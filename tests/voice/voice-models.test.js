/**
 * Tests for Voice Task and Voice Result models
 */

const { describe, it, expect } = require('@jest/globals');
const { VoiceTask, VOICE_OPERATIONS, INPUT_TYPES, PRIVACY_CLASSIFICATIONS } = require('../../src/models/voice-task-model');
const { VoiceResult, RESULT_STATUS } = require('../../src/models/voice-result-model');
const { v4: uuid } = require('uuid');

describe('VoiceTask Model', () => {
  const validTaskData = {
    task_id: uuid(),
    objective_id: uuid(),
    requesting_identity: {
      user_id: uuid(),
      email: 'user@example.com',
      roles: ['user']
    },
    requested_operation: VOICE_OPERATIONS.TEXT_TO_SPEECH,
    input_type: INPUT_TYPES.TEXT,
    input_reference: '',
    input_text: 'Hello world',
    language: 'en',
    privacy_classification: PRIVACY_CLASSIFICATIONS.INTERNAL,
    retention_policy: {
      duration_days: 30,
      auto_delete: true
    }
  };

  it('should create valid voice task', () => {
    const task = VoiceTask.from(validTaskData);
    expect(task.task_id).toBe(validTaskData.task_id);
    expect(task.requested_operation).toBe(VOICE_OPERATIONS.TEXT_TO_SPEECH);
  });

  it('should validate task with all required fields', () => {
    const result = VoiceTask.validate(validTaskData);
    expect(result.valid).toBe(true);
  });

  it('should reject task without task_id', () => {
    const invalidData = { ...validTaskData };
    delete invalidData.task_id;
    const result = VoiceTask.validate(invalidData);
    expect(result.valid).toBe(false);
  });

  it('should reject task without objective_id', () => {
    const invalidData = { ...validTaskData };
    delete invalidData.objective_id;
    const result = VoiceTask.validate(invalidData);
    expect(result.valid).toBe(false);
  });

  it('should reject task with invalid operation', () => {
    const invalidData = { ...validTaskData, requested_operation: 'invalid_op' };
    const result = VoiceTask.validate(invalidData);
    expect(result.valid).toBe(false);
  });

  it('should reject text with length > 10000', () => {
    const invalidData = {
      ...validTaskData,
      input_text: 'x'.repeat(10001)
    };
    const result = VoiceTask.validate(invalidData);
    expect(result.valid).toBe(false);
  });

  it('should validate language pattern', () => {
    const goodLanguages = ['en', 'en-US', 'fr', 'es-ES'];
    for (const lang of goodLanguages) {
      const task = VoiceTask.from({ ...validTaskData, language: lang });
      expect(task.language).toBe(lang);
    }
  });

  it('should reject invalid language patterns', () => {
    const badLanguages = ['EN', 'en_US', '123', ''];
    for (const lang of badLanguages) {
      const result = VoiceTask.validate({ ...validTaskData, language: lang });
      expect(result.valid).toBe(false);
    }
  });

  it('should detect text-to-speech operation', () => {
    const task = VoiceTask.from(validTaskData);
    expect(task.isTextToSpeech()).toBe(true);
    expect(task.isSpeechToText()).toBe(false);
  });

  it('should detect sensitive classification', () => {
    const task = VoiceTask.from({
      ...validTaskData,
      privacy_classification: PRIVACY_CLASSIFICATIONS.CONFIDENTIAL
    });
    expect(task.isSensitive()).toBe(true);
  });

  it('should detect non-sensitive classification', () => {
    const task = VoiceTask.from({
      ...validTaskData,
      privacy_classification: PRIVACY_CLASSIFICATIONS.PUBLIC
    });
    expect(task.isSensitive()).toBe(false);
  });

  it('should have default sample rate', () => {
    const task = VoiceTask.from(validTaskData);
    expect(task.sample_rate).toBe(24000);
  });

  it('should allow override of sample rate', () => {
    const task = VoiceTask.from({ ...validTaskData, sample_rate: 48000 });
    expect(task.sample_rate).toBe(48000);
  });

  it('should validate retention policy', () => {
    const result = VoiceTask.validate({
      ...validTaskData,
      retention_policy: {
        duration_days: 365,
        auto_delete: true
      }
    });
    expect(result.valid).toBe(true);
  });
});

