/**
 * Queue Controller
 *
 * Manages bounded queues with priority, FIFO, states (running/paused/draining/stopped)
 * Prevents unbounded in-memory queues.
 */

const { QueueFullError } = require('./errors');

class QueueController {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 10000;
    this.maxPriority = options.maxPriority || 5;
    this.state = 'running';

    // Queue: array of { item, priority, enqueuedAt, deadline, cancellationToken }
    this.queue = [];

    // Stats
    this.stats = {
      enqueued: 0,
      dequeued: 0,
      timedOut: 0,
      cancelled: 0
    };

    // Event handlers
    this.onEvent = options.onEvent || null;
  }

  /**
   * Enqueue an item
   * @param {*} item - Item to enqueue
   * @param {Object} [options] - Enqueue options
   * @returns {Object} queue token
   * @throws {QueueFullError} if queue is full
   */
  enqueue(item, options = {}) {
    if (this.state === 'stopped') {
      throw new Error('Queue is stopped');
    }

    if (this.queue.length >= this.maxSize) {
      throw new QueueFullError({
        queueSize: this.queue.length,
        maxSize: this.maxSize
      });
    }

    const priority = Math.max(0, Math.min(options.priority || 3, this.maxPriority));
    const enqueuedAt = Date.now();
    const deadline = options.deadline || (enqueuedAt + 3600000); // 1 hour default

    const entry = {
      item,
      priority,
      enqueuedAt,
      deadline,
      cancellationToken: options.cancellationToken
    };

    // Insert in priority order (higher priority first)
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (entry.priority > this.queue[i].priority) {
        this.queue.splice(i, 0, entry);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.queue.push(entry);
    }

    this.stats.enqueued++;
    return { item, enqueuedAt, priority };
  }

  /**
   * Dequeue next item
   * @returns {*} next item or null if empty
   */
  dequeue() {
    if (this.queue.length === 0) return null;

    // Skip cancelled items
    while (this.queue.length > 0) {
      const entry = this.queue.shift();

      // Check for timeout
      if (Date.now() > entry.deadline) {
        this.stats.timedOut++;
        continue;
      }

      // Check for cancellation
      if (entry.cancellationToken && entry.cancellationToken.cancelled) {
        this.stats.cancelled++;
        continue;
      }

      this.stats.dequeued++;
      return entry.item;
    }

    return null;
  }

  /**
   * Peek next item without removing
   * @returns {*} next item or null if empty
   */
  peek() {
    if (this.queue.length === 0) return null;
    return this.queue[0].item;
  }

  /**
   * Get queue length
   * @returns {number} queue size
   */
  getSize() {
    return this.queue.length;
  }

  /**
   * Pause the queue (stop dequeueing)
   */
  pause() {
    if (this.state === 'running') {
      this.state = 'paused';
      this._emitEvent('queue_paused');
    }
  }

  /**
   * Resume the queue
   */
  resume() {
    if (this.state === 'paused') {
      this.state = 'running';
      this._emitEvent('queue_resumed');
    }
  }

  /**
   * Drain queue (stop accepting new work, process existing)
   */
  drain() {
    if (this.state === 'running') {
      this.state = 'draining';
      this._emitEvent('queue_draining');
    }
  }

  /**
   * Stop queue (reject everything)
   */
  stop() {
    this.state = 'stopped';
    this.queue = [];
    this._emitEvent('queue_stopped');
  }

  /**
   * Get queue status
   * @returns {Object} status
   */
  getStatus() {
    return {
      state: this.state,
      size: this.queue.length,
      maxSize: this.maxSize,
      available: Math.max(0, this.maxSize - this.queue.length),
      stats: { ...this.stats }
    };
  }

  /**
   * Private: Emit event
   * @private
   */
  _emitEvent(type) {
    if (this.onEvent) {
      this.onEvent({
        type: `resilience.${type}`,
        timestamp: Date.now()
      });
    }
  }
}

module.exports = QueueController;
