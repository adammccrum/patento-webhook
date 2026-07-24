# Framework Adapter Developer Guide

## Introduction

This guide explains how to create a framework adapter for integrating external agent frameworks with LAO AI OS.

## Adapter Responsibilities

A framework adapter is responsible for:

1. **Execution Translation**: Convert LAO FrameworkContext to framework-specific context
2. **Capability Declaration**: Report which capabilities the framework supports
3. **Health Monitoring**: Provide health status for the framework
4. **Timeout Enforcement**: Enforce execution timeouts
5. **Resource Tracking**: Capture metrics (tokens, cost, duration)
6. **Error Handling**: Convert framework errors to standard FrameworkResult errors
7. **Result Transformation**: Convert framework output to FrameworkResult format

## What Adapters Do NOT Do

Adapters MUST NOT:

1. **Implement Authorization**: Sierra/Uniform/Guardian done by upper layers
2. **Bypass Security Layers**: Cannot skip authentication or policy checks
3. **Make Capability Decisions**: Policy engine decides which framework to use
4. **Store State**: Frameworks may store state, adapter must not
5. **Manage Sessions**: Session management is framework's responsibility
6. **Define Policies**: Policy rules defined in FrameworkPolicy, not adapter
7. **Access Secrets**: Secrets should not be in adapter code
8. **Make Audit Decisions**: Audit logging done by manager

## Creating an Adapter

### Step 1: Extend FrameworkAdapter

```javascript
const FrameworkAdapter = require('../../framework-adapter');

class MyFrameworkAdapter extends FrameworkAdapter {
  constructor(options = {}) {
    super({
      framework_id: 'my-framework',
      display_name: 'My Framework',
      adapter_type: 'implementation', // or 'stub', 'placeholder'
      version: '1.0.0',
      timeout_ms: 60000, // default 60 seconds
      framework_features: {
        status: 'beta',
        installed: true,
        verified: false
      },
      ...options
    });
  }
}
```

### Step 2: Implement getCapabilities

Declare which capabilities the framework supports:

```javascript
getCapabilities() {
  return {
    multi_agent: true,      // Framework can orchestrate multiple agents
    tool_calling: true,     // Framework can invoke tools
    rag: true,              // Framework supports retrieval-augmented generation
    streaming: true,        // Framework supports streaming responses
    human_approval: false,  // Framework requires human approval
    browser: false,         // Framework has browser automation
    vision: false,          // Framework supports vision/images
    voice: false,           // Framework supports voice
    mcp: false,             // Framework supports MCP protocol
    memory: true,           // Framework maintains memory/context
    workflow: true,         // Framework defines workflows
    database: false         // Framework can access databases
  };
}
```

### Step 3: Implement supports()

This method tells if the framework supports a specific capability:

```javascript
supports(capability) {
  const caps = this.getCapabilities();
  return caps[capability] === true;
}
```

### Step 4: Implement healthCheck()

Provide health status of the framework:

```javascript
async healthCheck() {
  try {
    // Attempt a lightweight test
    const result = await this._callFramework({
      test: true,
      timeout: 5000
    });

    return {
      status: 'healthy',
      timestamp: Date.now(),
      message: 'Framework responding normally'
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      timestamp: Date.now(),
      message: `Health check failed: ${err.message}`,
      error: err.message
    };
  }
}
```

### Step 5: Implement execute()

Main execution method that runs framework with context:

```javascript
async execute(context) {
  // 1. Validate input
  const validation = this.checkResourceConstraints(context);
  if (!validation.valid) {
    return this.handleError(
      new Error(`Resource constraint violation: ${validation.errors.join(', ')}`),
      context.execution_id
    );
  }

  // 2. Create session
  const session = await this.createSession(context);

  // 3. Create safe context (remove sensitive data)
  const safeContext = this.createSafeContext(context);

  try {
    // 4. Execute with timeout enforcement
    const frameworkResult = await this.executeWithTimeout(
      this._callFramework(safeContext),
      context.timeout_ms || this.timeout_ms,
      context.execution_id
    );

    // 5. Validate result
    const resultValidation = this.validateResult(frameworkResult);
    if (!resultValidation.valid) {
      return this.handleError(
        new Error(`Invalid framework result: ${resultValidation.errors.join(', ')}`),
        context.execution_id
      );
    }

    // 6. Transform to FrameworkResult
    const result = this.transformResult(frameworkResult, context.execution_id);

    // 7. Record metrics
    this.recordMetrics(result, {
      tokens_used: frameworkResult.tokens_used,
      cost: frameworkResult.cost,
      duration_ms: frameworkResult.duration_ms
    });

    return result;
  } catch (err) {
    return this.handleError(err, context.execution_id);
  } finally {
    // 8. Cleanup session
    await this.cleanupSession(session.session_id);
  }
}
```

