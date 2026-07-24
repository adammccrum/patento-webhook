const {
  SystemError,
  ProviderError,
  ProviderUnavailableError,
  AdapterError,
  AgentError,
  AgentNotFoundError,
  ConfigurationError,
  ValidationError,
  AuthorizationError
} = require('../../src/utils/errors');

describe('Error Classes', () => {
  describe('SystemError', () => {
    test('should create a SystemError', () => {
      const error = new SystemError('Test error', 'TEST_CODE', { detail: 'value' });
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('SystemError');
      expect(error.details).toEqual({ detail: 'value' });
      expect(error.timestamp).toBeDefined();
    });

    test('should serialize to JSON', () => {
      const error = new SystemError('Test error', 'TEST_CODE', { detail: 'value' });
      const json = error.toJSON();
      expect(json.error).toBe('Test error');
      expect(json.code).toBe('TEST_CODE');
      expect(json.details).toEqual({ detail: 'value' });
      expect(json.timestamp).toBeDefined();
    });

    test('should create with default details', () => {
      const error = new SystemError('Test error', 'TEST_CODE');
      expect(error.details).toEqual({});
    });
  });

  describe('ProviderError', () => {
    test('should create a ProviderError', () => {
      const error = new ProviderError('Provider failed', 'PROVIDER_FAILED', { providerId: 'test' });
      expect(error.message).toBe('Provider failed');
      expect(error.code).toBe('PROVIDER_FAILED');
      expect(error.name).toBe('ProviderError');
      expect(error.details).toEqual({ providerId: 'test' });
    });

    test('should use default code', () => {
      const error = new ProviderError('Provider failed');
      expect(error.code).toBe('PROVIDER_ERROR');
    });

    test('should serialize to JSON', () => {
      const error = new ProviderError('Provider failed', 'PROVIDER_FAILED');
      const json = error.toJSON();
      expect(json.error).toBe('Provider failed');
      expect(json.code).toBe('PROVIDER_FAILED');
    });
  });

  describe('ProviderUnavailableError', () => {
    test('should create a ProviderUnavailableError', () => {
      const error = new ProviderUnavailableError('voicebox', 'Voicebox is not configured');
      expect(error.message).toBe('Voicebox is not configured');
      expect(error.code).toBe('PROVIDER_UNAVAILABLE');
      expect(error.name).toBe('ProviderUnavailableError');
      expect(error.details.providerId).toBe('voicebox');
    });

    test('should use default message', () => {
      const error = new ProviderUnavailableError('voicebox');
      expect(error.message).toBe('Provider voicebox is unavailable');
    });

    test('should serialize to JSON', () => {
      const error = new ProviderUnavailableError('voicebox', 'Not available');
      const json = error.toJSON();
      expect(json.error).toBe('Not available');
      expect(json.code).toBe('PROVIDER_UNAVAILABLE');
      expect(json.details.providerId).toBe('voicebox');
    });

    test('should include additional details', () => {
      const error = new ProviderUnavailableError('voicebox', 'Not available', { reason: 'offline' });
      expect(error.details.providerId).toBe('voicebox');
      expect(error.details.reason).toBe('offline');
    });
  });

  describe('AdapterError', () => {
    test('should create an AdapterError', () => {
      const error = new AdapterError('Adapter initialization failed', 'ADAPTER_INIT_FAILED');
      expect(error.message).toBe('Adapter initialization failed');
      expect(error.code).toBe('ADAPTER_INIT_FAILED');
      expect(error.name).toBe('AdapterError');
    });

    test('should use default code', () => {
      const error = new AdapterError('Adapter initialization failed');
      expect(error.code).toBe('ADAPTER_ERROR');
    });
  });

  describe('AgentError', () => {
    test('should create an AgentError', () => {
      const error = new AgentError('Agent execution failed', 'AGENT_EXEC_FAILED');
      expect(error.message).toBe('Agent execution failed');
      expect(error.code).toBe('AGENT_EXEC_FAILED');
      expect(error.name).toBe('AgentError');
    });

    test('should use default code', () => {
      const error = new AgentError('Agent execution failed');
      expect(error.code).toBe('AGENT_ERROR');
    });
  });

  describe('AgentNotFoundError', () => {
    test('should create an AgentNotFoundError', () => {
      const error = new AgentNotFoundError('AA', { context: 'lookup' });
      expect(error.message).toBe('Agent AA not found');
      expect(error.code).toBe('AGENT_NOT_FOUND');
      expect(error.name).toBe('AgentNotFoundError');
      expect(error.details.agentCode).toBe('AA');
      expect(error.details.context).toBe('lookup');
    });

    test('should serialize to JSON', () => {
      const error = new AgentNotFoundError('BB');
      const json = error.toJSON();
      expect(json.error).toBe('Agent BB not found');
      expect(json.code).toBe('AGENT_NOT_FOUND');
      expect(json.details.agentCode).toBe('BB');
    });
  });

  describe('ConfigurationError', () => {
    test('should create a ConfigurationError', () => {
      const error = new ConfigurationError('Invalid config', 'CONFIG_INVALID');
      expect(error.message).toBe('Invalid config');
      expect(error.code).toBe('CONFIG_INVALID');
      expect(error.name).toBe('ConfigurationError');
    });

    test('should use default code', () => {
      const error = new ConfigurationError('Invalid config');
      expect(error.code).toBe('CONFIGURATION_ERROR');
    });
  });

  describe('ValidationError', () => {
    test('should create a ValidationError', () => {
      const error = new ValidationError('Validation failed', 'VALIDATION_FAILED', { field: 'name' });
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.name).toBe('ValidationError');
      expect(error.details).toEqual({ field: 'name' });
    });

    test('should use default code', () => {
      const error = new ValidationError('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('AuthorizationError', () => {
    test('should create an AuthorizationError', () => {
      const error = new AuthorizationError('Not authorized', 'UNAUTHORIZED', { user: 'test' });
      expect(error.message).toBe('Not authorized');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.name).toBe('AuthorizationError');
      expect(error.details).toEqual({ user: 'test' });
    });

    test('should use default code', () => {
      const error = new AuthorizationError('Not authorized');
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('Error inheritance', () => {
    test('all errors should inherit from Error', () => {
      const errors = [
        new SystemError('test', 'TEST'),
        new ProviderError('test'),
        new ProviderUnavailableError('test'),
        new AdapterError('test'),
        new AgentError('test'),
        new AgentNotFoundError('test'),
        new ConfigurationError('test'),
        new ValidationError('test'),
        new AuthorizationError('test')
      ];

      errors.forEach(error => {
        expect(error instanceof Error).toBe(true);
      });
    });
  });

  describe('Error stack traces', () => {
    test('should preserve stack trace', () => {
      const error = new SystemError('Test error', 'TEST');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('SystemError');
    });
  });

  describe('Error instanceof checks', () => {
    test('ProviderUnavailableError should be instanceof ProviderError', () => {
      const error = new ProviderUnavailableError('test');
      expect(error instanceof ProviderError).toBe(true);
      expect(error instanceof SystemError).toBe(true);
    });

    test('AgentNotFoundError should be instanceof AgentError', () => {
      const error = new AgentNotFoundError('test');
      expect(error instanceof AgentError).toBe(true);
      expect(error instanceof SystemError).toBe(true);
    });
  });
});
