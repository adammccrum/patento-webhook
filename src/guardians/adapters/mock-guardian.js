/**
 * Mock Guardian Adapter
 *
 * Test adapter that simulates Guardian behavior without external dependencies.
 * Used for development, testing and demonstration.
 */

const GuardianBase = require('../guardian-base');
const GuardianResult = require('../guardian-result');

class MockGuardian extends GuardianBase {
  constructor(options = {}) {
    super({
      guardian_id: options.guardian_id || 'mock-guardian',
      category: options.category || 'test',
      display_name: options.display_name || 'Mock Guardian',
      version: '1.0.0',
      timeout_ms: options.timeout_ms || 100,
      fail_mode: options.fail_mode || 'fail_closed',
      priority: options.priority || 100,
      ...options
    });

    this.allow_by_default = options.allow_by_default !== false;
    this.findings = options.findings || [];
    this.controls = options.controls || [];
    this.evaluation_count = 0;
  }

  async initialize() {
    this._emitEvent('initialized', { guardian_id: this.guardian_id });
  }

  getCapabilities() {
    return {
      supported_actions: ['*'],
      supported_resource_types: ['*'],
      network_required: false,
      configuration_required: false
    };
  }

  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: Date.now(),
      message: 'Mock Guardian operational'
    };
  }

  supports(_action, _resourceType) {
    return true;
  }

  async evaluate(context) {
    this.evaluation_count++;
    const startTime = Date.now();

    // Simulate processing
    await this._delay(10);

    const result = new GuardianResult({
      evaluation_id: context.evaluation_id,
      guardian_id: this.guardian_id,
      guardian_category: this.category,
      correlation_id: context.correlation_id,
      decision: this.allow_by_default ? 'allow' : 'deny',
      risk_level: 'low',
      confidence: 0.95,
      health_status: 'healthy',
      started_at: startTime,
      completed_at: Date.now()
    });

    // Add configured findings
    this.findings.forEach((finding) => result.addFinding(finding));

    // Add configured controls
    this.controls.forEach((control) => result.addControl(control));

    // Add reason
    if (this.allow_by_default) {
      result.addReason('Mock Guardian allows by default');
    } else {
      result.addReason('Mock Guardian denies by default');
    }

    this._emitEvent('evaluation_completed', {
      evaluation_id: context.evaluation_id,
      decision: result.decision
    });

    return result;
  }

  explain(result) {
    return {
      guardian_id: this.guardian_id,
      category: this.category,
      decision: result.decision,
      reason: 'Mock Guardian for testing',
      evaluation_count: this.evaluation_count
    };
  }

  /**
   * Get evaluation statistics
   * @returns {Object} statistics
   */
  getStats() {
    return {
      guardian_id: this.guardian_id,
      evaluation_count: this.evaluation_count,
      allow_by_default: this.allow_by_default
    };
  }

  /**
   * Reset statistics
   */
  reset() {
    this.evaluation_count = 0;
  }

  /**
   * Private: Delay utility for simulating async work
   * @private
   */
  async _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = MockGuardian;
