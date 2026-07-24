/**
 * Voice Provider Adapter - Base interface for voice providers
 * All voice providers (TTS, STT, audio processing) implement this interface
 *
 * Providers are responsible for:
 * - Initialization and health checks
 * - Capability discovery
 * - Voice operations (TTS, STT, etc.)
 * - Resource cleanup
 * - Error handling and retries
 */

const logger = require('../../utils/logger');

/**
 * Base class for all voice providers
 */
class VoiceProviderAdapter {
  constructor(config = {}) {
    this.config = config;
    this.provider_id = config.provider_id || 'unknown';
    this.name = config.name || 'Unknown Voice Provider';
    this.execution_mode = config.execution_mode || 'local'; // 'local', 'network', or 'cloud'
    this.isInitialized = false;
    this.lastHealthCheck = null;
    this.capabilities = []; // Operations this provider supports
  }

  /**
   * Initialize the provider
   * Called once during activation
   */
  async initialize() {
    logger.info(`Initializing voice provider: ${this.name}`);
    this.isInitialized = true;
  }

  /**
   * Check if provider is installed (binary/executable available)
   */
  async isInstalled() {
    return true; // Override in subclass
  }

  /**
   * Check if provider is configured (credentials, paths, models available)
   */
  async isConfigured() {
    return this.isInitialized;
  }

  /**
   * Health check - verify provider is ready
   */
  async healthCheck() {
    this.lastHealthCheck = new Date();
    return {
      status: 'healthy',
      provider: this.provider_id,
      timestamp: this.lastHealthCheck.toISOString(),
      details: {}
    };
  }

  /**
   * List capabilities supported by this provider
   */
  async listCapabilities() {
    return this.capabilities;
  }

  /**
   * List available voices
   */
  async listVoices() {
    return [
      {
        id: 'default',
        name: 'Default Voice',
        language: 'en',
        gender: 'neutral',
        sample_rate: 24000
      }
    ];
  }

  /**
   * Text-to-Speech
   *
   * @param {Object} params
   * @param {string} params.text - Text to synthesize
   * @param {string} params.voice_id - Voice identifier
   * @param {string} params.language - Language code (e.g., 'en', 'es')
   * @param {string} params.output_format - Output format ('wav', 'mp3', 'flac')
   * @param {number} params.sample_rate - Sample rate in Hz
   * @returns {Object} { outputFile, duration, sampleRate, format, confidence }
   */
  async textToSpeech(params) {
    throw new Error(`${this.name} does not support text-to-speech`);
  }

  /**
   * Speech-to-Text
   *
   * @param {Object} params
   * @param {string} params.audioFile - Path to audio file
   * @param {string} params.language - Language code
   * @returns {Object} { transcript, confidence, language, duration }
   */
  async speechToText(params) {
    throw new Error(`${this.name} does not support speech-to-text`);
  }

  /**
   * Inspect audio metadata
   *
   * @param {Object} params
   * @param {string} params.audioFile - Path to audio file
   * @returns {Object} { duration, sampleRate, channels, format, codec }
   */
  async inspectAudio(params) {
    throw new Error(`${this.name} does not support audio inspection`);
  }

  /**
   * Preview a voice (generate sample speech)
   *
   * @param {Object} params
   * @param {string} params.voice_id - Voice identifier
   * @param {string} params.text - Sample text
   * @param {string} params.language - Language code
   * @returns {Object} { outputFile, duration }
   */
  async previewVoice(params) {
    throw new Error(`${this.name} does not support voice preview`);
  }

  /**
   * Cancel an ongoing job
   *
   * @param {string} jobId - Job identifier
   */
  async cancelJob(jobId) {
    logger.debug(`Cancel job ${jobId} - not implemented in ${this.name}`);
  }

  /**
   * Cleanup resources
   * Called when shutting down or on error
   */
  async cleanup() {
    logger.debug(`Cleaning up ${this.name}`);
  }

  /**
   * Shutdown the provider
   * Called on application shutdown
   */
  async shutdown() {
    await this.cleanup();
    this.isInitialized = false;
    logger.info(`Shut down voice provider: ${this.name}`);
  }

  /**
   * Validate text-to-speech parameters
   */
  validateTTSParams(params) {
    const errors = [];

    if (!params.text || typeof params.text !== 'string') {
      errors.push('text is required and must be a string');
    } else if (params.text.length === 0) {
      errors.push('text cannot be empty');
    } else if (params.text.length > 10000) {
      errors.push('text exceeds maximum length of 10000 characters');
    }

    if (!params.voice_id) {
      errors.push('voice_id is required');
    }

    if (!params.language) {
      errors.push('language is required');
    }

    if (!params.output_format) {
      errors.push('output_format is required');
    }

    if (params.sample_rate && typeof params.sample_rate !== 'number') {
      errors.push('sample_rate must be a number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate speech-to-text parameters
   */
  validateSTTParams(params) {
    const errors = [];

    if (!params.audioFile || typeof params.audioFile !== 'string') {
      errors.push('audioFile is required and must be a string');
    }

    if (!params.language) {
      errors.push('language is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize file path to prevent traversal attacks
   */
  sanitizeFilePath(filePath) {
    // Remove any .. or leading slashes
    return filePath.replace(/\.\./g, '').replace(/^\/+/, '');
  }
}

module.exports = VoiceProviderAdapter;
