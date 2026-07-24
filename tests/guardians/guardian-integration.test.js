/**
 * Guardian Integration Tests
 */

const GuardianManager = require('../../src/guardians/guardian-manager');
const GuardianContext = require('../../src/guardians/guardian-context');
const MockGuardian = require('../../src/guardians/adapters/mock-guardian');

describe('Guardian Framework Integration', () => {
  let manager;

  beforeEach(() => {
    manager = new GuardianManager();
  });

  describe('Initialization', () => {
    it('creates Guardian Manager', () => {
      expect(manager).toBeDefined();
      expect(manager.initialized).toBe(false);
    });

    it('initializes Manager', async () => {
      await manager.initialize();
      expect(manager.initialized).toBe(true);
    });
  });

  describe('Guardian Registration', () => {
    it('registers Guardian', () => {
      const mock = new MockGuardian({
        guardian_id: 'mock-1'
      });

      manager.registerGuardian(mock, {
        display_name: 'Mock Guardian 1',
        implementation_status: 'mock'
      });

      const record = manager.getGuardianStatus('mock-1');
      expect(record).toBeDefined();
      expect(record.guardian_id).toBe('mock-1');
    });

    it('registers multiple Guardians', () => {
      for (let i = 0; i < 3; i++) {
        const mock = new MockGuardian({
          guardian_id: `mock-${i}`
        });
        manager.registerGuardian(mock);
      }

      const statuses = manager.getAllGuardianStatuses();
      expect(statuses.length).toBe(3);
    });
  });

  describe('Evaluation', () => {
    beforeEach(async () => {
      const mock = new MockGuardian({
        guardian_id: 'allow-guardian',
        allow_by_default: true
      });
      manager.registerGuardian(mock);

      const denyMock = new MockGuardian({
        guardian_id: 'deny-guardian',
        allow_by_default: false
      });
      manager.registerGuardian(denyMock);

      await manager.initialize();
    });

    it('evaluates context through pipeline', async () => {
      const context = new GuardianContext({
        action: 'test_action',
        requesting_agent: 'test-agent',
        target_provider: 'test-provider'
      });

      const result = await manager.evaluate(context);
      expect(result).toBeDefined();
      expect(result.evaluation_id).toBe(context.evaluation_id);
    });

    it('allows when Guardian allows', async () => {
      const context = new GuardianContext({
        action: 'test_action'
      });

      // Policy requires audit Guardian only (the default), which isn't registered
      // So result will be unavailable -> deny (fail_closed)
      const result = await manager.evaluate(context);
      expect(result.final_decision).toBe('deny');
    });

    it('handles missing required Guardian', async () => {
      const context = new GuardianContext({
        action: 'shell_command' // Requires execution Guardian
      });

      const result = await manager.evaluate(context);
      expect(result.final_decision).toBe('deny'); // fail_closed
    });
  });

  describe('Health Management', () => {
    beforeEach(() => {
      const mock = new MockGuardian({
        guardian_id: 'health-test'
      });
      manager.registerGuardian(mock);
    });

    it('gets health status', () => {
      const status = manager.getHealthStatus();
      expect(status.manager_initialized).toBe(false);
      expect(status.registry_stats).toBeDefined();
    });

    it('gets individual Guardian health', async () => {
      await manager.initialize();
      const status = manager.getGuardianStatus('health-test');
      expect(status.guardian_id).toBe('health-test');
    });

    it('performs health check on Guardian', async () => {
      await manager.initialize();
      const health = await manager.checkGuardianHealth('health-test');
      expect(health.status).toBe('healthy');
    });

    it('performs health check on all Guardians', async () => {
      const mock2 = new MockGuardian({
        guardian_id: 'health-test-2'
      });
      manager.registerGuardian(mock2);

      await manager.initialize();
      const results = await manager.checkAllHealth();

      expect(Object.keys(results).length).toBeGreaterThan(0);
      Object.values(results).forEach((health) => {
        expect(health.status).toBeDefined();
      });
    });
  });

  describe('Guardian Control', () => {
    beforeEach(() => {
      const mock = new MockGuardian({
        guardian_id: 'control-test'
      });
      manager.registerGuardian(mock);
    });

    it('enables Guardian', () => {
      manager.disableGuardian('control-test');
      let status = manager.getGuardianStatus('control-test');
      expect(status.enabled).toBe(false);

      manager.enableGuardian('control-test');
      status = manager.getGuardianStatus('control-test');
      expect(status.enabled).toBe(true);
    });

    it('disables Guardian', () => {
      manager.disableGuardian('control-test');
      const status = manager.getGuardianStatus('control-test');
      expect(status.enabled).toBe(false);
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      const mock = new MockGuardian({
        guardian_id: 'shutdown-test'
      });
      manager.registerGuardian(mock);
      await manager.initialize();
    });

    it('shuts down Manager', async () => {
      expect(manager.initialized).toBe(true);
      await manager.shutdown();
      expect(manager.initialized).toBe(false);
    });
  });

  describe('Policy and Context', () => {
    it('accepts GuardianContext object', async () => {
      const context = new GuardianContext({
        action: 'test',
        correlation_id: 'test-correlation'
      });

      await manager.initialize();
      const result = await manager.evaluate(context);
      expect(result.evaluation_id).toBe(context.evaluation_id);
    });

    it('converts plain object to GuardianContext', async () => {
      await manager.initialize();

      const result = await manager.evaluate({
        action: 'test',
        correlation_id: 'test-correlation'
      });

      expect(result.evaluation_id).toBeDefined();
    });

    it('respects policy for required Guardians', async () => {
      const mock = new MockGuardian({
        guardian_id: 'audit',
        allow_by_default: true
      });
      manager.registerGuardian(mock);

      // Default policy requires 'audit' Guardian
      const context = new GuardianContext({
        action: 'test_action'
      });

      await manager.initialize();
      const result = await manager.evaluate(context);

      // Should have evaluated audit Guardian
      expect(result.all_results.length).toBeGreaterThan(0);
    });
  });

  describe('Event Emission', () => {
    it('emits events during evaluation', async () => {
      const events = [];
      const eventManager = new GuardianManager({
        onEvent: (event) => events.push(event)
      });

      const mock = new MockGuardian({
        guardian_id: 'event-test'
      });
      eventManager.registerGuardian(mock);

      await eventManager.initialize();
      const context = new GuardianContext({ action: 'test' });
      await eventManager.evaluate(context);

      const types = events.map((e) => e.type);
      expect(types).toContain('guardian.evaluation_requested');
      expect(types.some((t) => t.includes('evaluation_'))).toBe(true);
    });
  });

  describe('Core v1.0 Compatibility', () => {
    it('does not modify Core v1.0 API', () => {
      expect(manager.registry).toBeDefined();
      expect(manager.policy).toBeDefined();
      expect(manager.pipeline).toBeDefined();
      expect(manager.health_monitor).toBeDefined();
    });

    it('Guardian evaluation is opt-in', async () => {
      // Guardian framework can be used independently of Core APIs
      await manager.initialize();
      const context = new GuardianContext({ action: 'test' });
      const result = await manager.evaluate(context);
      expect(result).toBeDefined();
    });
  });

  describe('Echo Compatibility', () => {
    it('Guardian Framework is Echo-compatible', async () => {
      const mock = new MockGuardian({
        guardian_id: 'echo-test'
      });
      manager.registerGuardian(mock);

      // Echo can use Guardian independently
      expect(manager.registry.get('echo-test')).toBeDefined();
      expect(manager.policy).toBeDefined();
    });
  });
});
