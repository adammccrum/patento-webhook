/**
 * Mock Voice Provider - For testing and development
 * Simulates TTS, STT, and audio operations without external dependencies
 */

const VoiceProviderAdapter = require('../voice-provider-adapter');
const { v4: uuid } = require('uuid');
const path = require('path');
const logger = require('../../../utils/logger');

class MockVoiceAdapter extends VoiceProviderAdapter {
  constructor(config = {}) {
    super({
      provider_id: 'mock-voice',
      name: 'Mock Voice Provider',
      execution_mode: 'mock',
      ...config
    });

    this.capabilities = [
      'text-to-speech',
      'speech-to-text',
      'audio-metadata',
      'voice-preview',
      'job-cancellation'
    ];

    this.activeJobs = new Map();
    this.mockVoices = [
      { id: 'alice', name: 'Alice', language: 'en', gender: 'female', sample_rate: 24000 },
      { id: 'bob', name: 'Bob', language: 'en', gender: 'male', sample_rate: 24000 },
      { id: 'charlie', name: 'Charlie', language: 'en', gender: 'neutral', sample_rate: 24000 }
    ];
  }

  async initialize() {
    await super.initialize();
    logger.info('Mock voice provider initialized for testing');
  }

  async isInstalled() {
    return true; // Always available
  }

  async isConfigured() {
    return true;
  }

  async healthCheck() {
    this.lastHealthCheck = new Date();
    return {
      status: 'healthy',
      provider: this.provider_id,
      timestamp: this.lastHealthCheck.toISOString(),
      details: {
        mode: 'mock',
        activeJobs: this.activeJobs.size
      }
    };
  }

  async listCapabilities() {
    return this.capabilities;
  }

  async listVoices() {
    return this.mockVoices;
  }

  async textToSpeech(params) {
    const validation = this.validateTTSParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid TTS parameters: ${validation.errors.join(', ')}`);
    }

    const jobId = uuid();
    const duration = Math.ceil(params.text.length / 140); // Rough estimate: ~140 chars per second

    // Simulate async processing
    const result = {
      jobId,
      outputFile: `mock-tts-${jobId}.wav`,
      duration,
      sampleRate: params.sample_rate || 24000,
      format: params.output_format || 'wav',
      confidence: 0.99,
      processingTime: Math.random() * 1000 + 100
    };

    // Track job
    this.activeJobs.set(jobId, {
      type: 'tts',
      status: 'completed',
      result
    });

    logger.debug(`Mock TTS job ${jobId}: "${params.text.substring(0, 50)}..." → ${result.outputFile}`);
    return result;
  }

  async speechToText(params) {
    const validation = this.validateSTTParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid STT parameters: ${validation.errors.join(', ')}`);
    }

    const jobId = uuid();
    const mockTranscript = 'This is a mock transcription of the audio file.';

    const result = {
      jobId,
      transcript: mockTranscript,
      confidence: 0.95,
      language: params.language || 'en',
      duration: 5.2,
      processingTime: Math.random() * 2000 + 500
    };

    this.activeJobs.set(jobId, {
      type: 'stt',
      status: 'completed',
      result
    });

    logger.debug(`Mock STT job ${jobId}: "${params.audioFile}" → "${mockTranscript}"`);
    return result;
  }

  async inspectAudio(params) {
    if (!params.audioFile) {
      throw new Error('audioFile parameter is required');
    }

    const mockMetadata = {
      filename: path.basename(params.audioFile),
      duration: 5.5,
      sampleRate: 16000,
      channels: 1,
      format: 'wav',
      codec: 'PCM',
      bitRate: 256000,
      fileSize: 447000
    };

    logger.debug(`Mock audio inspect: ${params.audioFile}`);
    return mockMetadata;
  }

  async previewVoice(params) {
    if (!params.voice_id || !params.text) {
      throw new Error('voice_id and text are required for voice preview');
    }

    const voice = this.mockVoices.find(v => v.id === params.voice_id);
    if (!voice) {
      throw new Error(`Voice ${params.voice_id} not found`);
    }

    const jobId = uuid();
    const duration = Math.ceil(params.text.length / 140);

    const result = {
      jobId,
      voice: voice.name,
      outputFile: `mock-preview-${jobId}.wav`,
      duration,
      sampleRate: 24000,
      format: 'wav',
      text: params.text
    };

    logger.debug(`Mock voice preview ${jobId}: "${voice.name}" says "${params.text.substring(0, 30)}..."`);
    return result;
  }

  async cancelJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === 'completed' || job.status === 'failed') {
      throw new Error(`Cannot cancel ${job.status} job`);
    }

    job.status = 'cancelled';
    logger.debug(`Mock job ${jobId} cancelled`);
  }

  async cleanup() {
    this.activeJobs.clear();
    await super.cleanup();
  }

  /**
   * Get job status (for testing)
   */
  getJobStatus(jobId) {
    const job = this.activeJobs.get(jobId);
    return job || null;
  }
}

module.exports = MockVoiceAdapter;
