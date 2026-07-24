/**
 * Framework Adapters Tests
 */

const NativeAdapter = require('../../src/frameworks/adapters/native/native-adapter');
const LangGraphAdapter = require('../../src/frameworks/adapters/langgraph/langgraph-adapter');
const AutoGenAdapter = require('../../src/frameworks/adapters/autogen/autogen-adapter');
const CrewAIAdapter = require('../../src/frameworks/adapters/crewai/crewai-adapter');
const PydanticAIAdapter = require('../../src/frameworks/adapters/pydanticai/pydanticai-adapter');
const OpenHandsAdapter = require('../../src/frameworks/adapters/openhands/openhands-adapter');
const AiderAdapter = require('../../src/frameworks/adapters/aider/aider-adapter');
const FrameworkContext = require('../../src/frameworks/framework-context');

describe('Framework Adapters', () => {
  describe('NativeAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new NativeAdapter();
    });

    test('should initialize', async () => {
      await adapter.initialize();
      expect(adapter.enabled).toBe(true);
    });

    test('should have multi-agent capability', () => {
      const capabilities = adapter.getCapabilities();
      expect(capabilities.multi_agent).toBe(true);
      expect(capabilities.tool_calling).toBe(true);
      expect(capabilities.mcp).toBe(true);
    });

    test('should return healthy status', async () => {
      const health = await adapter.healthCheck();
      expect(health.status).toBe('healthy');
    });

    test('should support multi_agent', () => {
      expect(adapter.supports('multi_agent')).toBe(true);
    });
  });

  describe('LangGraphAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new LangGraphAdapter();
    });

    test('should be a placeholder adapter', async () => {
      const info = adapter.getAdapterInfo();
      expect(info.adapter_type).toBe('placeholder');
    });

    test('should return unknown health status', async () => {
      const health = await adapter.healthCheck();
      expect(health.status).toBe('unknown');
      expect(health.message).toContain('placeholder');
    });

    test('should not support any capabilities', () => {
      expect(adapter.supports('multi_agent')).toBe(false);
      expect(adapter.supports('tool_calling')).toBe(false);
    });

    test('should return unavailable on execute', async () => {
      const context = new FrameworkContext({
        execution_id: 'exec-123',
        framework_id: 'langgraph'
      });
      const result = await adapter.execute(context);
      expect(result.status).toBe('unavailable');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('AutoGenAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new AutoGenAdapter();
    });

    test('should be a placeholder adapter', () => {
      expect(adapter.adapter_type).toBe('placeholder');
    });

    test('should return unknown health status', async () => {
      const health = await adapter.healthCheck();
      expect(health.status).toBe('unknown');
    });

    test('should return unavailable on execute', async () => {
      const context = new FrameworkContext({
        execution_id: 'exec-123',
        framework_id: 'autogen'
      });
      const result = await adapter.execute(context);
      expect(result.status).toBe('unavailable');
    });
  });

  describe('CrewAIAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new CrewAIAdapter();
    });

    test('should initialize', async () => {
      await adapter.initialize();
      expect(adapter.framework_id).toBe('crewai');
    });

    test('should not support any capabilities by default', () => {
      expect(adapter.supports('multi_agent')).toBe(false);
    });
  });

  describe('PydanticAIAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new PydanticAIAdapter();
    });

    test('should have correct framework_id', () => {
      expect(adapter.framework_id).toBe('pydanticai');
      expect(adapter.display_name).toBe('PydanticAI');
    });
  });

  describe('OpenHandsAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new OpenHandsAdapter();
    });

    test('should have correct framework_id', () => {
      expect(adapter.framework_id).toBe('openhands');
    });

    test('should return unavailable status', async () => {
      const context = new FrameworkContext({
        execution_id: 'exec-123',
        framework_id: 'openhands'
      });
      const result = await adapter.execute(context);
      expect(result.status).toBe('unavailable');
    });
  });

  describe('AiderAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new AiderAdapter();
    });

    test('should have correct metadata', () => {
      const metadata = adapter.getMetadata();
      expect(metadata.framework_id).toBe('aider');
      expect(metadata.enabled).toBe(true);
    });

    test('should have cancel and cleanup methods', async () => {
      expect(adapter.cancel).toBeDefined();
      expect(adapter.cleanup).toBeDefined();
      await adapter.cancel('exec-123');
      await adapter.cleanup();
    });
  });

  describe('Common Adapter Behavior', () => {
    test('all adapters should have required methods', () => {
      const adapters = [
        new NativeAdapter(),
        new LangGraphAdapter(),
        new AutoGenAdapter(),
        new CrewAIAdapter()
      ];

      adapters.forEach(adapter => {
        expect(adapter.initialize).toBeDefined();
        expect(adapter.getMetadata).toBeDefined();
        expect(adapter.getCapabilities).toBeDefined();
        expect(adapter.healthCheck).toBeDefined();
        expect(adapter.supports).toBeDefined();
        expect(adapter.createSession).toBeDefined();
        expect(adapter.execute).toBeDefined();
        expect(adapter.cancel).toBeDefined();
        expect(adapter.cleanup).toBeDefined();
      });
    });

    test('all adapters should have framework_id', () => {
      const adapters = [
        new NativeAdapter(),
        new LangGraphAdapter(),
        new AutoGenAdapter(),
        new CrewAIAdapter(),
        new PydanticAIAdapter(),
        new OpenHandsAdapter(),
        new AiderAdapter()
      ];

      adapters.forEach(adapter => {
        expect(adapter.framework_id).toBeDefined();
        expect(typeof adapter.framework_id).toBe('string');
        expect(adapter.framework_id.length).toBeGreaterThan(0);
      });
    });

    test('all adapters should support timeouts', () => {
      const adapters = [
        new NativeAdapter(),
        new LangGraphAdapter(),
        new AutoGenAdapter()
      ];

      adapters.forEach(adapter => {
        expect(adapter.timeout_ms).toBeDefined();
        expect(adapter.timeout_ms).toBeGreaterThan(0);
      });
    });
  });
});
