/**
 * Framework Integration Tests
 *
 * End-to-end tests for framework registry, policy, health, and manager.
 */

const FrameworkManager = require('../../src/frameworks/framework-manager');
const FrameworkBase = require('../../src/frameworks/framework-base');
const FrameworkContext = require('../../src/frameworks/framework-context');
const NativeAdapter = require('../../src/frameworks/adapters/native/native-adapter');

describe('Framework Integration', () => {
  let manager;

  beforeEach(() => {
    manager = new FrameworkManager();
  });

  afterEach(() => {
    if (manager.health.monitoring) {
      manager.health.stopMonitoring();
    }
  });

  describe('Complete Framework Lifecycle', () => {
    test('should register, query, and manage frameworks', () => {
      const nativeAdapter = new NativeAdapter();
      manager.registerFramework(nativeAdapter);

      const framework = manager.getFramework('native');
      expect(framework).toBeDefined();
      expect(framework.framework_id).toBe('native');
      expect(framework.enabled).toBe(true);
    });

    test('should enable and disable frameworks', () => {
      const adapter = new FrameworkBase({ framework_id: 'test-fw' });
      manager.registerFramework(adapter, { enabled: true });

      manager.disableFramework('test-fw');
      expect(manager.getFramework('test-fw').enabled).toBe(false);

      manager.enableFramework('test-fw');
      expect(manager.getFramework('test-fw').enabled).toBe(true);
    });
  });

  describe('Framework Categorization', () => {
    test('should filter frameworks by category', () => {
      const multiAgentAdapter = new FrameworkBase({ framework_id: 'multi-agent-fw' });
      const workflowAdapter = new FrameworkBase({ framework_id: 'workflow-fw' });

      manager.registerFramework(multiAgentAdapter, { category: 'multi-agent' });
      manager.registerFramework(workflowAdapter, { category: 'workflow' });

      const multiAgent = manager.getFrameworksByCategory('multi-agent');
      expect(multiAgent.length).toBe(1);
      expect(multiAgent[0].framework_id).toBe('multi-agent-fw');

      const workflow = manager.getFrameworksByCategory('workflow');
      expect(workflow.length).toBe(1);
      expect(workflow[0].framework_id).toBe('workflow-fw');
    });
  });

  describe('Policy-Driven Selection', () => {
    test('should select frameworks based on policy', () => {
      const nativeAdapter = new NativeAdapter();
      manager.registerFramework(nativeAdapter);

      const selectedFramework = manager.policy.selectFramework(
        'multi_agent',
        null,
        'default'
      );

      expect(selectedFramework).toBeDefined();
      expect(selectedFramework.framework_id).toBe('native');
    });

    test('should validate framework meets requirements', () => {
      const adapter = new FrameworkBase({ framework_id: 'test-fw' });
      manager.registerFramework(adapter, {
        sierra_required: true,
        uniform_required: true
      });

      const context = new FrameworkContext({ framework_id: 'test-fw' });
      const validation = manager.policy.validateFramework('test-fw', context);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should validate framework with all security references', () => {
      const adapter = new FrameworkBase({ framework_id: 'test-fw' });
      manager.registerFramework(adapter, {
        sierra_required: true,
        uniform_required: true
      });

      const context = new FrameworkContext({
        framework_id: 'test-fw',
        sierra_reference: 'sierra-123',
        uniform_reference: 'uniform-123',
        guardian_reference: 'guardian-123'
      });

      const validation = manager.policy.validateFramework('test-fw', context);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Health Monitoring Integration', () => {
    test('should monitor framework health', async () => {
      const adapter = new FrameworkBase({ framework_id: 'test-fw' });
      manager.registerFramework(adapter);

      const health = await manager.health.checkFrameworkHealth('test-fw');
      expect(health.framework_id).toBe('test-fw');
      expect(health.status).toBe('healthy');
    });

    test('should track health status in registry', async () => {
      const adapter = new FrameworkBase({ framework_id: 'test-fw' });
      manager.registerFramework(adapter);

      await manager.health.checkFrameworkHealth('test-fw');
      const framework = manager.getFramework('test-fw');

      expect(framework.health_status).toBe('healthy');
      expect(framework.last_health_check).toBeDefined();
    });

    test('should provide system health summary', async () => {
      const adapter1 = new FrameworkBase({ framework_id: 'fw-1' });
      const adapter2 = new FrameworkBase({ framework_id: 'fw-2' });

      manager.registerFramework(adapter1);
      manager.registerFramework(adapter2);

      await manager.health.checkFrameworkHealth('fw-1');
      await manager.health.checkFrameworkHealth('fw-2');

      const systemHealth = manager.health.getSystemHealth();
      expect(systemHealth.total).toBe(2);
      expect(systemHealth.healthy).toBe(2);
    });
  });

  describe('Framework Statistics', () => {
    test('should provide comprehensive statistics', () => {
      const adapter1 = new FrameworkBase({ framework_id: 'fw-1' });
      const adapter2 = new FrameworkBase({ framework_id: 'fw-2' });

      manager.registerFramework(adapter1, {
        category: 'multi-agent',
        enabled: true,
        implementation_status: 'integrated'
      });
      manager.registerFramework(adapter2, {
        category: 'workflow',
        enabled: false,
        implementation_status: 'proposed'
      });

      const stats = manager.getStats();

      expect(stats.registry.total).toBe(2);
      expect(stats.registry.enabled).toBe(1);
      expect(stats.registry.disabled).toBe(1);
      expect(stats.registry.by_category).toBeDefined();
      expect(stats.registry.by_implementation_status).toBeDefined();
      expect(stats.health).toBeDefined();
      expect(stats.executions).toBeDefined();
    });
  });

  describe('Framework Metadata', () => {
    test('should store and retrieve framework metadata', () => {
      const metadata = {
        display_name: 'Test Framework',
        category: 'testing',
        maintainer: 'Test Team',
        licence: 'MIT',
        official_repository: 'https://github.com/test/test'
      };

      const adapter = new FrameworkBase({
        framework_id: 'test-fw',
        display_name: 'Test Framework'
      });

      manager.registerFramework(adapter, metadata);
      const framework = manager.getFramework('test-fw');

      expect(framework.display_name).toBe(metadata.display_name);
      expect(framework.category).toBe(metadata.category);
      expect(framework.maintainer).toBe(metadata.maintainer);
      expect(framework.licence).toBe(metadata.licence);
      expect(framework.official_repository).toBe(metadata.official_repository);
    });
  });

  describe('Multiple Framework Management', () => {
    test('should manage multiple frameworks simultaneously', () => {
      const adapters = [];
      for (let i = 0; i < 5; i++) {
        const adapter = new FrameworkBase({
          framework_id: `fw-${i}`,
          display_name: `Framework ${i}`
        });
        adapters.push(adapter);
        manager.registerFramework(adapter, {
          category: i % 2 === 0 ? 'multi-agent' : 'workflow',
          enabled: i % 2 === 0
        });
      }

      const all = manager.getFrameworks();
      expect(all.length).toBe(5);

      const enabled = manager.getEnabledFrameworks();
      expect(enabled.length).toBe(3);

      const multiAgent = manager.getFrameworksByCategory('multi-agent');
      expect(multiAgent.length).toBe(3);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing framework gracefully', () => {
      const framework = manager.getFramework('nonexistent');
      expect(framework).toBeUndefined();
    });

    test('should handle duplicate registration', () => {
      const adapter = new FrameworkBase({ framework_id: 'test-fw' });
      manager.registerFramework(adapter);

      expect(() => {
        manager.registerFramework(adapter);
      }).toThrow();
    });

    test('should handle invalid framework_id', () => {
      const badAdapter = new FrameworkBase({ display_name: 'No ID' });
      expect(() => {
        manager.registerFramework(badAdapter);
      }).toThrow();
    });
  });

  describe('Native Framework', () => {
    test('should register native LAO AI OS framework', () => {
      const nativeAdapter = new NativeAdapter();
      manager.registerFramework(nativeAdapter);

      const framework = manager.getFramework('native');
      expect(framework).toBeDefined();
      expect(framework.display_name).toBe('LAO AI OS Native');
      expect(framework.adapter_status).toBe('complete');
      expect(framework.implementation_status).toBe('integrated');
    });

    test('native framework should support core capabilities', () => {
      const nativeAdapter = new NativeAdapter();
      manager.registerFramework(nativeAdapter);

      expect(nativeAdapter.supports('multi_agent')).toBe(true);
      expect(nativeAdapter.supports('tool_calling')).toBe(true);
      expect(nativeAdapter.supports('mcp')).toBe(true);
    });

    test('native framework should be healthy', async () => {
      const nativeAdapter = new NativeAdapter();
      manager.registerFramework(nativeAdapter);

      const health = await manager.health.checkFrameworkHealth('native');
      expect(health.status).toBe('healthy');
    });
  });
});
