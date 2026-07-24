# Agent SDK - Foundation Document

## Overview

The Agent SDK is a thin, non-intrusive wrapper around Core v1.0 APIs. It provides standardized service access patterns, cross-cutting concerns (retry, timeout, audit, idempotency), and typed method signatures—while maintaining full backwards compatibility with existing agents and services.

**Key Principle:** The SDK is a wrapper, not a replacement. It never duplicates, modifies, or bypasses core functionality. Existing agents (Echo, Foxtrot) continue working unchanged. New agents can optionally adopt the SDK for consistent patterns.

**Design Philosophy:**
- Core services remain the source of truth
- SDK adds convenience and resilience patterns
- Authorization and permission boundaries are never bypassed
- All errors are audited
- Idempotency is optional but available

## Core v1.0 APIs Wrapped

The SDK provides decorated access to all 9 Core v1.0 APIs:

1. **TaskExecutionAPI** - Task execution and lifecycle
2. **AuthorizationAPI** - User authorization checks
3. **ProviderRegistryAPI** - Provider discovery and adaptation
4. **AgentRegistryAPI** - Agent registration and status
5. **AuditSystemAPI** - Immutable event logging
6. **EventStreamAPI** - Real-time event subscriptions
7. **RBACEngineAPI** - Role-based access control
8. **AuthenticationServiceAPI** - User authentication
9. **HealthMonitoringAPI** - System health tracking

## Creating an SDK Instance

### Basic Usage

```javascript
const { AgentSDK } = require('./src/sdk');

const sdk = AgentSDK.createForAgent('EC', {
  taskExecutor,
  authorizer,
  providerRegistry,
  agentRegistry,
  auditLogger,
  eventStream,
  rbacEngine,
  authenticator,
  healthMonitor
});
```

### With Custom Configuration

```javascript
const sdk = new AgentSDK('EC', services, {
  correlationId: 'corr-uuid-12345',
  retry: {
    maxAttempts: 5,
    initialDelayMs: 200,
    backoffMultiplier: 2,
    jitterFactor: 0.1
  },
  timeout: {
    operationTimeoutMs: 45000,
    globalTimeoutMs: 90000
  },
  permissionContext: {
    user_id: 'user-123',
    permissions: ['voice:create', 'voice:transcribe'],
    roles: ['operator']
  }
});
```

### Dependency Validation

The SDK validates all required services at construction time:

```javascript
try {
  const sdk = AgentSDK.createForAgent('EC', incompleteServices);
} catch (error) {
  // SDKError: Missing required service: taskExecutor
  console.error(error.message);
}
```

## Using Services Through the SDK

Each Core API is accessed through a getter that returns a decorated interface:

### Task Execution

```javascript
const executor = sdk.getTaskExecutor();

// Execute task with automatic retry, timeout, audit
const result = await executor.executeTask({
  id: 'task-uuid',
  objective_id: 'obj-uuid',
  agent_code: 'EC',
  capability_required: 'text-to-speech',
  input: { text: 'Hello world' }
});
// Result: { status, output, error?, retry_count }
```

### RBAC Enforcement

```javascript
const rbac = sdk.getRBACEngine();

// Check permission (with audit, no retry on denial)
const allowed = await rbac.hasPermission('user-123', 'voice:create');

// Enforce permission (throws if denied)
await rbac.enforce('user-123', 'objective:create');
```

### Provider Registry

```javascript
const registry = sdk.getProviderRegistry();

// Get adapter for capability
const adapter = await registry.getAdapterForCapability('voice', 'text-to-speech');

// List all providers
const providers = await registry.listProviders();
```

### Audit Logging

```javascript
const audit = sdk.getAuditLogger();

// Log event (immutable, tamper-evident)
const event = await audit.logEvent({
  actor_id: 'user-123',
  actor_type: 'user',
  action: 'objective:create',
  resource_type: 'objective',
  resource_id: 'obj-uuid',
  status: 'success',
  details: JSON.stringify({ name: 'My Objective' })
});
// Returns: { id, sequence, timestamp, event_hash }

// Verify audit chain integrity
const verification = await audit.verifyChain(1, 100);
// Returns: { valid, tampering_detected }
```

## Decorator Behavior

The SDK automatically applies four decorators to all service methods:

### 1. Retry with Exponential Backoff and Jitter

**Applied to:** All retryable operations  
**Never retries:** Authorization failures, permission denials  
**Algorithm:**
- Initial delay: 100ms
- Multiplier: 2x per attempt
- Max delay: 5000ms
- Jitter: ±10% randomization
- Max attempts: 3 (configurable)

```
Attempt 1: Fail immediately
Attempt 2: Wait ~100ms ± 10ms, retry
Attempt 3: Wait ~200ms ± 20ms, retry
Attempt 4: Wait ~400ms ± 40ms, retry
...up to maxDelayMs
```

