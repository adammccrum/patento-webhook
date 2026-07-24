/**
 * Voice API Routes - Echo agent endpoints
 * Handles TTS, STT, voice preview, and audio operations
 *
 * All routes require authentication and RBAC enforcement
 */

const express = require('express');
const { v4: uuid } = require('uuid');
const Joi = require('joi');
const logger = require('../../utils/logger');
const { requirePermission } = require('../../middleware/permission-middleware');
const { validateRequestBody, validateRequestParams } = require('../../middleware/validation-middleware');
const { VoiceTask, VOICE_OPERATIONS, INPUT_TYPES } = require('../../models/voice-task-model');

module.exports = (echoAgent, operationCentre, rbacEngine) => {
  const router = express.Router();

  /**
   * POST /voice/text-to-speech
   * Create a text-to-speech job
   */
  router.post('/text-to-speech',
    requirePermission('voice:create'),
    validateRequestBody(
      Joi.object({
        text: Joi.string().max(10000).required(),
        language: Joi.string().pattern(/^[a-z]{2}(-[A-Z]{2})?$/).required(),
        voice_id: Joi.string().optional(),
        output_format: Joi.string().valid('wav', 'mp3', 'flac').optional(),
        sample_rate: Joi.number().valid(8000, 16000, 24000, 44100, 48000).optional(),
        provider_preference: Joi.string().optional(),
        privacy_classification: Joi.string().valid('public', 'internal', 'confidential', 'sensitive').optional()
      })
    ),
    async (req, res) => {
      try {
        const voiceTask = VoiceTask.from({
          task_id: uuid(),
          objective_id: req.body.objective_id || uuid(),
          requesting_identity: {
            user_id: req.user.id,
            email: req.user.email,
            roles: ['user']
          },
          requested_operation: VOICE_OPERATIONS.TEXT_TO_SPEECH,
          input_type: INPUT_TYPES.TEXT,
          input_reference: '',
          input_text: req.body.text,
          language: req.body.language,
          voice_profile: {
            voice_id: req.body.voice_id || 'default',
            sample_rate: req.body.sample_rate || 24000
          },
          output_format: req.body.output_format || 'wav',
          sample_rate: req.body.sample_rate || 24000,
          provider_preference: req.body.provider_preference,
          fallback_allowed: true,
          privacy_classification: req.body.privacy_classification || 'internal',
          retention_policy: {
            duration_days: 30,
            auto_delete: true
          }
        });

        const result = await echoAgent.processVoiceTask(voiceTask);

        res.json({
          status: 'success',
          job_id: result.job_id,
          operation: result.operation,
          output_reference: result.output_reference,
          output_format: result.output_format,
          duration: result.duration,
          processing_time_ms: result.processing_time_ms,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`TTS job creation failed: ${error.message}`);
        res.status(400).json({
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * POST /voice/speech-to-text
   * Create a speech-to-text job
   */
  router.post('/speech-to-text',
    requirePermission('voice:transcribe'),
    validateRequestBody(
      Joi.object({
        audio_file: Joi.string().required(),
        language: Joi.string().pattern(/^[a-z]{2}(-[A-Z]{2})?$/).required(),
        provider_preference: Joi.string().optional(),
        privacy_classification: Joi.string().valid('public', 'internal', 'confidential', 'sensitive').optional()
      })
    ),
    async (req, res) => {
      try {
        const voiceTask = VoiceTask.from({
          task_id: uuid(),
          objective_id: req.body.objective_id || uuid(),
          requesting_identity: {
            user_id: req.user.id,
            email: req.user.email,
            roles: ['user']
          },
          requested_operation: VOICE_OPERATIONS.SPEECH_TO_TEXT,
          input_type: INPUT_TYPES.AUDIO_FILE,
          input_reference: req.body.audio_file,
          language: req.body.language,
          provider_preference: req.body.provider_preference,
          fallback_allowed: true,
          privacy_classification: req.body.privacy_classification || 'internal',
          retention_policy: {
            duration_days: 30,
            auto_delete: true
          }
        });

        const result = await echoAgent.processVoiceTask(voiceTask);

        res.json({
          status: 'success',
          job_id: result.job_id,
          operation: result.operation,
          transcript: result.transcript,
          confidence: result.confidence,
          language: result.language,
          processing_time_ms: result.processing_time_ms,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`STT job creation failed: ${error.message}`);
        res.status(400).json({
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * POST /voice/preview
   * Preview a synthetic voice
   */
  router.post('/preview',
    requirePermission('voice:preview'),
    validateRequestBody(
      Joi.object({
        voice_id: Joi.string().required(),
        text: Joi.string().max(500).optional(),
        language: Joi.string().pattern(/^[a-z]{2}(-[A-Z]{2})?$/).optional()
      })
    ),
    async (req, res) => {
      try {
        const voiceTask = VoiceTask.from({
          task_id: uuid(),
          objective_id: uuid(),
          requesting_identity: {
            user_id: req.user.id,
            email: req.user.email,
            roles: ['user']
          },
          requested_operation: VOICE_OPERATIONS.VOICE_PREVIEW,
          input_type: INPUT_TYPES.TEXT,
          input_reference: '',
          input_text: req.body.text || 'The quick brown fox jumps over the lazy dog.',
          language: req.body.language || 'en',
          voice_profile: {
            voice_id: req.body.voice_id
          },
          fallback_allowed: true,
          privacy_classification: 'public',
          retention_policy: {
            duration_days: 1,
            auto_delete: true
          }
        });

        const result = await echoAgent.processVoiceTask(voiceTask);

        res.json({
          status: 'success',
          voice_id: req.body.voice_id,
          output_reference: result.output_reference,
          duration: result.duration,
          processing_time_ms: result.processing_time_ms,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Voice preview failed: ${error.message}`);
        res.status(400).json({
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /voice/providers
   * List available voice providers
   */
  router.get('/providers',
    requirePermission('voice:view'),
    async (req, res) => {
      try {
        const providers = Array.from(operationCentre.providerRegistry.definitions.values())
          .filter(p => p.category === 'voice')
          .map(p => ({
            provider_id: p.provider_id,
            name: p.name,
            execution_mode: p.execution_mode,
            enabled: p.enabled,
            installed: p.installed,
            configured: p.configured,
            health_status: p.health_status,
            last_tested: p.last_tested,
            licence: p.licence
          }));

        res.json({
          providers,
          total: providers.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Provider list failed: ${error.message}`);
        res.status(500).json({
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /voice/providers/:provider_id
   * Get provider details and capabilities
   */
  router.get('/providers/:provider_id',
    requirePermission('voice:view'),
    async (req, res) => {
      try {
        const provider = operationCentre.providerRegistry.definitions.get(req.params.provider_id);
        if (!provider) {
          return res.status(404).json({
            error: `Provider ${req.params.provider_id} not found`,
            timestamp: new Date().toISOString()
          });
        }

        const adapter = operationCentre.providerRegistry.adapters.get(provider.provider_id);
        const capabilities = adapter ? await adapter.listCapabilities() : [];
        const voices = adapter ? await adapter.listVoices() : [];

        res.json({
          provider: {
            provider_id: provider.provider_id,
            name: provider.name,
            execution_mode: provider.execution_mode,
            enabled: provider.enabled,
            installed: provider.installed,
            configured: provider.configured,
            health_status: provider.health_status,
            licence: provider.licence,
            repository: provider.repository
          },
          capabilities,
          voices,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Provider details failed: ${error.message}`);
        res.status(500).json({
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /voice/jobs
   * List active and completed voice jobs
   */
  router.get('/jobs',
    requirePermission('voice:view'),
    async (req, res) => {
      try {
        const activeJobs = echoAgent.getActiveJobs();
        const completedJobs = echoAgent.getCompletedJobs(50);

        res.json({
          active_jobs: activeJobs.length,
          active: activeJobs.map(j => ({
            job_id: j.job_id,
            status: j.status,
            operation: j.operation,
            provider_id: j.provider_id,
            created_at: j.created_at
          })),
          completed: completedJobs.slice(-10).map(j => ({
            job_id: j.job_id,
            status: j.status,
            operation: j.operation,
            provider_id: j.provider_id,
            processing_time_ms: j.processing_time_ms,
            completed_at: j.completed_at
          })),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Job listing failed: ${error.message}`);
        res.status(500).json({
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /voice/jobs/:job_id
   * Get voice job status
   */
  router.get('/jobs/:job_id',
    requirePermission('voice:view'),
    async (req, res) => {
      try {
        const job = echoAgent.getJobStatus(req.params.job_id);
        if (!job) {
          return res.status(404).json({
            error: `Job ${req.params.job_id} not found`,
            timestamp: new Date().toISOString()
          });
        }

        res.json({
          job_id: job.job_id,
          status: job.status,
          operation: job.operation,
          provider_id: job.provider_id,
          retry_count: job.retry_count,
          created_at: job.created_at,
          started_at: job.started_at,
          completed_at: job.completed_at,
          processing_time_ms: job.processing_time_ms,
          error: job.error,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Job status failed: ${error.message}`);
        res.status(500).json({
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * POST /voice/jobs/:job_id/cancel
   * Cancel a voice job
   */
  router.post('/jobs/:job_id/cancel',
    requirePermission('voice:cancel'),
    async (req, res) => {
      try {
        await echoAgent.cancelJob(req.params.job_id);
        res.json({
          status: 'cancelled',
          job_id: req.params.job_id,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Job cancellation failed: ${error.message}`);
        res.status(400).json({
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /voice/health
   * Check Echo agent health and provider status
   */
  router.get('/health',
    async (req, res) => {
      try {
        const providers = Array.from(operationCentre.providerRegistry.definitions.values())
          .filter(p => p.category === 'voice' && p.enabled);

        const providerStatus = {};
        for (const provider of providers) {
          try {
            const adapter = operationCentre.providerRegistry.adapters.get(provider.provider_id);
            if (adapter) {
              const health = await adapter.healthCheck();
              providerStatus[provider.provider_id] = health.status;
            } else {
              providerStatus[provider.provider_id] = 'not_initialized';
            }
          } catch (error) {
            providerStatus[provider.provider_id] = 'error';
          }
        }

        res.json({
          agent: 'Echo',
          status: 'operational',
          active_jobs: echoAgent.getActiveJobs().length,
          providers: providerStatus,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Echo health check failed: ${error.message}`);
        res.status(500).json({
          agent: 'Echo',
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  return router;
};
