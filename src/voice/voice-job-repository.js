/**
 * Voice Job Repository
 * Handles persistence and queries for voice jobs in the database
 */

const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

class VoiceJobRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create and save a new voice job
   */
  async createJob(jobData) {
    try {
      const job = {
        id: uuid(),
        job_id: jobData.job_id,
        task_id: jobData.task_id,
        objective_id: jobData.objective_id,
        user_id: jobData.user_id,
        audit_reference: jobData.audit_reference,
        operation: jobData.operation,
        status: 'started',
        provider_id: jobData.provider_id || null,
        retry_count: 0,
        max_retries: jobData.max_retries || 3,
        language: jobData.language || null,
        output_format: jobData.output_format || null,
        sample_rate: jobData.sample_rate || null,
        privacy_classification: jobData.privacy_classification || 'internal',
        retention_policy: jobData.retention_policy || {},
        input_text: jobData.input_text || null,
        input_reference: jobData.input_reference || null,
        error: null,
        error_code: null,
        warnings: [],
        created_at: new Date(),
        started_at: null,
        completed_at: null,
        expires_at: this._calculateExpiryDate(jobData.retention_policy)
      };

      await this.db('voice_jobs').insert(job);
      logger.debug(`Voice job created: ${jobData.job_id}`);
      return job;
    } catch (error) {
      logger.error(`Failed to create voice job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get job by job_id
   */
  async getJob(jobId) {
    try {
      return await this.db('voice_jobs')
        .where('job_id', jobId)
        .first();
    } catch (error) {
      logger.error(`Failed to fetch voice job: ${error.message}`);
      return null;
    }
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId, status, updates = {}) {
    try {
      const data = {
        status,
        updated_at: new Date(),
        ...updates
      };

      if (status === 'started' && !updates.started_at) {
        data.started_at = new Date();
      }

      if (['completed', 'failed', 'cancelled'].includes(status) && !updates.completed_at) {
        data.completed_at = new Date();
      }

      await this.db('voice_jobs')
        .where('job_id', jobId)
        .update(data);

      logger.debug(`Voice job status updated: ${jobId} -> ${status}`);
    } catch (error) {
      logger.error(`Failed to update voice job status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update job with provider and output
   */
  async updateJobWithOutput(jobId, providerId, outputReference, metadata = {}) {
    try {
      const data = {
        provider_id: providerId,
        duration_ms: metadata.duration_ms,
        status: 'completed',
        completed_at: new Date(),
        updated_at: new Date()
      };

      await this.db('voice_jobs')
        .where('job_id', jobId)
        .update(data);

      logger.debug(`Voice job output recorded: ${jobId}`);
    } catch (error) {
      logger.error(`Failed to update voice job with output: ${error.message}`);
      throw error;
    }
  }

  /**
   * Record job failure
   */
  async recordJobFailure(jobId, error, errorCode = 'UNKNOWN_ERROR') {
    try {
      await this.db('voice_jobs')
        .where('job_id', jobId)
        .update({
          status: 'failed',
          error: error.message || String(error),
          error_code: errorCode,
          completed_at: new Date(),
          updated_at: new Date()
        });

      logger.debug(`Voice job failure recorded: ${jobId} - ${errorCode}`);
    } catch (error) {
      logger.error(`Failed to record job failure: ${error.message}`);
      throw error;
    }
  }

  /**
   * Increment retry count
   */
  async incrementRetryCount(jobId) {
    try {
      await this.db('voice_jobs')
        .where('job_id', jobId)
        .increment('retry_count', 1);

      logger.debug(`Voice job retry incremented: ${jobId}`);
    } catch (error) {
      logger.error(`Failed to increment retry count: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get active jobs for a user
   */
  async getActiveJobsForUser(userId, limit = 50) {
    try {
      return await this.db('voice_jobs')
        .where('user_id', userId)
        .where('status', 'in', ['started', 'processing'])
        .orderBy('created_at', 'desc')
        .limit(limit);
    } catch (error) {
      logger.error(`Failed to fetch active jobs: ${error.message}`);
      return [];
    }
  }

  /**
   * Get completed jobs for a user
   */
  async getCompletedJobsForUser(userId, limit = 50) {
    try {
      return await this.db('voice_jobs')
        .where('user_id', userId)
        .where('status', 'in', ['completed', 'failed', 'cancelled'])
        .orderBy('completed_at', 'desc')
        .limit(limit);
    } catch (error) {
      logger.error(`Failed to fetch completed jobs: ${error.message}`);
      return [];
    }
  }

  /**
   * Get jobs by operation type
   */
  async getJobsByOperation(operation, status = null, limit = 100) {
    try {
      let query = this.db('voice_jobs').where('operation', operation);

      if (status) {
        query = query.where('status', status);
      }

      return await query
        .orderBy('created_at', 'desc')
        .limit(limit);
    } catch (error) {
      logger.error(`Failed to fetch jobs by operation: ${error.message}`);
      return [];
    }
  }

  /**
   * Get jobs by provider
   */
  async getJobsByProvider(providerId, limit = 100) {
    try {
      return await this.db('voice_jobs')
        .where('provider_id', providerId)
        .orderBy('created_at', 'desc')
        .limit(limit);
    } catch (error) {
      logger.error(`Failed to fetch jobs by provider: ${error.message}`);
      return [];
    }
  }

  /**
   * Get provider statistics
   */
  async getProviderStats(providerId) {
    try {
      const stats = await this.db('voice_jobs')
        .where('provider_id', providerId)
        .select(
          this.db.raw('COUNT(*) as total'),
          this.db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as completed', ['completed']),
          this.db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as failed', ['failed']),
          this.db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as cancelled', ['cancelled']),
          this.db.raw('AVG(CAST(EXTRACT(EPOCH FROM (completed_at - started_at)) AS FLOAT)) as avg_duration_seconds')
        )
        .first();

      return {
        total: stats.total || 0,
        completed: stats.completed || 0,
        failed: stats.failed || 0,
        cancelled: stats.cancelled || 0,
        avg_duration_seconds: stats.avg_duration_seconds || 0
      };
    } catch (error) {
      logger.error(`Failed to fetch provider stats: ${error.message}`);
      return null;
    }
  }

  /**
   * Get operation statistics
   */
  async getOperationStats(operation) {
    try {
      const stats = await this.db('voice_jobs')
        .where('operation', operation)
        .select(
          this.db.raw('COUNT(*) as total'),
          this.db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as completed', ['completed']),
          this.db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as failed', ['failed']),
          this.db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as cancelled', ['cancelled']),
          this.db.raw('AVG(CAST(EXTRACT(EPOCH FROM (completed_at - started_at)) AS FLOAT)) as avg_duration_seconds')
        )
        .first();

      return {
        total: stats.total || 0,
        completed: stats.completed || 0,
        failed: stats.failed || 0,
        cancelled: stats.cancelled || 0,
        avg_duration_seconds: stats.avg_duration_seconds || 0
      };
    } catch (error) {
      logger.error(`Failed to fetch operation stats: ${error.message}`);
      return null;
    }
  }

  /**
   * Clean up expired jobs and outputs
   */
  async cleanupExpiredJobs() {
    try {
      const expiredCount = await this.db('voice_jobs')
        .where('expires_at', '<', new Date())
        .delete();

      if (expiredCount > 0) {
        logger.info(`Cleaned up ${expiredCount} expired voice jobs`);
      }

      return expiredCount;
    } catch (error) {
      logger.error(`Voice job cleanup failed: ${error.message}`);
      throw error;
    }
  }

  // Private methods

  _calculateExpiryDate(retentionPolicy) {
    if (!retentionPolicy || !retentionPolicy.duration_days) {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default
    }

    const days = Math.min(Math.max(retentionPolicy.duration_days, 1), 365);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}

module.exports = VoiceJobRepository;
