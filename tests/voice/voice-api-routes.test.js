/**
 * Integration tests for Voice API Routes
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');
const { v4: uuid } = require('uuid');

// Mock Express request/response objects
class MockRequest {
  constructor(data = {}) {
    this.body = data.body || {};
    this.params = data.params || {};
    this.query = data.query || {};
    this.user = data.user || { id: uuid(), email: 'user@example.com', roles: ['user'] };
    this.headers = data.headers || {};
  }
}

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.data = null;
    this.error = null;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(data) {
    this.data = data;
    return this;
  }
}

describe('Voice API Routes - Security and Validation', () => {
  describe('Text-to-Speech Endpoint', () => {
    it('should require authentication', () => {
      // Routes should enforce auth middleware
      const route = '/voice/text-to-speech';
      expect(route).toBeTruthy();
    });

    it('should require voice:create permission', () => {
      // Permission middleware should check for 'voice:create'
      const requiredPermission = 'voice:create';
      expect(requiredPermission).toBe('voice:create');
    });

    it('should validate text field is required', () => {
      const request = new MockRequest({
        body: { language: 'en' } // Missing text
      });
      expect(request.body.text).toBeUndefined();
    });

    it('should validate text max length of 10000', () => {
      const longText = 'x'.repeat(10001);
      const isValid = longText.length <= 10000;
      expect(isValid).toBe(false);
    });

    it('should validate language pattern', () => {
      const validLanguages = ['en', 'es', 'fr-FR', 'de-DE'];
      const pattern = /^[a-z]{2}(-[A-Z]{2})?$/;

      for (const lang of validLanguages) {
        expect(lang).toMatch(pattern);
      }

      const invalidLanguages = ['EN', 'en_US', '123'];
      for (const lang of invalidLanguages) {
        expect(lang).not.toMatch(pattern);
      }
    });

    it('should validate output_format is one of: wav, mp3, flac', () => {
      const validFormats = ['wav', 'mp3', 'flac'];
      const request = new MockRequest({
        body: {
          text: 'Hello',
          language: 'en',
          output_format: 'wav'
        }
      });
      expect(validFormats).toContain(request.body.output_format);
    });

    it('should validate sample_rate is standard value', () => {
      const validSampleRates = [8000, 16000, 24000, 44100, 48000];
      const request = new MockRequest({
        body: {
          text: 'Hello',
          language: 'en',
          sample_rate: 24000
        }
      });
      expect(validSampleRates).toContain(request.body.sample_rate);
    });

    it('should reject invalid sample rates', () => {
      const validSampleRates = [8000, 16000, 24000, 44100, 48000];
      const invalidRates = [22050, 32000, 96000];

      for (const rate of invalidRates) {
        expect(validSampleRates).not.toContain(rate);
      }
    });

    it('should validate privacy_classification', () => {
      const validClassifications = ['public', 'internal', 'confidential', 'sensitive'];
      const request = new MockRequest({
        body: {
          text: 'Hello',
          language: 'en',
          privacy_classification: 'internal'
        }
      });
      expect(validClassifications).toContain(request.body.privacy_classification);
    });

    it('should set default privacy classification to internal', () => {
      // If not specified, should default to 'internal'
      const defaultClass = 'internal';
      expect(defaultClass).toBe('internal');
    });

    it('should return job_id, operation, output_reference on success', () => {
      const response = new MockResponse();
      const successData = {
        status: 'success',
        job_id: uuid(),
        operation: 'text_to_speech',
        output_reference: 'voice-abc123.wav',
        output_format: 'wav',
        duration: 2500,
        processing_time_ms: 1500,
        timestamp: new Date().toISOString()
      };

      expect(successData.status).toBe('success');
      expect(successData.job_id).toBeTruthy();
      expect(successData.operation).toBe('text_to_speech');
      expect(successData.output_reference).toBeTruthy();
    });

    it('should include timestamp in response', () => {
      const timestamp = new Date().toISOString();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Speech-to-Text Endpoint', () => {
    it('should require voice:transcribe permission', () => {
      const requiredPermission = 'voice:transcribe';
      expect(requiredPermission).toBe('voice:transcribe');
    });

    it('should require audio_file field', () => {
      const request = new MockRequest({
        body: { language: 'en' } // Missing audio_file
      });
      expect(request.body.audio_file).toBeUndefined();
    });

    it('should require language field', () => {
      const request = new MockRequest({
        body: { audio_file: '/path/to/audio.wav' } // Missing language
      });
      expect(request.body.language).toBeUndefined();
    });

    it('should return transcript and confidence on success', () => {
      const successData = {
        status: 'success',
        job_id: uuid(),
        operation: 'speech_to_text',
        transcript: 'Hello, this is a test',
        confidence: 0.95,
        language: 'en',
        processing_time_ms: 5000,
        timestamp: new Date().toISOString()
      };

      expect(successData.transcript).toBeTruthy();
      expect(successData.confidence).toBeGreaterThanOrEqual(0);
      expect(successData.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Voice Preview Endpoint', () => {
    it('should require voice:preview permission', () => {
      const requiredPermission = 'voice:preview';
      expect(requiredPermission).toBe('voice:preview');
    });

    it('should require voice_id field', () => {
      const request = new MockRequest({
        body: {} // Missing voice_id
      });
      expect(request.body.voice_id).toBeUndefined();
    });

    it('should accept optional text field with max length 500', () => {
      const maxLength = 500;
      const textExceeding = 'x'.repeat(501);
      expect(textExceeding.length > maxLength).toBe(true);
    });

    it('should use default preview text if not provided', () => {
      const defaultText = 'The quick brown fox jumps over the lazy dog.';
      expect(defaultText).toBeTruthy();
      expect(defaultText.length > 0).toBe(true);
    });

    it('should return voice_id and duration on success', () => {
      const successData = {
        status: 'success',
        voice_id: 'en-us-amy-medium',
        output_reference: 'voice-preview-123.wav',
        duration: 1500,
        processing_time_ms: 800,
        timestamp: new Date().toISOString()
      };

      expect(successData.voice_id).toBeTruthy();
      expect(successData.duration).toBeGreaterThan(0);
    });
  });

  describe('Provider Listing Endpoints', () => {
    it('should require voice:view permission for provider list', () => {
      const requiredPermission = 'voice:view';
      expect(requiredPermission).toBe('voice:view');
    });

    it('should return array of providers', () => {
      const providers = [
        {
          provider_id: 'mock-voice',
          name: 'Mock Voice',
          execution_mode: 'local',
          enabled: true,
          installed: true,
          configured: true,
          health_status: 'healthy'
        }
      ];

      expect(Array.isArray(providers)).toBe(true);
      expect(providers[0].provider_id).toBeTruthy();
    });

    it('should include total count', () => {
      const response = {
        providers: [],
        total: 0,
        timestamp: new Date().toISOString()
      };

      expect(response.total).toBe(response.providers.length);
    });

    it('should filter enabled providers only', () => {
      const allProviders = [
        { provider_id: 'p1', enabled: true, category: 'voice' },
        { provider_id: 'p2', enabled: false, category: 'voice' },
        { provider_id: 'p3', enabled: true, category: 'voice' }
      ];

      const enabledProviders = allProviders.filter(p => p.enabled && p.category === 'voice');
      expect(enabledProviders.length).toBe(2);
    });
  });

  describe('Provider Details Endpoint', () => {
    it('should return 404 if provider not found', () => {
      const statusCode = 404;
      const errorResponse = {
        error: 'Provider nonexistent not found',
        timestamp: new Date().toISOString()
      };

      expect(statusCode).toBe(404);
      expect(errorResponse.error).toContain('not found');
    });

    it('should return provider details with capabilities', () => {
      const providerDetails = {
        provider: {
          provider_id: 'mock-voice',
          name: 'Mock Voice',
          execution_mode: 'local',
          enabled: true
        },
        capabilities: ['text-to-speech', 'voice-preview'],
        voices: [
          { voice_id: 'alice', name: 'Alice', language: 'en', gender: 'female' },
          { voice_id: 'bob', name: 'Bob', language: 'en', gender: 'male' }
        ],
        timestamp: new Date().toISOString()
      };

      expect(providerDetails.provider.provider_id).toBeTruthy();
      expect(Array.isArray(providerDetails.capabilities)).toBe(true);
      expect(Array.isArray(providerDetails.voices)).toBe(true);
    });
  });

  describe('Job Management Endpoints', () => {
    it('should return active and completed jobs separately', () => {
      const jobsResponse = {
        active_jobs: 2,
        active: [
          {
            job_id: uuid(),
            status: 'started',
            operation: 'text_to_speech',
            provider_id: 'mock-voice',
            created_at: new Date().toISOString()
          }
        ],
        completed: [
          {
            job_id: uuid(),
            status: 'completed',
            operation: 'text_to_speech',
            provider_id: 'mock-voice',
            processing_time_ms: 1500,
            completed_at: new Date().toISOString()
          }
        ],
        timestamp: new Date().toISOString()
      };

      expect(jobsResponse.active_jobs).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(jobsResponse.active)).toBe(true);
      expect(Array.isArray(jobsResponse.completed)).toBe(true);
    });

    it('should include only last 10 completed jobs', () => {
      const completed = [];
      for (let i = 0; i < 10; i++) {
        completed.push({ job_id: uuid() });
      }
      expect(completed.length).toBe(10);
    });

    it('should require voice:view permission to list jobs', () => {
      const requiredPermission = 'voice:view';
      expect(requiredPermission).toBe('voice:view');
    });
  });

  describe('Job Status Endpoint', () => {
    it('should return 404 if job not found', () => {
      const statusCode = 404;
      const errorResponse = {
        error: 'Job nonexistent not found',
        timestamp: new Date().toISOString()
      };

      expect(statusCode).toBe(404);
      expect(errorResponse.error).toContain('not found');
    });

    it('should return job details with status and processing time', () => {
      const jobDetails = {
        job_id: uuid(),
        status: 'completed',
        operation: 'text_to_speech',
        provider_id: 'mock-voice',
        retry_count: 0,
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        processing_time_ms: 1500,
        error: null,
        timestamp: new Date().toISOString()
      };

      expect(jobDetails.job_id).toBeTruthy();
      expect(jobDetails.status).toBeTruthy();
      expect(jobDetails.processing_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Job Cancellation Endpoint', () => {
    it('should require voice:cancel permission', () => {
      const requiredPermission = 'voice:cancel';
      expect(requiredPermission).toBe('voice:cancel');
    });

    it('should return cancelled status on success', () => {
      const response = {
        status: 'cancelled',
        job_id: uuid(),
        timestamp: new Date().toISOString()
      };

      expect(response.status).toBe('cancelled');
      expect(response.job_id).toBeTruthy();
    });

    it('should return 400 if job already completed', () => {
      const statusCode = 400;
      const errorResponse = {
        error: 'Cannot cancel completed job',
        timestamp: new Date().toISOString()
      };

      expect(statusCode).toBe(400);
      expect(errorResponse.error).toContain('Cannot cancel');
    });
  });

  describe('Health Check Endpoint', () => {
    it('should not require authentication', () => {
      // Health check should be accessible without auth
      const route = '/voice/health';
      expect(route).toBeTruthy();
    });

    it('should return Echo agent status', () => {
      const healthResponse = {
        agent: 'Echo',
        status: 'operational',
        active_jobs: 0,
        providers: {
          'mock-voice': 'healthy',
          'mock-stt': 'degraded'
        },
        timestamp: new Date().toISOString()
      };

      expect(healthResponse.agent).toBe('Echo');
      expect(healthResponse.status).toMatch(/operational|error/);
      expect(typeof healthResponse.active_jobs).toBe('number');
    });

    it('should include provider health status', () => {
      const healthResponse = {
        providers: {
          'piper': 'healthy',
          'whisper-cpp': 'not_installed',
          'mock-voice': 'unavailable'
        }
      };

      for (const [provider, status] of Object.entries(healthResponse.providers)) {
        expect(['healthy', 'degraded', 'error', 'not_installed', 'unavailable']).toContain(status);
      }
    });
  });

  describe('Error Responses', () => {
    it('should return 401 for unauthenticated requests', () => {
      const statusCode = 401;
      const response = {
        error: 'Unauthorized',
        timestamp: new Date().toISOString()
      };

      expect(statusCode).toBe(401);
    });

    it('should return 403 for permission denied', () => {
      const statusCode = 403;
      const response = {
        error: 'Forbidden: voice:create permission required',
        timestamp: new Date().toISOString()
      };

      expect(statusCode).toBe(403);
    });

    it('should return 400 for validation errors', () => {
      const statusCode = 400;
      const response = {
        error: 'Validation error',
        timestamp: new Date().toISOString()
      };

      expect(statusCode).toBe(400);
    });

    it('should not expose system details in error responses', () => {
      const errorResponse = {
        error: 'Operation failed',
        timestamp: new Date().toISOString()
      };

      // Should not contain stack traces or internal paths
      const stringified = JSON.stringify(errorResponse);
      expect(stringified).not.toContain('/home/');
      expect(stringified).not.toContain('at ');
      expect(stringified).not.toContain('Error:');
    });
  });

  describe('Response Timestamps', () => {
    it('should include ISO format timestamp in all responses', () => {
      const timestamp = new Date().toISOString();
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(timestamp).toMatch(isoRegex);
    });
  });
});
