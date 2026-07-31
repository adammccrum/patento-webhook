/**
 * IrisKey Platform - Queue Service
 * Background jobs and async task processing with Redis support
 */

/**
 * Queue job types
 */
export enum JobType {
  SEND_EMAIL = 'send-email',
  SEND_SMS = 'send-sms',
  CREDIT_RESET = 'credit-reset',
  AUDIT_MAINTENANCE = 'audit-maintenance',
  ANALYTICS_AGGREGATION = 'analytics-aggregation',
  AI_USAGE_RECONCILIATION = 'ai-usage-reconciliation',
  NOTIFICATION_DELIVERY = 'notification-delivery',
  USER_CLEANUP = 'user-cleanup',
}

/**
 * Job status
 */
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

/**
 * Job configuration
 */
export interface JobConfig {
  type: JobType;
  priority?: number; // 0-10, higher = more important
  maxRetries?: number;
  timeout?: number; // milliseconds
  delayMs?: number; // delay before processing
  tags?: string[];
}

/**
 * Queue job
 */
export interface QueueJob {
  id: string;
  type: JobType;
  status: JobStatus;
  data: Record<string, unknown>;
  priority: number;
  maxRetries: number;
  retries: number;
  timeout: number;
  delayMs: number;
  tags: string[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: {
    message: string;
    stack?: string;
  };
  result?: unknown;
}

/**
 * Job handler function
 */
export type JobHandler = (job: QueueJob) => Promise<unknown>;

/**
 * In-memory queue (for single instance)
 */
class InMemoryQueue {
  private jobs: Map<string, QueueJob> = new Map();
  private handlers: Map<JobType, JobHandler> = new Map();
  private processingJobs: Set<string> = new Set();
  private scheduledJobs: Map<NodeJS.Timeout, string> = new Map();

  /**
   * Register a job handler
   */
  registerHandler(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Enqueue a job
   */
  async enqueue(
    type: JobType,
    data: Record<string, unknown>,
    config: Partial<JobConfig> = {}
  ): Promise<string> {
    const jobId = crypto.randomUUID();
    const job: QueueJob = {
      id: jobId,
      type,
      status: JobStatus.PENDING,
      data,
      priority: config.priority || 5,
      maxRetries: config.maxRetries || 3,
      retries: 0,
      timeout: config.timeout || 30000,
      delayMs: config.delayMs || 0,
      tags: config.tags || [],
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);

    if (job.delayMs > 0) {
      this.scheduleJob(jobId, job.delayMs);
    } else {
      this.process(jobId);
    }

    return jobId;
  }

  /**
   * Schedule job processing
   */
  private scheduleJob(jobId: string, delayMs: number): void {
    const timeout = setTimeout(() => {
      this.process(jobId);
      this.scheduledJobs.delete(timeout);
    }, delayMs);

    this.scheduledJobs.set(timeout, jobId);
  }

  /**
   * Process a job
   */
  private async process(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (this.processingJobs.has(jobId)) return;
    this.processingJobs.add(jobId);

    try {
      job.status = JobStatus.PROCESSING;
      job.startedAt = new Date();

      const handler = this.handlers.get(job.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Job timeout')), job.timeout)
      );

      const result = await Promise.race([handler(job), timeoutPromise]);

      job.status = JobStatus.COMPLETED;
      job.result = result;
      job.completedAt = new Date();
    } catch (error) {
      job.retries++;

      if (job.retries < job.maxRetries) {
        job.status = JobStatus.RETRYING;
        this.scheduleJob(jobId, Math.min(1000 * Math.pow(2, job.retries), 60000));
      } else {
        job.status = JobStatus.FAILED;
        job.error = {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        };
      }
    } finally {
      this.processingJobs.delete(jobId);
    }
  }

  /**
   * Get job status
   */
  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs by status
   */
  getJobsByStatus(status: JobStatus): QueueJob[] {
    return Array.from(this.jobs.values()).filter((job) => job.status === status);
  }

  /**
   * Get all jobs by type
   */
  getJobsByType(type: JobType): QueueJob[] {
    return Array.from(this.jobs.values()).filter((job) => job.type === type);
  }

  /**
   * Cancel a job
   */
  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
      return false;
    }

    this.jobs.delete(jobId);
    return true;
  }

  /**
   * Clear completed jobs
   */
  clearCompleted(): void {
    for (const [jobId, job] of this.jobs) {
      if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
        if (Date.now() - job.completedAt!.getTime() > 24 * 60 * 60 * 1000) {
          this.jobs.delete(jobId);
        }
      }
    }
  }
}

/**
 * Redis queue (for distributed systems)
 */
