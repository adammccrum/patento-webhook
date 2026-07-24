/**
 * Voice Result Model - Defines structure of voice operation responses
 */

const Joi = require('joi');

const RESULT_STATUS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PARTIAL: 'partial'
};

/**
 * Voice Result Validation Schema
 */
const voiceResultSchema = Joi.object({
  job_id: Joi.string().uuid().required(),
  provider_id: Joi.string().required(),
  operation: Joi.string().required(),
  status: Joi.string()
    .valid(...Object.values(RESULT_STATUS))
    .required(),

  output_reference: Joi.string().optional(), // File path or URL, not raw data
  output_format: Joi.string().optional(),
  duration: Joi.number().min(0).optional(),
  sample_rate: Joi.number().optional(),
  language: Joi.string().optional(),

  // For speech-to-text results
  transcript: Joi.string().optional(),
  confidence: Joi.number().min(0).max(1).optional(),

  // Metadata
  processing_time_ms: Joi.number().min(0).required(),
  retry_count: Joi.number().min(0).required(),
  warnings: Joi.array().items(Joi.string()).optional(),
  error: Joi.string().optional(),
  error_code: Joi.string().optional(),

  // Audit and tracking
  audit_reference: Joi.string().uuid().optional(),
  correlation_id: Joi.string().optional(),
  timestamp: Joi.date().optional()
}).required();

/**
 * Voice Result Class
 */
class VoiceResult {
  constructor(data) {
    this.job_id = data.job_id;
    this.provider_id = data.provider_id;
    this.operation = data.operation;
    this.status = data.status;
    this.output_reference = data.output_reference;
    this.output_format = data.output_format;
    this.duration = data.duration;
    this.sample_rate = data.sample_rate;
    this.language = data.language;
    this.transcript = data.transcript;
    this.confidence = data.confidence;
    this.processing_time_ms = data.processing_time_ms;
    this.retry_count = data.retry_count || 0;
    this.warnings = data.warnings || [];
    this.error = data.error;
    this.error_code = data.error_code;
    this.audit_reference = data.audit_reference;
    this.correlation_id = data.correlation_id;
    this.timestamp = data.timestamp || new Date();
  }

  static validate(data) {
    const result = voiceResultSchema.validate(data);
    return {
      valid: !result.error,
      errors: result.error ? result.error.details.map(d => d.message) : [],
      value: result.value
    };
  }

  static from(data) {
    const validation = this.validate(data);
    if (!validation.valid) {
      throw new Error(`Invalid voice result: ${validation.errors.join(', ')}`);
    }
    return new VoiceResult(validation.value);
  }

  static success(jobId, providerId, operation, params = {}) {
    return new VoiceResult({
      job_id: jobId,
      provider_id: providerId,
      operation,
      status: RESULT_STATUS.COMPLETED,
      output_reference: params.output_reference,
      output_format: params.output_format,
      duration: params.duration,
      sample_rate: params.sample_rate,
      language: params.language,
      transcript: params.transcript,
      confidence: params.confidence,
      processing_time_ms: params.processing_time_ms || 0,
      retry_count: params.retry_count || 0,
      warnings: params.warnings || [],
      audit_reference: params.audit_reference,
      correlation_id: params.correlation_id
    });
  }

  static failure(jobId, providerId, operation, error, params = {}) {
    return new VoiceResult({
      job_id: jobId,
      provider_id: providerId,
      operation,
      status: RESULT_STATUS.FAILED,
      error: error.message || String(error),
      error_code: error.code || 'UNKNOWN_ERROR',
      processing_time_ms: params.processing_time_ms || 0,
      retry_count: params.retry_count || 0,
      warnings: params.warnings || [],
      audit_reference: params.audit_reference,
      correlation_id: params.correlation_id
    });
  }

  static cancelled(jobId, providerId, operation, params = {}) {
    return new VoiceResult({
      job_id: jobId,
      provider_id: providerId,
      operation,
      status: RESULT_STATUS.CANCELLED,
      processing_time_ms: params.processing_time_ms || 0,
      retry_count: params.retry_count || 0,
      audit_reference: params.audit_reference,
      correlation_id: params.correlation_id
    });
  }

  isSuccess() {
    return this.status === RESULT_STATUS.COMPLETED;
  }

  isFailed() {
    return this.status === RESULT_STATUS.FAILED;
  }

  isCancelled() {
    return this.status === RESULT_STATUS.CANCELLED;
  }

  toJSON() {
    return {
      job_id: this.job_id,
      provider_id: this.provider_id,
      operation: this.operation,
      status: this.status,
      output_reference: this.output_reference,
      output_format: this.output_format,
      duration: this.duration,
      sample_rate: this.sample_rate,
      language: this.language,
      transcript: this.transcript,
      confidence: this.confidence,
      processing_time_ms: this.processing_time_ms,
      retry_count: this.retry_count,
      warnings: this.warnings,
      error: this.error,
      error_code: this.error_code,
      audit_reference: this.audit_reference,
      correlation_id: this.correlation_id,
      timestamp: this.timestamp
    };
  }

  // Sanitized version for API responses (no error details for non-admin users)
  toSafeJSON() {
    const result = this.toJSON();
    if (this.isFailed()) {
      result.error = 'Operation failed'; // Generic message
      delete result.error_code;
    }
    return result;
  }
}

module.exports = {
  VoiceResult,
  voiceResultSchema,
  RESULT_STATUS
};
