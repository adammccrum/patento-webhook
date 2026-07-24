/**
 * FrameworkHealth Tests
 */

const FrameworkHealth = require('../../src/frameworks/framework-health');
const FrameworkRegistry = require('../../src/frameworks/framework-registry');
const FrameworkBase = require('../../src/frameworks/framework-base');

describe('FrameworkHealth', () => {
  let health;
  let registry;
  let testAdapter;

  beforeEach(() => {
    registry = new FrameworkRegistry();
    health = new FrameworkHealth(registry, { check_interval_ms: 100 });

    testAdapter = new FrameworkBase({
      framework_id: 'test-fw',
      display_name: 'Test Framework'
    });

    registry.register(testAdapter);
  });

  afterEach(() => {
    if (health.monitoring) {
      health.stopMonitoring();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default interval', () => {
      const defaultHealth = new FrameworkHealth(registry);
      expect(defaultHealth.check_interval_ms).toBe(60000);
    });

    test('should initialize with custom interval', () => {
      expect(health.check_interval_ms).toBe(100);
    });
  });

  describe('Health Check', () => {
    test('should check framework health', async () => {
      const result = await health.checkFrameworkHealth('test-fw');
      expect(result.framework_id).toBe('test-fw');
      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
    });

    test('should return unknown for missing framework', async () => {
      const result = await health.checkFrameworkHealth('unknown-fw');
      expect(result.status).toBe('unknown');
      expect(result.reason).toContain('not found');
    });

    test('should record health check history', async () => {
      await health.checkFrameworkHealth('test-fw');
      const history = health.getHealthHistory('test-fw');
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('status');
      expect(history[0]).toHaveProperty('timestamp');
    });
  });

  describe('Monitoring', () => {
    test('should start monitoring', () => {
      health.startMonitoring();
      expect(health.monitoring).toBe(true);
    });

    test('should stop monitoring', () => {
      health.startMonitoring();
      health.stopMonitoring();
      expect(health.monitoring).toBe(false);
    });

    test('should not restart if already monitoring', () => {
      health.startMonitoring();
      const interval1 = health.check_timeout;
      health.startMonitoring();
      expect(health.check_timeout).toBe(interval1);
    });
  });

  describe('getHealth', () => {
    test('should return health status for framework', async () => {
      await health.checkFrameworkHealth('test-fw');
      const status = health.getHealth('test-fw');
      expect(status.framework_id).toBe('test-fw');
      expect(status.current_status).toBeDefined();
    });

    test('should return null for unknown framework', () => {
      const status = health.getHealth('unknown-fw');
      expect(status).toBeNull();
    });
  });

  describe('getSystemHealth', () => {
    test('should return system health summary', async () => {
      await health.checkFrameworkHealth('test-fw');
      const systemHealth = health.getSystemHealth();
      expect(systemHealth).toHaveProperty('total');
      expect(systemHealth).toHaveProperty('healthy');
      expect(systemHealth).toHaveProperty('unhealthy');
      expect(systemHealth.total).toBe(1);
    });
  });

  describe('getUnhealthyFrameworks', () => {
    test('should return frameworks with health issues', async () => {
      const unhealthyAdapter = new FrameworkBase({
        framework_id: 'unhealthy-fw',
        display_name: 'Unhealthy'
      });
      unhealthyAdapter.healthCheck = async () => ({ status: 'unhealthy' });

      registry.register(unhealthyAdapter);
      await health.checkFrameworkHealth('unhealthy-fw');

      const unhealthy = health.getUnhealthyFrameworks();
      expect(unhealthy.length).toBe(1);
      expect(unhealthy[0].framework_id).toBe('unhealthy-fw');
    });
  });

  describe('Health History', () => {
    test('should maintain health check history', async () => {
      await health.checkFrameworkHealth('test-fw');
      await health.checkFrameworkHealth('test-fw');
      await health.checkFrameworkHealth('test-fw');

      const history = health.getHealthHistory('test-fw', 100);
      expect(history.length).toBe(3);
    });

    test('should limit history to recent checks', async () => {
      for (let i = 0; i < 150; i++) {
        await health.checkFrameworkHealth('test-fw');
      }

      const history = health.getHealthHistory('test-fw', 100);
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('resetHealth', () => {
    test('should reset health failure count', async () => {
      const failingAdapter = new FrameworkBase({
        framework_id: 'failing-fw',
        display_name: 'Failing'
      });
      failingAdapter.healthCheck = async () => ({ status: 'unhealthy' });

      registry.register(failingAdapter);
      await health.checkFrameworkHealth('failing-fw');

      health.resetHealth('failing-fw');
      const historyData = health.health_history.get('failing-fw');
      expect(historyData.failure_count).toBe(0);
    });
  });

  describe('Event Emission', () => {
    test('should emit events', (done) => {
      const healthWithEvents = new FrameworkHealth(registry, {
        onEvent: (event) => {
          if (event.type.includes('health')) {
            expect(event.timestamp).toBeDefined();
            done();
          }
        },
        check_interval_ms: 100
      });

      healthWithEvents.startMonitoring();
    });
  });
});
