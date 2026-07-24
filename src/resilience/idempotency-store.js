/**
 * Idempotency Store
 *
 * Persistent and in-memory adapters for preventing duplicate operations.
 * Supports conflict detection and expired-key reuse policies.
 */

const { v4: uuid } = require('uuid');
const { IdempotencyConflictError } = require('./errors');

class IdempotencyStore {
  constructor(options = {}) {
    this.storage = options.storage || null; // Database adapter
    this.ttlMs = options.ttlMs || 3600000; // 1 hour
    this.onEvent = options.onEvent || null;

    // In-memory fallback
    this.cache = new Map();
  }

  /**
   * Record operation attempt
   * @param {Object} idempotencyRequest - Request details
   * @returns {Promise<Object|null>} prior result if duplicate, null if new
   */
  async recordAttempt(idempotencyRequest = {}) {
    const key = idempotencyRequest.key;
    const requestId = idempotencyRequest.requestId || uuid();
    const requestFingerprint = idempotencyRequest.fingerprint;
    const scope = idempotencyRequest.scope || 'default';

    if (!key) {
      return null; // No idempotency tracking
    }

    // Check storage first
    if (this.storage) {
      try {
        const existing = await this.storage.getIdempotencyRecord(key, scope);

        if (existing) {
          // Check if not expired
          if (existing.expires_at && new Date(existing.expires_at) > new Date()) {
            // Check request fingerprint for conflicts
            if (requestFingerprint && existing.request_fingerprint !== requestFingerprint) {
              throw new IdempotencyConflictError({
                idempotencyKey: key,
                priorRequestId: existing.request_id,
                currentRequestId: requestId
              });
            }

            // Return prior result
            if (existing.status === 'completed') {
              return {
                type: 'prior_result',
                resultId: existing.result_id,
                result: existing.result
              };
            } else if (existing.status === 'in_progress') {
              return {
                type: 'in_progress',
                requestId: existing.request_id
              };
            }
          }
        }

        // Record new attempt
        await this.storage.createIdempotencyRecord({
          key,
          scope,
          request_id: requestId,
          request_fingerprint: requestFingerprint,
          status: 'in_progress',
          created_at: new Date(),
          expires_at: new Date(Date.now() + this.ttlMs)
        });

        return null;
      } catch (error) {
        // Fall through to in-memory cache if storage fails
        if (error instanceof IdempotencyConflictError) {
          throw error;
        }
      }
    }

    // In-memory fallback
    const cacheKey = `${scope}:${key}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      // Check for conflict
      if (requestFingerprint && cached.fingerprint !== requestFingerprint) {
        throw new IdempotencyConflictError({
          idempotencyKey: key,
          priorRequestId: cached.requestId,
          currentRequestId: requestId
        });
      }

      if (cached.status === 'completed') {
        return {
          type: 'prior_result',
          resultId: cached.resultId,
          result: cached.result
        };
      } else if (cached.status === 'in_progress') {
        return {
          type: 'in_progress',
          requestId: cached.requestId
        };
      }
    }

    // Record new attempt in memory
    this.cache.set(cacheKey, {
      requestId,
      fingerprint: requestFingerprint,
      status: 'in_progress',
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs
    });

    return null;
  }

  /**
   * Record operation result
   * @param {Object} options - Result options
   * @returns {Promise<void>}
   */
  async recordResult(options = {}) {
    const key = options.key;
    const scope = options.scope || 'default';
    const resultId = options.resultId || uuid();
    const result = options.result;

    if (!key) return;

    // Update storage if available
    if (this.storage) {
      try {
        await this.storage.updateIdempotencyRecord(key, scope, {
          status: 'completed',
          result_id: resultId,
          result,
          completed_at: new Date()
        });
      } catch {
        // Silently fail
      }
    }

    // Update in-memory cache
    const cacheKey = `${scope}:${key}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      cached.status = 'completed';
      cached.resultId = resultId;
      cached.result = result;
    }
  }

  /**
   * Clear expired entries
   * @returns {Promise<number>} count of cleared entries
   */
  async cleanup() {
    let count = 0;

    // Clean storage
    if (this.storage) {
      try {
        count = await this.storage.deleteExpiredIdempotencyRecords(new Date());
      } catch {
        // Silently fail
      }
    }

    // Clean in-memory cache
    const now = Date.now();
    for (const [key, value] of this.cache) {
      if (value.expiresAt < now) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Get idempotency record
   * @param {string} key - Idempotency key
   * @param {string} scope - Scope
   * @returns {Promise<Object|null>} record or null
   */
  async getRecord(key, scope = 'default') {
    if (this.storage) {
      try {
        return await this.storage.getIdempotencyRecord(key, scope);
      } catch {
        // Silently fail
      }
    }

    const cacheKey = `${scope}:${key}`;
    return this.cache.get(cacheKey) || null;
  }
}

module.exports = IdempotencyStore;
