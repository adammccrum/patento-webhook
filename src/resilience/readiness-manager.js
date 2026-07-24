/**
 * Readiness Manager
 *
 * Tracks service readiness states and component health.
 * Separates liveness (crashed?) from readiness (ready for traffic?).
 */

class ReadinessManager {
  constructor(options = {}) {
    this.state = 'starting';
    this.components = new Map();
    this.onEvent = options.onEvent || null;

    // Required components
    this.requiredComponents = options.requiredComponents || [
      'database',
      'audit_system',
      'event_stream',
      'agent_registry',
      'authentication'
    ];

    // Optional components (failures don't make platform unavailable)
    this.optionalComponents = options.optionalComponents || [
      'provider:voice:piper',
      'provider:voice:whisper',
      'monitoring'
    ];

    // Initialize all components as unknown
    for (const comp of this.requiredComponents.concat(this.optionalComponents)) {
      this.components.set(comp, {
        status: 'unknown',
        lastChecked: null,
        message: null
      });
    }
  }

  /**
   * Set component health status
   * @param {string} component - Component name
   * @param {string} status - 'healthy', 'degraded', 'unhealthy'
   * @param {string} message - Optional status message
   */
  setComponentHealth(component, status, message = null) {
    if (!this.components.has(component)) {
      this.components.set(component, {});
    }

    const prevStatus = this.components.get(component).status;
    this.components.get(component).status = status;
    this.components.get(component).lastChecked = Date.now();
    this.components.get(component).message = message;

    // Update overall state if needed
    if (prevStatus !== status) {
      this._updateState();

      if (this.onEvent) {
        this.onEvent({
          type: 'resilience.component_status_changed',
          component,
          oldStatus: prevStatus,
          newStatus: status,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Get current readiness state
   * @returns {string} 'starting'|'ready'|'degraded'|'not_ready'|'draining'|'shutting_down'|'stopped'
   */
  getState() {
    return this.state;
  }

  /**
   * Check if service is ready
   * @returns {boolean} true if ready to accept traffic
   */
  isReady() {
    return this.state === 'ready' || this.state === 'degraded';
  }

  /**
   * Check if service is alive
   * @returns {boolean} true if process is running
   */
  isAlive() {
    return this.state !== 'stopped';
  }

  /**
   * Get detailed readiness status
   * @returns {Object} detailed status information
   */
  getReadinessStatus() {
    const requiredHealthy = this.requiredComponents.every(
      (comp) => this.components.get(comp)?.status === 'healthy'
    );

    const optionalHealthy = this.optionalComponents.filter(
      (comp) => this.components.get(comp)?.status === 'healthy'
    ).length;

    return {
      state: this.state,
      ready: this.isReady(),
      alive: this.isAlive(),
      requiredComponentsHealthy: requiredHealthy,
      optionalComponentsHealthy: optionalHealthy,
      components: this._getComponentStatus(),
      timestamp: Date.now()
    };
  }

  /**
   * Mark service as draining
   */
  markDraining() {
    if (this.state === 'running' || this.state === 'ready' || this.state === 'degraded') {
      this.state = 'draining';
      this._emitStateChange('draining');
    }
  }

  /**
   * Mark service as shutting down
   */
  markShuttingDown() {
    if (this.state !== 'stopped') {
      this.state = 'shutting_down';
      this._emitStateChange('shutting_down');
    }
  }

  /**
   * Mark service as stopped
   */
  markStopped() {
    this.state = 'stopped';
    this._emitStateChange('stopped');
  }

  /**
   * Reset to starting state
   */
  reset() {
    this.state = 'starting';
    for (const [comp] of this.components) {
      this.components.get(comp).status = 'unknown';
    }
    this._emitStateChange('starting');
  }

  /**
   * Private: Update overall state based on component health
   * @private
   */
  _updateState() {
    if (this.state === 'shutting_down' || this.state === 'stopped' || this.state === 'draining') {
      return; // Don't change state during shutdown
    }

    const requiredHealthy = this.requiredComponents.every(
      (comp) => {
        const status = this.components.get(comp)?.status;
        return status === 'healthy' || status === 'degraded';
      }
    );

    const requiredFullyHealthy = this.requiredComponents.every(
      (comp) => this.components.get(comp)?.status === 'healthy'
    );

    if (!requiredHealthy) {
      // Required component is unhealthy
      this.state = 'not_ready';
    } else if (!requiredFullyHealthy) {
      // Required component is degraded
      this.state = 'degraded';
    } else {
      // All required components healthy
      this.state = 'ready';
    }

    this._emitStateChange(this.state);
  }

  /**
   * Private: Get component status
   * @private
   */
  _getComponentStatus() {
    const status = {};
    for (const [comp, health] of this.components) {
      status[comp] = health;
    }
    return status;
  }

  /**
   * Private: Emit state change event
   * @private
   */
  _emitStateChange(newState) {
    if (this.onEvent) {
      this.onEvent({
        type: 'resilience.readiness_state_changed',
        newState,
        timestamp: Date.now()
      });
    }
  }
}

module.exports = ReadinessManager;
