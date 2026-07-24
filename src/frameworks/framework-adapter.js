/**
 * Framework Adapter Pattern
 *
 * Base implementation of the adapter pattern for framework integration.
 * Provides common utilities for framework adapters.
 */

const FrameworkBase = require('./framework-base');
const FrameworkResult = require('./framework-result');

class FrameworkAdapter extends FrameworkBase {
  constructor(options = {}) {
    super(options);
    this.adapter_type = options.adapter_type || 'generic';
    this.framework_features = options.framework_features || {};
    this.session_manager = null;
  }

  /**
   * Create execution session
   * @param {FrameworkContext} context - Execution context
   * @returns {Promise<Object>} session details
   */
  async createSession(context) {
    const session = {
      session_id: context.session_id,
      framework_id: this.framework_id,
      created_at: Date.now(),
      execution_id: context.execution_id,
      correlation_id: context.correlation_id,
      status: 'active',
      timeout_ms: context.timeout_ms || this.timeout_ms
    };

    return session;
  }

  /**
   * Cleanup session resources
   * @param {string} session_id - Session ID
   * @returns {Promise<void>}
   */
  async cleanupSession(session_id) {
    // Override in subclass if needed
  }

  /**
   * Create safe context for external framework
   * @param {FrameworkContext} context - Original context
   * @returns {Object} sanitized context for framework
   */
  createSafeContext(context) {
    return {
      execution_id: context.execution_id,
      correlation_id: context.correlation_id,
      objective_id: context.objective_id,
      task_id: context.task_id,
      session_id: context.session_id,
      framework_id: context.framework_id,
      agent_code: context.agent_code,
      provider_id: context.provider_id,
      capability: context.capability,
      permissions: context.permissions,
      timeout_ms: context.timeout_ms,
      max_tokens: context.max_tokens,
      memory_limit_mb: context.memory_limit_mb,
      privacy_classification: context.privacy_classification,
      risk_classification: context.risk_classification,
      objective_description: context.objective_description,
      tool_references: context.tool_references || [],
      execution_mode: context.execution_mode,
      streaming_enabled: context.streaming_enabled,
      human_approval_required: context.human_approval_required,
      metadata: context.metadata || {}
    };
  }

  /**
   * Wrap framework execution with timeout
   * @param {Promise} promise - Framework execution promise
   * @param {number} timeout_ms - Timeout in milliseconds
   * @param {string} execution_id - Execution ID
   * @returns {Promise} wrapped execution
   */
  async executeWithTimeout(promise, timeout_ms, execution_id) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Framework execution timeout after ${timeout_ms}ms`));
        }, timeout_ms);
      })
    ]);
  }

  /**
   * Record execution metrics
   * @param {FrameworkResult} result - Execution result
   * @param {Object} metrics - Metrics to record
   */
  recordMetrics(result, metrics) {
    if (metrics.tokens_used !== undefined) result.tokens_used = metrics.tokens_used;
    if (metrics.tokens_limit !== undefined) result.tokens_limit = metrics.tokens_limit;
    if (metrics.cost !== undefined) result.cost = metrics.cost;
    if (metrics.memory_used_mb !== undefined) result.memory_used_mb = metrics.memory_used_mb;
    if (metrics.memory_peak_mb !== undefined) result.memory_peak_mb = metrics.memory_peak_mb;
    if (metrics.cpu_time_ms !== undefined) result.cpu_time_ms = metrics.cpu_time_ms;
  }

  /**
   * Validate execution result
   * @param {*} result - Result from framework
   * @returns {Object} validation result
   */
  validateResult(result) {
    const errors = [];

    if (!result) {
      errors.push('Framework returned null result');
    } else if (typeof result !== 'object') {
      errors.push('Framework result must be an object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Transform framework result to FrameworkResult
   * @param {Object} frameworkResult - Result from external framework
   * @param {string} execution_id - Execution ID
   * @returns {FrameworkResult} structured result
   */
  transformResult(frameworkResult, execution_id) {
    const result = new FrameworkResult({
      execution_id,
      framework_id: this.framework_id,
      status: 'completed',
      result: frameworkResult
    });

    return result;
  }

  /**
   * Handle framework error
   * @param {Error} error - Error from framework
   * @param {string} execution_id - Execution ID
   * @returns {FrameworkResult} error result
   */
  handleError(error, execution_id) {
    const result = new FrameworkResult({
      execution_id,
      framework_id: this.framework_id,
      status: 'failed'
    });

    result.fail(error);
    return result;
  }

  /**
   * Check resource constraints
   * @param {FrameworkContext} context - Execution context
   * @returns {Object} validation result
   */
  checkResourceConstraints(context) {
    const errors = [];

    if (context.timeout_ms && context.timeout_ms < 1000) {
      errors.push('Timeout must be at least 1000ms');
    }

    if (context.memory_limit_mb && context.memory_limit_mb < 128) {
      errors.push('Memory limit must be at least 128MB');
    }

    if (context.max_tokens && context.max_tokens < 0) {
      errors.push('Max tokens cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
}

  /**
   * Get adapter info
   * @returns {Object} adapter information
   */
  getAdapterInfo() {
    return {
      framework_id: this.framework_id,
      display_name: this.display_name,
      adapter_type: this.adapter_type,
      version: this.version,
      capabilities: this.getCapabilities(),
      features: this.framework_features,
      enabled: this.enabled,
      timeout_ms: this.timeout_ms
    };
  }
}

module.exports = FrameworkAdapter;
