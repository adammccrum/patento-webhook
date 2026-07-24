const ProviderAdapter = require('../../src/providers/adapter-base');

describe('ProviderAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new ProviderAdapter({
      id: 'test-adapter',
      name: 'Test Adapter',
      category: 'voice',
      capabilities: ['test-capability']
    });
  });

  test('should create an adapter', () => {
    expect(adapter.id).toBe('test-adapter');
    expect(adapter.name).toBe('Test Adapter');
    expect(adapter.category).toBe('voice');
  });

  test('should check if adapter can handle capability', async () => {
    const canHandle = await adapter.canHandle('test-capability');
    expect(canHandle).toBe(true);

    const cannotHandle = await adapter.canHandle('unknown-capability');
    expect(cannotHandle).toBe(false);
  });

  test('should perform health check', async () => {
    const health = await adapter.healthCheck();
    expect(health).toBe('healthy');
    expect(adapter.lastChecked).toBeDefined();
  });

  test('should track costs', async () => {
    const cost = await adapter.trackCost('operation', 10, 0.5);
    expect(cost).toBe(5);
    expect(adapter.costTracker.total).toBe(5);
    expect(adapter.costTracker.calls).toBe(1);
  });

  test('should get metadata', async () => {
    const metadata = await adapter.getMetadata();
    expect(metadata.id).toBe('test-adapter');
    expect(metadata.name).toBe('Test Adapter');
    expect(metadata.capabilities).toContain('test-capability');
  });

  test('should reset cost tracker', () => {
    adapter.trackCost('op', 100, 0.1);
    adapter.resetCostTracker();
    expect(adapter.costTracker.total).toBe(0);
    expect(adapter.costTracker.calls).toBe(0);
  });
});
