/**
 * Duplicate Detection
 *
 * Detects duplicate objectives, tasks, voice jobs, approvals, events, and cleanup jobs
 * using stable fingerprints from canonical request data.
 */

const crypto = require('crypto');

class DuplicateDetector {
  constructor(options = {}) {
    this.storage = options.storage || null;
    this.ttlMs = options.ttlMs || 3600000; // 1 hour
    this.onEvent = options.onEvent || null;

    // In-memory cache
    this.cache = new Map();
  }

  /**
   * Detect duplicate objective
   * @param {Object} objective - Objective details
   * @returns {Promise<boolean>} true if duplicate
   */
  async detectObjectiveDuplicate(objective) {
    const fingerprint = this._createFingerprint('objective', {
      description: objective.description,
      user_id: objective.user_id
    });

    return this._checkDuplicate('objective', fingerprint, objective.id);
  }

  /**
   * Detect duplicate task
   * @param {Object} task - Task details
   * @returns {Promise<boolean>} true if duplicate
   */
  async detectTaskDuplicate(task) {
    const fingerprint = this._createFingerprint('task', {
      objective_id: task.objective_id,
      agent_code: task.agent_code,
      capability_required: task.capability_required,
      input_hash: this._hashObject(task.input)
    });

    return this._checkDuplicate('task', fingerprint, task.id);
  }

  /**
   * Detect duplicate voice job
   * @param {Object} job - Voice job details
   * @returns {Promise<boolean>} true if duplicate
   */
  async detectVoiceJobDuplicate(job) {
    const fingerprint = this._createFingerprint('voice_job', {
      operation: job.requested_operation,
      input_type: job.input_type,
      input_hash: this._hashObject(job.input_reference),
      user_id: job.requesting_identity
    });

    return this._checkDuplicate('voice_job', fingerprint, job.id);
  }

  /**
   * Detect duplicate approval
   * @param {Object} approval - Approval request
   * @returns {Promise<boolean>} true if duplicate
   */
  async detectApprovalDuplicate(approval) {
    const fingerprint = this._createFingerprint('approval', {
      identity: approval.identity,
      action: approval.action,
      risk_level: approval.risk_level
    });

    return this._checkDuplicate('approval', fingerprint, approval.id);
  }

  /**
   * Detect duplicate event
   * @param {Object} event - Event details
   * @returns {Promise<boolean>} true if duplicate
   */
  async detectEventDuplicate(event) {
    const fingerprint = this._createFingerprint('event', {
      type: event.type,
      correlation_id: event.correlation_id,
      sequence: event.sequence
    });

    return this._checkDuplicate('event', fingerprint, event.id);
  }

  /**
   * Detect duplicate cleanup job
   * @param {Object} job - Cleanup job details
   * @returns {Promise<boolean>} true if duplicate
   */
  async detectCleanupDuplicate(job) {
    const fingerprint = this._createFingerprint('cleanup', {
      target_type: job.target_type,
      target_id: job.target_id
    });

    return this._checkDuplicate('cleanup', fingerprint, job.id);
  }

  /**
   * Record successful duplicate check
   * @param {string} type - Entity type
   * @param {string} fingerprint - Canonical fingerprint
   * @param {string} entityId - Entity ID
   * @returns {Promise<void>}
   */
  async recordEntity(type, fingerprint, entityId) {
    if (this.storage) {
      try {
        await this.storage.createDuplicateCheckpoint({
          type,
          fingerprint,
          entity_id: entityId,
          created_at: new Date(),
          expires_at: new Date(Date.now() + this.ttlMs)
        });
      } catch (error) {
        // Silently fail
      }
    }

    // In-memory cache
    const key = `${type}:${fingerprint}`;
    this.cache.set(key, {
      entityId,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs
    });
  }

  /**
   * Cleanup expired checkpoints
   * @returns {Promise<number>} count of cleaned entries
   */
  async cleanup() {
    let count = 0;

    if (this.storage) {
      try {
        count = await this.storage.deleteExpiredDuplicateCheckpoints(new Date());
      } catch (error) {
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
   * Private: Create fingerprint from canonical data
   * @private
   */
  _createFingerprint(type, data) {
    // Sort keys for deterministic order
    const sorted = {};
    Object.keys(data)
      .sort()
      .forEach((key) => {
        sorted[key] = data[key];
      });

    const canonical = JSON.stringify(sorted);
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Private: Hash object to string
   * @private
   */
  _hashObject(obj) {
    if (!obj) return '';
    const canonical = JSON.stringify(obj);
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Private: Check for duplicate
   * @private
   */
  async _checkDuplicate(type, fingerprint, _entityId) {
    const key = `${type}:${fingerprint}`;

    // Check storage
    if (this.storage) {
      try {
        const existing = await this.storage.getDuplicateCheckpoint(type, fingerprint);
        if (existing && existing.expires_at > new Date()) {
          return true;
        }
      } catch (error) {
        // Silently fail
      }
    }

    // Check in-memory cache
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return true;
    }

    return false;
  }
}

module.exports = DuplicateDetector;
