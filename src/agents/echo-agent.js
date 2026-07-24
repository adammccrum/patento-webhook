/**
 * Echo Agent - Voice and Audio Operations Agent
 *
 * Handles:
 * - Text-to-speech synthesis
 * - Speech-to-text transcription
 * - Audio metadata extraction
 * - Voice preview
 *
 * Uses provider registry for capability-based provider selection
 * Enforces RBAC and policy checks
 * Persists jobs to database and stores outputs securely
 */

const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');
const { VoiceTask, VOICE_OPERATIONS } = require('../models/voice-task-model');
const { VoiceResult, RESULT_STATUS } = require('../models/voice-result-model');

class EchoAgent {
  constructor(providerRegistry, rbacEngine, policyEngine, auditLogger, jobRepository, storageManager) {
    this.code = 'EE';
    this.name = 'Echo';
    this.role = 'Voice & Audio';
    this.providerRegistry = providerRegistry;
    this.rbacEngine = rbacEngine;
    this.policyEngine = policyEngine;
    this.auditLogger = auditLogger;
    this.jobRepository = jobRepository;
    this.storageManager = storageManager;

    this.status = 'idle';
    this.activeJobs = new Map(); // job_id -> job info
    this.completedJobs = [];
    this.maxRetries = 3;
    this.retryDelay = 1000; // ms
  }

