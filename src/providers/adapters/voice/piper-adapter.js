/**
 * Piper Voice Adapter
 * Local text-to-speech using Piper (https://github.com/rhasspy/piper)
 *
 * Piper is lightweight, offline TTS with support for multiple languages and voices
 * Requires: piper binary and voice models
 *
 * Installation:
 *   1. Download Piper from https://github.com/rhasspy/piper/releases
 *   2. Place binary at PIPER_BIN_PATH environment variable
 *   3. Download voice models to PIPER_MODELS_DIR
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuid } = require('uuid');
const logger = require('../../../utils/logger');
const VoiceProviderAdapter = require('../voice-provider-adapter');

const PIPER_BIN_PATH = process.env.PIPER_BIN_PATH || '/usr/bin/piper';
const PIPER_MODELS_DIR = process.env.PIPER_MODELS_DIR || './piper-models';
const PIPER_OUTPUT_DIR = process.env.PIPER_OUTPUT_DIR || './piper-outputs';

// Supported voices and their properties
const PIPER_VOICES = {
  'en-us-amy-medium': {
    name: 'Amy',
    language: 'en',
    gender: 'female',
    sample_rate: 22050,
    model_path: 'en/en_US/amy/medium.onnx'
  },
  'en-us-john-medium': {
    name: 'John',
    language: 'en',
    gender: 'male',
    sample_rate: 22050,
    model_path: 'en/en_US/john/medium.onnx'
  },
  'en-gb-alan-medium': {
    name: 'Alan',
    language: 'en-GB',
    gender: 'male',
    sample_rate: 22050,
    model_path: 'en/en_GB/alan/medium.onnx'
  },
  'es-es-davefx-medium': {
    name: 'Dave',
    language: 'es',
    gender: 'male',
    sample_rate: 22050,
    model_path: 'es/es_ES/davefx/medium.onnx'
  },
  'fr-fr-siwis-medium': {
    name: 'Siwis',
    language: 'fr',
    gender: 'female',
    sample_rate: 22050,
    model_path: 'fr/fr_FR/siwis/medium.onnx'
  }
};

class PiperAdapter extends VoiceProviderAdapter {
  constructor() {
    super('piper', 'Piper', 'local');
    this.capabilities = ['text-to-speech', 'voice-preview'];
    this.activeJobs = new Map();
  }

  /**
   * Initialize Piper adapter
   */
  async initialize() {
    try {
      // Check if Piper binary exists
      try {
        await fs.access(PIPER_BIN_PATH);
      } catch {
        this.installed = false;
        this.health_status = 'not_installed';
        logger.warn(`Piper binary not found at ${PIPER_BIN_PATH}. Install Piper to enable local TTS.`);
        return;
      }

      // Create output directory
      await fs.mkdir(PIPER_OUTPUT_DIR, { recursive: true });

      this.installed = true;
      this.configured = true;
      this.health_status = 'healthy';
      logger.info('Piper adapter initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize Piper adapter: ${error.message}`);
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
          message: 'Piper binary not installed'
        };
      }

      // Try to run piper with --help
      return await new Promise((resolve) => {
        const child = spawn(PIPER_BIN_PATH, ['--help'], { timeout: 5000 });
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
          resolve({ status: 'unhealthy', message: 'Failed to execute Piper' });
        });
      });
    } catch (error) {
      logger.error(`Health check failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * List available voices
   */
  async listVoices() {
    return Object.entries(PIPER_VOICES).map(([voiceId, voice]) => ({
      voice_id: voiceId,
      name: voice.name,
      language: voice.language,
      gender: voice.gender,
      sample_rate: voice.sample_rate
    }));
  }

  /**
   * Text-to-speech synthesis
   */
  async textToSpeech(params) {
    if (!this.installed) {
      throw new Error('Piper not installed');
    }

    try {
      this.validateTextToSpeechParams(params);

      const voiceId = params.voice_id || 'en-us-amy-medium';
      const voiceConfig = PIPER_VOICES[voiceId];

      if (!voiceConfig) {
        throw new Error(`Voice not found: ${voiceId}`);
      }

      const jobId = uuid();
      const outputFile = path.join(PIPER_OUTPUT_DIR, `tts-${jobId}.wav`);

      return await this._synthesizeWithPiper(
        params.text,
        voiceConfig,
        outputFile,
        params.output_format,
        params.sample_rate
      );
    } catch (error) {
      logger.error(`Piper TTS failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Preview a voice
   */
  async previewVoice(params) {
    if (!this.installed) {
      throw new Error('Piper not installed');
    }

    try {
      this.validatePreviewVoiceParams(params);

      const voiceId = params.voice_id || 'en-us-amy-medium';
      const voiceConfig = PIPER_VOICES[voiceId];

      if (!voiceConfig) {
        throw new Error(`Voice not found: ${voiceId}`);
      }

      const previewText = params.text || 'The quick brown fox jumps over the lazy dog.';
      const jobId = uuid();
      const outputFile = path.join(PIPER_OUTPUT_DIR, `preview-${jobId}.wav`);

      return await this._synthesizeWithPiper(previewText, voiceConfig, outputFile, 'wav');
    } catch (error) {
      logger.error(`Piper preview failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel job (placeholder - Piper runs synchronously)
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
      const files = await fs.readdir(PIPER_OUTPUT_DIR);
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 hour

      for (const file of files) {
        const filePath = path.join(PIPER_OUTPUT_DIR, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      logger.warn(`Piper cleanup failed: ${error.message}`);
    }
  }

  /**
   * Shutdown
   */
  async shutdown() {
    try {
      await this.cleanup();
      logger.info('Piper adapter shutdown complete');
    } catch (error) {
      logger.error(`Piper shutdown failed: ${error.message}`);
    }
  }

  // Private methods

  /**
   * Synthesize text using Piper
   */
  async _synthesizeWithPiper(text, voiceConfig, outputFile, outputFormat = 'wav', sampleRate = null) {
    return new Promise((resolve, reject) => {
      const modelPath = path.join(PIPER_MODELS_DIR, voiceConfig.model_path);

      // Piper command: echo "text" | piper --model model.onnx --output_file output.wav
      const args = [
        '--model', modelPath,
        '--output_file', outputFile
      ];

      if (sampleRate) {
        args.push('--speaker', '0');
      }

      const child = spawn(PIPER_BIN_PATH, args, {
        timeout: 30000
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
        reject(new Error(`Piper execution error: ${error.message}`));
      });

      child.on('exit', async (code) => {
        if (code !== 0) {
          reject(new Error(`Piper failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const stats = await fs.stat(outputFile);
          resolve({
            outputFile,
            outputUrl: null,
            format: outputFormat || 'wav',
            duration: 0, // Would need to parse WAV header
            sampleRate: voiceConfig.sample_rate,
            language: voiceConfig.language
          });
        } catch (error) {
          reject(new Error(`Failed to verify output file: ${error.message}`));
        }
      });

      // Send text to Piper stdin
      child.stdin.write(text);
      child.stdin.end();
    });
  }
}

module.exports = PiperAdapter;
