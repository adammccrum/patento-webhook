/**
 * Framework Base Class
 *
 * Abstract base class for all framework adapters.
 * Defines the contract that every framework must implement.
 */

const FrameworkResult = require('./framework-result');

class FrameworkBase {
  constructor(options = {}) {
    this.framework_id = options.framework_id;
    this.display_name = options.display_name;
    this.version = options.version || '0.0.0';
    this.enabled = options.enabled !== false;
    this.timeout_ms = options.timeout_ms || 30000;
    this.onEvent = options.onEvent || null;
  }

  /**
   * Initialize framework adapter
   * @returns {Promise<void>}
   */
  async initialize() {
    // Override in subclass
  }

  /**
   * Get framework metadata
   * @returns {Object} metadata
   */
  getMetadata() {
    return {
      framework_id: this.framework_id,
      display_name: this.display_name,
      version: this.version,
      enabled: this.enabled,
      timeout_ms: this.timeout_ms
    };
  }

  /**
   * Get framework capabilities
   * @returns {Object} capabilities
   */
  getCapabilities() {
    return {
      multi_agent: false,
      tool_calling: false,
      rag: false,
      streaming: false,
      human_approval: false,
      browser: false,
      vision: false,
      voice: false,
      mcp: false,
      memory: false,
      workflow: false,
      database: false
    };
  }

  /**
   * Perform health check
   * @returns {Promise<Object>} health status
   */
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: Date.now(),
      message: 'OK'
    };
  }

  /**
   * Check if framework supports capability
   * @param {string} capability - Capability name
   * @returns {boolean}
   */
  supports(capability) {
    // Override in subclass
    return false;
  }

  /**
   * Create execution session
   * @param {FrameworkContext} context - Execution context
   * @returns {Promise<Object>} session details
   */
  async createSession(context) {
    // Override in subclass
    return {
      session_id: context.session_id,
      created_at: Date.now()
    };
  }

  /**
   * Execute framework with context
   * @param {FrameworkContext} context - Execution context
   * @returns {Promise<FrameworkResult>} execution result
   */
  async execute(context) {
    // Override in subclass
    const result = new FrameworkResult({
      execution_id: context.execution_id,
      framework_id: this.framework_id,
      status: 'unavailable'
    });

    result.addWarning('Framework execute() not implemented');
    return result;
  }

  /**
   * Cancel ongoing execution
   * @param {string} execution_id - Execution ID
   * @returns {Promise<void>}
   */
  async cancel(execution_id) {
    // Override in subclass if framework supports cancellation
  }

  /**
   * Cleanup resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Override in subclass if framework has cleanup
  }

  /**
   * Shutdown framework
   * @returns {Promise<void>}
   */
  async shutdown() {
    await this.cleanup();
  }

  /**
   * Emit event
   * @param {string} type - Event type
   * @param {Object} data - Event data
   */
  _emitEvent(type, data = {}) {
    if (this.onEvent) {
      this.onEvent({
        type: `framework.${type}`,
        framework_id: this.framework_id,
        ...data,
        timestamp: Date.now()
      });
    }
  }
}

module.exports = FrameworkBase;
