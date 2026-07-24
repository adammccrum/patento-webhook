/**
 * Concurrency Limiter
 *
 * Control concurrent execution at multiple levels:
 * global, per-agent, per-provider, per-user, per-operation
 */

class ConcurrencyLimiter {
  constructor(options = {}) {
    this.globalLimit = options.globalLimit || 500;
    this.agentLimits = options.agentLimits || {};
    this.providerLimits = options.providerLimits || {};
    this.userLimits = options.userLimits || {};
    this.operationLimits = options.operationLimits || {};

    // Tracking
    this.global = { active: 0, waiting: 0, rejected: 0 };
    this.byAgent = new Map();
    this.byProvider = new Map();
    this.byUser = new Map();
    this.byOperation = new Map();

    // Queues for priority
    this.queues = new Map();
  }

  /**
   * Try to acquire a concurrency slot
   * @param {Object} context - Execution context
   * @returns {Object|null} slot token or null if rejected
   */
  tryAcquire(context = {}) {
    // Check global limit
    if (this.global.active >= this.globalLimit) {
      this.global.rejected++;
      return null;
    }

    // Check agent limit
    if (context.agentCode) {
      const limit = this.agentLimits[context.agentCode] || this.globalLimit;
      const agentStats = this._getOrCreateStats('byAgent', context.agentCode);
      if (agentStats.active >= limit) {
        agentStats.rejected++;
        return null;
      }
    }

    // Check provider limit
    if (context.providerId) {
      const limit = this.providerLimits[context.providerId] || this.globalLimit;
      const providerStats = this._getOrCreateStats('byProvider', context.providerId);
      if (providerStats.active >= limit) {
        providerStats.rejected++;
        return null;
      }
    }

    // Check user limit
    if (context.userId) {
      const limit = this.userLimits[context.userId] || this.globalLimit;
      const userStats = this._getOrCreateStats('byUser', context.userId);
      if (userStats.active >= limit) {
        userStats.rejected++;
        return null;
      }
    }

    // Check operation limit
    if (context.operation) {
      const limit = this.operationLimits[context.operation] || this.globalLimit;
      const opStats = this._getOrCreateStats('byOperation', context.operation);
      if (opStats.active >= limit) {
        opStats.rejected++;
        return null;
      }
    }

    // Acquire all slots
    this.global.active++;
    if (context.agentCode) {
      this._getOrCreateStats('byAgent', context.agentCode).active++;
    }
    if (context.providerId) {
      this._getOrCreateStats('byProvider', context.providerId).active++;
    }
    if (context.userId) {
      this._getOrCreateStats('byUser', context.userId).active++;
    }
    if (context.operation) {
      this._getOrCreateStats('byOperation', context.operation).active++;
    }

    return {
      context,
      timestamp: Date.now()
    };
  }

  /**
   * Release a concurrency slot
   * @param {Object} slot - Slot token from tryAcquire
   */
  release(slot) {
    if (!slot) return;

    const context = slot.context;

    // Release all slots
    if (this.global.active > 0) this.global.active--;
    if (context.agentCode) {
      const stats = this._getOrCreateStats('byAgent', context.agentCode);
      if (stats.active > 0) stats.active--;
    }
    if (context.providerId) {
      const stats = this._getOrCreateStats('byProvider', context.providerId);
      if (stats.active > 0) stats.active--;
    }
    if (context.userId) {
      const stats = this._getOrCreateStats('byUser', context.userId);
      if (stats.active > 0) stats.active--;
    }
    if (context.operation) {
      const stats = this._getOrCreateStats('byOperation', context.operation);
      if (stats.active > 0) stats.active--;
    }
  }

  /**
   * Get concurrency status
   * @returns {Object} current status
   */
  getStatus() {
    return {
      global: {
        active: this.global.active,
        limit: this.globalLimit,
        available: Math.max(0, this.globalLimit - this.global.active)
      },
      byAgent: this._statsMapToObject(this.byAgent),
      byProvider: this._statsMapToObject(this.byProvider),
      byUser: this._statsMapToObject(this.byUser),
      byOperation: this._statsMapToObject(this.byOperation)
    };
  }

  /**
   * Private: Get or create stats for key
   * @private
   */
  _getOrCreateStats(collection, key) {
    const map = this[collection];
    if (!map.has(key)) {
      map.set(key, { active: 0, waiting: 0, rejected: 0 });
    }
    return map.get(key);
  }

  /**
   * Private: Convert stats map to object
   * @private
   */
  _statsMapToObject(map) {
    const result = {};
    for (const [key, stats] of map) {
      result[key] = stats;
    }
    return result;
  }
}

module.exports = ConcurrencyLimiter;