describe('VoiceResult Model', () => {
  const validResultData = {
    job_id: uuid(),
    provider_id: 'mock-voice',
    operation: VOICE_OPERATIONS.TEXT_TO_SPEECH,
    status: RESULT_STATUS.COMPLETED,
    output_reference: 'voice-abc123.wav',
    output_format: 'wav',
    duration: 2500,
    sample_rate: 24000,
    language: 'en',
    processing_time_ms: 1500,
    retry_count: 0
  };

  it('should create successful result', () => {
    const result = VoiceResult.success(
      uuid(),
      'mock-voice',
      VOICE_OPERATIONS.TEXT_TO_SPEECH,
      {
        output_reference: 'voice-abc123.wav',
        output_format: 'wav',
        duration: 2500,
        sample_rate: 24000,
        processing_time_ms: 1500
      }
    );
    expect(result.status).toBe(RESULT_STATUS.COMPLETED);
    expect(result.isSuccess()).toBe(true);
  });

  it('should create failed result', () => {
    const error = new Error('Provider failed');
    error.code = 'PROVIDER_ERROR';
    const result = VoiceResult.failure(uuid(), 'mock-voice', VOICE_OPERATIONS.TEXT_TO_SPEECH, error);
    expect(result.status).toBe(RESULT_STATUS.FAILED);
    expect(result.isFailed()).toBe(true);
    expect(result.error).toContain('Provider failed');
  });

  it('should create cancelled result', () => {
    const result = VoiceResult.cancelled(uuid(), 'mock-voice', VOICE_OPERATIONS.TEXT_TO_SPEECH);
    expect(result.status).toBe(RESULT_STATUS.CANCELLED);
    expect(result.isCancelled()).toBe(true);
  });

  it('should validate result with all required fields', () => {
    const result = VoiceResult.validate(validResultData);
    expect(result.valid).toBe(true);
  });

  it('should reject result without job_id', () => {
    const invalidData = { ...validResultData };
    delete invalidData.job_id;
    const result = VoiceResult.validate(invalidData);
    expect(result.valid).toBe(false);
  });

  it('should reject result with invalid status', () => {
    const invalidData = { ...validResultData, status: 'invalid_status' };
    const result = VoiceResult.validate(invalidData);
    expect(result.valid).toBe(false);
  });

  it('should include audit reference in result', () => {
    const auditRef = uuid();
    const result = VoiceResult.success(uuid(), 'mock-voice', VOICE_OPERATIONS.TEXT_TO_SPEECH, {
      output_reference: 'voice-xyz.wav',
      processing_time_ms: 1000,
      audit_reference: auditRef
    });
    expect(result.audit_reference).toBe(auditRef);
  });

  it('should include correlation_id in result', () => {
    const correlationId = uuid();
    const result = VoiceResult.success(uuid(), 'mock-voice', VOICE_OPERATIONS.TEXT_TO_SPEECH, {
      output_reference: 'voice-xyz.wav',
      processing_time_ms: 1000,
      correlation_id: correlationId
    });
    expect(result.correlation_id).toBe(correlationId);
  });

  it('should hide error details in toSafeJSON', () => {
    const error = new Error('Specific provider error');
    const result = VoiceResult.failure(uuid(), 'mock-voice', VOICE_OPERATIONS.TEXT_TO_SPEECH, error);
    const safeJson = result.toSafeJSON();
    expect(safeJson.error).toBe('Operation failed');
    expect(safeJson.error_code).toBeUndefined();
  });

  it('should include full error details in toJSON', () => {
    const error = new Error('Specific provider error');
    error.code = 'PROVIDER_ERROR';
    const result = VoiceResult.failure(uuid(), 'mock-voice', VOICE_OPERATIONS.TEXT_TO_SPEECH, error);
    const fullJson = result.toJSON();
    expect(fullJson.error).toBe('Specific provider error');
    expect(fullJson.error_code).toBe('PROVIDER_ERROR');
  });

  it('should track retry count', () => {
    const result = VoiceResult.success(uuid(), 'mock-voice', VOICE_OPERATIONS.TEXT_TO_SPEECH, {
      output_reference: 'voice-xyz.wav',
      processing_time_ms: 2000,
      retry_count: 2
    });
    expect(result.retry_count).toBe(2);
  });

  it('should support warnings array', () => {
    const result = VoiceResult.success(uuid(), 'mock-voice', VOICE_OPERATIONS.TEXT_TO_SPEECH, {
      output_reference: 'voice-xyz.wav',
      processing_time_ms: 1000,
      warnings: ['Low confidence on some words', 'Background noise detected']
    });
    expect(result.warnings.length).toBe(2);
  });
});

describe('VoiceResult for STT operations', () => {
  it('should include transcript in STT result', () => {
    const result = VoiceResult.success(uuid(), 'whisper', VOICE_OPERATIONS.SPEECH_TO_TEXT, {
      transcript: 'Hello, this is a test',
      confidence: 0.95,
      language: 'en',
      processing_time_ms: 5000
    });
    expect(result.transcript).toBe('Hello, this is a test');
    expect(result.confidence).toBe(0.95);
  });

  it('should validate confidence range', () => {
    const validData = {
      job_id: uuid(),
      provider_id: 'whisper',
      operation: VOICE_OPERATIONS.SPEECH_TO_TEXT,
      status: RESULT_STATUS.COMPLETED,
      transcript: 'Test',
      confidence: 0.95,
      processing_time_ms: 5000,
      retry_count: 0
    };
    const result = VoiceResult.validate(validData);
    expect(result.valid).toBe(true);
  });

  it('should reject confidence > 1', () => {
    const invalidData = {
      job_id: uuid(),
      provider_id: 'whisper',
      operation: VOICE_OPERATIONS.SPEECH_TO_TEXT,
      status: RESULT_STATUS.COMPLETED,
      transcript: 'Test',
      confidence: 1.5,
      processing_time_ms: 5000,
      retry_count: 0
    };
    const result = VoiceResult.validate(invalidData);
    expect(result.valid).toBe(false);
  });
});
