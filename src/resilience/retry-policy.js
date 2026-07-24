/**
 * Retry Policy - Shared Implementation
 *
 * Single retry policy used by Agent SDK and resilience wrappers.
 * Authorization, permission, and policy denials are never retried.
 */

class RetryPolicy {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 3;
    this.initialDelayMs = options.initialDelayMs || 100;
    this.maxDelayMs = options.maxDelayMs || 5000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.jitterFactor = options.jitterFactor || 0.1;

    // Error classification
    this.retryableClasses = options.retryableClasses || [
      'transient_error',
      'timeout',
      'service_unavailable',
      'circuit_breaker',
      'bulkhead',
      'queue'
    ];

    this.nonRetryableClasses = options.nonRetryableClasses || [
      'authorization_failure',
      'permission_denial',
      'policy_denial',
      'validation_error',
      'cancellation',
      'not_found',
      'conflict',
      'dead_letter'
    ];

    // Budget tracking
    this.budgetPerMinute = options.budgetPerMinute || 1000;
    this.budgetWindow = new Map(); // agent -> { count, resetTime }
  }

  /**
   * Check if operation should be retried
   * @param {Error} error - The error that occurred
   * @param {number} attempt - Current attempt number (0-based)
   * @param {Object} [context] - Optional context
   * @returns {boolean} true if should retry
   */
  shouldRetry(error, attempt, context = {}) {
    // Check if retryable
    if (!this._isRetryable(error)) {
      return false;
    }

    // Check attempt limit
    if (attempt >= this.maxAttempts - 1) {
      return false;
    }

    // Check retry budget if context includes agent code
    if (context.agentCode) {
      if (!this._hasRetryBudget(context.agentCode)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate delay before next retry
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} delay in milliseconds
   */
  getRetryDelayMs(attempt) {
    const exponentialDelay = this.initialDelayMs * Math.pow(this.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelayMs);

    // Add jitter
    const jitter = cappedDelay * this.jitterFactor * Math.random();
    return cappedDelay + jitter;
  }

  /**
   * Consume retry budget
   * @param {string} agentCode - Agent identifier
   */
  consumeBudget(agentCode) {
    if (!agentCode) return;

    let budget = this.budgetWindow.get(agentCode) || {
      count: 0,
      resetTime: Date.now() + 60000
    };

    // Reset if window expired
    if (Date.now() > budget.resetTime) {
      budget = { count: 0, resetTime: Date.now() + 60000 };
    }

    budget.count++;
    this.budgetWindow.set(agentCode, budget);
  }

  /**
   * Get budget status
   * @param {string} agentCode - Agent identifier
   * @returns {Object} budget status
   */
  getBudgetStatus(agentCode) {
    const budget = this.budgetWindow.get(agentCode);
    if (!budget) {
      return { used: 0, limit: this.budgetPerMinute, available: this.budgetPerMinute };
    }

    return {
      used: budget.count,
      limit: this.budgetPerMinute,
      available: Math.max(0, this.budgetPerMinute - budget.count),
      resetTime: budget.resetTime
    };
  }

  /**
   * Private: Check if error is retryable
   * @private
   */
  _isRetryable(error) {
    const classification = error.classification || 'unknown';

    // Never retry non-retryable classes
    if (this.nonRetryableClasses.includes(classification)) {
      return false;
    }

    // Explicitly retryable classes
    if (this.retryableClasses.includes(classification)) {
      return true;
    }

    // Check error.retryable property if set
    if (error.retryable !== undefined) {
      return error.retryable;
    }

    // Default: don't retry unknown errors
    return false;
  }

  /**
   * Private: Check if agent has retry budget
   * @private
   */
  _hasRetryBudget(agentCode) {
    const budget = this.budgetWindow.get(agentCode);
    if (!budget) {
      return true; // First time, has budget
    }

    // Reset if window expired
    if (Date.now() > budget.resetTime) {
      return true;
    }

    return budget.count < this.budgetPerMinute;
  }
}

module.exports = RetryPolicy;
