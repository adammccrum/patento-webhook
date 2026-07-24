/**
 * Guardian Result
 *
 * Structured result returned from Guardian evaluations.
 * Contains decision, findings, and required controls.
 */

const { v4: uuid } = require('uuid');

class GuardianResult {
  constructor(options = {}) {
    // Identifiers
    this.evaluation_id = options.evaluation_id || uuid();
    this.guardian_id = options.guardian_id;
    this.guardian_category = options.guardian_category;
    this.correlation_id = options.correlation_id;

    // Decision
    this.decision = options.decision || 'unavailable'; // allow, allow_with_controls, hold_for_authorisation, hold_for_review, deny, unavailable, error
    this.risk_level = options.risk_level || 'unknown'; // none, low, medium, high, critical
    this.confidence = options.confidence !== undefined ? options.confidence : 0.5; // 0.0 to 1.0

    // Reasoning
    this.reasons = options.reasons || [];
    this.findings = options.findings || [];
    this.warnings = options.warnings || [];

    // Required actions
    this.required_controls = options.required_controls || [];
    this.required_permissions = options.required_permissions || [];
    this.authorisation_required = options.authorisation_required || false;
    this.manual_review_required = options.manual_review_required || false;

    // Remediation
    this.remediation = options.remediation;

    // References
    this.policy_references = options.policy_references || [];
    this.evidence_references = options.evidence_references || [];
    this.audit_reference = options.audit_reference;

    // Health
    this.health_status = options.health_status || 'unknown'; // healthy, degraded, unhealthy
    this.error = options.error;

    // Timing
    this.started_at = options.started_at || Date.now();
    this.completed_at = options.completed_at || Date.now();
    this.processing_time_ms = this.completed_at - this.started_at;
  }

  /**
   * Check if decision is allow
   * @returns {boolean}
   */
  isAllowed() {
    return this.decision === 'allow' || this.decision === 'allow_with_controls';
  }

  /**
   * Check if decision is allow without controls
   * @returns {boolean}
   */
  isUnconditionallyAllowed() {
    return this.decision === 'allow';
  }

  /**
   * Check if decision is deny
   * @returns {boolean}
   */
  isDenied() {
    return this.decision === 'deny';
  }

  /**
   * Check if decision requires authorisation
   * @returns {boolean}
   */
  requiresAuthorisation() {
    return this.decision === 'hold_for_authorisation' || this.authorisation_required;
  }

  /**
   * Check if decision requires review
   * @returns {boolean}
   */
  requiresReview() {
    return this.decision === 'hold_for_review' || this.manual_review_required;
  }

  /**
   * Check if Guardian is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.decision !== 'unavailable' && this.decision !== 'error';
  }

  /**
   * Add finding
   * @param {Object} finding
   */
  addFinding(finding) {
    this.findings.push({
      id: finding.id || uuid(),
      type: finding.type, // e.g. 'secret_detected', 'unsafe_network', 'prompt_injection'
      severity: finding.severity || 'medium', // low, medium, high, critical
      description: finding.description,
      evidence: finding.evidence,
      remediation: finding.remediation,
      timestamp: Date.now()
    });
  }

  /**
   * Add control
   * @param {Object} control
   */
  addControl(control) {
    this.required_controls.push({
      id: control.id || uuid(),
      type: control.type, // e.g. 'rate_limit', 'audit_log', 'approval'
      description: control.description,
      enforcement: control.enforcement || 'required',
      timestamp: Date.now()
    });
  }

  /**
   * Add reason
   * @param {string} reason
   */
  addReason(reason) {
    if (!this.reasons.includes(reason)) {
      this.reasons.push(reason);
    }
  }

  /**
   * Mark as denied with reason
   * @param {string} reason
   */
  deny(reason) {
    this.decision = 'deny';
    this.addReason(reason);
  }

  /**
   * Mark as allowed with controls
   * @param {Array} controls
   */
  allowWithControls(controls = []) {
    this.decision = 'allow_with_controls';
    controls.forEach((control) => this.addControl(control));
  }

  /**
   * Mark as holding for authorisation
   */
  holdForAuthorisation() {
    this.decision = 'hold_for_authorisation';
    this.authorisation_required = true;
  }

  /**
   * Mark as holding for review
   */
  holdForReview() {
    this.decision = 'hold_for_review';
    this.manual_review_required = true;
  }

  /**
   * Get safe summary for API responses (no sensitive data)
   * @returns {Object} summary
   */
  toSafeSummary() {
    return {
      evaluation_id: this.evaluation_id,
      guardian_id: this.guardian_id,
      guardian_category: this.guardian_category,
      decision: this.decision,
      risk_level: this.risk_level,
      requires_authorisation: this.requiresAuthorisation(),
      requires_review: this.requiresReview(),
      processing_time_ms: this.processing_time_ms,
      findings_count: this.findings.length,
      controls_count: this.required_controls.length
    };
  }

  /**
   * Get detailed summary for audit
   * @returns {Object} summary
   */
  toJSON() {
    return {
      evaluation_id: this.evaluation_id,
      guardian_id: this.guardian_id,
      guardian_category: this.guardian_category,
      correlation_id: this.correlation_id,
      decision: this.decision,
      risk_level: this.risk_level,
      confidence: this.confidence,
      reasons: this.reasons,
      findings: this.findings,
      warnings: this.warnings,
      required_controls: this.required_controls,
      required_permissions: this.required_permissions,
      authorisation_required: this.authorisation_required,
      manual_review_required: this.manual_review_required,
      remediation: this.remediation,
      policy_references: this.policy_references,
      evidence_references: this.evidence_references,
      audit_reference: this.audit_reference,
      health_status: this.health_status,
      error: this.error,
      started_at: this.started_at,
      completed_at: this.completed_at,
      processing_time_ms: this.processing_time_ms
    };
  }
}

module.exports = GuardianResult;
