/**
 * FrameworkBase Tests
 */

const FrameworkBase = require('../../src/frameworks/framework-base');
const FrameworkResult = require('../../src/frameworks/framework-result');

describe('FrameworkBase', () => {
  let adapter;

  beforeEach(() => {
    adapter = new FrameworkBase({
      framework_id: 'test-framework',
      display_name: 'Test Framework',
      version: '1.0.0'
    });
  });

  describe('Initialization', () => {
    test('should initialize with correct properties', () => {
      expect(adapter.framework_id).toBe('test-framework');
      expect(adapter.display_name).toBe('Test Framework');
      expect(adapter.version).toBe('1.0.0');
      expect(adapter.enabled).toBe(true);
    });

    test('should have default timeout of 30 seconds', () => {
      expect(adapter.timeout_ms).toBe(30000);
    });

    test('should allow custom timeout', () => {
      const customAdapter = new FrameworkBase({
        framework_id: 'test',
        timeout_ms: 60000
      });
      expect(customAdapter.timeout_ms).toBe(60000);
    });
  });

  describe('getMetadata', () => {
    test('should return framework metadata', () => {
      const metadata = adapter.getMetadata();
      expect(metadata).toHaveProperty('framework_id', 'test-framework');
      expect(metadata).toHaveProperty('display_name', 'Test Framework');
      expect(metadata).toHaveProperty('version', '1.0.0');
    });
  });

  describe('getCapabilities', () => {
    test('should return all capabilities', () => {
      const capabilities = adapter.getCapabilities();
      expect(capabilities).toHaveProperty('multi_agent', false);
      expect(capabilities).toHaveProperty('tool_calling', false);
      expect(capabilities).toHaveProperty('rag', false);
      expect(capabilities).toHaveProperty('streaming', false);
      expect(capabilities).toHaveProperty('mcp', false);
    });

    test('should have all expected capability keys', () => {
      const capabilities = adapter.getCapabilities();
      const expectedCapabilities = [
        'multi_agent', 'tool_calling', 'rag', 'streaming', 'human_approval',
        'browser', 'vision', 'voice', 'mcp', 'memory', 'workflow', 'database'
      ];
      expectedCapabilities.forEach(cap => {
        expect(capabilities).toHaveProperty(cap);
      });
    });
  });

  describe('healthCheck', () => {
    test('should return healthy status by default', async () => {
      const health = await adapter.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health).toHaveProperty('timestamp');
      expect(health.message).toBe('OK');
    });
  });

  describe('supports', () => {
    test('should return false for any capability by default', () => {
      expect(adapter.supports('multi_agent')).toBe(false);
      expect(adapter.supports('tool_calling')).toBe(false);
      expect(adapter.supports('vision')).toBe(false);
    });
  });

  describe('execute', () => {
    test('should return unavailable result by default', async () => {
      const context = { execution_id: 'exec-123', session_id: 'sess-123' };
      const result = await adapter.execute(context);
      expect(result).toBeInstanceOf(FrameworkResult);
      expect(result.status).toBe('unavailable');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('lifecycle methods', () => {
    test('should have initialize method', async () => {
      expect(adapter.initialize).toBeDefined();
      await adapter.initialize();
    });

    test('should have createSession method', async () => {
      const context = { session_id: 'sess-123', execution_id: 'exec-123' };
      const session = await adapter.createSession(context);
      expect(session.session_id).toBe('sess-123');
      expect(session.created_at).toBeDefined();
    });

    test('should have cancel method', async () => {
      expect(adapter.cancel).toBeDefined();
      await adapter.cancel('exec-123');
    });

    test('should have cleanup method', async () => {
      expect(adapter.cleanup).toBeDefined();
      await adapter.cleanup();
    });

    test('should have shutdown method', async () => {
      expect(adapter.shutdown).toBeDefined();
      await adapter.shutdown();
    });
  });

  describe('event emission', () => {
    test('should emit events when onEvent handler is set', (done) => {
      const eventAdapter = new FrameworkBase({
        framework_id: 'test',
        onEvent: (event) => {
          expect(event.type).toContain('framework.');
          expect(event.framework_id).toBe('test');
          expect(event.timestamp).toBeDefined();
          done();
        }
      });

      eventAdapter._emitEvent('test_event', { data: 'value' });
    });

    test('should not error if onEvent is not set', () => {
      expect(() => {
        adapter._emitEvent('test_event', { data: 'value' });
      }).not.toThrow();
    });
  });
});
