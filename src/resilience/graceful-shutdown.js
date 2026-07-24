/**
 * Graceful Shutdown Manager
 *
 * Ordered shutdown process:
 * 1. mark not ready
 * 2. reject new work
 * 3. pause queues
 * 4. stop accepting connections
 * 5. allow in-flight completion
 * 6. cancel remaining safe-to-cancel work
 * 7. persist interrupted state
 * 8. flush audit events
 * 9. flush event buffers
 * 10. close database
 * 11. close providers
 * 12. report result
 */

class GracefulShutdownManager {
  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs || 30000;
    this.hooks = {
      markNotReady: options.markNotReady,
      rejectNewWork: options.rejectNewWork,
      pauseQueues: options.pauseQueues,
      stopConnections: options.stopConnections,
      waitInFlight: options.waitInFlight,
      cancelSafeToCancel: options.cancelSafeToCancel,
      persistInterruptedState: options.persistInterruptedState,
      flushAuditEvents: options.flushAuditEvents,
      flushEventBuffers: options.flushEventBuffers,
      closeDatabase: options.closeDatabase,
      closeProviders: options.closeProviders
    };

    this.state = 'running';
    this.shutdownStartedAt = null;
    this.onEvent = options.onEvent || null;
  }

  /**
   * Initiate graceful shutdown
   * @returns {Promise<Object>} shutdown result
   */
  async shutdown() {
    if (this.state !== 'running') {
      // Idempotent: shutdown already in progress or complete
      return {
        state: this.state,
        result: 'already_' + this.state
      };
    }

    this.state = 'shutting_down';
    this.shutdownStartedAt = Date.now();

    this._emitEvent('resilience.shutdown_started');

    const steps = [
      { name: 'markNotReady', hook: this.hooks.markNotReady },
      { name: 'rejectNewWork', hook: this.hooks.rejectNewWork },
      { name: 'pauseQueues', hook: this.hooks.pauseQueues },
      { name: 'stopConnections', hook: this.hooks.stopConnections },
      { name: 'waitInFlight', hook: this.hooks.waitInFlight },
      { name: 'cancelSafeToCancel', hook: this.hooks.cancelSafeToCancel },
      { name: 'persistInterruptedState', hook: this.hooks.persistInterruptedState },
      { name: 'flushAuditEvents', hook: this.hooks.flushAuditEvents },
      { name: 'flushEventBuffers', hook: this.hooks.flushEventBuffers },
      { name: 'closeDatabase', hook: this.hooks.closeDatabase },
      { name: 'closeProviders', hook: this.hooks.closeProviders }
    ];

    const result = {
      startedAt: this.shutdownStartedAt,
      completedSteps: [],
      failedSteps: [],
      errors: []
    };

    // Execute each step with timeout
    for (const step of steps) {
      if (!step.hook) {
        result.completedSteps.push(step.name);
        continue;
      }

      try {
        const stepTimeout = this.timeoutMs / steps.length;
        await this._executeWithTimeout(step.hook, stepTimeout);
        result.completedSteps.push(step.name);
      } catch (error) {
        result.failedSteps.push(step.name);
        result.errors.push({
          step: step.name,
          error: error.message
        });
        // Continue to next step even if one fails
      }
    }

    this.state = 'stopped';
    result.completedAt = Date.now();
    result.durationMs = result.completedAt - result.startedAt;
    result.success = result.failedSteps.length === 0;

    if (result.success) {
      this._emitEvent('resilience.shutdown_completed');
    } else {
      this._emitEvent('resilience.shutdown_failed', result.errors);
    }

    return result;
  }

  /**
   * Forced shutdown (if graceful timeout exceeded)
   */
  async forceShutdown() {
    this.state = 'stopped';
    this._emitEvent('resilience.forced_shutdown');
  }

  /**
   * Get shutdown status
   * @returns {Object} current status
   */
  getStatus() {
    return {
      state: this.state,
      shutdownStartedAt: this.shutdownStartedAt,
      elapsedMs: this.shutdownStartedAt
        ? Date.now() - this.shutdownStartedAt
        : null
    };
  }

  /**
   * Private: Execute with timeout
   * @private
   */
  async _executeWithTimeout(fn, timeoutMs) {
    return new Promise((resolve, reject) => {
      let completed = false;

      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          reject(new Error(`Step timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      Promise.resolve(fn())
        .then((result) => {
          if (!completed) {
            completed = true;
            clearTimeout(timer);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!completed) {
            completed = true;
            clearTimeout(timer);
            reject(error);
          }
        });
    });
  }

  /**
   * Private: Emit event
   * @private
   */
  _emitEvent(type, data = {}) {
    if (this.onEvent) {
      this.onEvent({
        type,
        timestamp: Date.now(),
        data
      });
    }
  }
}

module.exports = GracefulShutdownManager;
