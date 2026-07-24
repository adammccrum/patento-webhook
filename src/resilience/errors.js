/**
 * Resilience Error Model
 *
 * Structured error classes for resilience patterns.
 * Every error includes code, message, classification, and safe metadata.
 */

class ResilienceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'RESILIENCE_ERROR';
    this.classification = options.classification || 'unknown';
    this.component = options.component || 'resilience';
    this.retryable = options.retryable !== false;
    this.agentCode = options.agentCode;
    this.providerId = options.providerId;
    this.operation = options.operation;
    this.correlationId = options.correlationId;
    this.timestamp = new Date();
    this.metadata = options.metadata || {};
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      classification: this.classification,
      component: this.component,
      retryable: this.retryable,
      agentCode: this.agentCode,
      providerId: this.providerId,
      operation: this.operation,
      correlationId: this.correlationId,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata
    };
  }

  toSafeJSON() {
    return this.toJSON();
  }
}

class CircuitOpenError extends ResilienceError {
  constructor(options = {}) {
    super('Circuit breaker is open', {
      ...options,
      code: 'CIRCUIT_OPEN',
      classification: 'circuit_breaker',
      retryable: true
    });
  }
}

class BulkheadRejectedError extends ResilienceError {
  constructor(options = {}) {
    super('Bulkhead limit reached', {
      ...options,
      code: 'BULKHEAD_REJECTED',
      classification: 'bulkhead',
      retryable: true,
      metadata: {
        ...options.metadata,
        rejectionReason: options.rejectionReason || 'capacity'
      }
    });
  }
}

class QueueFullError extends ResilienceError {
  constructor(options = {}) {
    super('Queue is full', {
      ...options,
      code: 'QUEUE_FULL',
      classification: 'queue',
      retryable: true,
      metadata: {
        ...options.metadata,
        queueSize: options.queueSize,
        maxSize: options.maxSize
      }
    });
  }
}

class QueueTimeoutError extends ResilienceError {
  constructor(options = {}) {
    super('Task timeout waiting in queue', {
      ...options,
      code: 'QUEUE_TIMEOUT',
      classification: 'timeout',
      retryable: true,
      metadata: {
        ...options.metadata,
        waitTimeMs: options.waitTimeMs,
        timeoutMs: options.timeoutMs
      }
    });
  }
}

class OperationTimeoutError extends ResilienceError {
  constructor(options = {}) {
    super('Operation timeout', {
      ...options,
      code: 'OPERATION_TIMEOUT',
      classification: 'timeout',
      retryable: true,
      metadata: {
        ...options.metadata,
        phase: options.phase || 'execution',
        timeoutMs: options.timeoutMs
      }
    });
  }
}

class RetryExhaustedError extends ResilienceError {
  constructor(options = {}) {
    super('Retry budget exhausted', {
      ...options,
      code: 'RETRY_EXHAUSTED',
      classification: 'retry',
      retryable: false,
      metadata: {
        ...options.metadata,
        attempts: options.attempts,
        maxAttempts: options.maxAttempts,
        lastError: options.lastError
      }
    });
  }
}

class BackpressureRejectedError extends ResilienceError {
  constructor(options = {}) {
    super('Rejected due to backpressure', {
      ...options,
      code: 'BACKPRESSURE_REJECTED',
      classification: 'backpressure',
      retryable: true,
      metadata: {
        ...options.metadata,
        reason: options.reason || 'unknown',
        queueDepth: options.queueDepth,
        errorRate: options.errorRate,
        memoryPressure: options.memoryPressure
      }
    });
  }
}

class DuplicateOperationError extends ResilienceError {
  constructor(options = {}) {
    super('Duplicate operation detected', {
      ...options,
      code: 'DUPLICATE_OPERATION',
      classification: 'idempotency',
      retryable: false,
      metadata: {
        ...options.metadata,
        idempotencyKey: options.idempotencyKey,
        priorResultId: options.priorResultId
      }
    });
  }
}

class IdempotencyConflictError extends ResilienceError {
  constructor(options = {}) {
    super('Idempotency conflict: same key, different request', {
      ...options,
      code: 'IDEMPOTENCY_CONFLICT',
      classification: 'idempotency',
      retryable: false,
      metadata: {
        ...options.metadata,
        idempotencyKey: options.idempotencyKey,
        priorRequestId: options.priorRequestId,
        currentRequestId: options.currentRequestId
      }
    });
  }
}

class DeadLetteredError extends ResilienceError {
  constructor(options = {}) {
    super('Task moved to dead-letter queue', {
      ...options,
      code: 'DEAD_LETTERED',
      classification: 'dead_letter',
      retryable: false,
      metadata: {
        ...options.metadata,
        deadLetterId: options.deadLetterId,
        reason: options.reason,
        failureClassification: options.failureClassification
      }
    });
  }
}

class ServiceDrainingError extends ResilienceError {
  constructor(options = {}) {
    super('Service is draining, no new work accepted', {
      ...options,
      code: 'SERVICE_DRAINING',
      classification: 'service_state',
      retryable: true
    });
  }
}

class ServiceNotReadyError extends ResilienceError {
  constructor(options = {}) {
    super('Service is not ready', {
      ...options,
      code: 'SERVICE_NOT_READY',
      classification: 'service_state',
      retryable: true,
      metadata: {
        ...options.metadata,
        readinessStatus: options.readinessStatus,
        failingComponent: options.failingComponent
      }
    });
  }
}

class CancellationError extends ResilienceError {
  constructor(options = {}) {
    super('Operation was cancelled', {
      ...options,
      code: 'CANCELLED',
      classification: 'cancellation',
      retryable: false
    });
  }
}

module.exports = {
  ResilienceError,
  CircuitOpenError,
  BulkheadRejectedError,
  QueueFullError,
  QueueTimeoutError,
  OperationTimeoutError,
  RetryExhaustedError,
  BackpressureRejectedError,
  DuplicateOperationError,
  IdempotencyConflictError,
  DeadLetteredError,
  ServiceDrainingError,
  ServiceNotReadyError,
  CancellationError
};
