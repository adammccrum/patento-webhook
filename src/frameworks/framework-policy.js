/**
 * Framework Selection Policy Engine
 *
 * Policy-driven framework selection based on capabilities,
 * security constraints, and execution context.
 */

const { FrameworkNotAvailableError } = require('./framework-errors');

class FrameworkPolicy {
  constructor(registry, options = {}) {
    this.registry = registry;
    this.onEvent = options.onEvent || null;
    this.policies = new Map();
    this._initializeDefaultPolicies();
  }

  /**
   * Initialize default policies
   * @private
   */
  _initializeDefaultPolicies() {
    this.policies.set('default', {
      name: 'default',
      description: 'Default framework selection policy',
      rules: [
        { priority: 1000, condition: (f, ctx) => f.enabled && f.implementation_status !== 'disabled' },
        { priority: 500, condition: (f, ctx) => f.health_status === 'healthy' },
        { priority: 300, condition: (f, ctx) => !f.guardian_requirements || f.guardian_requirements.length === 0 }
      ]
    });

    this.policies.set('high-security', {
      name: 'high-security',
      description: 'High security policy - requires all authorization layers',
      rules: [
        { priority: 1000, condition: (f, ctx) => f.enabled && f.implementation_status !== 'disabled' },
        { priority: 700, condition: (f, ctx) => f.health_status === 'healthy' },
        { priority: 600, condition: (f, ctx) => f.sierra_required === true },
        { priority: 550, condition: (f, ctx) => f.uniform_required === true },
        { priority: 500, condition: (f, ctx) => ctx && ctx.hasSecurityReferences() }
      ]
    });

    this.policies.set('sandbox-only', {
      name: 'sandbox-only',
      description: 'Sandbox-only policy - no filesystem or network',
      rules: [
        { priority: 1000, condition: (f, ctx) => f.enabled && f.implementation_status !== 'disabled' },
        { priority: 600, condition: (f, ctx) => f.sandbox_support === true },
        { priority: 500, condition: (f, ctx) => f.filesystem_required === false },
        { priority: 500, condition: (f, ctx) => f.network_required === false }
      ]
    });

    this.policies.set('streaming-required', {
      name: 'streaming-required',
      description: 'Streaming-required policy - must support real-time streaming',
      rules: [
        { priority: 1000, condition: (f, ctx) => f.enabled && f.implementation_status !== 'disabled' },
        { priority: 700, condition: (f, ctx) => f.streaming_support === true },
        { priority: 500, condition: (f, ctx) => f.health_status === 'healthy' }
      ]
    });
  }

  /**
   * Register custom policy
   * @param {string} name - Policy name
   * @param {Object} policy - Policy definition with rules array
   */
  registerPolicy(name, policy) {
    if (!policy.rules || !Array.isArray(policy.rules)) {
      throw new Error('Policy must have a rules array');
    }
    this.policies.set(name, policy);
    this._emitEvent('policy_registered', { policy_name: name });
  }

  /**
   * Select framework by capability and policy
   * @param {string} capability - Required capability
   * @param {FrameworkContext} context - Execution context
   * @param {string} policy - Policy name
   * @returns {Object} Selected framework record
   */
  selectFramework(capability, context, policy = 'default') {
    const candidates = this._findCandidates(capability, context, policy);

    if (candidates.length === 0) {
      throw new FrameworkNotAvailableError(
        'any',
        `No framework available for capability ${capability} under ${policy} policy`
      );
    }

    return candidates[0];
  }

  /**
   * Select multiple frameworks
   * @param {string} capability - Required capability
   * @param {FrameworkContext} context - Execution context
   * @param {string} policy - Policy name
   * @param {number} count - Number of frameworks to select
   * @returns {Array} Selected framework records
   */
  selectFrameworks(capability, context, policy = 'default', count = 1) {
    const candidates = this._findCandidates(capability, context, policy);
    return candidates.slice(0, count);
  }

  /**
   * Check if framework can execute capability
   * @param {string} framework_id - Framework ID
   * @param {string} capability - Capability to check
   * @returns {boolean}
   */
  canExecute(framework_id, capability) {
    const record = this.registry.get(framework_id);
    if (!record) return false;
    if (!record.enabled) return false;
    if (record.implementation_status === 'disabled') return false;
    return record.adapter.supports(capability);
  }

  /**
   * Validate framework meets requirements
   * @param {string} framework_id - Framework ID
   * @param {FrameworkContext} context - Execution context
   * @returns {Object} validation result
   */
  validateFramework(framework_id, context) {
    const record = this.registry.get(framework_id);
    const errors = [];

    if (!record) {
      errors.push(`Framework ${framework_id} not found in registry`);
    } else {
      if (!record.enabled) errors.push('Framework is disabled');
      if (record.implementation_status === 'disabled') errors.push('Framework implementation is disabled');
      if (record.health_status === 'unhealthy') errors.push('Framework is unhealthy');

      if (record.sierra_required && (!context || !context.sierra_reference)) {
        errors.push('Framework requires Sierra authorization');
      }

      if (record.uniform_required && (!context || !context.uniform_reference)) {
        errors.push('Framework requires Uniform governance');
      }

      if (record.guardian_requirements && record.guardian_requirements.length > 0) {
        errors.push(`Framework requires Guardian: ${record.guardian_requirements.join(', ')}`);
      }

      if (record.network_required && (!context || !context.permissions?.includes('network:access'))) {
        errors.push('Framework requires network access permission');
      }

      if (record.filesystem_required && (!context || !context.permissions?.includes('filesystem:access'))) {
        errors.push('Framework requires filesystem access permission');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      framework_id
    };
  }

  /**
   * Private: Find candidate frameworks
   * @private
   */
  _findCandidates(capability, context, policyName) {
    const policy = this.policies.get(policyName);
    if (!policy) {
      throw new Error(`Unknown policy: ${policyName}`);
    }

    const all = this.registry.getAll();
    const candidates = [];

    for (const record of all) {
      if (!record.adapter.supports(capability)) continue;

      let score = 0;
      let passes = true;

      for (const rule of policy.rules) {
        try {
          if (rule.condition(record, context)) {
            score += rule.priority;
          }
        } catch (err) {
          passes = false;
          break;
        }
      }

      if (passes && score > 0) {
        candidates.push({ record, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.map(c => c.record);
  }

  /**
   * Get available capabilities
   * @returns {Array} List of capabilities
   */
  getAvailableCapabilities() {
    const capabilities = new Set();
    const all = this.registry.getAll();

    for (const record of all) {
      if (!record.enabled) continue;
      const caps = record.adapter.getCapabilities();
      Object.keys(caps).forEach(cap => {
        if (caps[cap]) capabilities.add(cap);
      });
    }

    return Array.from(capabilities);
  }

  /**
   * Get frameworks by capability
   * @param {string} capability - Capability name
   * @returns {Array} Framework records supporting capability
   */
  getFrameworksByCapability(capability) {
    const all = this.registry.getAll();
    return all.filter(r => r.enabled && r.adapter.supports(capability));
  }

  /**
   * Private: Emit event
   * @private
   */
  _emitEvent(type, data = {}) {
    if (this.onEvent) {
      this.onEvent({
        type: `framework.policy.${type}`,
        ...data,
        timestamp: Date.now()
      });
    }
  }
}

module.exports = FrameworkPolicy;
