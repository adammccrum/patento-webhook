/**
 * Timeout Policy
 *
 * Support for multiple timeout levels and per-agent/provider/operation overrides.
 */

class TimeoutPolicy {
  constructor(options = {}) {
    // Default timeouts
    this.operationTimeoutMs = options.operationTimeoutMs || 30000;
    this.queueTimeoutMs = options.queueTimeoutMs || 60000;
    this.providerTimeoutMs = options.providerTimeoutMs || 30000;
    this.taskTimeoutMs = options.taskTimeoutMs || 120000;
    this.shutdownTimeoutMs = options.shutdownTimeoutMs || 30000;
    this.globalMaxTimeoutMs = options.globalMaxTimeoutMs || 300000;

    // Overrides
    this.agentOverrides = options.agentOverrides || {};
    this.providerOverrides = options.providerOverrides || {};
    this.operationOverrides = options.operationOverrides || {};
  }

  /**
   * Get effective timeout for operation
   * @param {Object} context - Operation context
   * @returns {number} timeout in milliseconds
   */
  getEffectiveTimeout(context = {}) {
    let timeout = this.operationTimeoutMs;

    // Apply agent override
    if (context.agentCode && this.agentOverrides[context.agentCode]) {
      timeout = this.agentOverrides[context.agentCode];
    }

    // Apply provider override
    if (context.providerId && this.providerOverrides[context.providerId]) {
      timeout = Math.min(timeout, this.providerOverrides[context.providerId]);
    }

    // Apply operation override
    if (context.operation && this.operationOverrides[context.operation]) {
      timeout = Math.min(timeout, this.operationOverrides[context.operation]);
    }

    // Apply global maximum
    timeout = Math.min(timeout, this.globalMaxTimeoutMs);

    return timeout;
  }

  /**
   * Get queue timeout
   * @returns {number} timeout in milliseconds
   */
  getQueueTimeout() {
    return Math.min(this.queueTimeoutMs, this.globalMaxTimeoutMs);
  }

  /**
   * Get provider timeout
   * @param {string} [providerId] - Provider identifier
   * @returns {number} timeout in milliseconds
   */
  getProviderTimeout(providerId) {
    let timeout = this.providerTimeoutMs;

    if (providerId && this.providerOverrides[providerId]) {
      timeout = this.providerOverrides[providerId];
    }

    return Math.min(timeout, this.globalMaxTimeoutMs);
  }

  /**
   * Get task timeout
   * @returns {number} timeout in milliseconds
   */
  getTaskTimeout() {
    return Math.min(this.taskTimeoutMs, this.globalMaxTimeoutMs);
  }

  /**
   * Get shutdown timeout
   * @returns {number} timeout in milliseconds
   */
  getShutdownTimeout() {
    return Math.min(this.shutdownTimeoutMs, this.globalMaxTimeoutMs);
  }

  /**
   * Set agent override
   * @param {string} agentCode - Agent identifier
   * @param {number} timeoutMs - Timeout in milliseconds
   */
  setAgentOverride(agentCode, timeoutMs) {
    this.agentOverrides[agentCode] = Math.min(timeoutMs, this.globalMaxTimeoutMs);
  }

  /**
   * Set provider override
   * @param {string} providerId - Provider identifier
   * @param {number} timeoutMs - Timeout in milliseconds
   */
  setProviderOverride(providerId, timeoutMs) {
    this.providerOverrides[providerId] = Math.min(timeoutMs, this.globalMaxTimeoutMs);
  }

  /**
   * Set operation override
   * @param {string} operation - Operation name
   * @param {number} timeoutMs - Timeout in milliseconds
   */
  setOperationOverride(operation, timeoutMs) {
    this.operationOverrides[operation] = Math.min(timeoutMs, this.globalMaxTimeoutMs);
  }
}

module.exports = TimeoutPolicy;
