/**
 * Guardian Pipeline
 *
 * Orchestrates the Guardian evaluation pipeline.
 * Executes Guardians in sequence or parallel, aggregates results.
 */

const { GuardianTimeoutError, GuardianCancelledError } = require('./guardian-errors');
const GuardianResult = require('./guardian-result');

class GuardianPipeline {
  constructor(options = {}) {
    this.registry = options.registry;
    this.policy = options.policy;
    this.onEvent = options.onEvent || null;
    this.active_evaluations = new Map();
  }

  /**
   * Execute Guardian pipeline
   * @param {GuardianContext} context - Evaluation context
   * @returns {Promise<Object>} pipeline result
   */
  async execute(context) {
    const pipelineId = context.evaluation_id;
    const startTime = Date.now();

    // Validate context
    const validation = context.validate();
    if (!validation.valid) {
      return this._createErrorResult(pipelineId, validation.errors.join('; '));
    }

    // Track this evaluation
    this.active_evaluations.set(pipelineId, {
      context,
      cancelled: false,
      start_time: startTime
    });

    try {
      // Get required Guardians
      const policyResult = this.policy.getRequiredGuardians(context);
      const required_ids = policyResult.required;
      const optional_ids = policyResult.optional;

      this._emitEvent('pipeline_started', {
        evaluation_id: pipelineId,
        required_guardians: required_ids.length,
        optional_guardians: optional_ids.length,
        fail_mode: policyResult.fail_mode
      });

      // Execute required Guardians
      const required_results = [];
      for (const guardian_id of required_ids) {
        if (this.active_evaluations.get(pipelineId).cancelled) {
          throw new GuardianCancelledError(pipelineId);
        }

        const result = await this._executeGuardian(guardian_id, context);
        required_results.push(result);

        if (!result.isAvailable() && policyResult.fail_mode === 'fail_closed') {
          // Stop on required Guardian failure
          break;
        }
      }

      // Execute optional Guardians (in parallel if possible)
      const optional_results = [];
      for (const guardian_id of optional_ids) {
        if (this.active_evaluations.get(pipelineId).cancelled) {
          throw new GuardianCancelledError(pipelineId);
        }

        const result = await this._executeGuardian(guardian_id, context);
        optional_results.push(result);
      }

      // Aggregate results
      const aggregated = this._aggregateResults(
        pipelineId,
        required_results,
        optional_results,
        policyResult.fail_mode
      );

      this._emitEvent('pipeline_completed', {
        evaluation_id: pipelineId,
        decision: aggregated.final_decision,
        processing_time_ms: Date.now() - startTime
      });

      return aggregated;
    } catch (error) {
      this._emitEvent('pipeline_failed', {
        evaluation_id: pipelineId,
        error: error.message
      });

      return this._createErrorResult(pipelineId, error.message);
    } finally {
      this.active_evaluations.delete(pipelineId);
    }
  }

  /**
   * Cancel evaluation
   * @param {string} evaluation_id - Evaluation ID
   * @returns {Promise<void>}
   */
  async cancel(evaluation_id) {
    const eval_data = this.active_evaluations.get(evaluation_id);
    if (eval_data) {
      eval_data.cancelled = true;
      this._emitEvent('evaluation_cancelled', { evaluation_id });
    }
  }

