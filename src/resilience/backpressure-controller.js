/**
 * Backpressure Controller
 *
 * Responds to system overload with configurable strategies:
 * accept, delay, reject, shed_low_priority, pause_provider, hold_for_review
 */

class BackpressureController {
  constructor(options = {}) {
    // Thresholds
    this.queueDepthThreshold = options.queueDepthThreshold || 1000;
    this.activeExecutionThreshold = options.activeExecutionThreshold || 500;
    this.errorRateThreshold = options.errorRateThreshold || 0.1; // 10%
    this.memoryThresholdMb = options.memoryThresholdMb || 512;

    // Strategies (per threshold)
    this.strategies = options.strategies || {
      queue_depth: 'reject',
      active_execution: 'delay',
      error_rate: 'shed_low_priority',
      memory_pressure: 'reject'
    };

    // Decision tracking
    this.lastDecision = null;
    this.decisions = [];

    // Event handlers
    this.onEvent = options.onEvent || null;
  }

  /**
   * Evaluate backpressure conditions
   * @param {Object} metrics - Current system metrics
   * @returns {string} decision: 'accept', 'delay', 'reject', etc.
   */
  evaluate(metrics = {}) {
    const decision = this._makeDecision(metrics);

    // Record decision
    this.lastDecision = {
      decision,
      metrics,
      timestamp: Date.now()
    };

    // Keep history (last 100)
    this.decisions.push(this.lastDecision);
    if (this.decisions.length > 100) {
      this.decisions.shift();
    }

    // Emit event
    if (this.onEvent && decision !== 'accept') {
      this.onEvent({
        type: 'resilience.backpressure_applied',
        decision,
        metrics,
        timestamp: Date.now()
      });
    }

    return decision;
  }

  /**
   * Get decision with explanation
   * @param {Object} metrics - Current system metrics
   * @returns {Object} decision with explanation
   */
  evaluateWithExplanation(metrics = {}) {
    const queueDepth = metrics.queueDepth || 0;
    const activeExecution = metrics.activeExecution || 0;
    const errorRate = metrics.errorRate || 0;
    const memoryUsageMb = metrics.memoryUsageMb || 0;

    const explanation = {
      queueDepth: {
        value: queueDepth,
        threshold: this.queueDepthThreshold,
        exceeded: queueDepth > this.queueDepthThreshold
      },
      activeExecution: {
        value: activeExecution,
        threshold: this.activeExecutionThreshold,
        exceeded: activeExecution > this.activeExecutionThreshold
      },
      errorRate: {
        value: errorRate,
        threshold: this.errorRateThreshold,
        exceeded: errorRate > this.errorRateThreshold
      },
      memoryPressure: {
        value: memoryUsageMb,
        threshold: this.memoryThresholdMb,
        exceeded: memoryUsageMb > this.memoryThresholdMb
      }
    };

    const decision = this._makeDecision(metrics);

    return {
      decision,
      explanation,
      timestamp: Date.now()
    };
  }

  /**
   * Get backpressure status
   * @returns {Object} current status
   */
  getStatus() {
    return {
      lastDecision: this.lastDecision,
      decisionHistory: this.decisions.slice(-10),
      strategies: { ...this.strategies }
    };
  }

  /**
   * Private: Make backpressure decision
   * @private
   */
  _makeDecision(metrics) {
    const queueDepth = metrics.queueDepth || 0;
    const activeExecution = metrics.activeExecution || 0;
    const errorRate = metrics.errorRate || 0;
    const memoryUsageMb = metrics.memoryUsageMb || 0;

    // Check each threshold in order of severity
    if (memoryUsageMb > this.memoryThresholdMb) {
      return this.strategies.memory_pressure || 'reject';
    }

    if (errorRate > this.errorRateThreshold) {
      return this.strategies.error_rate || 'shed_low_priority';
    }

    if (activeExecution > this.activeExecutionThreshold) {
      return this.strategies.active_execution || 'delay';
    }

    if (queueDepth > this.queueDepthThreshold) {
      return this.strategies.queue_depth || 'reject';
    }

    return 'accept';
  }
}

module.exports = BackpressureController;
