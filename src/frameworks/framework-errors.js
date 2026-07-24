/**
 * Framework Registry Errors
 *
 * Error classes for framework registration and execution.
 */

class FrameworkError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'FrameworkError';
    this.code = options.code || 'FRAMEWORK_ERROR';
    this.framework_id = options.framework_id;
    this.timestamp = Date.now();
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      framework_id: this.framework_id,
      timestamp: this.timestamp
    };
  }
}

class FrameworkNotFoundError extends FrameworkError {
  constructor(framework_id, options = {}) {
    super(`Framework ${framework_id} not found in registry`, {
      ...options,
      code: 'FRAMEWORK_NOT_FOUND'
    });
    this.name = 'FrameworkNotFoundError';
    this.framework_id = framework_id;
  }
}

class FrameworkAdapterError extends FrameworkError {
  constructor(framework_id, message, options = {}) {
    super(`Framework ${framework_id} adapter error: ${message}`, {
      ...options,
      code: 'ADAPTER_ERROR'
    });
    this.name = 'FrameworkAdapterError';
    this.framework_id = framework_id;
  }
}

class FrameworkNotAvailableError extends FrameworkError {
  constructor(framework_id, reason, options = {}) {
    super(`Framework ${framework_id} is not available: ${reason}`, {
      ...options,
      code: 'FRAMEWORK_UNAVAILABLE'
    });
    this.name = 'FrameworkNotAvailableError';
    this.framework_id = framework_id;
    this.reason = reason;
  }
}

class FrameworkConfigError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: 'CONFIG_ERROR'
    });
    this.name = 'FrameworkConfigError';
  }
}

class FrameworkExecutionError extends FrameworkError {
  constructor(framework_id, message, options = {}) {
    super(message, {
      ...options,
      code: 'EXECUTION_ERROR'
    });
    this.name = 'FrameworkExecutionError';
    this.framework_id = framework_id;
  }
}

class GuardianRequiredError extends FrameworkError {
  constructor(framework_id, guardian_id, options = {}) {
    super(`Framework ${framework_id} requires Guardian ${guardian_id} which is unavailable`, {
      ...options,
      code: 'GUARDIAN_REQUIRED'
    });
    this.name = 'GuardianRequiredError';
    this.framework_id = framework_id;
    this.guardian_id = guardian_id;
  }
}

class SierraRequiredError extends FrameworkError {
  constructor(framework_id, options = {}) {
    super(`Framework ${framework_id} requires Sierra authorisation`, {
      ...options,
      code: 'SIERRA_REQUIRED'
    });
    this.name = 'SierraRequiredError';
    this.framework_id = framework_id;
  }
}

class UniformRequiredError extends FrameworkError {
  constructor(framework_id, options = {}) {
    super(`Framework ${framework_id} requires Uniform governance`, {
      ...options,
      code: 'UNIFORM_REQUIRED'
    });
    this.name = 'UniformRequiredError';
    this.framework_id = framework_id;
  }
}

class FrameworkVersionError extends FrameworkError {
  constructor(framework_id, required_version, available_version, options = {}) {
    super(`Framework ${framework_id} requires version ${required_version}, but ${available_version} is available`, {
      ...options,
      code: 'VERSION_MISMATCH'
    });
    this.name = 'FrameworkVersionError';
    this.framework_id = framework_id;
    this.required_version = required_version;
    this.available_version = available_version;
  }
}

class FrameworkIncompatibleError extends FrameworkError {
  constructor(framework_id, message, options = {}) {
    super(`Framework ${framework_id} is incompatible: ${message}`, {
      ...options,
      code: 'INCOMPATIBLE'
    });
    this.name = 'FrameworkIncompatibleError';
    this.framework_id = framework_id;
  }
}

module.exports = {
  FrameworkError,
  FrameworkNotFoundError,
  FrameworkAdapterError,
  FrameworkNotAvailableError,
  FrameworkConfigError,
  FrameworkExecutionError,
  GuardianRequiredError,
  SierraRequiredError,
  UniformRequiredError,
  FrameworkVersionError,
  FrameworkIncompatibleError
};
