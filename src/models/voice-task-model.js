/**
 * Voice Task Model - Defines structure of voice operation requests
 * Supports TTS, STT, audio metadata extraction, and voice preview operations
 */

const Joi = require('joi');

const VOICE_OPERATIONS = {
  TEXT_TO_SPEECH: 'text_to_speech',
  SPEECH_TO_TEXT: 'speech_to_text',
  AUDIO_METADATA: 'audio_metadata',
  VOICE_PREVIEW: 'voice_preview'
};

const INPUT_TYPES = {
  TEXT: 'text',
  AUDIO_FILE: 'audio_file',
  AUDIO_URL: 'audio_url'
};

const OUTPUT_FORMATS = {
  WAV: 'wav',
  MP3: 'mp3',
  FLAC: 'flac'
};

const PRIVACY_CLASSIFICATIONS = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  CONFIDENTIAL: 'confidential',
  SENSITIVE: 'sensitive'
};

/**
 * Voice Task Validation Schema
 */
const voiceTaskSchema = Joi.object({
  task_id: Joi.string().uuid().required(),
  objective_id: Joi.string().uuid().required(),
  requesting_identity: Joi.object({
    user_id: Joi.string().required(),
    email: Joi.string().email().required(),
    roles: Joi.array().items(Joi.string()).required()
  }).required(),

  requested_operation: Joi.string()
    .valid(...Object.values(VOICE_OPERATIONS))
    .required(),

  input_type: Joi.string()
    .valid(...Object.values(INPUT_TYPES))
    .required(),

  input_reference: Joi.string().required(), // File path or text content
  input_text: Joi.string().max(10000).optional(),
  language: Joi.string().pattern(/^[a-z]{2}(-[A-Z]{2})?$/).required(), // e.g., 'en', 'en-US'
  voice_profile: Joi.object({
    provider_preference: Joi.string().optional(),
    voice_id: Joi.string().optional(),
    voice_name: Joi.string().optional(),
    gender: Joi.string().valid('male', 'female', 'neutral').optional(),
    sample_rate: Joi.number().valid(8000, 16000, 24000, 44100, 48000).optional()
  }).optional(),

  output_format: Joi.string()
    .valid(...Object.values(OUTPUT_FORMATS))
    .optional(),

  sample_rate: Joi.number()
    .valid(8000, 16000, 24000, 44100, 48000)
    .optional(),

  provider_preference: Joi.string().optional(),
  fallback_allowed: Joi.boolean().optional(),

  privacy_classification: Joi.string()
    .valid(...Object.values(PRIVACY_CLASSIFICATIONS))
    .required(),

  retention_policy: Joi.object({
    duration_days: Joi.number().min(1).max(365).required(),
    auto_delete: Joi.boolean().required()
  }).required(),

  authorisation_reference: Joi.string().uuid().optional(),
  timeout_ms: Joi.number().min(1000).max(600000).optional(),
  status: Joi.string()
    .valid('pending', 'processing', 'completed', 'failed', 'cancelled')
    .optional()
}).required();

/**
 * Voice Task Class
 */
class VoiceTask {
  constructor(data) {
    this.task_id = data.task_id;
    this.objective_id = data.objective_id;
    this.requesting_identity = data.requesting_identity;
    this.requested_operation = data.requested_operation;
    this.input_type = data.input_type;
    this.input_reference = data.input_reference;
    this.input_text = data.input_text;
    this.language = data.language;
    this.voice_profile = data.voice_profile || {};
    this.output_format = data.output_format || OUTPUT_FORMATS.WAV;
    this.sample_rate = data.sample_rate || 24000;
    this.provider_preference = data.provider_preference;
    this.fallback_allowed = data.fallback_allowed !== false;
    this.privacy_classification = data.privacy_classification;
    this.retention_policy = data.retention_policy;
    this.authorisation_reference = data.authorisation_reference;
    this.timeout_ms = data.timeout_ms || 60000;
    this.status = data.status || 'pending';
    this.created_at = data.created_at || new Date();
    this.started_at = data.started_at || null;
    this.completed_at = data.completed_at || null;
  }

  static validate(data) {
    const result = voiceTaskSchema.validate(data);
    return {
      valid: !result.error,
      errors: result.error ? result.error.details.map(d => d.message) : [],
      value: result.value
    };
  }

  static from(data) {
    const validation = this.validate(data);
    if (!validation.valid) {
      throw new Error(`Invalid voice task: ${validation.errors.join(', ')}`);
    }
    return new VoiceTask(validation.value);
  }

  isTextToSpeech() {
    return this.requested_operation === VOICE_OPERATIONS.TEXT_TO_SPEECH;
  }

  isSpeechToText() {
    return this.requested_operation === VOICE_OPERATIONS.SPEECH_TO_TEXT;
  }

  isAudioMetadata() {
    return this.requested_operation === VOICE_OPERATIONS.AUDIO_METADATA;
  }

  isVoicePreview() {
    return this.requested_operation === VOICE_OPERATIONS.VOICE_PREVIEW;
  }

  isSensitive() {
    return [PRIVACY_CLASSIFICATIONS.CONFIDENTIAL, PRIVACY_CLASSIFICATIONS.SENSITIVE]
      .includes(this.privacy_classification);
  }

  toJSON() {
    return {
      task_id: this.task_id,
      objective_id: this.objective_id,
      requesting_identity: this.requesting_identity,
      requested_operation: this.requested_operation,
      input_type: this.input_type,
      input_reference: this.input_reference,
      language: this.language,
      voice_profile: this.voice_profile,
      output_format: this.output_format,
      provider_preference: this.provider_preference,
      fallback_allowed: this.fallback_allowed,
      privacy_classification: this.privacy_classification,
      retention_policy: this.retention_policy,
      authorisation_reference: this.authorisation_reference,
      timeout_ms: this.timeout_ms,
      status: this.status,
      created_at: this.created_at,
      started_at: this.started_at,
      completed_at: this.completed_at
    };
  }
}

module.exports = {
  VoiceTask,
  voiceTaskSchema,
  VOICE_OPERATIONS,
  INPUT_TYPES,
  OUTPUT_FORMATS,
  PRIVACY_CLASSIFICATIONS
};