class RedisQueue {
  constructor(private redis: any) {}

  async enqueue(
    type: JobType,
    data: Record<string, unknown>,
    config: Partial<JobConfig> = {}
  ): Promise<string> {
    const jobId = crypto.randomUUID();
    const job: QueueJob = {
      id: jobId,
      type,
      status: JobStatus.PENDING,
      data,
      priority: config.priority || 5,
      maxRetries: config.maxRetries || 3,
      retries: 0,
      timeout: config.timeout || 30000,
      delayMs: config.delayMs || 0,
      tags: config.tags || [],
      createdAt: new Date(),
    };

    const queueKey = `queue:${type}`;
    const jobKey = `job:${jobId}`;

    await this.redis.hset(jobKey, 'data', JSON.stringify(job));
    await this.redis.zadd(queueKey, job.priority, jobId);

    if (job.delayMs > 0) {
      await this.redis.zadd(`queue:delayed`, Date.now() + job.delayMs, jobId);
    }

    return jobId;
  }

  async getJob(jobId: string): Promise<QueueJob | undefined> {
    const jobKey = `job:${jobId}`;
    const data = await this.redis.hget(jobKey, 'data');
    return data ? JSON.parse(data) : undefined;
  }

  async dequeue(type: JobType, count: number = 1): Promise<string[]> {
    const queueKey = `queue:${type}`;
    const jobIds = await this.redis.zrange(queueKey, 0, count - 1);

    for (const jobId of jobIds) {
      await this.redis.zrem(queueKey, jobId);
    }

    return jobIds;
  }

  async updateJobStatus(jobId: string, status: JobStatus, result?: unknown): Promise<void> {
    const jobKey = `job:${jobId}`;
    const updates: Record<string, unknown> = { status };

    if (result) {
      updates.result = JSON.stringify(result);
    }

    if (status === JobStatus.COMPLETED) {
      updates.completedAt = new Date().toISOString();
    }

    await this.redis.hset(jobKey, updates);
  }

  async cancel(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) return false;

    const queueKey = `queue:${job.type}`;
    await this.redis.zrem(queueKey, jobId);
    await this.redis.del(`job:${jobId}`);

    return true;
  }
}

/**
 * Queue factory
 */
export class Queue {
  private inMemory: InMemoryQueue;
  private redis?: RedisQueue;

  constructor(redisClient?: any) {
    this.inMemory = new InMemoryQueue();
    if (redisClient) {
      this.redis = new RedisQueue(redisClient);
    }
  }

  /**
   * Register job handler
   */
  registerHandler(type: JobType, handler: JobHandler): void {
    this.inMemory.registerHandler(type, handler);
  }

  /**
   * Enqueue a job
   */
  async enqueue(
    type: JobType,
    data: Record<string, unknown>,
    config?: Partial<JobConfig>
  ): Promise<string> {
    if (this.redis) {
      return this.redis.enqueue(type, data, config);
    }
    return this.inMemory.enqueue(type, data, config);
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<QueueJob | undefined> {
    if (this.redis) {
      return this.redis.getJob(jobId);
    }
    return this.inMemory.getJob(jobId);
  }

  /**
   * Cancel a job
   */
  async cancel(jobId: string): Promise<boolean> {
    if (this.redis) {
      return this.redis.cancel(jobId);
    }
    return this.inMemory.cancel(jobId);
  }
}

/**
 * Global queue instance
 */
let globalQueue: Queue | null = null;

/**
 * Initialize global queue
 */
export function initializeQueue(redisClient?: any): Queue {
  if (!globalQueue) {
    globalQueue = new Queue(redisClient);
  }
  return globalQueue;
}

/**
 * Get global queue
 */
export function getQueue(): Queue {
  if (!globalQueue) {
    globalQueue = new Queue();
  }
  return globalQueue;
}

/**
 * Scheduled job definitions
 */
export const ScheduledJobs = {
  creditReset: {
    type: JobType.CREDIT_RESET,
    cron: '0 0 * * *', // Daily at midnight
    description: 'Reset monthly credit limits',
  },
  auditMaintenance: {
    type: JobType.AUDIT_MAINTENANCE,
    cron: '0 2 * * *', // Daily at 2 AM
    description: 'Archive old audit logs',
  },
  analyticsAggregation: {
    type: JobType.ANALYTICS_AGGREGATION,
    cron: '0 */6 * * *', // Every 6 hours
    description: 'Aggregate analytics data',
  },
  userCleanup: {
    type: JobType.USER_CLEANUP,
    cron: '0 3 * * 0', // Weekly on Sunday at 3 AM
    description: 'Clean up inactive users',
  },
};