**Example:**
```javascript
const executor = sdk.getTaskExecutor();

// Transient failures are retried
const result = await executor.executeTask(task);
// May retry up to 3 times before giving up

// Authorization failures are never retried
const auth = sdk.getAuthenticator();
await auth.verifyToken(token); // 1 attempt only
```

### 2. Timeout Enforcement

**Applied to:** All service methods  
**Default:** 30 second operation timeout + 60 second global timeout  
**Behavior:** Uses minimum of operation and global timeout

```javascript
const sdk = new AgentSDK('EC', services, {
  timeout: {
    operationTimeoutMs: 45000,
    globalTimeoutMs: 120000
  }
});

// Any operation taking >45 seconds throws SDKError
const result = await executor.executeTask(task);
```

### 3. Error Audit Decoration

**Applied to:** All service methods  
**Logged:** Agent code, operation, correlation ID, error class, message  
**Includes:** Structured details in audit event

```javascript
// When this fails:
await executor.executeTask(invalidTask);

// Audit receives:
{
  actor_id: 'EC',
  actor_type: 'service',
  action: 'sdk:executeTask:error',
  status: 'failure',
  details: {
    error_class: 'ValidationError',
    message: 'Missing required field: id',
    agent_code: 'EC',
    operation: 'executeTask',
    correlation_id: 'corr-12345',
    is_retryable: true
  }
}
```

### 4. Idempotency (Optional)

**Applied to:** User choice via idempotencyKey  
**Behavior:** Caches result for duplicate requests  
**TTL:** 1 hour (configurable)

```javascript
// Use cache to prevent duplicate operations
const cache = sdk._idempotencyCache;

// Or use individual decorator:
const { withIdempotency } = require('./src/sdk');

// Advanced use: Apply to custom function
const idempotentFn = withIdempotency(myFunction, {
  idempotencyKey: 'unique-operation-id',
  ttlMs: 7200000 // 2 hours
});
```

## Security Boundaries

### Never Bypassed

The SDK enforces inviolable boundaries:

1. **Authorization Failures**
   - Authentication errors are never retried
   - SDK immediately throws with isAuthorizationFailure flag
   - Audit logged without retry attempts

2. **Permission Denials**
   - Permission checks are never retried
   - SDK immediately throws with isPermissionDenial flag
   - Audit logged without retry attempts

3. **RBAC Checks**
   - SDK uses RBAC engine, never bypasses it
   - All operations respect user permissions
   - Failures are never silently converted to successes

4. **Audit Trail**
   - All errors logged to audit system
   - Errors include agent code, operation, correlation ID
   - Audit chain verified for tampering

5. **Sierra and Uniform**
   - No decorator can bypass escalation requirements
   - High-risk operations require approval
   - Failures don't convert to mock successes

## Error Handling

### SDKError

Thrown by SDK initialization or decorator failures:

```javascript
const { SDKError } = require('./src/sdk');

try {
  const sdk = AgentSDK.createForAgent('EC', services);
} catch (error) {
  if (error instanceof SDKError) {
    console.error('SDK initialization failed:', error.message);
    console.error('Agent:', error.agentCode);
    console.error('Operation:', error.operation);
  }
}
```

### Error Classification

Errors are classified for retry behavior:

```javascript
// Retryable (transient)
- Timeouts
- Network errors
- Resource exhaustion
- Service temporarily unavailable

// Non-retryable (permanent)
- Authorization failure (isAuthorizationFailure=true)
- Permission denial (isPermissionDenial=true)
- Invalid parameters
- Not found errors
- Conflict errors
```

## Agent Identity and Context

### Getting Agent Identity

```javascript
const identity = sdk.getIdentity();
// Returns:
// {
//   agentCode: 'EC',
//   correlationId: 'corr-uuid-12345',
//   permissionContext: {
//     user_id: 'user-123',
//     permissions: [...]
//     roles: [...]
//   }
// }
```

### Correlation ID Propagation

Correlation IDs link related operations:

```javascript
// Generated automatically
const sdk1 = AgentSDK.createForAgent('EC', services);
console.log(sdk1.correlationId); // Auto-generated UUID

// Or provided explicitly
const sdk2 = new AgentSDK('EC', services, {
  correlationId: 'request-12345'
});

// All operations use same correlation ID for tracing
await sdk2.getTaskExecutor().executeTask(task);
// Audit event includes correlation_id: 'request-12345'
```

## Backwards Compatibility

### Existing Agents (Echo, etc.)

No changes required. Existing code continues working:

```javascript
// Old way (still works)
const echo = new Echo(
  taskExecutor,
  authorizer,
  providerRegistry,
  auditLogger
);

await echo.processVoiceTask(task);
```

