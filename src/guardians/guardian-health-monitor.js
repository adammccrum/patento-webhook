/**
 * Guardian Health Monitor
 *
 * Tracks Guardian health status and metrics.
 * Detects failures and manages Guardian availability.
 */

class GuardianHealthMonitor {
  constructor(options = {}) {
    this.health_check_interval_ms = options.health_check_interval_ms || 60000;
    this.failure_threshold = options.failure_threshold || 3;
    this.recovery_timeout_ms = options.recovery_timeout_ms || 300000; // 5 minutes

    // Health tracking
    this.health_records = new Map();
    this.onEvent = options.onEvent || null;
  }

  /**
   * Record evaluation result
   * @param {string} guardian_id - Guardian ID
   * @param {GuardianResult} result - Evaluation result
   */
  recordEvaluation(guardian_id, result) {
    let record = this.health_records.get(guardian_id);
    if (!record) {
      record = this._createRecord(guardian_id);
      this.health_records.set(guardian_id, record);
    }

    // Update statistics
    record.total_evaluations++;
    record.last_evaluation = Date.now();

    if (result.isAvailable()) {
      record.successful_evaluations++;
      record.consecutive_failures = 0;
    } else {
      record.failed_evaluations++;
      record.consecutive_failures++;
      record.last_failure = Date.now();
      record.last_error = result.error;
    }

    // Update health status
    this._updateHealthStatus(guardian_id, record);
  }

  /**
   * Record health check result
   * @param {string} guardian_id - Guardian ID
   * @param {Object} health - Health check result
   */
  recordHealthCheck(guardian_id, health) {
    let record = this.health_records.get(guardian_id);
    if (!record) {
      record = this._createRecord(guardian_id);
      this.health_records.set(guardian_id, record);
    }

    record.last_health_check = Date.now();
    record.health_check_status = health.status;
    record.health_check_message = health.message;

    if (health.status === 'healthy') {
      record.consecutive_failures = 0;
    }

    this._updateHealthStatus(guardian_id, record);
  }

  /**
   * Get health status for Guardian
   * @param {string} guardian_id - Guardian ID
   * @returns {Object} health status
   */
  getHealthStatus(guardian_id) {
    const record = this.health_records.get(guardian_id);
    if (!record) {
      return {
        guardian_id,
        status: 'unknown',
        reason: 'No health data'
      };
    }

    return {
      guardian_id,
      status: record.health_status,
      total_evaluations: record.total_evaluations,
      successful_evaluations: record.successful_evaluations,
      failed_evaluations: record.failed_evaluations,
      success_rate: record.total_evaluations > 0 ? record.successful_evaluations / record.total_evaluations : 0,
      consecutive_failures: record.consecutive_failures,
      last_evaluation: record.last_evaluation,
      last_failure: record.last_failure,
      last_health_check: record.last_health_check,
      health_check_status: record.health_check_status,
      last_error: record.last_error
    };
  }

  /**
   * Get health status for all Guardians
   * @returns {Object} health statuses
   */
  getAllHealthStatus() {
    const statuses = {};
    for (const [guardian_id] of this.health_records) {
      statuses[guardian_id] = this.getHealthStatus(guardian_id);
    }
    return statuses;
  }

  /**
   * Check if Guardian is considered healthy
   * @param {string} guardian_id - Guardian ID
   * @returns {boolean}
   */
  isHealthy(guardian_id) {
    const status = this.getHealthStatus(guardian_id);
    return status.status === 'healthy';
  }

  /**
   * Check if Guardian is degraded
   * @param {string} guardian_id - Guardian ID
   * @returns {boolean}
   */
  isDegraded(guardian_id) {
    const status = this.getHealthStatus(guardian_id);
    return status.status === 'degraded';
  }

  /**
   * Check if Guardian is unhealthy
   * @param {string} guardian_id - Guardian ID
   * @returns {boolean}
   */
  isUnhealthy(guardian_id) {
    const status = this.getHealthStatus(guardian_id);
    return status.status === 'unhealthy';
  }

  /**
   * Get aggregate health
   * @returns {Object} aggregate statistics
   */
  getAggregateHealth() {
    const statuses = this.getAllHealthStatus();
    const values = Object.values(statuses);

    return {
      total_guardians: values.length,
      healthy: values.filter((s) => s.status === 'healthy').length,
      degraded: values.filter((s) => s.status === 'degraded').length,
      unhealthy: values.filter((s) => s.status === 'unhealthy').length,
      unknown: values.filter((s) => s.status === 'unknown').length,
      overall_status: this._calculateOverallStatus(statuses),
      last_update: Date.now()
    };
  }

  /**
   * Private: Create health record
   * @private
   */
  _createRecord(guardian_id) {
    return {
      guardian_id,
      health_status: 'unknown',
      total_evaluations: 0,
      successful_evaluations: 0,
      failed_evaluations: 0,
      consecutive_failures: 0,
      last_evaluation: null,
      last_failure: null,
      last_error: null,
      last_health_check: null,
      health_check_status: null,
      health_check_message: null,
      created_at: Date.now()
    };
  }

  /**
   * Private: Update health status based on metrics
   * @private
   */
  _updateHealthStatus(guardian_id, record) {
    let newStatus = 'unknown';

    if (record.total_evaluations === 0) {
      newStatus = 'unknown';
    } else if (record.consecutive_failures >= this.failure_threshold) {
      newStatus = 'unhealthy';
    } else if (record.consecutive_failures > 0) {
      newStatus = 'degraded';
    } else {
      newStatus = 'healthy';
    }

    if (newStatus !== record.health_status) {
      record.health_status = newStatus;
      this._emitEvent('health_changed', {
        guardian_id,
        new_status: newStatus,
        consecutive_failures: record.consecutive_failures
      });
    }
  }

  /**
   * Private: Calculate overall status
   * @private
   */
  _calculateOverallStatus(statuses) {
    const values = Object.values(statuses);
    if (values.length === 0) return 'unknown';

    const unhealthy = values.filter((s) => s.status === 'unhealthy').length;
    if (unhealthy > 0) return 'degraded'; // At least one Guardian unhealthy

    const degraded = values.filter((s) => s.status === 'degraded').length;
    if (degraded > 0) return 'degraded';

    return 'healthy';
  }

  /**
   * Private: Emit event
   * @private
   */
  _emitEvent(type, data = {}) {
    if (this.onEvent) {
      this.onEvent({
        type: `guardian.health_${type}`,
        ...data,
        timestamp: Date.now()
      });
    }
  }
}

module.exports = GuardianHealthMonitor;
