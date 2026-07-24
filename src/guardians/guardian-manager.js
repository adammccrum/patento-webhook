/**
 * Guardian Manager
 *
 * Central orchestrator for the Guardian Framework.
 * Manages registry, policy, pipeline, and health.
 */

const GuardianRegistry = require('./guardian-registry');
const GuardianPolicy = require('./guardian-policy');
const GuardianPipeline = require('./guardian-pipeline');
const GuardianHealthMonitor = require('./guardian-health-monitor');
const GuardianContext = require('./guardian-context');

class GuardianManager {
  constructor(options = {}) {
    this.registry = new GuardianRegistry({ onEvent: options.onEvent });
    this.policy = new GuardianPolicy(options.policy || {});
    this.pipeline = new GuardianPipeline({
      registry: this.registry,
      policy: this.policy,
      onEvent: options.onEvent
    });
    this.health_monitor = new GuardianHealthMonitor(options.health_monitor || {});
    this.onEvent = options.onEvent || null;
    this.initialized = false;
  }

  /**
   * Initialize Guardian Manager
   * @returns {Promise<void>}
   */
  async initialize() {
    const startTime = Date.now();

    // Initialize all registered Guardians
    const guardians = this.registry.getAll();
    for (const record of guardians) {
      try {
        await record.adapter.initialize();
        this._emitEvent('guardian_initialized', {
          guardian_id: record.guardian_id
        });
      } catch (error) {
        this._emitEvent('guardian_initialization_failed', {
          guardian_id: record.guardian_id,
          error: error.message
        });
      }
    }

    this.initialized = true;
    this._emitEvent('manager_initialized', {
      guardians: guardians.length,
      initialization_time_ms: Date.now() - startTime
    });
  }

  /**
   * Register Guardian
   * @param {GuardianBase} guardian - Guardian instance
   * @param {Object} metadata - Guardian metadata
   */
  registerGuardian(guardian, metadata = {}) {
    this.registry.register(guardian, metadata);
  }

  /**
   * Evaluate action through Guardian framework
   * @param {GuardianContext|Object} context - Evaluation context
   * @returns {Promise<Object>} evaluation result
   */
  async evaluate(context) {
    // Convert plain object to GuardianContext if needed
    if (!(context instanceof GuardianContext)) {
      context = new GuardianContext(context);
    }

    this._emitEvent('evaluation_requested', {
      evaluation_id: context.evaluation_id,
      action: context.action
    });

    try {
      const result = await this.pipeline.execute(context);

      // Record results for health tracking
      for (const guardian_result of result.all_results || []) {
        this.health_monitor.recordEvaluation(guardian_result.guardian_id, guardian_result);
      }

      this._emitEvent(
        `evaluation_${result.final_decision}`,
        this._getSafeSummary(result)
      );

      return result;
    } catch (error) {
      this._emitEvent('evaluation_error', {
        evaluation_id: context.evaluation_id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get health status
   * @returns {Object} health status
   */
  getHealthStatus() {
    return {
      manager_initialized: this.initialized,
      registry_stats: this.registry.getStats(),
      aggregate_health: this.health_monitor.getAggregateHealth(),
      timestamp: Date.now()
    };
  }

  /**
   * Get Guardian status
   * @param {string} guardian_id - Guardian ID
   * @returns {Object} Guardian status
   */
  getGuardianStatus(guardian_id) {
    const record = this.registry.get(guardian_id);
    const health = this.health_monitor.getHealthStatus(guardian_id);

    return {
      ...record,
      ...health,
      adapter: undefined // Don't expose adapter instance
    };
  }

  /**
   * Get all Guardian statuses
   * @returns {Array} Guardian statuses
   */
  getAllGuardianStatuses() {
    return this.registry.getAll().map((record) => {
      const health = this.health_monitor.getHealthStatus(record.guardian_id);
      return {
        ...record,
        ...health,
        adapter: undefined
      };
    });
  }

  /**
   * Enable Guardian
   * @param {string} guardian_id - Guardian ID
   */
  enableGuardian(guardian_id) {
    this.registry.enable(guardian_id);
    this._emitEvent('guardian_enabled', { guardian_id });
  }

  /**
   * Disable Guardian
   * @param {string} guardian_id - Guardian ID
   */
  disableGuardian(guardian_id) {
    this.registry.disable(guardian_id);
    this._emitEvent('guardian_disabled', { guardian_id });
  }

  /**
   * Perform health check on Guardian
   * @param {string} guardian_id - Guardian ID
   * @returns {Promise<Object>} health check result
   */
  async checkGuardianHealth(guardian_id) {
    const adapter = this.registry.getAdapter(guardian_id);
    if (!adapter) {
      return {
        status: 'unavailable',
        message: 'Guardian not found'
      };
    }

    try {
      const health = await adapter.healthCheck();
      this.health_monitor.recordHealthCheck(guardian_id, health);
      this.registry.updateHealth(guardian_id, health);

      this._emitEvent('health_check_completed', {
        guardian_id,
        status: health.status
      });

      return health;
    } catch (error) {
      const health = {
        status: 'unhealthy',
        message: error.message
      };
      this.health_monitor.recordHealthCheck(guardian_id, health);
      this.registry.updateHealth(guardian_id, health);

      return health;
    }
  }

  /**
   * Perform health checks on all Guardians
   * @returns {Promise<Object>} health check results
   */
  async checkAllHealth() {
    const results = {};
    const guardians = this.registry.getEnabled();

    for (const record of guardians) {
      results[record.guardian_id] = await this.checkGuardianHealth(record.guardian_id);
    }

    return results;
  }

  /**
   * Cancel evaluation
   * @param {string} evaluation_id - Evaluation ID
   * @returns {Promise<void>}
   */
  async cancelEvaluation(evaluation_id) {
    await this.pipeline.cancel(evaluation_id);
  }

  /**
   * Shutdown Guardian Manager
   * @returns {Promise<void>}
   */
  async shutdown() {
    const guardians = this.registry.getAll();

    for (const record of guardians) {
      try {
        await record.adapter.shutdown();
      } catch (error) {
        // Log but continue with others
      }
    }

    this.initialized = false;
    this._emitEvent('manager_shutdown', {
      guardians_shutdown: guardians.length
    });
  }

  /**
   * Private: Get safe summary for events
   * @private
   */
  _getSafeSummary(result) {
    return {
      evaluation_id: result.evaluation_id,
      final_decision: result.final_decision,
      risk_level: result.risk_level,
      findings_count: (result.all_results || []).reduce((sum, r) => sum + r.findings.length, 0),
      controls_count: (result.all_results || []).reduce((sum, r) => sum + r.required_controls.length, 0),
      processing_time_ms: result.processing_time_ms
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

module.exports = GuardianManager;
