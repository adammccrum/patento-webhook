/**
 * Framework Manager
 *
 * Central orchestrator for framework registry, policy, health,
 * and execution lifecycle management.
 */

const FrameworkRegistry = require('./framework-registry');
const FrameworkPolicy = require('./framework-policy');
const FrameworkHealth = require('./framework-health');
const FrameworkContext = require('./framework-context');
const FrameworkResult = require('./framework-result');
const {
  FrameworkNotFoundError,
  FrameworkNotAvailableError,
  SierraRequiredError,
  UniformRequiredError,
  GuardianRequiredError
} = require('./framework-errors');

class FrameworkManager {
  constructor(options = {}) {
    this.registry = new FrameworkRegistry({ onEvent: options.onEvent });
    this.policy = new FrameworkPolicy(this.registry, { onEvent: options.onEvent });
    this.health = new FrameworkHealth(this.registry, {
      onEvent: options.onEvent,
      check_interval_ms: options.health_check_interval_ms
    });

    this.onEvent = options.onEvent || null;
    this.executions = new Map(); // execution_id -> { status, framework_id, context, result }
  }

  /**
   * Register framework adapter
   * @param {FrameworkBase} adapter - Framework adapter instance
   * @param {Object} metadata - Framework metadata
   */
  registerFramework(adapter, metadata = {}) {
    this.registry.register(adapter, metadata);
    this._emitEvent('framework_registered', {
      framework_id: adapter.framework_id,
      display_name: metadata.display_name || adapter.display_name
    });
  }

  /**
   * Start framework manager
   * @returns {Promise<void>}
   */
  async start() {
    this.health.startMonitoring();
    this._emitEvent('manager_started', { timestamp: Date.now() });
  }

  /**
   * Stop framework manager
   * @returns {Promise<void>}
   */
  async stop() {
    this.health.stopMonitoring();

    // Cancel any running executions
    for (const [exec_id, execution] of this.executions.entries()) {
      if (execution.status === 'running') {
        try {
          const adapter = this.registry.getAdapter(execution.framework_id);
          if (adapter) {
            await adapter.cancel(exec_id);
          }
        } catch (err) {
          // Log but continue shutdown
        }
      }
    }

    this._emitEvent('manager_stopped', { timestamp: Date.now() });
  }

  /**
   * Execute framework with capability requirement
   * @param {string} capability - Required capability
   * @param {FrameworkContext} context - Execution context
   * @param {Object} options - Execution options
   * @returns {Promise<FrameworkResult>} execution result
   */
  async execute(capability, context, options = {}) {
    const policy = options.policy || 'default';

    // Validate context
    const validation = context.validate();
    if (!validation.valid) {
      const result = new FrameworkResult({
        execution_id: context.execution_id,
        status: 'failed'
      });
      result.fail(`Invalid context: ${validation.errors.join(', ')}`);
      return result;
    }

    // Select framework by capability and policy
    let record;
    try {
      record = this.policy.selectFramework(capability, context, policy);
    } catch (err) {
      const result = new FrameworkResult({
        execution_id: context.execution_id,
        status: 'failed'
      });
      result.fail(`No framework available: ${err.message}`);
      return result;
    }

    return this._executeFramework(record, context);
  }

  /**
   * Execute specific framework
   * @param {string} framework_id - Framework ID
   * @param {FrameworkContext} context - Execution context
   * @returns {Promise<FrameworkResult>} execution result
   */
  async executeFramework(framework_id, context) {
    const record = this.registry.get(framework_id);
    if (!record) {
      throw new FrameworkNotFoundError(framework_id);
    }

    return this._executeFramework(record, context);
  }

