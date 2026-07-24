# Resilience Architecture

## Overview

The resilience layer provides foundational components for failure isolation, retry control, timeout management, backpressure handling, duplicate prevention, and graceful degradation. These components are designed to work together or independently, giving future agents and providers flexible ways to build fault-tolerant systems.

**Key Principle:** Resilience is additive. Components can be adopted progressively without requiring changes to existing agents or breaking Core v1.0 APIs.

## Architecture Goals

1. **Failure Isolation** - Prevent cascading failures across agents and providers
2. **Resource Protection** - Never allow one workload to exhaust all system resources
3. **Graceful Degradation** - Service continues at reduced capacity rather than failing entirely
4. **Observability** - Every resilience decision is auditable and observable
5. **Compatibility** - Optional adoption, no mandatory changes to existing code
6. **Core v1.0 Compliance** - Never bypass or modify frozen interface boundaries

## Components

### 1. Circuit Breaker

Stops calling failing providers to prevent cascading failures.

**States:**
- `closed` - normal operation, calls pass through
- `open` - provider failing, calls fail fast
- `half_open` - testing if provider recovered, limited probes allowed
- `disabled` - circuit breaker bypassed

**Configuration:**
- `failureThreshold` - failures to trigger open
- `successThreshold` - successes to trigger closed from half_open
- `cooldownMs` - time before attempting recovery
- `halfOpenProbeLimit` - max probes in half_open state

**Error Classification:**
- Counted errors: transient_error, timeout, service_unavailable
- Ignored errors: authorization_failure, permission_denial, policy_denial, validation_error, cancellation

**Usage:**
```javascript
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 2,
  cooldownMs: 60000
});

if (!breaker.canExecute()) {
  throw new CircuitOpenError();
}

try {
  const result = await provider.execute();
  breaker.recordSuccess();
  return result;
} catch (error) {
  breaker.recordFailure(error);
  throw error;
}
```

### 2. Bulkhead Isolation

Isolates resources to prevent one overloaded component from exhausting all resources.

