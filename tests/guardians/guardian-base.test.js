/**
 * Guardian Base Tests
 */

const GuardianBase = require('../../src/guardians/guardian-base');

describe('GuardianBase', () => {
  let guardian;

  beforeEach(() => {
    guardian = new GuardianBase({
      guardian_id: 'test-guardian',
      category: 'test',
      display_name: 'Test Guardian'
    });
  });

  describe('Initialization', () => {
    it('creates Guardian with default values', () => {
      expect(guardian.guardian_id).toBe('test-guardian');
      expect(guardian.category).toBe('test');
      expect(guardian.enabled).toBe(true);
      expect(guardian.timeout_ms).toBe(5000);
      expect(guardian.fail_mode).toBe('fail_closed');
    });

    it('respects configuration options', () => {
      const custom = new GuardianBase({
        guardian_id: 'custom',
        timeout_ms: 10000,
        fail_mode: 'hold_for_review',
        enabled: false
      });

      expect(custom.timeout_ms).toBe(10000);
      expect(custom.fail_mode).toBe('hold_for_review');
      expect(custom.enabled).toBe(false);
    });
  });

  describe('Metadata and Capabilities', () => {
    it('returns metadata', () => {
      const metadata = guardian.getMetadata();
      expect(metadata.guardian_id).toBe('test-guardian');
      expect(metadata.category).toBe('test');
      expect(metadata.version).toBe('1.0.0');
    });

    it('returns capabilities', () => {
      const caps = guardian.getCapabilities();
      expect(caps.supported_actions).toBeDefined();
      expect(Array.isArray(caps.supported_actions)).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('performs health check', async () => {
      const health = await guardian.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('Lifecycle', () => {
    it('initializes Guardian', async () => {
      await expect(guardian.initialize()).resolves.toBeUndefined();
    });

    it('performs cleanup', async () => {
      await expect(guardian.cleanup()).resolves.toBeUndefined();
    });

    it('shuts down Guardian', async () => {
      await expect(guardian.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('Evaluation', () => {
    it('returns unavailable for base implementation', async () => {
      const context = {
        evaluation_id: 'test-eval',
        action: 'test_action'
      };

      const result = await guardian.evaluate(context);
      expect(result.decision).toBe('unavailable');
      expect(result.guardian_id).toBe('test-guardian');
    });
  });

  describe('Event Emission', () => {
    it('emits events when handler is provided', () => {
      const events = [];
      const guardianWithEvent = new GuardianBase({
        guardian_id: 'event-test',
        onEvent: (event) => events.push(event)
      });

      guardianWithEvent._emitEvent('test_event', { data: 'test' });

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('guardian.test_event');
      expect(events[0].data).toBe('test');
    });
  });

  describe('Supports', () => {
    it('returns false for base implementation', () => {
      expect(guardian.supports('action', 'resource')).toBe(false);
    });
  });

  describe('Cancel and Cleanup', () => {
    it('cancels evaluation', async () => {
      await expect(guardian.cancel('test-eval')).resolves.toBeUndefined();
    });
  });
});