  /**
   * Private: Execute on framework adapter
   * @private
   */
  async _executeFramework(record, context) {
    const execution_id = context.execution_id;

    // Validate security requirements
    if (record.sierra_required && !context.sierra_reference) {
      const result = new FrameworkResult({
        execution_id,
        framework_id: record.framework_id,
        status: 'failed'
      });
      result.fail(new SierraRequiredError(record.framework_id));
      return result;
    }

    if (record.uniform_required && !context.uniform_reference) {
      const result = new FrameworkResult({
        execution_id,
        framework_id: record.framework_id,
        status: 'failed'
      });
      result.fail(new UniformRequiredError(record.framework_id));
      return result;
    }

    if (record.guardian_requirements && record.guardian_requirements.length > 0) {
      const result = new FrameworkResult({
        execution_id,
        framework_id: record.framework_id,
        status: 'failed'
      });
      const missing = record.guardian_requirements.join(', ');
      result.fail(new GuardianRequiredError(record.framework_id, missing));
      return result;
    }

    // Register execution
    this.executions.set(execution_id, {
      status: 'running',
      framework_id: record.framework_id,
      context,
      result: null
    });

    this._emitEvent('execution_started', {
      execution_id,
      framework_id: record.framework_id
    });

    try {
      const result = await record.adapter.execute(context);

      // Record execution completion
      this.executions.get(execution_id).status = result.status;
      this.executions.get(execution_id).result = result;

      this._emitEvent('execution_completed', {
        execution_id,
        framework_id: record.framework_id,
        status: result.status,
        duration_ms: result.duration_ms
      });

      return result;
    } catch (err) {
      const result = new FrameworkResult({
        execution_id,
        framework_id: record.framework_id,
        status: 'failed'
      });
      result.fail(err);

      this.executions.get(execution_id).status = 'failed';
      this.executions.get(execution_id).result = result;

      this._emitEvent('execution_failed', {
        execution_id,
        framework_id: record.framework_id,
        error: err.message
      });

      return result;
    }
  }

  /**
   * Cancel execution
   * @param {string} execution_id - Execution ID
   * @returns {Promise<void>}
   */
  async cancelExecution(execution_id) {
    const execution = this.executions.get(execution_id);
    if (!execution) return;

    if (execution.status !== 'running') return;

    const adapter = this.registry.getAdapter(execution.framework_id);
    if (adapter) {
      await adapter.cancel(execution_id);
      execution.status = 'cancelled';

      this._emitEvent('execution_cancelled', { execution_id });
    }
  }

  /**
   * Get execution status
   * @param {string} execution_id - Execution ID
   * @returns {Object} execution details
   */
  getExecutionStatus(execution_id) {
    return this.executions.get(execution_id) || null;
  }

  /**
   * Get active executions
   * @returns {Array} running executions
   */
  getActiveExecutions() {
    return Array.from(this.executions.values()).filter(e => e.status === 'running');
  }

  /**
   * Cleanup old executions
   * @param {number} age_ms - Execution age in milliseconds
   */
  cleanupExecutions(age_ms = 86400000) { // 24 hours default
    const now = Date.now();
    const to_delete = [];

    for (const [exec_id, execution] of this.executions.entries()) {
      if (execution.result && now - execution.result.end_time > age_ms) {
        to_delete.push(exec_id);
      }
    }

    to_delete.forEach(id => this.executions.delete(id));

    if (to_delete.length > 0) {
      this._emitEvent('executions_cleaned', { count: to_delete.length });
    }
  }

  /**
   * Enable framework
   * @param {string} framework_id - Framework ID
   */
  enableFramework(framework_id) {
    this.registry.enable(framework_id);
    this._emitEvent('framework_enabled', { framework_id });
  }

  /**
   * Disable framework
   * @param {string} framework_id - Framework ID
   */
  disableFramework(framework_id) {
    this.registry.disable(framework_id);
    this._emitEvent('framework_disabled', { framework_id });
  }

  /**
   * Get framework record
   * @param {string} framework_id - Framework ID
   * @returns {Object} framework record
   */
  getFramework(framework_id) {
    return this.registry.get(framework_id);
  }

  /**
   * Get all frameworks
   * @returns {Array} framework records
   */
  getFrameworks() {
    return this.registry.getAll();
  }

  /**
   * Get frameworks by category
   * @param {string} category - Framework category
   * @returns {Array} framework records
   */
  getFrameworksByCategory(category) {
    return this.registry.getByCategory(category);
  }

  /**
   * Get enabled frameworks
   * @returns {Array} enabled framework records
   */
  getEnabledFrameworks() {
    return this.registry.getEnabled();
  }

  /**
   * Get registry statistics
   * @returns {Object} statistics
   */
  getStats() {
    return {
      registry: this.registry.getStats(),
      health: this.health.getSystemHealth(),
      executions: {
        active: this.getActiveExecutions().length,
        total: this.executions.size
      },
      timestamp: Date.now()
    };
  }

  /**
   * Private: Emit event
   * @private
   */
  _emitEvent(type, data = {}) {
    if (this.onEvent) {
      this.onEvent({
        type: `framework.manager.${type}`,
        ...data,
        timestamp: Date.now()
      });
    }
  }
}

module.exports = FrameworkManager;
