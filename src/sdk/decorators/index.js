/**
 * Agent SDK Decorators
 *
 * Provides cross-cutting concerns: retry logic with jitter, timeout enforcement,
 * error auditing, and idempotency. Respects authorization and permission boundaries.
 */

class SDKError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'SDKError';
    this.agentCode = options.agentCode;
    this.operation = options.operation;
    this.correlationId = options.correlationId;
    this.idempotencyKey = options.idempotencyKey;
    this.isRetryable = options.isRetryable !== false;
    this.isAuthorizationFailure = options.isAuthorizationFailure || false;
    this.isPermissionDenial = options.isPermissionDenial || false;
  }
}

/**
 * Retry decorator with exponential backoff and jitter
 * Non-retryable: authorization failures, permission denials
 * Retryable: transient errors, timeouts, resource exhaustion
 */
function withRetry(fn, options = {}) {
  return async function retryWrapper(...args) {
    const {
      maxAttempts = 3,
      initialDelayMs = 100,
      maxDelayMs = 5000,
      backoffMultiplier = 2,
      jitterFactor = 0.1,
      isRetryable = (err) => !(err.isAuthorizationFailure || err.isPermissionDenial)
    } = options;

    let lastError;
    let attempt = 0;

    for (attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        lastError = error;

        // Never retry authorization or permission failures
        if (!isRetryable(error)) {
          throw error;
        }

        // Last attempt failed
        if (attempt === maxAttempts - 1) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
        const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

        // Add jitter
        const jitter = cappedDelay * jitterFactor * Math.random();
        const delayMs = cappedDelay + jitter;

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError;
  };
}

/**
 * Timeout decorator with configurable limits
 * Enforces operation-level and global timeouts
 */
function withTimeout(fn, options = {}) {
  return async function timeoutWrapper(...args) {
    const {
      operationTimeoutMs = 30000,
      globalTimeoutMs = 60000
    } = options;

    const timeoutMs = Math.min(operationTimeoutMs, globalTimeoutMs);

    return new Promise((resolve, reject) => {
      let completed = false;

      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          reject(new SDKError(`Operation timeout after ${timeoutMs}ms`, {
            isRetryable: true,
            agentCode: options.agentCode,
            operation: options.operation
          }));
        }
      }, timeoutMs);

      fn.apply(this, args)
        .then((result) => {
          if (!completed) {
            completed = true;
            clearTimeout(timer);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!completed) {
            completed = true;
            clearTimeout(timer);
            reject(error);
          }
        });
    });
  };
}

/**
 * Error audit decorator
 * Logs all errors to audit system with structured context
 */
function withErrorAudit(fn, options = {}) {
  return async function errorAuditWrapper(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      // Log error to audit system if available
      if (options.auditLogger) {
        try {
          await options.auditLogger.logEvent({
            actor_id: options.agentCode,
            actor_type: 'service',
            action: `sdk:${options.operation}:error`,
            resource_type: 'operation',
            resource_id: options.correlationId,
            status: 'failure',
            details: JSON.stringify({
              error_class: error.constructor.name,
              message: error.message,
              agent_code: options.agentCode,
              operation: options.operation,
              correlation_id: options.correlationId,
              idempotency_key: options.idempotencyKey,
              is_authorization_failure: error.isAuthorizationFailure || false,
              is_permission_denial: error.isPermissionDenial || false,
              is_retryable: error.isRetryable !== false
            })
          });
        } catch {
          // Audit failures don't block original error
        }
      }

      throw error;
    }
  };
}

/**
 * Idempotency decorator
 * Prevents duplicate execution of idempotent operations
 * Uses in-memory cache with TTL
 */
class IdempotencyCache {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  set(key, result, ttlMs = 3600000) {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + ttlMs
    });
  }

  clear() {
    this.cache.clear();
  }
}

const globalIdempotencyCache = new IdempotencyCache();

function withIdempotency(fn, options = {}) {
  return async function idempotencyWrapper(...args) {
    const { idempotencyKey, cache = globalIdempotencyCache, ttlMs = 3600000 } = options;

    // If no key, just execute normally
    if (!idempotencyKey) {
      return fn.apply(this, args);
    }

    // Check cache for previous result
    const cached = cache.get(idempotencyKey);
    if (cached !== null) {
      return cached;
    }

    // Execute and cache result (errors are not cached)
    const result = await fn.apply(this, args);
    cache.set(idempotencyKey, result, ttlMs);
    return result;
  };
}

/**
 * Compose multiple decorators into a single wrapper
 */
function composeDecorators(fn, decorators = []) {
  let wrapped = fn;
  // Apply decorators in reverse order (innermost first)
  for (const decorator of decorators.reverse()) {
    wrapped = decorator(wrapped);
  }
  return wrapped;
}

module.exports = {
  SDKError,
  withRetry,
  withTimeout,
  withErrorAudit,
  withIdempotency,
  IdempotencyCache,
  globalIdempotencyCache,
  composeDecorators
};
