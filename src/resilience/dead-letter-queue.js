/**
 * Dead-Letter Queue
 *
 * Persists tasks that cannot be automatically recovered.
 * Tracks failure classification, retry eligibility, and authorization context.
 */

const { v4: uuid } = require('uuid');

class DeadLetterQueue {
  constructor(options = {}) {
    this.storage = options.storage || null; // Database adapter
    this.maxRetentionDays = options.maxRetentionDays || 90;
    this.onEvent = options.onEvent || null;
  }

  /**
   * Create dead-letter entry
   * @param {Object} task - Original task
   * @param {Object} context - Context information
   * @returns {Promise<Object>} dead-letter record
   */
  async create(task, context = {}) {
    const deadLetterId = uuid();
    const now = new Date();
    const expiryDate = new Date(now.getTime() + this.maxRetentionDays * 24 * 60 * 60 * 1000);

    const record = {
      dead_letter_id: deadLetterId,
      original_task_id: task.id,
      objective_id: task.objective_id,
      assigned_agent: context.agentCode,
      provider_id: context.providerId,
      failure_classification: context.failureClassification || 'unknown',
      last_error: context.lastError,
      attempt_count: context.attemptCount || 0,
      payload_reference: context.payloadReference,
      authorization_reference: context.authorizationReference,
      correlation_id: context.correlationId,
      created_at: now,
      expires_at: expiryDate,
      review_status: 'pending',
      retry_eligible: context.retryEligible !== false,
      notes: context.notes
    };

    // Persist to storage if available
    if (this.storage) {
      try {
        await this.storage.createDeadLetter(record);
      } catch {
        // Silently fail; dead-letter creation should not fail the original operation
      }
    }

    // Emit event
    if (this.onEvent) {
      this.onEvent({
        type: 'resilience.dead_letter_created',
        deadLetterId,
        classification: record.failure_classification,
        timestamp: now
      });
    }

    return record;
  }

  /**
   * Get dead-letter entry
   * @param {string} deadLetterId - Dead-letter record ID
   * @returns {Promise<Object|null>} record or null if not found
   */
  async get(deadLetterId) {
    if (!this.storage) return null;

    try {
      return await this.storage.getDeadLetter(deadLetterId);
    } catch (error) {
      // Silently fail
      return null;
    }
  }

  /**
   * Query dead-letter entries
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} matching records
   */
  async query(filters = {}) {
    if (!this.storage) return [];

    try {
      return await this.storage.queryDeadLetters(filters);
    } catch (error) {
      // Silently fail
      return [];
    }
  }

  /**
   * Acknowledge dead-letter entry (mark reviewed)
   * @param {string} deadLetterId - Dead-letter record ID
   * @returns {Promise<void>}
   */
  async acknowledge(deadLetterId) {
    if (!this.storage) return;

    try {
      await this.storage.updateDeadLetterStatus(deadLetterId, 'acknowledged');
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Mark dead-letter as resolved
   * @param {string} deadLetterId - Dead-letter record ID
   * @param {string} resolution - How it was resolved
   * @returns {Promise<void>}
   */
  async markResolved(deadLetterId, resolution = 'manual_resolution') {
    if (!this.storage) return;

    try {
      await this.storage.updateDeadLetterStatus(deadLetterId, resolution);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Get dead-letters eligible for retry
   * @returns {Promise<Array>} retryable records
   */
  async getRetryable() {
    if (!this.storage) return [];

    try {
      return await this.storage.queryDeadLetters({
        retry_eligible: true,
        review_status: 'acknowledged'
      });
    } catch (error) {
      // Silently fail
      return [];
    }
  }

  /**
   * Cleanup expired dead-letter entries
   * @returns {Promise<number>} count of deleted entries
   */
  async cleanup() {
    if (!this.storage) return 0;

    try {
      return await this.storage.deleteExpiredDeadLetters(new Date());
    } catch (error) {
      // Silently fail
      return 0;
    }
  }

  /**
   * Get dead-letter statistics
   * @returns {Promise<Object>} stats
   */
  async getStats() {
    if (!this.storage) return {};

    try {
      return await this.storage.getDeadLetterStats();
    } catch (error) {
      // Silently fail
      return {};
    }
  }
}

module.exports = DeadLetterQueue;