**Isolation Keys:**
- by agent (EC workload doesn't consume resources meant for FX)
- by provider (Piper doesn't consume resources meant for Whisper)
- by capability (TTS doesn't block STT)
- by job type

**Configuration:**
- `maxConcurrent` - concurrent executions limit
- `maxQueued` - queued executions limit
- `rejectionPolicy` - reject, queue, or shed
- `keyLimits` - per-key overrides

**Usage:**
```javascript
const bulkhead = new BulkheadIsolation({
  maxConcurrent: 100,
  keyLimits: { 'provider-piper': 20 }
});

const slot = bulkhead.tryAcquire('provider-piper');
if (!slot) throw new BulkheadRejectedError();

try {
  return await execute();
} finally {
  bulkhead.release(slot);
}
```

### 3. Retry Policy

Shared retry implementation with exponential backoff and jitter.

**Configuration:**
- `maxAttempts` - maximum retry attempts
- `initialDelayMs` - starting delay
- `maxDelayMs` - maximum delay
- `backoffMultiplier` - exponential growth factor
- `jitterFactor` - randomization (0-1)
- `budgetPerMinute` - retry budget limit

**Non-Retryable:**
- authorization_failure, permission_denial, policy_denial, validation_error, cancellation

**Usage:**
```javascript
const policy = new RetryPolicy({
  maxAttempts: 3,
  initialDelayMs: 100,
  backoffMultiplier: 2
});

for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
  try {
    return await operation();
  } catch (error) {
    if (!policy.shouldRetry(error, attempt)) throw error;
    
    const delay = policy.getRetryDelayMs(attempt);
    await sleep(delay);
  }
}
```

### 4. Timeout Policy

Support for multiple timeout levels with per-agent/provider/operation overrides.

**Configuration:**
- `operationTimeoutMs` - per-operation timeout
- `queueTimeoutMs` - queue wait timeout
- `providerTimeoutMs` - provider execution timeout
- `taskTimeoutMs` - task completion timeout
- `shutdownTimeoutMs` - graceful shutdown timeout
- `globalMaxTimeoutMs` - absolute maximum

**Usage:**
```javascript
const policy = new TimeoutPolicy({
  operationTimeoutMs: 30000,
  globalMaxTimeoutMs: 60000
});

const timeout = policy.getEffectiveTimeout({
  agentCode: 'EC',
  providerId: 'piper',
  operation: 'voice:create'
});

// timeout = 30000 (or lower if overridden)
```

### 5. Concurrency Limiting

Control concurrent execution at multiple levels.

**Levels:**
- global execution limit
- per-agent limit
- per-provider limit
- per-user limit
- per-operation limit

**Usage:**
```javascript
const limiter = new ConcurrencyLimiter({
  globalLimit: 500,
  agentLimits: { 'EC': 100 },
  providerLimits: { 'piper': 30 }
});

const slot = limiter.tryAcquire({
  agentCode: 'EC',
  providerId: 'piper',
  userId: 'user-123'
});

if (!slot) return null;

try {
  return await execute();
} finally {
  limiter.release(slot);
}
```

### 6. Queue Controller

Bounded queues with priority, FIFO, and lifecycle states.

**States:**
- `running` - accepting and processing items
- `paused` - not processing new items
- `draining` - stop accepting new items, process existing
- `stopped` - reject everything

**Features:**
- Task priority (higher first)
- Deadline-based expiry
- Cancellation support
- Bounded size (no unbounded queues)

**Usage:**
```javascript
const queue = new QueueController({ maxSize: 10000 });

queue.enqueue(item, { priority: 5 });
const next = queue.dequeue();

queue.pause();  // Stop processing
queue.drain();  // Finish existing, reject new
```

### 7. Backpressure Controller

Responds to system overload with configurable strategies.

**Strategies:**
- `accept` - proceed normally
- `delay` - add small delays to rate limit
- `reject` - refuse new work
- `shed_low_priority` - drop low-priority items
- `pause_provider` - stop accepting from this provider
- `hold_for_review` - escalate to human reviewer

**Inputs:**
- Queue depth
- Active execution count
- Error rate
- Memory pressure
- Provider health
- Database health

**Usage:**
```javascript
const bp = new BackpressureController({
  queueDepthThreshold: 1000,
  strategies: { queue_depth: 'reject' }
});

const decision = bp.evaluate({
  queueDepth: 500,
  activeExecution: 250,
  errorRate: 0.05,
  memoryUsageMb: 200
});

// decision = 'accept' or 'reject' or 'delay' etc.
```

### 8. Dead-Letter Queue

Persist tasks that cannot be automatically recovered.

**Entry Reasons:**
- retry budget exhausted
- provider response permanently invalid
- recovery is unsafe
- repeated timeouts
- dependency unresolvable
- manual quarantine

**Persistence:**
- dead_letter_id
- original task ID
- objective ID
- assigned agent
- provider
- failure classification
- last error
- attempt count
- authorization reference
- correlation ID
- review status
- retry eligibility

**Usage:**
```javascript
const dlq = new DeadLetterQueue();

await dlq.create(task, {
  agentCode: 'EC',
  failureClassification: 'permanent_failure',
  lastError: error.message,
  attemptCount: 5,
  retryEligible: false
});

const retryable = await dlq.getRetryable();
```

### 9. Idempotency Store

Prevent duplicate operations with persistent and in-memory adapters.

**Conflict Detection:**
- same key + same request → return prior result
- same key + different request → conflict error
- expired key → can be reused

**Usage:**
```javascript
const idempotency = new IdempotencyStore();

const priorResult = await idempotency.recordAttempt({
  key: 'operation-id-123',
  fingerprint: 'canonical-hash',
  scope: 'voice-job'
});

if (priorResult) return priorResult.result;

// Execute operation...

await idempotency.recordResult({
  key: 'operation-id-123',
  resultId: uuid(),
  result: { status: 'completed' }
});
```

### 10. Duplicate Detector

Detect duplicates using stable fingerprints from canonical data.

**Entities Detected:**
- objectives
- tasks
- voice jobs
- approval decisions
- events
- cleanup jobs

**Implementation:**
- SHA256 hash of canonical JSON
- Time-based expiry (1 hour default)
- Both in-memory and persistent adapters

**Usage:**
```javascript
const duplicates = new DuplicateDetector();

const isDuplicate = await duplicates.detectObjectiveDuplicate({
  description: 'My objective',
  user_id: 'user-123'
});

if (!isDuplicate) {
  await duplicates.recordEntity('objective', fingerprint, objectiveId);
}
```

### 11. Graceful Shutdown

Ordered shutdown process with 12 steps and timeout enforcement.

**Steps (in order):**
1. Mark service not ready
2. Reject new work
3. Pause queues
4. Stop accepting connections
5. Allow in-flight work to complete
6. Cancel remaining safe-to-cancel work
7. Persist interrupted work state
8. Flush audit events
9. Flush event buffers
10. Close database connections
11. Close providers
12. Report shutdown result

**Features:**
- Configurable timeout
- Progress events
- Failure reporting
- Forced-exit fallback
- Idempotent invocation

**Usage:**
```javascript
const shutdown = new GracefulShutdownManager({
  timeoutMs: 30000,
  markNotReady: async () => { /* ... */ },
  rejectNewWork: async () => { /* ... */ },
  // ... other hooks
});

const result = await shutdown.shutdown();
// result.success, result.completedSteps, result.failedSteps
```

### 12. Readiness Manager

Track service readiness with 7 states.

**States:**
- `starting` - service initializing
- `ready` - ready for traffic
- `degraded` - running but reduced capacity
- `not_ready` - not ready for traffic
- `draining` - stopping accepting new work
- `shutting_down` - shutdown in progress
- `stopped` - service stopped

**Features:**
- Separate liveness (crashed?) from readiness (ready for traffic?)
- Required vs optional components
- Optional component failures don't make platform unavailable

**Usage:**
```javascript
const readiness = new ReadinessManager({
  requiredComponents: ['database', 'audit_system'],
  optionalComponents: ['provider:voice:piper']
});

readiness.setComponentHealth('database', 'healthy');
readiness.setComponentHealth('provider:voice:piper', 'unhealthy');

// Platform still ready (optional component failed)
const status = readiness.getReadinessStatus();
```

### 13. Error Model

14+ structured resilience errors with safe metadata.

**Error Classes:**
- CircuitOpenError
- BulkheadRejectedError
- QueueFullError
- QueueTimeoutError
- OperationTimeoutError
- RetryExhaustedError
- BackpressureRejectedError
- DuplicateOperationError
- IdempotencyConflictError
- DeadLetteredError
- ServiceDrainingError
- ServiceNotReadyError
- CancellationError

**Properties:**
- code, message, classification
- retryable (boolean)
- agentCode, providerId, operation
- correlationId, timestamp
- safe metadata (no secrets/traces)

## Integration with Core v1.0

The resilience layer sits between agents and Core v1.0 APIs:

```
Agent (Echo, Foxtrot, etc.)
    ↓
Resilience Layer (Circuit breaker, bulkhead, retry, timeout, etc.)
    ↓
Agent SDK (typed decorators)
    ↓
Core v1.0 APIs (frozen interface)
    ↓
Services (Database, providers, etc.)
```

**Key Properties:**
- Resilience components don't modify Core APIs
- Decorators are composable and orthogonal
- No breaking changes to existing agents
- Optional adoption path for new agents

## Execution Order (Recommended)

1. Validate request context
2. Check readiness
3. Check idempotency
4. Check circuit breaker
5. Acquire bulkhead/concurrency slot
6. Apply timeout
7. Execute with retry where permitted
8. Record result
9. Release resources
10. Emit audit and events

## Configuration

Resilience components are configured via `config/resilience.yaml`:

```yaml
circuit_breakers:
  default:
    failure_threshold: 5
    success_threshold: 2
    cooldown_ms: 60000

bulkheads:
  default:
    max_concurrent: 100
    max_queued: 1000

retry_policy:
  max_attempts: 3
  initial_delay_ms: 100
  backoff_multiplier: 2
  jitter_factor: 0.1
  budget_per_minute: 1000

# ... other components
```

## Testing

All resilience components include comprehensive unit tests:
- Unit tests for each component
- Integration tests for component interaction
- Echo compatibility tests
- Core v1.0 compliance tests

Run tests:
```bash
npm test -- tests/resilience/
```

## Future Enhancements

1. **Distributed Circuit Breaker** - Share state across processes
2. **Metrics Collection** - Performance and error rate tracking
3. **Bulkhead Dashboard** - Real-time resource visualization
4. **Policy Validator** - Prevent configuration conflicts
5. **Advanced Backpressure** - Machine-learning-driven decisions
6. **Provider Health Scoring** - Adaptive provider selection
7. **Canary Deployments** - Gradual rollout support

## References

- Circuit Breaker Pattern: https://martinfowler.com/bliki/CircuitBreaker.html
- Bulkhead Pattern: https://en.wikipedia.org/wiki/Bulkhead_(computing)
- Exponential Backoff: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
- Graceful Shutdown: https://12factor.net/
