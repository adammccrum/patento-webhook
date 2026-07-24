/**
 * Resilience Module - Main Entry Point
 *
 * Comprehensive failure isolation, retry control, timeouts, backpressure,
 * duplicate prevention and graceful degradation components.
 */

// Error classes
const {
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
} = require('./errors');

// Components
const CircuitBreaker = require('./circuit-breaker');
const BulkheadIsolation = require('./bulkhead');
const RetryPolicy = require('./retry-policy');
const TimeoutPolicy = require('./timeout-policy');
const ConcurrencyLimiter = require('./concurrency-limiter');
const QueueController = require('./queue-controller');
const BackpressureController = require('./backpressure-controller');
const DeadLetterQueue = require('./dead-letter-queue');
const IdempotencyStore = require('./idempotency-store');
const DuplicateDetector = require('./duplicate-detector');
const GracefulShutdownManager = require('./graceful-shutdown');
const ReadinessManager = require('./readiness-manager');

module.exports = {
  // Error classes
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
  CancellationError,

  // Components
  CircuitBreaker,
  BulkheadIsolation,
  RetryPolicy,
  TimeoutPolicy,
  ConcurrencyLimiter,
  QueueController,
  BackpressureController,
  DeadLetterQueue,
  IdempotencyStore,
  DuplicateDetector,
  GracefulShutdownManager,
  ReadinessManager
};
