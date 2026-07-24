/**
 * Framework Execution Result
 *
 * Structured result returned from framework execution.
 */

const { v4: uuid } = require('uuid');

class FrameworkResult {
  constructor(options = {}) {
    // Identifiers
    this.execution_id = options.execution_id || uuid();
    this.framework_id = options.framework_id;
    this.framework_version = options.framework_version;
    this.session_id = options.session_id;
    this.correlation_id = options.correlation_id;

    // Status
    this.status = options.status || 'unknown'; // pending, running, completed, failed, cancelled, timeout
    this.success = options.success !== false;

    // Output
    this.result = options.result;
    this.output_summary = options.output_summary;
    this.tool_calls = options.tool_calls || [];
    this.provider_calls = options.provider_calls || [];

    // Metrics
    this.start_time = options.start_time || Date.now();
    this.end_time = options.end_time || Date.now();
    this.duration_ms = this.end_time - this.start_time;
    this.tokens_used = options.tokens_used;
    this.tokens_limit = options.tokens_limit;
    this.cost = options.cost;

    // Memory and resource usage
    this.memory_used_mb = options.memory_used_mb;
    this.memory_peak_mb = options.memory_peak_mb;
    this.cpu_time_ms = options.cpu_time_ms;

    // References
    this.guardian_reference = options.guardian_reference;
    this.audit_reference = options.audit_reference;
    this.provider_references = options.provider_references || [];

    // Errors and warnings
    this.errors = options.errors || [];
    this.warnings = options.warnings || [];

    // Streaming data
    this.streamed_chunks = options.streamed_chunks || 0;
    this.stream_interrupted = options.stream_interrupted || false;

    // Human approval
    this.approval_required = options.approval_required || false;
    this.approval_reference = options.approval_reference;
  }

  /**
   * Mark as completed
   * @param {*} result - Execution result
   */
  complete(result) {
    this.status = 'completed';
    this.result = result;
    this.success = true;
    this.end_time = Date.now();
    this.duration_ms = this.end_time - this.start_time;
  }

  /**
   * Mark as failed
   * @param {Error|string} error - Error details
   */
  fail(error) {
    this.status = 'failed';
    this.success = false;
    this.end_time = Date.now();
    this.duration_ms = this.end_time - this.start_time;

    if (typeof error === 'string') {
      this.errors.push({ message: error, timestamp: Date.now() });
    } else if (error instanceof Error) {
      this.errors.push({ message: error.message, stack: error.stack, timestamp: Date.now() });
    } else {
      this.errors.push({ error, timestamp: Date.now() });
    }
  }

  /**
   * Add warning
   * @param {string} warning - Warning message
   */
  addWarning(warning) {
    this.warnings.push({ message: warning, timestamp: Date.now() });
  }

  /**
   * Record tool call
   * @param {Object} call - Tool call details
   */
  recordToolCall(call) {
    this.tool_calls.push({
      ...call,
      timestamp: Date.now()
    });
  }

  /**
   * Record provider call
   * @param {Object} call - Provider call details
   */
  recordProviderCall(call) {
    this.provider_calls.push({
      ...call,
      timestamp: Date.now()
    });
  }

  /**
   * Get summary for API responses
   * @returns {Object} safe summary
   */
  toSafeSummary() {
    return {
      execution_id: this.execution_id,
      framework_id: this.framework_id,
      status: this.status,
      success: this.success,
      duration_ms: this.duration_ms,
      tokens_used: this.tokens_used,
      tool_calls_count: this.tool_calls.length,
      provider_calls_count: this.provider_calls.length,
      errors_count: this.errors.length,
      warnings_count: this.warnings.length
    };
  }

  /**
   * Get detailed summary for audit
   * @returns {Object} detailed summary
   */
  toJSON() {
    return {
      execution_id: this.execution_id,
      framework_id: this.framework_id,
      framework_version: this.framework_version,
      session_id: this.session_id,
      correlation_id: this.correlation_id,
      status: this.status,
      success: this.success,
      result: this.result,
      output_summary: this.output_summary,
      tool_calls: this.tool_calls,
      provider_calls: this.provider_calls,
      start_time: this.start_time,
      end_time: this.end_time,
      duration_ms: this.duration_ms,
      tokens_used: this.tokens_used,
      cost: this.cost,
      memory_used_mb: this.memory_used_mb,
      errors: this.errors,
      warnings: this.warnings,
      guardian_reference: this.guardian_reference,
      audit_reference: this.audit_reference
    };
  }
}

module.exports = FrameworkResult;
