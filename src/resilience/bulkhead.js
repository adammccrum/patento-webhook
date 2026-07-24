/**
 * Bulkhead Isolation Pattern
 *
 * Isolates resources to prevent one overloaded component from exhausting
 * all resources and affecting other components.
 */

class BulkheadIsolation {
  constructor(options = {}) {
    this.name = options.name || 'bulkhead';
    this.maxConcurrent = options.maxConcurrent || 100;
    this.maxQueued = options.maxQueued || 1000;
    this.rejectionPolicy = options.rejectionPolicy || 'reject'; // reject, queue, shed
    this.onEvent = options.onEvent || null;

    // Per-key limits
    this.keyLimits = options.keyLimits || {};

    // Tracking
    this.active = new Map(); // key -> count
    this.queued = new Map(); // key -> count
    this.rejected = new Map(); // key -> count
  }

  /**
   * Try to acquire a bulkhead slot
   * @param {string} key - Isolation key (agent, provider, capability, job type)
   * @returns {Object} slot token or null if rejected
   */
  tryAcquire(key) {
    const limit = this.keyLimits[key] || this.maxConcurrent;
    const activeCount = (this.active.get(key) || 0);

    if (activeCount >= limit) {
      // Handle rejection
      if (this.rejectionPolicy === 'queue') {
        const queuedCount = (this.queued.get(key) || 0);
        if (queuedCount >= this.maxQueued) {
          this._recordRejection(key);
          return null;
        }
        this.queued.set(key, queuedCount + 1);
        return { key, type: 'queued', timestamp: Date.now() };
      } else {
        this._recordRejection(key);
        return null;
      }
    }

    this.active.set(key, activeCount + 1);
    return { key, type: 'active', timestamp: Date.now() };
  }

  /**
   * Release a bulkhead slot
   * @param {Object} slot - Slot token from tryAcquire
   */
  release(slot) {
    if (!slot) return;

    const { key, type } = slot;

    if (type === 'active') {
      const count = (this.active.get(key) || 0) - 1;
      if (count <= 0) {
        this.active.delete(key);
      } else {
        this.active.set(key, count);
      }
    } else if (type === 'queued') {
      const count = (this.queued.get(key) || 0) - 1;
      if (count <= 0) {
        this.queued.delete(key);
      } else {
        this.queued.set(key, count);
      }
    }
  }

  /**
   * Get bulkhead status
   * @returns {Object} current status
   */
  getStatus() {
    const status = {
      active: 0,
      queued: 0,
      rejected: 0,
      byKey: {}
    };

    for (const [key, count] of this.active) {
      status.active += count;
      status.byKey[key] = status.byKey[key] || {};
      status.byKey[key].active = count;
    }

    for (const [key, count] of this.queued) {
      status.queued += count;
      status.byKey[key] = status.byKey[key] || {};
      status.byKey[key].queued = count;
    }

    for (const [key, count] of this.rejected) {
      status.rejected += count;
      status.byKey[key] = status.byKey[key] || {};
      status.byKey[key].rejected = count;
    }

    return status;
  }

  /**
   * Private: Record rejection
   * @private
   */
  _recordRejection(key) {
    const count = (this.rejected.get(key) || 0) + 1;
    this.rejected.set(key, count);

    if (this.onEvent) {
      this.onEvent({
        type: 'resilience.bulkhead_rejected',
        name: this.name,
        key,
        timestamp: Date.now()
      });
    }
  }
}

module.exports = BulkheadIsolation;