### Step 6: Implement initialize()

Framework-specific setup:

```javascript
async initialize() {
  // Load configuration
  // Connect to external service
  // Warm up caches
  // Verify dependencies

  this._emitEvent('adapter_initialized', {
    framework_id: this.framework_id,
    status: 'ready'
  });
}
```

### Step 7: Implement Other Lifecycle Methods

```javascript
// Called when execution needs to be cancelled
async cancel(execution_id) {
  // Send cancellation to framework
  // Clean up in-flight operations
  this._emitEvent('execution_cancelled', { execution_id });
}

// Called on adapter shutdown
async cleanup() {
  // Close connections
  // Release resources
  // Save state if needed
}

// Optional: Called when adapter shuts down
async shutdown() {
  await this.cleanup();
}
```

## Example: Complete Minimal Adapter

```javascript
const FrameworkAdapter = require('../../framework-adapter');
const FrameworkResult = require('../../framework-result');

class SimpleAdapter extends FrameworkAdapter {
  constructor(options = {}) {
    super({
      framework_id: 'simple',
      display_name: 'Simple Framework',
      version: '1.0.0',
      ...options
    });
  }

  async initialize() {
    this._emitEvent('initialized', { framework_id: this.framework_id });
  }

  getCapabilities() {
    return {
      multi_agent: false,
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
    };
  }

  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: Date.now(),
      message: 'Simple framework OK'
    };
  }

  supports(capability) {
    return this.getCapabilities()[capability] === true;
  }

  async execute(context) {
    const result = new FrameworkResult({
      execution_id: context.execution_id,
      framework_id: this.framework_id,
      status: 'completed'
    });

    try {
      // Simple execution
      const output = await this._executeSimple(context);
      result.complete(output);
      return result;
    } catch (err) {
      result.fail(err);
      return result;
    }
  }

  async _executeSimple(context) {
    return {
      success: true,
      message: 'Simple execution complete',
      context_id: context.execution_id
    };
  }

  async cancel(execution_id) {
    this._emitEvent('cancelled', { execution_id });
  }

  async cleanup() {
    // Nothing to clean up
  }
}

module.exports = SimpleAdapter;
```

## Testing Your Adapter

### Basic Adapter Test

```javascript
const { describe, test, expect } = require('@jest/globals');
const YourAdapter = require('./your-adapter');
const FrameworkContext = require('../../framework-context');

describe('YourAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new YourAdapter();
  });

  test('should initialize', async () => {
    await adapter.initialize();
    expect(adapter.enabled).toBe(true);
  });

  test('should report capabilities', () => {
    const caps = adapter.getCapabilities();
    expect(caps).toBeDefined();
    expect(Object.keys(caps).length).toBeGreaterThan(0);
  });

  test('should return health status', async () => {
    const health = await adapter.healthCheck();
    expect(health.status).toBeDefined();
    expect(health.timestamp).toBeDefined();
  });

  test('should execute with context', async () => {
    const context = new FrameworkContext({
      execution_id: 'test-exec',
      framework_id: 'test',
      sierra_reference: 'sierra-123',
      uniform_reference: 'uniform-123'
    });

    const result = await adapter.execute(context);
    expect(result.execution_id).toBe('test-exec');
    expect(result.status).toBeDefined();
  });

  test('should support declared capabilities', () => {
    const caps = adapter.getCapabilities();
    Object.entries(caps).forEach(([cap, supported]) => {
      if (supported) {
        expect(adapter.supports(cap)).toBe(true);
      }
    });
  });
});
```

## Best Practices

### 1. Validate Input Early

```javascript
async execute(context) {
  // Check context validity first
  const validation = context.validate();
  if (!validation.valid) {
    const result = new FrameworkResult({ execution_id: context.execution_id });
    result.fail(`Invalid context: ${validation.errors.join(', ')}`);
    return result;
  }
  // ... continue
}
```

