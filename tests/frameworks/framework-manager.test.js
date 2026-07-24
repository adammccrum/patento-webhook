/**
 * FrameworkManager Tests
 */

const FrameworkManager = require('../../src/frameworks/framework-manager');
const FrameworkBase = require('../../src/frameworks/framework-base');
const FrameworkContext = require('../../src/frameworks/framework-context');

describe('FrameworkManager', () => {
  let manager;
  let testAdapter;

  beforeEach(() => {
    manager = new FrameworkManager();
    testAdapter = new FrameworkBase({
      framework_id: 'test-fw',
      display_name: 'Test Framework'
    });
  });

  describe('Initialization', () => {
    test('should initialize with empty registry', () => {
      expect(manager.registry).toBeDefined();
      expect(manager.policy).toBeDefined();
      expect(manager.health).toBeDefined();
      expect(manager.getFrameworks().length).toBe(0);
    });
  });

  describe('registerFramework', () => {
    test('should register framework adapter', () => {
      manager.registerFramework(testAdapter, { display_name: 'Test' });
      const fw = manager.getFramework('test-fw');
      expect(fw).toBeDefined();
      expect(fw.framework_id).toBe('test-fw');
    });
  });

  describe('getFramework', () => {
    test('should return registered framework', () => {
      manager.registerFramework(testAdapter);
      const fw = manager.getFramework('test-fw');
      expect(fw.framework_id).toBe('test-fw');
    });

    test('should return null for unknown framework', () => {
      const fw = manager.getFramework('unknown');
      expect(fw).toBeUndefined();
    });
  });

  describe('getFrameworks', () => {
    test('should return all frameworks', () => {
      manager.registerFramework(testAdapter);
      const adapter2 = new FrameworkBase({ framework_id: 'test-fw-2' });
      manager.registerFramework(adapter2);

      const frameworks = manager.getFrameworks();
      expect(frameworks.length).toBe(2);
    });
  });

  describe('getFrameworksByCategory', () => {
    test('should filter frameworks by category', () => {
      manager.registerFramework(testAdapter, { category: 'multi-agent' });
      const adapter2 = new FrameworkBase({ framework_id: 'test-fw-2' });
      manager.registerFramework(adapter2, { category: 'workflow' });

      const multiAgent = manager.getFrameworksByCategory('multi-agent');
      expect(multiAgent.length).toBe(1);
      expect(multiAgent[0].framework_id).toBe('test-fw');
    });
  });

  describe('getEnabledFrameworks', () => {
    test('should return only enabled frameworks', () => {
      manager.registerFramework(testAdapter, { enabled: true });
      const adapter2 = new FrameworkBase({ framework_id: 'test-fw-2' });
      manager.registerFramework(adapter2, { enabled: false });

      const enabled = manager.getEnabledFrameworks();
      expect(enabled.length).toBe(1);
      expect(enabled[0].framework_id).toBe('test-fw');
    });
  });

  describe('enableFramework/disableFramework', () => {
    test('should enable/disable framework', () => {
      manager.registerFramework(testAdapter, { enabled: false });
      manager.enableFramework('test-fw');
      expect(manager.getFramework('test-fw').enabled).toBe(true);

      manager.disableFramework('test-fw');
      expect(manager.getFramework('test-fw').enabled).toBe(false);
    });
  });

  describe('getStats', () => {
    test('should return manager statistics', () => {
      manager.registerFramework(testAdapter);
      const stats = manager.getStats();
      expect(stats).toHaveProperty('registry');
      expect(stats).toHaveProperty('health');
      expect(stats).toHaveProperty('executions');
      expect(stats.registry.total).toBe(1);
    });
  });

  describe('Health monitoring', () => {
    test('should start and stop health monitoring', async () => {
      await manager.start();
      expect(manager.health.monitoring).toBe(true);

      await manager.stop();
      expect(manager.health.monitoring).toBe(false);
    });
  });

  describe('Execution tracking', () => {
    test('should track active executions', async () => {
      const context = new FrameworkContext({
        execution_id: 'exec-123',
        framework_id: 'test-fw',
        sierra_reference: 'sierra-123',
        uniform_reference: 'uniform-123',
        guardian_reference: 'guardian-123'
      });

      manager.registerFramework(testAdapter);
      const result = await manager.execute('multi_agent', context);

      expect(result.execution_id).toBe('exec-123');
      expect(result.framework_id).toBe('test-fw');
    });
  });

  describe('Event Emission', () => {
    test('should emit events', (done) => {
      const managerWithEvents = new FrameworkManager({
        onEvent: (event) => {
          if (event.type.includes('framework')) {
            expect(event.timestamp).toBeDefined();
            done();
          }
        }
      });

      managerWithEvents.registerFramework(testAdapter);
    });
  });
});
