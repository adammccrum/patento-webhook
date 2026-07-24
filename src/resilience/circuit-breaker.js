/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by stopping calls to failing services.
 * States: closed (normal), open (failing fast), half_open (testing recovery), disabled (bypassed)
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'circuit-breaker';
    this.state = 'closed';

    // Configuration
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.cooldownMs = options.cooldownMs || 60000;
    this.halfOpenProbeLimit = options.halfOpenProbeLimit || 1;
    this.windowSizeMs = options.windowSizeMs || 120000;

    // Error classification
    this.countedErrorClasses = options.countedErrorClasses || [
      'transient_error',
      'timeout',
      'service_unavailable'
    ];
    this.ignoredErrorClasses = options.ignoredErrorClasses || [
      'authorization_failure',
      'permission_denial',
      'policy_denial',
      'validation_error',
      'cancellation'
    ];

    // State tracking
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastStateChangeTime = null;
    this.halfOpenProbeCount = 0;

    // Event handlers
    this.onStateChange = options.onStateChange || null;
    this.onEvent = options.onEvent || null;
  }

  /**
   * Check if execution is allowed
   * @returns {boolean} true if execution allowed
   */
  canExecute() {
    if (this.state === 'disabled') return true;
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      this._tryTransitionToHalfOpen();
      return this.state === 'half_open';
    }
    if (this.state === 'half_open') {
      return this.halfOpenProbeCount < this.halfOpenProbeLimit;
    }
    return false;
  }

  /**
   * Record successful execution
   */
  recordSuccess() {
    if (this.state === 'disabled') return;

    this.successCount++;
    this.failureCount = 0;

    if (this.state === 'half_open') {
      if (this.successCount >= this.successThreshold) {
        this._transitionTo('closed');
      }
    }
  }

  /**
   * Record failed execution
   * @param {Error} error - The error that occurred
   */
  recordFailure(error) {
    if (this.state === 'disabled') return;

    // Check if error should be counted
    if (!this._shouldCountError(error)) {
      return;
    }

    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.state === 'closed') {
      if (this.failureCount >= this.failureThreshold) {
        this._transitionTo('open');
      }
    } else if (this.state === 'half_open') {
      this._transitionTo('open');
    }
  }

  /**
   * Manually open the circuit
   */
  manualOpen() {
    this._transitionTo('open');
  }

  /**
   * Manually close the circuit
   */
  manualClose() {
    this._transitionTo('closed');
  }

  /**
   * Manually disable the circuit (bypass it)
   */
  manualDisable() {
    this._transitionTo('disabled');
  }

  /**
   * Reset the circuit to closed state
   */
  reset() {
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenProbeCount = 0;
    if (this.state !== 'closed') {
      this._transitionTo('closed');
    }
  }

  /**
   * Get circuit state
   * @returns {Object} state information
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChangeTime: this.lastStateChangeTime,
      halfOpenProbeCount: this.halfOpenProbeCount,
      isClosed: this.state === 'closed',
      isOpen: this.state === 'open',
      isHalfOpen: this.state === 'half_open',
      isDisabled: this.state === 'disabled'
    };
  }

  /**
   * Private: Check if error should be counted
   * @private
   */
  _shouldCountError(error) {
    const classification = error.classification || 'unknown';

    // Never count ignored error classes
    if (this.ignoredErrorClasses.includes(classification)) {
      return false;
    }

    // Count only explicitly counted classes if list is non-empty
    if (this.countedErrorClasses.length > 0) {
      return this.countedErrorClasses.includes(classification);
    }

    // Count all others
    return true;
  }

  /**
   * Private: Try to transition from open to half-open
   * @private
   */
  _tryTransitionToHalfOpen() {
    if (this.state !== 'open') return;

    const timeSinceOpen = Date.now() - (this.lastStateChangeTime || Date.now());
    if (timeSinceOpen >= this.cooldownMs) {
      this._transitionTo('half_open');
    }
  }

  /**
   * Private: Transition to new state
   * @private
   */
  _transitionTo(newState) {
    if (newState === this.state) return;

    const oldState = this.state;
    this.state = newState;
    this.lastStateChangeTime = Date.now();

    // Reset counters on state change
    if (newState === 'half_open') {
      this.halfOpenProbeCount = 0;
      this.successCount = 0;
      this.failureCount = 0;
    } else if (newState === 'closed') {
      this.failureCount = 0;
      this.successCount = 0;
      this.halfOpenProbeCount = 0;
    }

    // Emit events
    if (this.onStateChange) {
      this.onStateChange({
        name: this.name,
        oldState,
        newState,
        timestamp: this.lastStateChangeTime
      });
    }

    if (this.onEvent) {
      this.onEvent({
        type: `resilience.circuit_${newState}`,
        name: this.name,
        oldState,
        newState,
        timestamp: this.lastStateChangeTime
      });
    }
  }
}

module.exports = CircuitBreaker;