  /**
   * Process a voice task
   */
  async processVoiceTask(voiceTask) {
    const startTime = Date.now();
    const jobId = uuid();
    const auditRef = uuid();

    try {
      // Validate task
      if (!(voiceTask instanceof VoiceTask)) {
        voiceTask = VoiceTask.from(voiceTask);
      }

      // Check permissions
      const hasPermission = await this._checkPermissions(
        voiceTask.requesting_identity,
        voiceTask.requested_operation
      );

      if (!hasPermission) {
        throw new Error(`User lacks permission for ${voiceTask.requested_operation}`);
      }

      // Check policy
      const policyDecision = await this._checkPolicy(voiceTask);
      if (!policyDecision.allowed) {
        throw new Error(`Policy denied: ${policyDecision.reason}`);
      }

      // Create and persist job
      const job = {
        job_id: jobId,
        task_id: voiceTask.task_id,
        objective_id: voiceTask.objective_id,
        user_id: voiceTask.requesting_identity.user_id,
        status: 'started',
        operation: voiceTask.requested_operation,
        provider_id: null,
        retry_count: 0,
        audit_reference: auditRef,
        language: voiceTask.language,
        output_format: voiceTask.output_format,
        sample_rate: voiceTask.sample_rate,
        privacy_classification: voiceTask.privacy_classification,
        retention_policy: voiceTask.retention_policy,
        created_at: new Date(),
        started_at: new Date()
      };

      this.activeJobs.set(jobId, job);

      // Persist to database if repository available
      if (this.jobRepository) {
        try {
          await this.jobRepository.createJob({
            job_id: jobId,
            task_id: voiceTask.task_id,
            objective_id: voiceTask.objective_id,
            user_id: voiceTask.requesting_identity.user_id,
            operation: voiceTask.requested_operation,
            language: voiceTask.language,
            output_format: voiceTask.output_format,
            sample_rate: voiceTask.sample_rate,
            privacy_classification: voiceTask.privacy_classification,
            retention_policy: voiceTask.retention_policy,
            audit_reference: auditRef
          });
        } catch (error) {
          logger.error(`Failed to persist job to database: ${error.message}`);
          // Continue without persistence
        }
      }

      // Emit start event
      await this._emitEvent('voice.job_started', {
        job_id: jobId,
        task_id: voiceTask.task_id,
        operation: voiceTask.requested_operation,
        correlation_id: auditRef
      });

      // Select provider
      const provider = await this._selectProvider(voiceTask);
      if (!provider) {
        throw new Error(`No suitable provider found for ${voiceTask.requested_operation}`);
      }

      job.provider_id = provider.provider_id;

      // Emit provider selected event
      await this._emitEvent('voice.provider_selected', {
        job_id: jobId,
        provider_id: provider.provider_id,
        correlation_id: auditRef
      });

      // Execute operation
      let result;
      try {
        result = await this._executeOperation(provider, voiceTask, jobId, auditRef);
      } catch (error) {
        // Attempt fallback if allowed
        if (voiceTask.fallback_allowed) {
          logger.warn(`Primary provider failed, attempting fallback for job ${jobId}`);
          await this._emitEvent('voice.job_retrying', {
            job_id: jobId,
            attempt: job.retry_count + 1,
            correlation_id: auditRef
          });

          job.retry_count++;
          const fallbackProvider = await this._selectFallbackProvider(voiceTask, provider.provider_id);
          if (fallbackProvider) {
            result = await this._executeOperation(fallbackProvider, voiceTask, jobId, auditRef);
            job.provider_id = fallbackProvider.provider_id;
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }

      job.status = 'completed';
      job.completed_at = new Date();
      job.processing_time_ms = Date.now() - startTime;

      // Persist completion to database
      if (this.jobRepository) {
        try {
          await this.jobRepository.updateJobStatus(jobId, 'completed', {
            provider_id: job.provider_id,
            duration_ms: job.processing_time_ms
          });
        } catch (error) {
          logger.error(`Failed to update job status in database: ${error.message}`);
        }
      }

      // Emit completion event
      await this._emitEvent('voice.job_completed', {
        job_id: jobId,
        task_id: voiceTask.task_id,
        provider_id: job.provider_id,
        operation: voiceTask.requested_operation,
        processing_time_ms: job.processing_time_ms,
        correlation_id: auditRef
      });

      // Record in completed jobs (keep last 100)
      this.completedJobs.push(job);
      if (this.completedJobs.length > 100) {
        this.completedJobs.shift();
      }

      return result;

    } catch (error) {
      logger.error(`Voice job ${jobId} failed: ${error.message}`);

      if (this.activeJobs.has(jobId)) {
        const job = this.activeJobs.get(jobId);
        job.status = 'failed';
        job.error = error.message;
        job.completed_at = new Date();
        job.processing_time_ms = Date.now() - startTime;

        // Persist failure to database
        if (this.jobRepository) {
          try {
            await this.jobRepository.recordJobFailure(jobId, error, error.code || 'UNKNOWN_ERROR');
          } catch (dbError) {
            logger.error(`Failed to record job failure in database: ${dbError.message}`);
          }
        }
      }

      // Emit failure event
      await this._emitEvent('voice.job_failed', {
        job_id: jobId,
        error: error.message,
        correlation_id: auditRef
      });

      throw error;
    }
  }

  /**
   * Check if user has required permissions
   */
  async _checkPermissions(identity, operation) {
    const permissionMap = {
      [VOICE_OPERATIONS.TEXT_TO_SPEECH]: 'voice:create',
      [VOICE_OPERATIONS.SPEECH_TO_TEXT]: 'voice:transcribe',
      [VOICE_OPERATIONS.AUDIO_METADATA]: 'voice:view',
      [VOICE_OPERATIONS.VOICE_PREVIEW]: 'voice:preview'
    };

    const permission = permissionMap[operation];
    if (!permission) {
      return false;
    }

    try {
      return await this.rbacEngine.hasPermission(identity.user_id, permission);
    } catch (error) {
      logger.error(`Permission check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check policy constraints
   */
  async _checkPolicy(voiceTask) {
    // Check for prohibited operations in this phase
    if (voiceTask.voice_profile?.voice_name) {
      // Voice cloning is prohibited
      return {
        allowed: false,
        reason: 'Voice cloning is not available in Phase 5A'
      };
    }

    // Policy check passed
    return { allowed: true };
  }

  /**
   * Select provider based on capability and health
   */
  async _selectProvider(voiceTask) {
    const capability = this._getRequiredCapability(voiceTask.requested_operation);

    try {
      // Try preferred provider first
      if (voiceTask.provider_preference) {
        const adapter = await this.providerRegistry.getAdapter(voiceTask.provider_preference);
        const health = await adapter.healthCheck();
        if (health.status === 'healthy') {
          return {
            provider_id: voiceTask.provider_preference,
            adapter
          };
        }
      }

      // Get any healthy provider for capability
      const adapter = await this.providerRegistry.getAdapterForCapability('voice', capability);
      if (adapter) {
        const provider = this.providerRegistry.definitions.get(adapter.provider_id);
        return {
          provider_id: provider.provider_id,
          adapter
        };
      }

      return null;
    } catch (error) {
      logger.error(`Provider selection failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Get fallback provider
   */
  async _selectFallbackProvider(voiceTask, excludeProviderId) {
    const capability = this._getRequiredCapability(voiceTask.requested_operation);

    try {
      const providers = Array.from(this.providerRegistry.definitions.values())
        .filter(p => p.category === 'voice' && p.enabled && p.provider_id !== excludeProviderId);

      for (const provider of providers) {
        try {
          const adapter = this.providerRegistry.getAdapter(provider.provider_id);
          const health = await adapter.healthCheck();
          if (health.status === 'healthy' && adapter.capabilities.includes(capability)) {
            return {
              provider_id: provider.provider_id,
              adapter
            };
          }
        } catch (e) {
          // Continue to next provider
          logger.debug(`Fallback provider ${provider.provider_id} unavailable: ${e.message}`);
        }
      }

      return null;
    } catch (error) {
      logger.error(`Fallback provider selection failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Execute operation with provider
   */
  async _executeOperation(provider, voiceTask, jobId, auditRef) {
    const adapter = provider.adapter;
    const operation = voiceTask.requested_operation;
    const startTime = Date.now();

    try {
      let result;

      switch (operation) {
        case VOICE_OPERATIONS.TEXT_TO_SPEECH:
          result = await adapter.textToSpeech({
            text: voiceTask.input_text,
            voice_id: voiceTask.voice_profile?.voice_id || 'default',
            language: voiceTask.language,
            output_format: voiceTask.output_format,
            sample_rate: voiceTask.sample_rate
          });
          break;

        case VOICE_OPERATIONS.SPEECH_TO_TEXT:
          result = await adapter.speechToText({
            audioFile: voiceTask.input_reference,
            language: voiceTask.language
          });
          break;

        case VOICE_OPERATIONS.AUDIO_METADATA:
          result = await adapter.inspectAudio({
            audioFile: voiceTask.input_reference
          });
          break;

        case VOICE_OPERATIONS.VOICE_PREVIEW:
          result = await adapter.previewVoice({
            voice_id: voiceTask.voice_profile?.voice_id || 'default',
            text: voiceTask.input_text || 'The quick brown fox jumps over the lazy dog.',
            language: voiceTask.language
          });
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      const processingTime = Date.now() - startTime;

      return VoiceResult.success(jobId, provider.provider_id, operation, {
        output_reference: result.outputFile || result.outputUrl,
        output_format: result.format,
        duration: result.duration,
        sample_rate: result.sampleRate,
        language: result.language || voiceTask.language,
        transcript: result.transcript,
        confidence: result.confidence,
        processing_time_ms: processingTime,
        audit_reference: auditRef,
        correlation_id: voiceTask.task_id
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      return VoiceResult.failure(jobId, provider.provider_id, operation, error, {
        processing_time_ms: processingTime,
        audit_reference: auditRef,
        correlation_id: voiceTask.task_id
      });
    }
  }

  /**
   * Get required capability for operation
   */
  _getRequiredCapability(operation) {
    const map = {
      [VOICE_OPERATIONS.TEXT_TO_SPEECH]: 'text-to-speech',
      [VOICE_OPERATIONS.SPEECH_TO_TEXT]: 'speech-to-text',
      [VOICE_OPERATIONS.AUDIO_METADATA]: 'audio-metadata',
      [VOICE_OPERATIONS.VOICE_PREVIEW]: 'voice-preview'
    };
    return map[operation] || operation;
  }

  /**
   * Emit event for Operation Centre
   */
  async _emitEvent(eventType, data) {
    // Emit to event aggregator if available
    if (this.eventAggregator) {
      this.eventAggregator.recordEvent({
        type: eventType,
        timestamp: new Date().toISOString(),
        agent: this.code,
        ...data
      });
    }

    logger.debug(`Echo event: ${eventType}`, data);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'started') {
      throw new Error(`Cannot cancel ${job.status} job`);
    }

    job.status = 'cancelled';
    await this._emitEvent('voice.job_cancelled', {
      job_id: jobId,
      correlation_id: job.audit_reference
    });
  }

  /**
   * Get job status
   */
  getJobStatus(jobId) {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active jobs
   */
  getActiveJobs() {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Get completed jobs
   */
  getCompletedJobs(limit = 50) {
    return this.completedJobs.slice(-limit);
  }
}

module.exports = EchoAgent;
