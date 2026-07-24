/**
 * Custom error classes for the system
 */

class SystemError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SystemError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

class ProviderError extends SystemError {
  constructor(message, code = 'PROVIDER_ERROR', details = {}) {
    super(message, code, details);
    this.name = 'ProviderError';
  }
}

class ProviderUnavailableError extends ProviderError {
  constructor(providerId, message, details = {}) {
    super(
      message || `Provider ${providerId} is unavailable`,
      'PROVIDER_UNAVAILABLE',
      { providerId, ...details }
    );
    this.name = 'ProviderUnavailableError';
  }
}

class AdapterError extends SystemError {
  constructor(message, code = 'ADAPTER_ERROR', details = {}) {
    super(message, code, details);
    this.name = 'AdapterError';
  }
}

class AgentError extends SystemError {
  constructor(message, code = 'AGENT_ERROR', details = {}) {
    super(message, code, details);
    this.name = 'AgentError';
  }
}

class AgentNotFoundError extends AgentError {
  constructor(agentCode, details = {}) {
    super(`Agent ${agentCode} not found`, 'AGENT_NOT_FOUND', { agentCode, ...details });
    this.name = 'AgentNotFoundError';
  }
}

class ConfigurationError extends SystemError {
  constructor(message, code = 'CONFIGURATION_ERROR', details = {}) {
    super(message, code, details);
    this.name = 'ConfigurationError';
  }
}

class ValidationError extends SystemError {
  constructor(message, code = 'VALIDATION_ERROR', details = {}) {
    super(message, code, details);
    this.name = 'ValidationError';
  }
}

class AuthorizationError extends SystemError {
  constructor(message, code = 'AUTHORIZATION_ERROR', details = {}) {
    super(message, code, details);
    this.name = 'AuthorizationError';
  }
}

module.exports = {
  SystemError,
  ProviderError,
  ProviderUnavailableError,
  AdapterError,
  AgentError,
  AgentNotFoundError,
  ConfigurationError,
  ValidationError,
  AuthorizationError
};
