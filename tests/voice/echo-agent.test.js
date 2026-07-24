/**
 * Tests for Echo Agent - Voice and Audio Operations
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');
const EchoAgent = require('../../src/agents/echo-agent');
const { VoiceTask, VOICE_OPERATIONS, INPUT_TYPES, PRIVACY_CLASSIFICATIONS } = require('../../src/models/voice-task-model');
const { RESULT_STATUS } = require('../../src/models/voice-result-model');
const { v4: uuid } = require('uuid');

// Mock classes
class MockProviderRegistry {
  constructor() {
    this.definitions = new Map();
    this.adapters = new Map();
  }

  async getAdapter(providerId) {
    return this.adapters.get(providerId);
  }

  async getAdapterForCapability(category, capability) {
    for (const [id, adapter] of this.adapters.entries()) {
      if (adapter.capabilities && adapter.capabilities.includes(capability)) {
        return adapter;
      }
    }
    return null;
  }
}

class MockVoiceAdapter {
  constructor(providerId, capabilities = ['text-to-speech']) {
    this.provider_id = providerId;
    this.capabilities = capabilities;
  }

  async healthCheck() {
    return { status: 'healthy' };
  }

  async textToSpeech(params) {
    return {
      outputFile: '/voice-abc123.wav',
      format: params.output_format || 'wav',
      duration: 2500,
      sampleRate: params.sample_rate || 24000,
      language: params.language
    };
  }

  async speechToText(params) {
    return {
      transcript: 'This is a test transcript',
      confidence: 0.95,
      language: params.language,
      duration: 5000
    };
  }

  async inspectAudio(params) {
    return {
      file: params.audioFile,
      size: 100000,
      format: 'wav',
      duration: 5000
    };
  }

  async previewVoice(params) {
    return {
      outputFile: '/voice-preview-123.wav',
      format: 'wav',
      duration: 1500,
      sampleRate: 24000,
      language: params.language
    };
  }
}

class MockRBACEngine {
  constructor() {
    this.userPermissions = new Map();
  }

  setUserPermissions(userId, permissions) {
    this.userPermissions.set(userId, permissions);
  }

  async hasPermission(userId, action) {
    const permissions = this.userPermissions.get(userId) || [];
    return permissions.includes(action);
  }
}

class MockAuditLogger {
  async logEvent(data) {
    // Mock implementation
  }
}

describe('Echo Agent', () => {
  let echoAgent;
  let providerRegistry;
  let rbacEngine;
  let auditLogger;

  beforeEach(() => {
    providerRegistry = new MockProviderRegistry();
    rbacEngine = new MockRBACEngine();
    auditLogger = new MockAuditLogger();

    echoAgent = new EchoAgent(providerRegistry, rbacEngine, null, auditLogger, null, null);
  });

  it('should have correct identity', () => {
    expect(echoAgent.code).toBe('EE');
    expect(echoAgent.name).toBe('Echo');
    expect(echoAgent.role).toBe('Voice & Audio');
  });

  describe('Text-to-Speech Operations', () => {
    beforeEach(() => {
      const mockAdapter = new MockVoiceAdapter('mock-voice', ['text-to-speech', 'voice-preview']);
      providerRegistry.adapters.set('mock-voice', mockAdapter);
      providerRegistry.definitions.set('mock-voice', {
        provider_id: 'mock-voice',
        category: 'voice',
        enabled: true
      });

      rbacEngine.setUserPermissions(uuid(), ['voice:create']);
    });

    it('should process text-to-speech task', async () => {
      const userId = uuid();
      rbacEngine.setUserPermissions(userId, ['voice:create']);

      const task = VoiceTask.from({
        task_id: uuid(),
        objective_id: uuid(),
        requesting_identity: {
          user_id: userId,
          email: 'user@example.com',
          roles: ['user']
        },
        requested_operation: VOICE_OPERATIONS.TEXT_TO_SPEECH,
        input_type: INPUT_TYPES.TEXT,
        input_reference: '',
        input_text: 'Hello world',
        language: 'en',
        privacy_classification: PRIVACY_CLASSIFICATIONS.INTERNAL,
        retention_policy: { duration_days: 30, auto_delete: true }
      });

      const result = await echoAgent.processVoiceTask(task);
      expect(result.status).toBe(RESULT_STATUS.COMPLETED);
      expect(result.output_reference).toBeTruthy();
      expect(result.language).toBe('en');
    });

    it('should reject TTS without permission', async () => {
      const userId = uuid();
      rbacEngine.setUserPermissions(userId, []); // No permissions

      const task = VoiceTask.from({
        task_id: uuid(),
        objective_id: uuid(),
        requesting_identity: {
          user_id: userId,
          email: 'user@example.com',
          roles: ['user']
        },
        requested_operation: VOICE_OPERATIONS.TEXT_TO_SPEECH,
        input_type: INPUT_TYPES.TEXT,
        input_reference: '',
        input_text: 'Hello world',
        language: 'en',
        privacy_classification: PRIVACY_CLASSIFICATIONS.INTERNAL,
        retention_policy: { duration_days: 30, auto_delete: true }
      });

      await expect(echoAgent.processVoiceTask(task))
        .rejects
        .toThrow('lacks permission');
    });
  });

  describe('Speech-to-Text Operations', () => {
    beforeEach(() => {
      const mockAdapter = new MockVoiceAdapter('mock-stt', ['speech-to-text']);
      providerRegistry.adapters.set('mock-stt', mockAdapter);
      providerRegistry.definitions.set('mock-stt', {
        provider_id: 'mock-stt',
        category: 'voice',
        enabled: true
      });
    });

    it('should process speech-to-text task', async () => {
      const userId = uuid();
      rbacEngine.setUserPermissions(userId, ['voice:transcribe']);

      const task = VoiceTask.from({
        task_id: uuid(),
        objective_id: uuid(),
        requesting_identity: {
          user_id: userId,
          email: 'user@example.com',
          roles: ['user']
        },
        requested_operation: VOICE_OPERATIONS.SPEECH_TO_TEXT,
        input_type: INPUT_TYPES.AUDIO_FILE,
        input_reference: '/path/to/audio.wav',
        language: 'en',
        privacy_classification: PRIVACY_CLASSIFICATIONS.INTERNAL,
        retention_policy: { duration_days: 30, auto_delete: true }
      });

      const result = await echoAgent.processVoiceTask(task);
      expect(result.status).toBe(RESULT_STATUS.COMPLETED);
      expect(result.transcript).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should reject STT without permission', async () => {
      const userId = uuid();
      rbacEngine.setUserPermissions(userId, []); // No permissions

      const task = VoiceTask.from({
        task_id: uuid(),
        objective_id: uuid(),
        requesting_identity: {
          user_id: userId,
          email: 'user@example.com',
          roles: ['user']
        },
        requested_operation: VOICE_OPERATIONS.SPEECH_TO_TEXT,
        input_type: INPUT_TYPES.AUDIO_FILE,
        input_reference: '/path/to/audio.wav',
        language: 'en',
        privacy_classification: PRIVACY_CLASSIFICATIONS.INTERNAL,
        retention_policy: { duration_days: 30, auto_delete: true }
      });

      await expect(echoAgent.processVoiceTask(task))
        .rejects
        .toThrow('lacks permission');
    });
  });

  describe('Policy Enforcement', () => {
    beforeEach(() => {
      const mockAdapter = new MockVoiceAdapter('mock-voice', ['text-to-speech']);
      providerRegistry.adapters.set('mock-voice', mockAdapter);
      providerRegistry.definitions.set('mock-voice', {
        provider_id: 'mock-voice',
        category: 'voice',
        enabled: true
      });
    });

    it('should reject voice cloning in Phase 5A', async () => {
      const userId = uuid();
      rbacEngine.setUserPermissions(userId, ['voice:create']);

      const task = VoiceTask.from({
        task_id: uuid(),
        objective_id: uuid(),
        requesting_identity: {
          user_id: userId,
          email: 'user@example.com',
          roles: ['user']
        },
        requested_operation: VOICE_OPERATIONS.TEXT_TO_SPEECH,
        input_type: INPUT_TYPES.TEXT,
        input_reference: '',
        input_text: 'Clone my voice',
        language: 'en',
        voice_profile: {
          voice_name: 'john_doe' // Indicates voice cloning attempt
        },
        privacy_classification: PRIVACY_CLASSIFICATIONS.INTERNAL,
        retention_policy: { duration_days: 30, auto_delete: true }
      });

      await expect(echoAgent.processVoiceTask(task))
        .rejects
        .toThrow('Voice cloning is not available');
    });
  });

  describe('Job Tracking', () => {
    it('should track active jobs', async () => {
      const mockAdapter = new MockVoiceAdapter('mock-voice', ['text-to-speech']);
      providerRegistry.adapters.set('mock-voice', mockAdapter);
      providerRegistry.definitions.set('mock-voice', {
        provider_id: 'mock-voice',
        category: 'voice',
        enabled: true
      });

      const userId = uuid();
      rbacEngine.setUserPermissions(userId, ['voice:create']);

      const task = VoiceTask.from({
        task_id: uuid(),
        objective_id: uuid(),
        requesting_identity: {
          user_id: userId,
          email: 'user@example.com',
          roles: ['user']
        },
        requested_operation: VOICE_OPERATIONS.TEXT_TO_SPEECH,
        input_type: INPUT_TYPES.TEXT,
        input_reference: '',
        input_text: 'Test',
        language: 'en',
        privacy_classification: PRIVACY_CLASSIFICATIONS.INTERNAL,
        retention_policy: { duration_days: 30, auto_delete: true }
      });

      await echoAgent.processVoiceTask(task);

      const completedJobs = echoAgent.getCompletedJobs();
      expect(completedJobs.length).toBeGreaterThan(0);
    });

    it('should maintain job status information', async () => {
      const mockAdapter = new MockVoiceAdapter('mock-voice', ['text-to-speech']);
      providerRegistry.adapters.set('mock-voice', mockAdapter);
      providerRegistry.definitions.set('mock-voice', {
        provider_id: 'mock-voice',
        category: 'voice',
        enabled: true
      });

      const userId = uuid();
      rbacEngine.setUserPermissions(userId, ['voice:create']);

      const task = VoiceTask.from({
        task_id: uuid(),
        objective_id: uuid(),
        requesting_identity: {
          user_id: userId,
          email: 'user@example.com',
          roles: ['user']
        },
        requested_operation: VOICE_OPERATIONS.TEXT_TO_SPEECH,
        input_type: INPUT_TYPES.TEXT,
        input_reference: '',
        input_text: 'Test',
        language: 'en',
        privacy_classification: PRIVACY_CLASSIFICATIONS.INTERNAL,
        retention_policy: { duration_days: 30, auto_delete: true }
      });

      await echoAgent.processVoiceTask(task);

      const jobs = echoAgent.getCompletedJobs();
      expect(jobs[0].status).toBe('completed');
      expect(jobs[0].operation).toBe(VOICE_OPERATIONS.TEXT_TO_SPEECH);
      expect(jobs[0].provider_id).toBeTruthy();
    });
  });

  describe('Voice Preview', () => {
    beforeEach(() => {
      const mockAdapter = new MockVoiceAdapter('mock-voice', ['text-to-speech', 'voice-preview']);
      providerRegistry.adapters.set('mock-voice', mockAdapter);
      providerRegistry.definitions.set('mock-voice', {
        provider_id: 'mock-voice',
        category: 'voice',
        enabled: true
      });
    });

    it('should process voice preview request', async () => {
      const userId = uuid();
      rbacEngine.setUserPermissions(userId, ['voice:preview']);

      const task = VoiceTask.from({
        task_id: uuid(),
        objective_id: uuid(),
        requesting_identity: {
          user_id: userId,
          email: 'user@example.com',
          roles: ['user']
        },
        requested_operation: VOICE_OPERATIONS.VOICE_PREVIEW,
        input_type: INPUT_TYPES.TEXT,
        input_reference: '',
        input_text: 'Preview voice',
        language: 'en',
        voice_profile: {
          voice_id: 'alice'
        },
        privacy_classification: PRIVACY_CLASSIFICATIONS.PUBLIC,
        retention_policy: { duration_days: 1, auto_delete: true }
      });

      const result = await echoAgent.processVoiceTask(task);
      expect(result.status).toBe(RESULT_STATUS.COMPLETED);
      expect(result.output_reference).toBeTruthy();
    });
  });

  describe('Permission Mapping', () => {
    it('should map TEXT_TO_SPEECH to voice:create', async () => {
      const userId = uuid();
      rbacEngine.setUserPermissions(userId, ['voice:create']);

      const hasPermission = await echoAgent._checkPermissions(
        { user_id: userId },
        VOICE_OPERATIONS.TEXT_TO_SPEECH
      );
      expect(hasPermission).toBe(true);
    });

    it('should map SPEECH_TO_TEXT to voice:transcribe', async () => {
      const userId = uuid();
      rbacEngine.setUserPermissions(userId, ['voice:transcribe']);

      const hasPermission = await echoAgent._checkPermissions(
        { user_id: userId },
        VOICE_OPERATIONS.SPEECH_TO_TEXT
      );
      expect(hasPermission).toBe(true);
    });

    it('should map VOICE_PREVIEW to voice:preview', async () => {
      const userId = uuid();
      rbacEngine.setUserPermissions(userId, ['voice:preview']);

      const hasPermission = await echoAgent._checkPermissions(
        { user_id: userId },
        VOICE_OPERATIONS.VOICE_PREVIEW
      );
      expect(hasPermission).toBe(true);
    });
  });
});
