/**
 * Framework Execution Context
 *
 * Structured context passed to framework adapters.
 * Contains all relevant information for framework execution.
 */

const { v4: uuid } = require('uuid');

class FrameworkContext {
  constructor(options = {}) {
    // Identifiers
    this.execution_id = options.execution_id || uuid();
    this.correlation_id = options.correlation_id;
    this.objective_id = options.objective_id;
    this.task_id = options.task_id;
    this.session_id = options.session_id || uuid();

    // Framework details
    this.framework_id = options.framework_id;
    this.framework_version = options.framework_version;

    // Agent and provider context
    this.agent_code = options.agent_code;
    this.provider_id = options.provider_id;
    this.capability = options.capability;

    // Requesting identity
    this.requesting_identity = options.requesting_identity;
    this.requesting_user = options.requesting_user;
    this.permissions = options.permissions || [];

    // Security references
    this.guardian_reference = options.guardian_reference;
    this.sierra_reference = options.sierra_reference;
    this.uniform_reference = options.uniform_reference;
    this.audit_reference = options.audit_reference;

    // Resource limits
    this.timeout_ms = options.timeout_ms;
    this.max_tokens = options.max_tokens;
    this.memory_limit_mb = options.memory_limit_mb;
    this.execution_budget = options.execution_budget;

    // Classification
    this.privacy_classification = options.privacy_classification || 'internal';
    this.risk_classification = options.risk_classification || 'medium';

    // Execution parameters
    this.objective_description = options.objective_description;
    this.tool_references = options.tool_references || [];
    this.provider_references = options.provider_references || [];
    this.resource_references = options.resource_references || [];

    // Execution mode
    this.execution_mode = options.execution_mode || 'synchronous';
    this.streaming_enabled = options.streaming_enabled !== false;
    this.human_approval_required = options.human_approval_required || false;

    // Metadata
    this.created_at = Date.now();
    this.deadline = options.deadline;
    this.metadata = options.metadata || {};
  }

  /**
   * Validate context has required fields
   * @returns {Object} validation result
   */
  validate() {
    const errors = [];

    if (!this.execution_id) errors.push('execution_id is required');
    if (!this.framework_id) errors.push('framework_id is required');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get summary for logging
   * @returns {Object} summary
   */
  getSummary() {
    return {
      execution_id: this.execution_id,
      framework_id: this.framework_id,
      correlation_id: this.correlation_id,
      agent_code: this.agent_code,
      provider_id: this.provider_id,
      risk_classification: this.risk_classification
    };
  }

  /**
   * Check if execution is within deadline
   * @returns {boolean} true if within deadline
   */
  withinDeadline() {
    if (!this.deadline) return true;
    return Date.now() < this.deadline;
  }

  /**
   * Get time remaining to deadline
   * @returns {number} milliseconds remaining or null
   */
  getTimeRemaining() {
    if (!this.deadline) return null;
    return Math.max(0, this.deadline - Date.now());
  }

  /**
   * Check if execution has required security references
   * @returns {boolean} true if all required references present
   */
  hasSecurityReferences() {
    return (
      !!this.sierra_reference &&
      !!this.uniform_reference &&
      !!this.audit_reference
    );
  }
}

module.exports = FrameworkContext;