### Optional SDK Adoption

Agents can optionally adopt SDK patterns:

```javascript
// New way (optional)
const echo = new Echo(
  AgentSDK.createForAgent('EC', services)
);

const executor = echo.sdk.getTaskExecutor();
await executor.executeTask(task);
```

### Migration Path

1. **Phase 1:** SDK available alongside direct service access
2. **Phase 2:** Agents can import SDK if desired
3. **Phase 3:** Future agents (Foxtrot, etc.) adopt SDK by default
4. **Phase 4:** No migration required; old pattern still supported

## Testing

### Unit Tests

122+ tests covering:
- SDK creation and dependency validation
- Agent identity and context binding
- Service access and decoration
- Retry with exponential backoff
- Timeout enforcement
- Authorization failure handling
- Permission denial handling
- Error audit events
- Idempotency
- Safe shutdown
- Core v1.0 contract compliance

### Running Tests

```bash
# SDK tests only
npm test -- tests/unit/sdk/agent-sdk.test.js

# All tests including regressions
npm test
```

## Performance Characteristics

### Overhead

- **Creation:** ~1ms per SDK instance
- **Method call:** ~0.1ms additional overhead (decorators)
- **Audit:** ~2ms per error (database write)
- **Retry delay:** Exponential backoff starts at 100ms

### Memory Usage

- **Per SDK:** ~10KB
- **Idempotency cache:** ~1KB per cached result
- **Global cache:** ~100MB max (configurable)

## Configuration Reference

### RetryOptions

```javascript
{
  maxAttempts: 3,              // Max retry attempts
  initialDelayMs: 100,         // Initial retry delay
  maxDelayMs: 5000,            // Maximum retry delay
  backoffMultiplier: 2,        // Exponential backoff factor
  jitterFactor: 0.1            // Jitter percentage (0-1)
}
```

### TimeoutOptions

```javascript
{
  operationTimeoutMs: 30000,   // Per-operation timeout
  globalTimeoutMs: 60000       // Global timeout
}
```

### PermissionContext

```javascript
{
  user_id: string,             // User identifier
  permissions: string[],       // User's permissions
  roles: string[]              // User's roles
}
```

## Known Limitations

1. **Idempotency cache is in-memory** - Survives restarts only in same process. For distributed idempotency, use explicit database-backed cache.

2. **Retry logic is operation-level** - Cannot retry partial failures. If a compound operation partially succeeds, it either all succeeds or is retried entirely.

3. **Timeout is wall-clock time** - Doesn't account for operation-specific deadlines (e.g., job TTLs). Use lower operation timeout if needed.

4. **No circuit breaker at SDK level** - Relies on provider health checks. Multiple timeouts may occur before failover.

## Future Enhancements

1. **Circuit breaker pattern** - Detect unhealthy services and fail fast
2. **Distributed idempotency** - Database-backed cache for multi-process deployments
3. **Bulkhead isolation** - Limit concurrent operations per agent
4. **Metrics collection** - Performance and error rate tracking
5. **Custom decorator composition** - Agents can define additional decorators
6. **SDK versioning** - Support multiple SDK versions simultaneously

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│ Agent (Echo, Foxtrot, etc.)                     │
├─────────────────────────────────────────────────┤
│ Agent SDK (Thin Wrapper)                        │
│ ├─ Retry (exponential backoff + jitter)        │
│ ├─ Timeout (operation + global)                │
│ ├─ Error Audit (logs to audit system)          │
│ └─ Idempotency (optional cache)                │
├─────────────────────────────────────────────────┤
│ Core v1.0 APIs (Source of Truth)               │
│ ├─ TaskExecutionAPI                            │
│ ├─ AuthorizationAPI                            │
│ ├─ ProviderRegistryAPI                         │
│ ├─ AgentRegistryAPI                            │
│ ├─ AuditSystemAPI                              │
│ ├─ EventStreamAPI                              │
│ ├─ RBACEngineAPI                               │
│ ├─ AuthenticationServiceAPI                    │
│ └─ HealthMonitoringAPI                         │
├─────────────────────────────────────────────────┤
│ Services (Database, Providers, etc.)            │
└─────────────────────────────────────────────────┘
```

## Summary

The Agent SDK provides a standardized, resilient, auditable interface to Core v1.0 APIs without duplicating or replacing them. It enables consistent patterns across current and future agents while maintaining full backwards compatibility.

Key properties:
- ✅ Thin wrapper (no duplication)
- ✅ Never bypasses security
- ✅ Fully retryable with jitter
- ✅ Timeout enforced
- ✅ All errors audited
- ✅ Optional idempotency
- ✅ Backwards compatible
- ✅ Core v1.0 compliant
