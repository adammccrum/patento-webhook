/**
 * Whisper.cpp Voice Adapter
 * Local speech-to-text using whisper.cpp (https://github.com/ggerganov/whisper.cpp)
 *
 * Whisper.cpp is a lightweight, offline speech-to-text engine with multi-language support
 * Requires: whisper.cpp binary and model files
 *
 * Installation:
 *   1. Clone https://github.com/ggerganov/whisper.cpp
 *   2. Build the main executable
 *   3. Download model files
 *   4. Set WHISPER_BIN_PATH and WHISPER_MODELS_DIR environment variables
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuid } = require('uuid');
const logger = require('../../../utils/logger');
const VoiceProviderAdapter = require('../voice-provider-adapter');

const WHISPER_BIN_PATH = process.env.WHISPER_BIN_PATH || '/usr/bin/whisper';
const WHISPER_MODELS_DIR = process.env.WHISPER_MODELS_DIR || './whisper-models';
const WHISPER_OUTPUT_DIR = process.env.WHISPER_OUTPUT_DIR || './whisper-outputs';

// Whisper model sizes and their characteristics
const WHISPER_MODELS = {
  'tiny': { name: 'Tiny', vram: 1, speed: 'very fast', accuracy: 'low' },
  'base': { name: 'Base', vram: 1, speed: 'fast', accuracy: 'low-medium' },
  'small': { name: 'Small', vram: 2, speed: 'medium', accuracy: 'medium' },
  'medium': { name: 'Medium', vram: 5, speed: 'slow', accuracy: 'medium-high' },
  'large': { name: 'Large', vram: 10, speed: 'very slow', accuracy: 'high' }
};

// Supported languages for transcription
const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'nl': 'Dutch',
  'ru': 'Russian',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ar': 'Arabic'
};

class WhisperAdapter extends VoiceProviderAdapter {
  constructor(modelSize = 'base') {
    super('whisper-cpp', `Whisper.cpp (${modelSize})`, 'local');
    this.modelSize = modelSize;
    this.capabilities = ['speech-to-text', 'audio-metadata'];
    this.activeJobs = new Map();
  }

  /**
   * Initialize Whisper adapter
   */
  async initialize() {
    try {
      // Check if Whisper binary exists
      try {
        await fs.access(WHISPER_BIN_PATH);
      } catch {
        this.installed = false;
        this.health_status = 'not_installed';
        logger.warn(`Whisper binary not found at ${WHISPER_BIN_PATH}. Install whisper.cpp to enable local STT.`);
        return;
      }

      // Check if model exists
      const modelFile = path.join(WHISPER_MODELS_DIR, `ggml-${this.modelSize}.bin`);
      try {
        await fs.access(modelFile);
      } catch {
        this.configured = false;
        this.health_status = 'misconfigured';
        logger.warn(`Whisper model not found at ${modelFile}. Download model to enable STT.`);
        return;
      }

      // Create output directory
      await fs.mkdir(WHISPER_OUTPUT_DIR, { recursive: true });

      this.installed = true;
      this.configured = true;
      this.health_status = 'healthy';
      logger.info(`Whisper adapter (${this.modelSize}) initialized successfully`);
    } catch (error) {
      logger.error(`Failed to initialize Whisper adapter: ${error.message}`);
      this.health_status = 'error';
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.installed) {
        return {
          status: 'unavailable',
          message: 'Whisper binary not installed'
        };
      }

      if (!this.configured) {
        return {
          status: 'degraded',
          message: `Model ${this.modelSize} not configured`
        };
      }

      // Try to run whisper with --help
      return await new Promise((resolve) => {
        const child = spawn(WHISPER_BIN_PATH, ['-h'], { timeout: 5000 });
        let timedOut = false;

        const timeout = setTimeout(() => {
          timedOut = true;
          child.kill();
        }, 5000);

        child.on('exit', (code) => {
          clearTimeout(timeout);
          if (timedOut) {
            resolve({ status: 'degraded', message: 'Health check timed out' });
          } else {
            resolve({ status: 'healthy' });
          }
        });

        child.on('error', () => {
          clearTimeout(timeout);
          resolve({ status: 'unhealthy', message: 'Failed to execute Whisper' });
        });
      });
    } catch (error) {
      logger.error(`Health check failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * List capabilities
   */
  async listCapabilities() {
    return [
      {
        name: 'speech-to-text',
        description: 'Transcribe audio to text',
        languages: Object.keys(SUPPORTED_LANGUAGES),
        formats: ['wav', 'mp3', 'flac', 'ogg']
      },
      {
        name: 'audio-metadata',
        description: 'Extract audio metadata',
        formats: ['wav', 'mp3', 'flac', 'ogg']
      }
    ];
  }

  /**
   * Speech-to-text transcription
   */
  async speechToText(params) {
    if (!this.installed) {
      throw new Error('Whisper not installed');
    }

    if (!this.configured) {
      throw new Error(`Whisper model ${this.modelSize} not configured`);
    }

    try {
      this.validateSpeechToTextParams(params);

      const audioFile = this.sanitizePath(params.audioFile);
      const language = params.language || 'en';

      // Validate language is supported
      if (!SUPPORTED_LANGUAGES[language]) {
        logger.warn(`Language ${language} requested, using English instead`);
      }

      const jobId = uuid();
      const outputFile = path.join(WHISPER_OUTPUT_DIR, `stt-${jobId}.json`);

      return await this._transcribeWithWhisper(audioFile, language, outputFile);
    } catch (error) {
      logger.error(`Whisper STT failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inspect audio metadata
   */
  async inspectAudio(params) {
    try {
      this.validateAudioInspectionParams(params);

      const audioFile = this.sanitizePath(params.audioFile);

      // Check file exists and is readable
      await fs.access(audioFile);
      const stats = await fs.stat(audioFile);

      return {
        file: audioFile,
        size: stats.size,
        modified: stats.mtime,
        // Note: Full metadata parsing would require additional audio libraries
        format: this._guessFormatFromExtension(audioFile),
        duration: 0 // Would need to parse audio header
      };
    } catch (error) {
      logger.error(`Audio inspection failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel job (placeholder - Whisper runs synchronously)
   */
  async cancelJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job && job.process) {
      job.process.kill();
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Cleanup
   */
  async cleanup() {
    try {
      // Clean up old output files (older than 1 hour)
      const files = await fs.readdir(WHISPER_OUTPUT_DIR);
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 hour

      for (const file of files) {
        const filePath = path.join(WHISPER_OUTPUT_DIR, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      logger.warn(`Whisper cleanup failed: ${error.message}`);
    }
  }

  /**
   * Shutdown
   */
  async shutdown() {
    try {
      await this.cleanup();
      logger.info('Whisper adapter shutdown complete');
    } catch (error) {
      logger.error(`Whisper shutdown failed: ${error.message}`);
    }
  }

  // Private methods

  /**
   * Transcribe audio using Whisper
   */
  async _transcribeWithWhisper(audioFile, language, outputFile) {
    return new Promise((resolve, reject) => {
      const modelPath = path.join(WHISPER_MODELS_DIR, `ggml-${this.modelSize}.bin`);

      const args = [
        '-m', modelPath,
        '-l', language,
        '-ojson',
        '-of', path.join(WHISPER_OUTPUT_DIR, `stt-${uuid()}`),
        audioFile
      ];

      const child = spawn(WHISPER_BIN_PATH, args, {
        timeout: 120000 // 2 minutes for transcription
      });

      let stderr = '';
      let stdout = '';

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.on('error', (error) => {
        reject(new Error(`Whisper execution error: ${error.message}`));
      });

      child.on('exit', async (code) => {
        if (code !== 0) {
          reject(new Error(`Whisper failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Read output JSON
          const outputPath = path.join(WHISPER_OUTPUT_DIR, `stt-${uuid()}.json`);
          const transcription = await this._parseWhisperOutput(outputPath);

          resolve({
            transcript: transcription.text,
            confidence: transcription.confidence || 0.85,
            language: language,
            duration: transcription.duration || 0
          });
        } catch (error) {
          reject(new Error(`Failed to parse Whisper output: ${error.message}`));
        }
      });
    });
  }

  /**
   * Parse Whisper JSON output
   */
  async _parseWhisperOutput(jsonFile) {
    try {
      const content = await fs.readFile(jsonFile, 'utf-8');
      const data = JSON.parse(content);

      return {
        text: data.result?.[0]?.text || '',
        confidence: data.result?.[0]?.confidence || 0.85,
        duration: data.result?.[0]?.timestamps?.end || 0
      };
    } catch (error) {
      logger.error(`Failed to parse Whisper output: ${error.message}`);
      return {
        text: '',
        confidence: 0,
        duration: 0
      };
    }
  }

  /**
   * Guess audio format from file extension
   */
  _guessFormatFromExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const formats = ['wav', 'mp3', 'flac', 'ogg', 'pcm'];
    return formats.includes(ext) ? ext : 'unknown';
  }
}

module.exports = WhisperAdapter;
