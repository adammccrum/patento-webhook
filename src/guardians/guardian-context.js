/**
 * Guardian Context
 *
 * Structured context passed to Guardian evaluations.
 * Contains all relevant information for security decision-making.
 */

const { v4: uuid } = require('uuid');

class GuardianContext {
  constructor(options = {}) {
    // Identifiers
    this.evaluation_id = options.evaluation_id || uuid();
    this.correlation_id = options.correlation_id;
    this.objective_id = options.objective_id;
    this.task_id = options.task_id;

    // Requesting identity
    this.requesting_identity = options.requesting_identity;
    this.requesting_agent = options.requesting_agent;
    this.requesting_user = options.requesting_user;

    // Target details
    this.target_agent = options.target_agent;
    this.target_provider = options.target_provider;

    // Action details
    this.action = options.action;
    this.capability = options.capability;
    this.input_summary = options.input_summary;
    this.resource_references = options.resource_references || [];

    // Security context
    this.permissions = options.permissions || [];
    this.authorisation_reference = options.authorisation_reference;
    this.privacy_classification = options.privacy_classification || 'internal';
    this.risk_classification = options.risk_classification || 'medium';

    // Execution context
    this.execution_mode = options.execution_mode || 'synchronous';
    this.network_destinations = options.network_destinations || [];
    this.filesystem_targets = options.filesystem_targets || [];
    this.command_summary = options.command_summary;

    // Model and dependencies
    this.model_reference = options.model_reference;
    this.dependency_reference = options.dependency_reference;

    // Prior results
    this.previous_guardian_results = options.previous_guardian_results || [];

    // Timing
    this.created_at = Date.now();
    this.deadline = options.deadline;

    // Metadata
    this.source = options.source;
    this.metadata = options.metadata || {};
  }

  /**
   * Validate context has required fields
   * @returns {Object} validation result with errors array
   */
  validate() {
    const errors = [];

    if (!this.evaluation_id) errors.push('evaluation_id is required');
    if (!this.action) errors.push('action is required');

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
      evaluation_id: this.evaluation_id,
      correlation_id: this.correlation_id,
      action: this.action,
      requesting_agent: this.requesting_agent,
      target_provider: this.target_provider,
      risk_classification: this.risk_classification,
      privacy_classification: this.privacy_classification
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
   * Get remaining time to deadline
   * @returns {number} milliseconds remaining, or null if no deadline
   */
  getTimeRemaining() {
    if (!this.deadline) return null;
    return Math.max(0, this.deadline - Date.now());
  }
}

module.exports = GuardianContext;
