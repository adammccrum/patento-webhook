/**
 * Guardian Framework Errors
 *
 * Error classes for Guardian evaluations and operations.
 */

class GuardianError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'GuardianError';
    this.code = options.code || 'GUARDIAN_ERROR';
    this.guardian_id = options.guardian_id;
    this.evaluation_id = options.evaluation_id;
    this.correlation_id = options.correlation_id;
    this.timestamp = Date.now();
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      guardian_id: this.guardian_id,
      evaluation_id: this.evaluation_id,
      timestamp: this.timestamp
    };
  }
}

class GuardianUnavailableError extends GuardianError {
  constructor(guardian_id, message, options = {}) {
    super(message || `Guardian ${guardian_id} is unavailable`, {
      ...options,
      code: 'GUARDIAN_UNAVAILABLE'
    });
    this.name = 'GuardianUnavailableError';
    this.guardian_id = guardian_id;
  }
}

class GuardianTimeoutError extends GuardianError {
  constructor(guardian_id, timeoutMs, options = {}) {
    super(`Guardian ${guardian_id} evaluation timed out after ${timeoutMs}ms`, {
      ...options,
      code: 'GUARDIAN_TIMEOUT'
    });
    this.name = 'GuardianTimeoutError';
    this.guardian_id = guardian_id;
    this.timeout_ms = timeoutMs;
  }
}

class GuardianDeniedError extends GuardianError {
  constructor(guardian_id, reason, options = {}) {
    super(`Guardian ${guardian_id} denied execution: ${reason}`, {
      ...options,
      code: 'GUARDIAN_DENIED'
    });
    this.name = 'GuardianDeniedError';
    this.guardian_id = guardian_id;
    this.reason = reason;
  }
}

class GuardianConfigError extends GuardianError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: 'GUARDIAN_CONFIG_ERROR'
    });
    this.name = 'GuardianConfigError';
  }
}

class GuardianPolicyViolationError extends GuardianError {
  constructor(message, policy_reference, options = {}) {
    super(message, {
      ...options,
      code: 'POLICY_VIOLATION'
    });
    this.name = 'GuardianPolicyViolationError';
    this.policy_reference = policy_reference;
  }
}

class GuardianContextError extends GuardianError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: 'CONTEXT_ERROR'
    });
    this.name = 'GuardianContextError';
  }
}

class GuardianRegistryError extends GuardianError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: 'REGISTRY_ERROR'
    });
    this.name = 'GuardianRegistryError';
  }
}

class GuardianCancelledError extends GuardianError {
  constructor(evaluation_id, options = {}) {
    super(`Guardian evaluation ${evaluation_id} was cancelled`, {
      ...options,
      code: 'EVALUATION_CANCELLED'
    });
    this.name = 'GuardianCancelledError';
    this.evaluation_id = evaluation_id;
  }
}

module.exports = {
  GuardianError,
  GuardianUnavailableError,
  GuardianTimeoutError,
  GuardianDeniedError,
  GuardianConfigError,
  GuardianPolicyViolationError,
  GuardianContextError,
  GuardianRegistryError,
  GuardianCancelledError
};
