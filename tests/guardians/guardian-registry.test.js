/**
 * Guardian Registry Tests
 */

const GuardianRegistry = require('../../src/guardians/guardian-registry');
const GuardianBase = require('../../src/guardians/guardian-base');
const { GuardianRegistryError } = require('../../src/guardians/guardian-errors');

describe('GuardianRegistry', () => {
  let registry;
  let testGuardian;

  beforeEach(() => {
    registry = new GuardianRegistry();
    testGuardian = new GuardianBase({
      guardian_id: 'test-guardian',
      category: 'test',
      display_name: 'Test Guardian'
    });
  });

  describe('Registration', () => {
    it('registers Guardian', () => {
      registry.register(testGuardian);
      const record = registry.get('test-guardian');
      expect(record).toBeDefined();
      expect(record.guardian_id).toBe('test-guardian');
    });

    it('rejects duplicate registration', () => {
      registry.register(testGuardian);
      expect(() => registry.register(testGuardian)).toThrow(GuardianRegistryError);
    });

    it('requires guardian_id', () => {
      const noIdGuardian = new GuardianBase();
      noIdGuardian.guardian_id = null;
      expect(() => registry.register(noIdGuardian)).toThrow(GuardianRegistryError);
    });
  });

  describe('Retrieval', () => {
    beforeEach(() => {
      registry.register(testGuardian);
    });

    it('retrieves Guardian by ID', () => {
      const record = registry.get('test-guardian');
      expect(record.guardian_id).toBe('test-guardian');
    });

    it('returns null for unknown Guardian', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('retrieves Guardian adapter', () => {
      const adapter = registry.getAdapter('test-guardian');
      expect(adapter).toBe(testGuardian);
    });

    it('gets all Guardians', () => {
      const another = new GuardianBase({
        guardian_id: 'another-guardian',
        category: 'test'
      });
      registry.register(another);

      const all = registry.getAll();
      expect(all.length).toBe(2);
    });

    it('gets Guardians by category', () => {
      const network = new GuardianBase({
        guardian_id: 'network-guardian',
        category: 'network'
      });
      registry.register(network);

      const byCategory = registry.getByCategory('test');
      expect(byCategory.length).toBe(1);
      expect(byCategory[0].guardian_id).toBe('test-guardian');
    });

    it('gets enabled Guardians', () => {
      const disabled = new GuardianBase({
        guardian_id: 'disabled-guardian',
        category: 'test',
        enabled: false
      });
      registry.register(disabled);

      const enabled = registry.getEnabled();
      expect(enabled.length).toBe(1);
      expect(enabled[0].guardian_id).toBe('test-guardian');
    });
  });

  describe('Health Status', () => {
    beforeEach(() => {
      registry.register(testGuardian);
    });

    it('updates health status', () => {
      registry.updateHealth('test-guardian', { status: 'healthy' });
      const record = registry.get('test-guardian');
      expect(record.health_status).toBe('healthy');
    });

    it('tracks last health check time', () => {
      const before = Date.now();
      registry.updateHealth('test-guardian', { status: 'healthy' });
      const after = Date.now();

      const record = registry.get('test-guardian');
      expect(record.last_health_check).toBeGreaterThanOrEqual(before);
      expect(record.last_health_check).toBeLessThanOrEqual(after);
    });
  });

  describe('Enable/Disable', () => {
    beforeEach(() => {
      registry.register(testGuardian);
    });

    it('enables Guardian', () => {
      testGuardian.enabled = false;
      registry.enable('test-guardian');
      const record = registry.get('test-guardian');
      expect(record.enabled).toBe(true);
    });

    it('disables Guardian', () => {
      registry.disable('test-guardian');
      const record = registry.get('test-guardian');
      expect(record.enabled).toBe(false);
    });
  });

  describe('Unregistration', () => {
    beforeEach(() => {
      registry.register(testGuardian);
    });

    it('unregisters Guardian', () => {
      registry.unregister('test-guardian');
      expect(registry.get('test-guardian')).toBeUndefined();
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      registry.register(testGuardian);

      const another = new GuardianBase({
        guardian_id: 'disabled-guardian',
        category: 'test',
        enabled: false
      });
      registry.register(another);
    });

    it('returns registry statistics', () => {
      const stats = registry.getStats();
      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
    });
  });

  describe('Events', () => {
    it('emits registration event', () => {
      const events = [];
      const reg = new GuardianRegistry({
        onEvent: (event) => events.push(event)
      });

      reg.register(testGuardian);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('guardian.guardian_registered');
    });
  });
});
