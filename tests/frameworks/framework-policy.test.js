/**
 * FrameworkPolicy Tests
 */

const FrameworkPolicy = require('../../src/frameworks/framework-policy');
const FrameworkRegistry = require('../../src/frameworks/framework-registry');
const FrameworkBase = require('../../src/frameworks/framework-base');
const FrameworkContext = require('../../src/frameworks/framework-context');

describe('FrameworkPolicy', () => {
  let policy;
  let registry;
  let testAdapter;

  beforeEach(() => {
    registry = new FrameworkRegistry();
    policy = new FrameworkPolicy(registry);

    testAdapter = new FrameworkBase({
      framework_id: 'test-fw',
      display_name: 'Test Framework'
    });
  });

  describe('Default Policies', () => {
    test('should have default policy', () => {
      expect(policy.policies.has('default')).toBe(true);
    });

    test('should have high-security policy', () => {
      expect(policy.policies.has('high-security')).toBe(true);
    });

    test('should have sandbox-only policy', () => {
      expect(policy.policies.has('sandbox-only')).toBe(true);
    });

    test('should have streaming-required policy', () => {
      expect(policy.policies.has('streaming-required')).toBe(true);
    });
  });

  describe('Register Policy', () => {
    test('should register custom policy', () => {
      const customPolicy = {
        name: 'custom',
        rules: [
          { priority: 1000, condition: (f) => f.enabled }
        ]
      };
      policy.registerPolicy('custom', customPolicy);
      expect(policy.policies.has('custom')).toBe(true);
    });

    test('should throw error if policy has no rules', () => {
      expect(() => {
        policy.registerPolicy('bad', { name: 'bad' });
      }).toThrow('Policy must have a rules array');
    });
  });

  describe('canExecute', () => {
    test('should return false if framework not found', () => {
      expect(policy.canExecute('unknown', 'multi_agent')).toBe(false);
    });

    test('should return false if framework disabled', () => {
      registry.register(testAdapter, { enabled: false });
      expect(policy.canExecute('test-fw', 'multi_agent')).toBe(false);
    });

    test('should return false if framework does not support capability', () => {
      registry.register(testAdapter);
      expect(policy.canExecute('test-fw', 'multi_agent')).toBe(false);
    });
  });

  describe('validateFramework', () => {
    test('should validate framework exists', () => {
      const result = policy.validateFramework('unknown', null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate framework is enabled', () => {
      registry.register(testAdapter, { enabled: false });
      const result = policy.validateFramework('test-fw', null);
      expect(result.valid).toBe(false);
    });

    test('should validate Sierra reference', () => {
      registry.register(testAdapter, { sierra_required: true });
      const context = new FrameworkContext({ framework_id: 'test-fw' });
      const result = policy.validateFramework('test-fw', context);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Sierra'))).toBe(true);
    });

    test('should validate Uniform reference', () => {
      registry.register(testAdapter, { uniform_required: true });
      const context = new FrameworkContext({ framework_id: 'test-fw' });
      const result = policy.validateFramework('test-fw', context);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Uniform'))).toBe(true);
    });
  });

  describe('getAvailableCapabilities', () => {
    test('should return capabilities from enabled frameworks', () => {
      const adapter = new FrameworkBase({
        framework_id: 'multi-agent-fw',
        display_name: 'Multi Agent'
      });

      // Create a capability-enabled adapter subclass for testing
      adapter.getCapabilities = () => ({
        multi_agent: true,
        tool_calling: true,
        rag: false,
        streaming: false,
        human_approval: false,
        browser: false,
        vision: false,
        voice: false,
        mcp: false,
        memory: false,
        workflow: false,
        database: false
      });

      registry.register(adapter, { enabled: true });
      const capabilities = policy.getAvailableCapabilities();

      expect(capabilities).toContain('multi_agent');
      expect(capabilities).toContain('tool_calling');
    });
  });

  describe('getFrameworksByCapability', () => {
    test('should return frameworks supporting capability', () => {
      const adapter = new FrameworkBase({
        framework_id: 'multi-agent-fw',
        display_name: 'Multi Agent'
      });

      adapter.supports = (cap) => cap === 'multi_agent';
      registry.register(adapter, { enabled: true });

      const frameworks = policy.getFrameworksByCapability('multi_agent');
      expect(frameworks.length).toBe(1);
      expect(frameworks[0].framework_id).toBe('multi-agent-fw');
    });
  });

  describe('Event Emission', () => {
    test('should emit policy events', (done) => {
      const policyWithEvents = new FrameworkPolicy(registry, {
        onEvent: (event) => {
          if (event.type.includes('policy')) {
            expect(event.timestamp).toBeDefined();
            done();
          }
        }
      });

      const customPolicy = {
        name: 'test',
        rules: [{ priority: 100, condition: (f) => true }]
      };
      policyWithEvents.registerPolicy('test', customPolicy);
    });
  });
});
