/**
 * Guardian Base Class
 *
 * Abstract base class that all Guardian adapters must implement.
 * Defines the interface for security evaluations.
 */

const GuardianResult = require('./guardian-result');

class GuardianBase {
  constructor(options = {}) {
    this.guardian_id = options.guardian_id;
    this.category = options.category;
    this.display_name = options.display_name;
    this.version = options.version || '1.0.0';
    this.enabled = options.enabled !== false;
    this.timeout_ms = options.timeout_ms || 5000;
    this.fail_mode = options.fail_mode || 'fail_closed'; // fail_closed, hold_for_review, fail_open_development_only
    this.priority = options.priority || 100;
    this.onEvent = options.onEvent || null;
  }

  /**
   * Initialize Guardian
   * @returns {Promise<void>}
   */
  async initialize() {
    // Override in subclass
  }

  /**
   * Get Guardian metadata
   * @returns {Object} metadata
   */
  getMetadata() {
    return {
      guardian_id: this.guardian_id,
      category: this.category,
      display_name: this.display_name,
      version: this.version,
      enabled: this.enabled,
      timeout_ms: this.timeout_ms,
      fail_mode: this.fail_mode,
      priority: this.priority
    };
  }

  /**
   * Get Guardian capabilities
   * @returns {Object} capabilities
   */
  getCapabilities() {
    return {
      supported_actions: [],
      supported_resource_types: [],
      network_required: false,
      configuration_required: false
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
   * Check if Guardian supports an action
   * @param {string} _action - Action name
   * @param {string} _resourceType - Resource type
   * @returns {boolean}
   */
  supports(_action, _resourceType) {
    // Override in subclass
    return false;
  }

  /**
   * Evaluate Guardian context
   * @param {GuardianContext} context - Evaluation context
   * @returns {Promise<GuardianResult>} evaluation result
   */
  async evaluate(context) {
    // Override in subclass
    const result = new GuardianResult({
      evaluation_id: context.evaluation_id,
      guardian_id: this.guardian_id,
      guardian_category: this.category,
      correlation_id: context.correlation_id,
      decision: 'unavailable',
      health_status: 'healthy'
    });

    result.addReason('Guardian evaluate() not implemented');
    return result;
  }

  /**
   * Get explanation for decision
   * @param {GuardianResult} result - Guardian result
   * @returns {Object} explanation
   */
  explain(result) {
    return {
      guardian_id: this.guardian_id,
      category: this.category,
      decision: result.decision,
      reasons: result.reasons,
      findings: result.findings,
      required_controls: result.required_controls,
      remediation: result.remediation
    };
  }

  /**
   * Cancel ongoing evaluation
   * @param {string} _evaluation_id - Evaluation ID
   * @returns {Promise<void>}
   */
  async cancel(_evaluation_id) {
    // Override in subclass if Guardian supports cancellation
  }

  /**
   * Cleanup resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Override in subclass if Guardian has cleanup
  }

  /**
   * Shutdown Guardian
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
        type: `guardian.${type}`,
        guardian_id: this.guardian_id,
        category: this.category,
        ...data,
        timestamp: Date.now()
      });
    }
  }
}

module.exports = GuardianBase;
