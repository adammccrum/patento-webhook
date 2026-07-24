const ProviderRegistry = require('../../src/providers/provider-registry');
const ProviderAdapter = require('../../src/providers/adapter-base');
const { ProviderUnavailableError } = require('../../src/utils/errors');

describe('ProviderRegistry Advanced', () => {
  let registry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('registerProvider validation', () => {
    test('should throw on invalid provider definition', () => {
      expect(() => {
        registry.registerProvider({
          name: 'Invalid'
        });
      }).toThrow('Invalid provider definition');
    });

    test('should throw on non-array registerProviders', () => {
      expect(() => {
        registry.registerProviders({ provider_id: 'test' });
      }).toThrow('Definitions must be an array');
    });
  });

  describe('activateAdapter', () => {
    test('should throw on undefined provider', async () => {
      await expect(
        registry.activateAdapter('undefined', ProviderAdapter, {})
      ).rejects.toThrow('Provider undefined not defined');
    });

    test('should throw on disabled provider', async () => {
      registry.registerProvider({
        provider_id: 'disabled',
        name: 'Disabled',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'DisabledAdapter',
        enabled: false,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      await expect(
        registry.activateAdapter('disabled', ProviderAdapter, {})
      ).rejects.toThrow('Provider disabled is not enabled');
    });

    test('should activate enabled provider', async () => {
      registry.registerProvider({
        provider_id: 'test',
        name: 'Test',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'TestAdapter',
        enabled: true,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      const adapter = await registry.activateAdapter('test', ProviderAdapter, {
        id: 'test',
        name: 'Test',
        category: 'voice',
        capabilities: []
      });

      expect(adapter).toBeDefined();
      expect(adapter.id).toBe('test');
      expect(registry.adapters.size).toBe(1);

      const def = registry.getDefinition('test');
      expect(def.installed).toBe(true);
      expect(def.configured).toBe(true);
      expect(def.health_status).toBe('healthy');
    });

    test('should handle adapter activation failure', async () => {
      registry.registerProvider({
        provider_id: 'failing',
        name: 'Failing',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'FailingAdapter',
        enabled: true,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      class FailingAdapter extends ProviderAdapter {
        async healthCheck() {
          throw new Error('Health check failed');
        }
      }

      await expect(
        registry.activateAdapter('failing', FailingAdapter, {
          id: 'failing',
          name: 'Failing',
          category: 'voice',
          capabilities: []
        })
      ).rejects.toThrow('Health check failed');
    });
  });

  describe('getAdapter errors', () => {
    test('should throw ProviderUnavailableError for missing adapter', () => {
      expect(() => {
        registry.getAdapter('nonexistent');
      }).toThrow(ProviderUnavailableError);
    });
  });

  describe('getAdapterForCapability', () => {
    test('should throw when no adapters available', async () => {
      registry.registerProvider({
        provider_id: 'voice1',
        name: 'Voice 1',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'VoiceAdapter1',
        enabled: false,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      await expect(
        registry.getAdapterForCapability('voice', 'tts')
      ).rejects.toThrow(ProviderUnavailableError);
    });

    test('should sort by health then cost', async () => {
      const adapter1 = new ProviderAdapter({
        id: 'health-bad',
        name: 'Health Bad',
        category: 'voice',
        capabilities: ['tts']
      });
      adapter1.health = 'unhealthy';
      adapter1.costTracker = { total: 10 };

      const adapter2 = new ProviderAdapter({
        id: 'health-good',
        name: 'Health Good',
        category: 'voice',
        capabilities: ['tts']
      });
      adapter2.health = 'healthy';
      adapter2.costTracker = { total: 20 };

      registry.registerProvider({
        provider_id: 'health-bad',
        name: 'Health Bad',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'Adapter1',
        enabled: true,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      registry.registerProvider({
        provider_id: 'health-good',
        name: 'Health Good',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'Adapter2',
        enabled: true,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      registry.adapters.set('health-bad', adapter1);
      registry.adapters.set('health-good', adapter2);

      const selected = await registry.getAdapterForCapability('voice', 'tts');
      expect(selected.id).toBe('health-good');
    });
  });

  describe('tryAdaptersForCapability', () => {
    test('should try adapters in sequence', async () => {
      const adapter1 = new ProviderAdapter({
        id: 'first',
        name: 'First',
        category: 'voice',
        capabilities: ['tts']
      });

      const adapter2 = new ProviderAdapter({
        id: 'second',
        name: 'Second',
        category: 'voice',
        capabilities: ['tts']
      });

      adapter1.testOp = jest.fn().mockRejectedValue(new Error('Failed'));
      adapter2.testOp = jest.fn().mockResolvedValue('success');

      registry.registerProvider({
        provider_id: 'first',
        name: 'First',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'Adapter1',
        enabled: true,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      registry.registerProvider({
        provider_id: 'second',
        name: 'Second',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'Adapter2',
        enabled: true,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      registry.adapters.set('first', adapter1);
      registry.adapters.set('second', adapter2);

      const result = await registry.tryAdaptersForCapability('voice', 'tts', 'testOp', 'arg1');
      expect(result.providerId).toBe('second');
      expect(result.result).toBe('success');
    });

    test('should throw when all adapters fail', async () => {
      const adapter1 = new ProviderAdapter({
        id: 'fail1',
        name: 'Fail 1',
        category: 'voice',
        capabilities: ['tts']
      });

      adapter1.testOp = jest.fn().mockRejectedValue(new Error('Failed'));

      registry.registerProvider({
        provider_id: 'fail1',
        name: 'Fail 1',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'Adapter1',
        enabled: true,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      registry.adapters.set('fail1', adapter1);

      await expect(
        registry.tryAdaptersForCapability('voice', 'tts', 'testOp')
      ).rejects.toThrow(ProviderUnavailableError);
    });

    test('should throw when operation not supported', async () => {
      const adapter = new ProviderAdapter({
        id: 'no-op',
        name: 'No Op',
        category: 'voice',
        capabilities: ['tts']
      });

      registry.registerProvider({
        provider_id: 'no-op',
        name: 'No Op',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'Adapter1',
        enabled: true,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      registry.adapters.set('no-op', adapter);

      await expect(
        registry.tryAdaptersForCapability('voice', 'tts', 'nonexistentOp')
      ).rejects.toThrow();
    });
  });

  describe('health checks', () => {
    afterEach(() => {
      jest.useRealTimers();
      registry.stopHealthChecks();
    });

    test('should stop health checks', () => {
      registry.startHealthChecks();
      expect(registry.healthCheckInterval).toBeDefined();
      registry.stopHealthChecks();
      expect(registry.healthCheckInterval).toBeNull();
    });

    test('should start health checks', (done) => {
      registry.registerProvider({
        provider_id: 'test',
        name: 'Test',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'TestAdapter',
        enabled: true,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      const adapter = new ProviderAdapter({
        id: 'test',
        name: 'Test',
        category: 'voice',
        capabilities: []
      });
      adapter.healthCheck = jest.fn().mockResolvedValue('healthy');

      registry.adapters.set('test', adapter);

      registry.startHealthChecks(100);

      setTimeout(() => {
        expect(adapter.healthCheck).toHaveBeenCalled();
        const def = registry.getDefinition('test');
        expect(def.health_status).toBe('healthy');
        registry.stopHealthChecks();
        done();
      }, 150);
    }, 10000);

    test('should handle health check failures', (done) => {
      registry.registerProvider({
        provider_id: 'failing',
        name: 'Failing',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'FailingAdapter',
        enabled: true,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      const adapter = new ProviderAdapter({
        id: 'failing',
        name: 'Failing',
        category: 'voice',
        capabilities: []
      });
      adapter.healthCheck = jest.fn().mockRejectedValue(new Error('Check failed'));

      registry.adapters.set('failing', adapter);

      registry.startHealthChecks(100);

      setTimeout(() => {
        const def = registry.getDefinition('failing');
        expect(def.health_status).toBe('unhealthy');
        registry.stopHealthChecks();
        done();
      }, 150);
    }, 10000);
  });

  describe('validate', () => {
    test('should validate all definitions', () => {
      registry.registerProvider({
        provider_id: 'valid',
        name: 'Valid',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'ValidAdapter',
        enabled: true,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      const validation = registry.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe('getStatus', () => {
    test('should return complete status report', async () => {
      registry.registerProvider({
        provider_id: 'test1',
        name: 'Test 1',
        category: 'voice',
        repository: '',
        licence: 'MIT',
        adapter: 'TestAdapter1',
        enabled: true,
        installed: false,
        configured: false,
        execution_mode: 'sync',
        GPU_requirement: false,
        health_status: 'unknown',
        last_tested: null,
        cost_classification: 'free'
      });

      await registry.activateAdapter('test1', ProviderAdapter, {
        id: 'test1',
        name: 'Test 1',
        category: 'voice',
        capabilities: []
      });

      const status = registry.getStatus();
      expect(status.timestamp).toBeDefined();
      expect(status.total_providers).toBe(1);
      expect(status.active_adapters).toBe(1);
      expect(status.providers.length).toBe(1);
    });
  });
});
