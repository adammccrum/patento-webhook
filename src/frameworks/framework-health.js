/**
 * Framework Health Monitoring
 *
 * Health checks, availability tracking, and status monitoring
 * for registered frameworks.
 */

class FrameworkHealth {
  constructor(registry, options = {}) {
    this.registry = registry;
    this.onEvent = options.onEvent || null;
    this.check_interval_ms = options.check_interval_ms || 60000; // 60 seconds
    this.unhealthy_threshold = options.unhealthy_threshold || 3; // consecutive failures
    this.health_history = new Map(); // framework_id -> { checks: [], current_status, failure_count }
    this.monitoring = false;
  }

  /**
   * Start health monitoring
   */
  startMonitoring() {
    if (this.monitoring) return;

    this.monitoring = true;
    this._performHealthCheck();
    this._emitEvent('monitoring_started', {});
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring() {
    this.monitoring = false;
    if (this.check_timeout) {
      clearTimeout(this.check_timeout);
      this.check_timeout = null;
    }
    this._emitEvent('monitoring_stopped', {});
  }

  /**
   * Perform health check on single framework
   * @param {string} framework_id - Framework ID
   * @returns {Promise<Object>} health status
   */
  async checkFrameworkHealth(framework_id) {
    const record = this.registry.get(framework_id);
    if (!record) {
      return {
        framework_id,
        status: 'unknown',
        reason: 'Framework not found',
        timestamp: Date.now()
      };
    }

    try {
      const health = await record.adapter.healthCheck();

      this.registry.updateHealth(framework_id, health);
      this._recordHealthCheck(framework_id, health);

      return {
        framework_id,
        status: health.status || 'unknown',
        message: health.message,
        timestamp: Date.now()
      };
    } catch (err) {
      const failureStatus = {
        status: 'unhealthy',
        reason: err.message || 'Health check failed',
        timestamp: Date.now()
      };

      this.registry.updateHealth(framework_id, failureStatus);
      this._recordHealthCheck(framework_id, failureStatus);

      return {
        framework_id,
        status: 'unhealthy',
        reason: err.message || 'Health check failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get health status for framework
   * @param {string} framework_id - Framework ID
   * @returns {Object} current health status
   */
  getHealth(framework_id) {
    const record = this.registry.get(framework_id);
    if (!record) return null;

    const history = this.health_history.get(framework_id);
    return {
      framework_id,
      current_status: record.health_status,
      last_check: record.last_health_check,
      history: history ? history.checks.slice(-10) : []
    };
  }

  /**
   * Get overall system health
   * @returns {Object} health summary
   */
  getSystemHealth() {
    const all = this.registry.getAll();
    const stats = {
      total: all.length,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      unknown: 0,
      timestamp: Date.now()
    };

    for (const record of all) {
      switch (record.health_status) {
        case 'healthy':
          stats.healthy++;
          break;
        case 'degraded':
          stats.degraded++;
          break;
        case 'unhealthy':
          stats.unhealthy++;
          break;
        default:
          stats.unknown++;
      }
    }

    return stats;
  }

  /**
   * Get frameworks needing attention
   * @returns {Array} frameworks with health issues
   */
  getUnhealthyFrameworks() {
    const all = this.registry.getAll();
    return all.filter(r => r.health_status === 'unhealthy' || r.health_status === 'degraded');
  }

  /**
   * Private: Perform periodic health check
   * @private
   */
  async _performHealthCheck() {
    if (!this.monitoring) return;

    try {
      const all = this.registry.getAll();
      const promises = all.map(record => this.checkFrameworkHealth(record.framework_id));

      await Promise.allSettled(promises);

      this._emitEvent('health_check_completed', {
        timestamp: Date.now(),
        frameworks_checked: all.length
      });
    } catch (err) {
      this._emitEvent('health_check_error', {
        error: err.message,
        timestamp: Date.now()
      });
    }

    if (this.monitoring) {
      this.check_timeout = setTimeout(() => this._performHealthCheck(), this.check_interval_ms);
    }
  }

  /**
   * Private: Record health check result
   * @private
   */
  _recordHealthCheck(framework_id, health) {
    let history = this.health_history.get(framework_id);

    if (!history) {
      history = {
        checks: [],
        current_status: 'unknown',
        failure_count: 0
      };
      this.health_history.set(framework_id, history);
    }

    history.checks.push({
      status: health.status || 'unknown',
      message: health.message || health.reason || '',
      timestamp: health.timestamp || Date.now()
    });

    // Keep only last 100 checks
    if (history.checks.length > 100) {
      history.checks = history.checks.slice(-100);
    }

    // Update failure count
    if (health.status === 'unhealthy' || health.status === 'degraded') {
      history.failure_count++;
    } else {
      history.failure_count = 0;
    }

    // Emit event if threshold reached
    if (history.failure_count >= this.unhealthy_threshold) {
      this._emitEvent('framework_threshold_reached', {
        framework_id,
        failure_count: history.failure_count,
        threshold: this.unhealthy_threshold
      });
    }

    history.current_status = health.status || 'unknown';
  }

  /**
   * Reset health for framework
   * @param {string} framework_id - Framework ID
   */
  resetHealth(framework_id) {
    const history = this.health_history.get(framework_id);
    if (history) {
      history.failure_count = 0;
      history.checks = [];
    }
  }

  /**
   * Get health history for framework
   * @param {string} framework_id - Framework ID
   * @param {number} limit - Number of records to return
   * @returns {Array} health check history
   */
  getHealthHistory(framework_id, limit = 50) {
    const history = this.health_history.get(framework_id);
    if (!history) return [];
    return history.checks.slice(-limit);
  }

  /**
   * Private: Emit event
   * @private
   */
  _emitEvent(type, data = {}) {
    if (this.onEvent) {
      this.onEvent({
        type: `framework.health.${type}`,
        ...data
      });
    }
  }
}

module.exports = FrameworkHealth;
