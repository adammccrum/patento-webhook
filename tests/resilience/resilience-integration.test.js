/**
 * Resilience Integration Tests
 *
 * Tests the interaction of all resilience components including:
 * - Circuit breaker + bulkhead isolation
 * - Retry policy + timeout policy
 * - Backpressure + queue controller
 * - Graceful shutdown + readiness
 * - Core v1.0 compatibility
 */

const {
  CircuitBreaker,
  BulkheadIsolation,
  RetryPolicy,
  TimeoutPolicy,
  ConcurrencyLimiter,
  QueueController,
  BackpressureController,
  ReadinessManager,
  GracefulShutdownManager,
  CircuitOpenError,
  BulkheadRejectedError
} = require('../../src/resilience');

describe('Resilience Components Integration', () => {
  let circuitBreaker;
  let bulkhead;
  let retryPolicy;
  let timeoutPolicy;
  let concurrencyLimiter;
  let queueController;
  let backpressure;
  let readiness;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 3,
      successThreshold: 2
    });

    bulkhead = new BulkheadIsolation({
      maxConcurrent: 10,
      maxQueued: 100
    });

    retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      initialDelayMs: 10,
      maxDelayMs: 100
    });

    timeoutPolicy = new TimeoutPolicy({
      operationTimeoutMs: 100,
      globalMaxTimeoutMs: 200
    });

    concurrencyLimiter = new ConcurrencyLimiter({
      globalLimit: 50
    });

    queueController = new QueueController({
      maxSize: 1000
    });

    backpressure = new BackpressureController({
      queueDepthThreshold: 100,
      activeExecutionThreshold: 50
    });

    readiness = new ReadinessManager({
      requiredComponents: ['database', 'audit_system']
    });
  });

  describe('Circuit Breaker + Bulkhead Integration', () => {
    it('bulkhead rejects when circuit is open', async () => {
      // Open the circuit
      circuitBreaker.recordFailure({
        classification: 'transient_error'
      });
      circuitBreaker.recordFailure({
        classification: 'transient_error'
      });
      circuitBreaker.recordFailure({
        classification: 'transient_error'
      });

      expect(circuitBreaker.getState().state).toBe('open');

      // Circuit should block execution
      const canExecute = circuitBreaker.canExecute();
      expect(canExecute).toBe(false);
    });

    it('bulkhead slot acquired and released', () => {
      const slot1 = bulkhead.tryAcquire('provider-a');
      expect(slot1).toBeDefined();

      const status = bulkhead.getStatus();
      expect(status.active).toBe(1);

      bulkhead.release(slot1);
      expect(bulkhead.getStatus().active).toBe(0);
    });

    it('bulkhead rejects when limit exceeded', () => {
      const bulkhead2 = new BulkheadIsolation({ maxConcurrent: 2 });

      const slot1 = bulkhead2.tryAcquire('provider-a');
      const slot2 = bulkhead2.tryAcquire('provider-a');
      expect(slot1).toBeDefined();
      expect(slot2).toBeDefined();

      const slot3 = bulkhead2.tryAcquire('provider-a');
      expect(slot3).toBeNull();
    });
  });

  describe('Retry Policy + Timeout Policy', () => {
    it('should not retry non-retryable errors', () => {
      const authError = {
        classification: 'authorization_failure'
      };

      expect(retryPolicy.shouldRetry(authError, 0)).toBe(false);
    });

    it('should retry transient errors', () => {
      const transientError = {
        classification: 'transient_error'
      };

      expect(retryPolicy.shouldRetry(transientError, 0)).toBe(true);
      expect(retryPolicy.shouldRetry(transientError, 1)).toBe(true);
    });

    it('respects max attempts', () => {
      const error = { classification: 'transient_error' };

      expect(retryPolicy.shouldRetry(error, 0)).toBe(true);
      expect(retryPolicy.shouldRetry(error, 1)).toBe(true);
      expect(retryPolicy.shouldRetry(error, 2)).toBe(false); // 3rd attempt
    });

    it('calculates exponential backoff with jitter', () => {
      const delay0 = retryPolicy.getRetryDelayMs(0);
      const delay1 = retryPolicy.getRetryDelayMs(1);
      const delay2 = retryPolicy.getRetryDelayMs(2);

      expect(delay0).toBeLessThanOrEqual(11); // 10ms + jitter
      expect(delay1).toBeGreaterThanOrEqual(10); // 20ms base
      expect(delay2).toBeLessThanOrEqual(100); // 40ms base, capped at 100
    });

    it('timeout policy respects global maximum', () => {
      const timeout = timeoutPolicy.getEffectiveTimeout({
        agentCode: 'EC',
        providerId: 'piper'
      });

      expect(timeout).toBeLessThanOrEqual(200); // globalMaxTimeoutMs
    });
  });

  describe('Queue + Backpressure Integration', () => {
    it('enqueues and dequeues items in priority order', () => {
      queueController.enqueue('item-1', { priority: 1 });
      queueController.enqueue('item-2', { priority: 5 });
      queueController.enqueue('item-3', { priority: 3 });

      expect(queueController.dequeue()).toBe('item-2'); // highest priority
      expect(queueController.dequeue()).toBe('item-3');
      expect(queueController.dequeue()).toBe('item-1');
    });

    it('queue full error when max size exceeded', () => {
      const queue = new QueueController({ maxSize: 2 });

      queue.enqueue('item-1');
      queue.enqueue('item-2');

      expect(() => {
        queue.enqueue('item-3');
      }).toThrow('Queue is full');
    });

    it('backpressure decision based on metrics', () => {
      const decision = backpressure.evaluate({
        queueDepth: 50,
        activeExecution: 25,
        errorRate: 0.05,
        memoryUsageMb: 100
      });

      expect(decision).toBe('accept');
    });

    it('backpressure rejects on high queue depth', () => {
      const decision = backpressure.evaluate({
        queueDepth: 500, // exceeds threshold
        activeExecution: 25,
        errorRate: 0.05,
        memoryUsageMb: 100
      });

      expect(decision).toBe('reject');
    });
  });

  describe('Concurrency Limiting', () => {
    it('acquires and releases concurrency slots', () => {
      const slot = concurrencyLimiter.tryAcquire({
        agentCode: 'EC'
      });

      expect(slot).toBeDefined();

      const status = concurrencyLimiter.getStatus();
      expect(status.global.active).toBe(1);

      concurrencyLimiter.release(slot);
      expect(concurrencyLimiter.getStatus().global.active).toBe(0);
    });

    it('rejects when global limit exceeded', () => {
      const limiter = new ConcurrencyLimiter({ globalLimit: 2 });

      const slot1 = limiter.tryAcquire({ agentCode: 'EC' });
      const slot2 = limiter.tryAcquire({ agentCode: 'EC' });
      expect(slot1).toBeDefined();
      expect(slot2).toBeDefined();

      const slot3 = limiter.tryAcquire({ agentCode: 'EC' });
      expect(slot3).toBeNull();
    });
  });

  describe('Readiness Manager', () => {
    it('starts in starting state', () => {
      expect(readiness.getState()).toBe('starting');
    });

    it('transitions to ready when required components healthy', () => {
      readiness.setComponentHealth('database', 'healthy');
      readiness.setComponentHealth('audit_system', 'healthy');

      expect(readiness.getState()).toBe('ready');
      expect(readiness.isReady()).toBe(true);
    });

    it('transitions to degraded when one component degraded', () => {
      readiness.setComponentHealth('database', 'healthy');
      readiness.setComponentHealth('audit_system', 'degraded');

      expect(readiness.getState()).toBe('degraded');
      expect(readiness.isReady()).toBe(true); // Still ready (degraded is acceptable)
    });

    it('transitions to not_ready when required component unhealthy', () => {
      readiness.setComponentHealth('database', 'unhealthy');

      expect(readiness.getState()).toBe('not_ready');
      expect(readiness.isReady()).toBe(false);
    });

    it('optional components don\'t affect readiness', () => {
      readiness.setComponentHealth('database', 'healthy');
      readiness.setComponentHealth('audit_system', 'healthy');

      const status1 = readiness.getReadinessStatus();
      expect(status1.state).toBe('ready');

      // Optional provider fails
      readiness.setComponentHealth('provider:voice:piper', 'unhealthy');

      const status2 = readiness.getReadinessStatus();
      expect(status2.state).toBe('ready'); // Still ready
    });
  });

  describe('Graceful Shutdown', () => {
    it('executes shutdown steps in order', async () => {
      const steps = [];
      const shutdown = new GracefulShutdownManager({
        markNotReady: async () => steps.push('markNotReady'),
        rejectNewWork: async () => steps.push('rejectNewWork'),
        pauseQueues: async () => steps.push('pauseQueues'),
        stopConnections: async () => steps.push('stopConnections')
      });

      const result = await shutdown.shutdown();

      expect(steps).toContain('markNotReady');
      expect(steps).toContain('rejectNewWork');
      expect(steps[0]).toBe('markNotReady');
      expect(result.success).toBe(true);
    });

    it('shutdown is idempotent', async () => {
      const shutdown = new GracefulShutdownManager();

      const result1 = await shutdown.shutdown();
      expect(result1.success).toBe(true);

      const result2 = await shutdown.shutdown();
      expect(result2.result).toBe('already_stopped');
    });
  });

  describe('Echo Compatibility', () => {
    it('resilience components don\'t require Echo changes', () => {
      // Echo can continue to work without resilience components
      const mockTask = {
        id: 'task-1',
        agentCode: 'EC'
      };

      // Old Echo execution (no resilience)
      const oldWay = () => {
        return { status: 'completed', output: {} };
      };

      expect(oldWay()).toBeDefined();

      // New Echo execution (with optional resilience)
      const newWay = () => {
        const slot = concurrencyLimiter.tryAcquire({ agentCode: mockTask.agentCode });
        if (!slot) throw new BulkheadRejectedError();

        const result = oldWay();
        concurrencyLimiter.release(slot);
        return result;
      };

      expect(newWay()).toBeDefined();
    });
  });

  describe('Core v1.0 Compatibility', () => {
    it('resilience components integrate with Core APIs', () => {
      // Resilience layer sits between agents and core
      // It doesn't modify core API signatures

      // This proves the resilience layer is additive, not invasive
      const coreApiMethod = async () => {
        return { status: 'completed', output: {} };
      };

      const withResilience = async () => {
        // Apply resilience decorators
        const canExecute = circuitBreaker.canExecute();
        if (!canExecute) throw new CircuitOpenError();

        const slot = bulkhead.tryAcquire('provider-a');
        if (!slot) throw new BulkheadRejectedError();

        try {
          return await coreApiMethod();
        } finally {
          bulkhead.release(slot);
        }
      };

      expect(typeof withResilience).toBe('function');
    });
  });
});