### 2. Create Safe Context

Do NOT pass raw context to framework. Filter out sensitive data:

```javascript
createSafeContext(context) {
  return {
    execution_id: context.execution_id,
    correlation_id: context.correlation_id,
    session_id: context.session_id,
    objective_description: context.objective_description,
    timeout_ms: context.timeout_ms,
    // ... other safe fields
    // DON'T include: sierra_reference, uniform_reference, passwords, etc.
  };
}
```

### 3. Record All Metrics

Track execution metrics for billing and optimization:

```javascript
this.recordMetrics(result, {
  tokens_used: frameworkResult.tokens,
  tokens_limit: frameworkResult.max_tokens,
  cost: frameworkResult.cost,
  memory_used_mb: frameworkResult.memory_mb,
  cpu_time_ms: frameworkResult.cpu_time
});
```

### 4. Handle Timeouts Explicitly

```javascript
const result = await this.executeWithTimeout(
  this._callFramework(context),
  context.timeout_ms || 60000,
  context.execution_id
);
```

### 5. Emit Events for Observability

```javascript
this._emitEvent('execution_started', {
  execution_id: context.execution_id,
  capability: context.capability
});

// ... execute ...

this._emitEvent('execution_completed', {
  execution_id: context.execution_id,
  status: result.status,
  duration_ms: result.duration_ms
});
```

### 6. Never Bypass Security

If framework requires capability user lacks:

```javascript
// ✗ WRONG - silently proceed
async execute(context) {
  if (!context.sierra_reference) {
    // Don't silently continue!
  }
}

// ✓ CORRECT - fail clearly
async execute(context) {
  if (this.sierra_required && !context.sierra_reference) {
    const result = new FrameworkResult({ execution_id });
    result.fail(new SierraRequiredError(this.framework_id));
    return result;
  }
}
```

### 7. Clean Up Resources

Always clean up in try-finally:

```javascript
try {
  const result = await this._execute(context);
  return result;
} catch (err) {
  return this.handleError(err, execution_id);
} finally {
  // Always cleanup
  await this.cleanupSession(session.session_id);
  // Release connections, memory, etc.
}
```

## Registering Your Adapter

In `config/frameworks.yaml`:

```yaml
frameworks:
  - framework_id: your-framework
    display_name: Your Framework
    category: multi-agent-framework
    official_repository: https://github.com/yourorg/your-framework
    official_website: https://your-framework.dev
    maintainer: Your Organization
    licence: MIT
    language: Python
    runtime: Python 3.9+
    latest_verified_version: 1.0.0
    verification_date: 2026-07-24
    maintenance_status: active
    community_size: medium
    adapter_status: complete
    implementation_status: integrated
    sierra_required: true
    uniform_required: true
    network_required: true
    filesystem_required: false
    sandbox_support: false
    streaming_support: true
    human_approval_support: false
    multi_agent_support: true
    mcp_support: false
    enabled: true
    notes: Production framework adapter
```

## Common Patterns

### Streaming Responses

```javascript
if (context.streaming_enabled) {
  result.streamed_chunks = 0;
  
  for await (const chunk of framework.streamExecute(safeContext)) {
    result.streamed_chunks++;
    // Emit chunk to client
  }
}
```

### Tool Calling

```javascript
for (const toolCall of frameworkResult.tool_calls) {
  result.recordToolCall({
    tool_name: toolCall.name,
    input: toolCall.arguments,
    output: executedToolResult
  });
}
```

### Provider Integration

```javascript
for (const providerCall of frameworkResult.provider_calls) {
  result.recordProviderCall({
    provider: providerCall.provider,
    model: providerCall.model,
    tokens_used: providerCall.tokens,
    cost: providerCall.cost
  });
}
```

## Troubleshooting

**Framework not executing**: Check if adapter supports capability

**Timeout errors**: Increase timeout_ms or optimize framework call

**Memory errors**: Check memory_limit_mb and cleanup session

**Missing metrics**: Ensure recordMetrics is called after execution

**Failed health checks**: Verify framework service is running

## Next Steps

1. Create adapter class extending FrameworkAdapter
2. Implement all required methods
3. Write comprehensive tests
4. Register in config/frameworks.yaml
5. Test with FrameworkManager
6. Submit for Guardian verification
