/**
 * FrameworkRegistry Tests
 */

const FrameworkRegistry = require('../../src/frameworks/framework-registry');
const FrameworkBase = require('../../src/frameworks/framework-base');

describe('FrameworkRegistry', () => {
  let registry;
  let testAdapter;

  beforeEach(() => {
    registry = new FrameworkRegistry();
    testAdapter = new FrameworkBase({
      framework_id: 'test-fw',
      display_name: 'Test Framework',
      version: '1.0.0'
    });
  });

  describe('Register', () => {
    test('should register framework adapter', () => {
      registry.register(testAdapter, { display_name: 'Test' });
      const record = registry.get('test-fw');
      expect(record).toBeDefined();
      expect(record.framework_id).toBe('test-fw');
    });

    test('should throw error if adapter has no framework_id', () => {
      const badAdapter = new FrameworkBase({ display_name: 'Test' });
      expect(() => {
        registry.register(badAdapter);
      }).toThrow('Framework adapter must have a framework_id');
    });

    test('should throw error if framework already registered', () => {
      registry.register(testAdapter);
      expect(() => {
        registry.register(testAdapter);
      }).toThrow('Framework test-fw is already registered');
    });

    test('should store metadata in registry record', () => {
      const metadata = {
        display_name: 'Custom Name',
        category: 'multi-agent',
        maintainer: 'Test Org'
      };
      registry.register(testAdapter, metadata);
      const record = registry.get('test-fw');
      expect(record.display_name).toBe('Custom Name');
      expect(record.category).toBe('multi-agent');
      expect(record.maintainer).toBe('Test Org');
    });

    test('should set default metadata values', () => {
      registry.register(testAdapter);
      const record = registry.get('test-fw');
      expect(record.category).toBe('general');
      expect(record.maintenance_status).toBe('unknown');
      expect(record.enabled).toBe(true);
      expect(record.health_status).toBe('unknown');
    });
  });

  describe('Get', () => {
    test('should return framework record', () => {
      registry.register(testAdapter);
      const record = registry.get('test-fw');
      expect(record.framework_id).toBe('test-fw');
      expect(record.adapter).toBe(testAdapter);
    });

    test('should return null for unknown framework', () => {
      const record = registry.get('unknown-fw');
      expect(record).toBeUndefined();
    });
  });

  describe('getAdapter', () => {
    test('should return framework adapter', () => {
      registry.register(testAdapter);
      const adapter = registry.getAdapter('test-fw');
      expect(adapter).toBe(testAdapter);
    });

    test('should return null if framework not found', () => {
      const adapter = registry.getAdapter('unknown-fw');
      expect(adapter).toBeNull();
    });
  });

  describe('getAll', () => {
    test('should return all registered frameworks', () => {
      const adapter2 = new FrameworkBase({
        framework_id: 'test-fw-2',
        display_name: 'Test Framework 2'
      });

      registry.register(testAdapter);
      registry.register(adapter2);

      const all = registry.getAll();
      expect(all.length).toBe(2);
      expect(all.map(r => r.framework_id)).toContain('test-fw');
      expect(all.map(r => r.framework_id)).toContain('test-fw-2');
    });

    test('should return empty array if no frameworks registered', () => {
      const all = registry.getAll();
      expect(all).toEqual([]);
    });
  });

  describe('getByCategory', () => {
    test('should filter frameworks by category', () => {
      registry.register(testAdapter, { category: 'multi-agent' });
      const adapter2 = new FrameworkBase({ framework_id: 'test-fw-2', display_name: 'Test 2' });
      registry.register(adapter2, { category: 'workflow' });

      const multiAgent = registry.getByCategory('multi-agent');
      expect(multiAgent.length).toBe(1);
      expect(multiAgent[0].framework_id).toBe('test-fw');
    });
  });

  describe('getEnabled', () => {
    test('should return only enabled frameworks', () => {
      registry.register(testAdapter, { enabled: true });
      const adapter2 = new FrameworkBase({ framework_id: 'test-fw-2', display_name: 'Test 2' });
      registry.register(adapter2, { enabled: false });

      const enabled = registry.getEnabled();
      expect(enabled.length).toBe(1);
      expect(enabled[0].framework_id).toBe('test-fw');
    });
  });

  describe('Enable/Disable', () => {
    test('should enable framework', () => {
      registry.register(testAdapter, { enabled: false });
      registry.enable('test-fw');
      expect(registry.get('test-fw').enabled).toBe(true);
    });

    test('should disable framework', () => {
      registry.register(testAdapter, { enabled: true });
      registry.disable('test-fw');
      expect(registry.get('test-fw').enabled).toBe(false);
    });
  });

  describe('Unregister', () => {
    test('should remove framework from registry', () => {
      registry.register(testAdapter);
      registry.unregister('test-fw');
      expect(registry.get('test-fw')).toBeUndefined();
    });
  });

  describe('Health Updates', () => {
    test('should update framework health status', () => {
      registry.register(testAdapter);
      registry.updateHealth('test-fw', { status: 'healthy' });
      const record = registry.get('test-fw');
      expect(record.health_status).toBe('healthy');
      expect(record.last_health_check).toBeDefined();
    });
  });

  describe('getStats', () => {
    test('should return registry statistics', () => {
      registry.register(testAdapter, { category: 'multi-agent', enabled: true });
      const adapter2 = new FrameworkBase({ framework_id: 'test-fw-2' });
      registry.register(adapter2, { category: 'workflow', enabled: false });

      const stats = registry.getStats();
      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
      expect(stats.by_category).toBeDefined();
    });
  });

  describe('Event Emission', () => {
    test('should emit event when framework registered', (done) => {
      const registryWithEvents = new FrameworkRegistry({
        onEvent: (event) => {
          if (event.type === 'framework.framework_registered') {
            expect(event.framework_id).toBe('test-fw');
            done();
          }
        }
      });

      registryWithEvents.register(testAdapter);
    });
  });
});
