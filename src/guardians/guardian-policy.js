/**
 * Guardian Policy Engine
 *
 * Configuration-driven policy evaluation based on context.
 * Determines which Guardians are required for an action.
 */

class GuardianPolicy {
  constructor(options = {}) {
    this.policies = options.policies || [];
    this.default_policy = options.default_policy || {
      fail_mode: 'fail_closed',
      required_guardians: ['audit'],
      optional_guardians: []
    };
  }

  /**
   * Get required Guardians for an action
   * @param {GuardianContext} context - Evaluation context
   * @returns {Object} guardian requirements
   */
  getRequiredGuardians(context) {
    const policy = this._findPolicy(context);

    return {
      required: policy.required_guardians || [],
      optional: policy.optional_guardians || [],
      fail_mode: policy.fail_mode || this.default_policy.fail_mode,
      reason: policy.name || policy.policy_name || 'default_policy'
    };
  }

  /**
   * Check if Guardian evaluation is required
   * @param {string} guardian_id - Guardian ID
   * @param {GuardianContext} context - Evaluation context
   * @returns {boolean}
   */
  isGuardianRequired(guardian_id, context) {
    const required = this.getRequiredGuardians(context);
    return required.required.includes(guardian_id);
  }

  /**
   * Check if Guardian evaluation is optional
   * @param {string} guardian_id - Guardian ID
   * @param {GuardianContext} context - Evaluation context
   * @returns {boolean}
   */
  isGuardianOptional(guardian_id, context) {
    const required = this.getRequiredGuardians(context);
    return required.optional.includes(guardian_id);
  }

  /**
   * Add policy
   * @param {Object} policy - Policy definition
   */
  addPolicy(policy) {
    if (!policy.name) throw new Error('Policy must have a name');
    this.policies.push(policy);
  }

  /**
   * Remove policy by name
   * @param {string} name - Policy name
   */
  removePolicy(name) {
    this.policies = this.policies.filter((p) => p.name !== name);
  }

  /**
   * Get all policies
   * @returns {Array} policies
   */
  getPolicies() {
    return [...this.policies];
  }

  /**
   * Get policy explanation for context
   * @param {GuardianContext} context - Evaluation context
   * @returns {Object} explanation
   */
  explainPolicy(context) {
    const policy = this._findPolicy(context);
    return {
      policy_name: policy.name || policy.policy_name || 'default_policy',
      matches: policy.matches || [],
      required_guardians: policy.required_guardians || [],
      optional_guardians: policy.optional_guardians || [],
      fail_mode: policy.fail_mode || this.default_policy.fail_mode,
      priority: policy.priority || 0,
      description: policy.description
    };
  }

  /**
   * Private: Find applicable policy for context
   * @private
   */
  _findPolicy(context) {
    // Sort policies by priority (higher first)
    const sorted = [...this.policies].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const policy of sorted) {
      if (this._policyMatches(policy, context)) {
        return policy;
      }
    }

    return this.default_policy;
  }

  /**
   * Private: Check if policy matches context
   * @private
   */
  _policyMatches(policy, context) {
    // Match by action
    if (policy.action) {
      if (Array.isArray(policy.action)) {
        if (!policy.action.includes(context.action)) return false;
      } else if (policy.action !== context.action) {
        return false;
      }
    }

    // Match by requesting role
    if (policy.requesting_role) {
      if (Array.isArray(policy.requesting_role)) {
        if (!policy.requesting_role.includes(context.requesting_role)) return false;
      } else if (policy.requesting_role !== context.requesting_role) {
        return false;
      }
    }

    // Match by requesting agent
    if (policy.requesting_agent) {
      if (Array.isArray(policy.requesting_agent)) {
        if (!policy.requesting_agent.includes(context.requesting_agent)) return false;
      } else if (policy.requesting_agent !== context.requesting_agent) {
        return false;
      }
    }

    // Match by target provider
    if (policy.target_provider) {
      if (Array.isArray(policy.target_provider)) {
        if (!policy.target_provider.includes(context.target_provider)) return false;
      } else if (policy.target_provider !== context.target_provider) {
        return false;
      }
    }

    // Match by execution mode
    if (policy.execution_mode) {
      if (Array.isArray(policy.execution_mode)) {
        if (!policy.execution_mode.includes(context.execution_mode)) return false;
      } else if (policy.execution_mode !== context.execution_mode) {
        return false;
      }
    }

    // Match by data classification
    if (policy.data_classification) {
      if (Array.isArray(policy.data_classification)) {
        if (!policy.data_classification.includes(context.privacy_classification)) return false;
      } else if (policy.data_classification !== context.privacy_classification) {
        return false;
      }
    }

    // Match by risk level
    if (policy.risk_level) {
      if (Array.isArray(policy.risk_level)) {
        if (!policy.risk_level.includes(context.risk_classification)) return false;
      } else if (policy.risk_level !== context.risk_classification) {
        return false;
      }
    }

    // Match by network use
    if (policy.requires_network !== undefined) {
      const hasNetwork = context.network_destinations && context.network_destinations.length > 0;
      if (policy.requires_network !== hasNetwork) return false;
    }

    // Match by filesystem access
    if (policy.requires_filesystem !== undefined) {
      const hasFilesystem = context.filesystem_targets && context.filesystem_targets.length > 0;
      if (policy.requires_filesystem !== hasFilesystem) return false;
    }

    return true;
  }
}

module.exports = GuardianPolicy;