  /**
   * Private: Execute single Guardian
   * @private
   */
  async _executeGuardian(guardian_id, context) {
    const adapter = this.registry.getAdapter(guardian_id);
    if (!adapter) {
      const result = new GuardianResult({
        evaluation_id: context.evaluation_id,
        guardian_id,
        decision: 'unavailable',
        health_status: 'unknown'
      });
      result.addReason(`Guardian ${guardian_id} not found in registry`);
      return result;
    }

    const record = this.registry.get(guardian_id);
    const timeoutMs = Math.min(adapter.timeout_ms, context.getTimeRemaining() || adapter.timeout_ms);

    try {
      const result = await Promise.race([
        adapter.evaluate(context),
        this._createTimeout(guardian_id, timeoutMs)
      ]);

      this._emitEvent('guardian_evaluated', {
        evaluation_id: context.evaluation_id,
        guardian_id,
        decision: result.decision,
        processing_time_ms: result.processing_time_ms
      });

      return result;
    } catch (error) {
      if (error instanceof GuardianTimeoutError) {
        const result = new GuardianResult({
          evaluation_id: context.evaluation_id,
          guardian_id,
          decision: record.fail_mode === 'fail_closed' ? 'deny' : 'allow',
          health_status: 'degraded',
          error: error.message
        });
        result.addReason(`Guardian evaluation timed out after ${timeoutMs}ms`);
        return result;
      }

      const result = new GuardianResult({
        evaluation_id: context.evaluation_id,
        guardian_id,
        decision: record.fail_mode === 'fail_closed' ? 'deny' : 'unavailable',
        health_status: 'unhealthy',
        error: error.message
      });
      result.addReason(`Guardian evaluation failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Private: Create timeout promise
   * @private
   */
  _createTimeout(guardian_id, timeoutMs) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new GuardianTimeoutError(guardian_id, timeoutMs));
      }, timeoutMs);
    });
  }

  /**
   * Private: Aggregate results from multiple Guardians
   * @private
   */
  _aggregateResults(evaluation_id, required_results, optional_results, fail_mode) {
    const all_results = [...required_results, ...optional_results];

    // Determine final decision
    let final_decision = 'allow';
    let highest_risk = 'none';

    // Any required Guardian denial -> deny
    const denied = required_results.filter((r) => r.isDenied());
    if (denied.length > 0) {
      final_decision = 'deny';
    }

    // Any required Guardian unavailable in fail_closed -> deny
    const unavailable = required_results.filter((r) => !r.isAvailable());
    if (unavailable.length > 0 && fail_mode === 'fail_closed') {
      final_decision = 'deny';
    }

    // Any required Guardian hold_for_authorisation -> hold
    const hold_auth = required_results.filter((r) => r.requiresAuthorisation());
    if (hold_auth.length > 0 && final_decision !== 'deny') {
      final_decision = 'hold_for_authorisation';
    }

    // Any required Guardian hold_for_review -> hold
    const hold_review = required_results.filter((r) => r.requiresReview());
    if (hold_review.length > 0 && final_decision !== 'deny' && final_decision !== 'hold_for_authorisation') {
      final_decision = 'hold_for_review';
    }

    // Aggregate findings and controls
    const all_findings = all_results.flatMap((r) => r.findings);
    const all_controls = all_results.flatMap((r) => r.required_controls);

    // Calculate risk
    for (const result of all_results) {
      if (this._riskLevel(result.risk_level) > this._riskLevel(highest_risk)) {
        highest_risk = result.risk_level;
      }
    }

    return {
      evaluation_id,
      final_decision,
      risk_level: highest_risk,
      required_guardians_evaluated: required_results.length,
      optional_guardians_evaluated: optional_results.length,
      all_results,
      findings: all_findings,
      controls: all_controls,
      requires_authorisation: final_decision === 'hold_for_authorisation',
      requires_review: final_decision === 'hold_for_review',
      processing_time_ms: Date.now() - all_results[0].started_at
    };
  }

  /**
   * Private: Convert risk level to numeric
   * @private
   */
  _riskLevel(level) {
    const levels = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
      unknown: 2
    };
    return levels[level] || 0;
  }

  /**
   * Private: Create error result
   * @private
   */
  _createErrorResult(evaluation_id, error_message) {
    return {
      evaluation_id,
      final_decision: 'deny',
      risk_level: 'unknown',
      error: error_message,
      all_results: []
    };
  }

  /**
   * Private: Emit event
   * @private
   */
  _emitEvent(type, data = {}) {
    if (this.onEvent) {
      this.onEvent({
        type: `guardian.${type}`,
        ...data,
        timestamp: Date.now()
      });
    }
  }
}

module.exports = GuardianPipeline;
