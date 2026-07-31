/**
 * Queue package tests
 */

import { InMemoryQueue, JobType, JobStatus } from './src/index';

describe('@iriskey/queue', () => {
  describe('InMemoryQueue', () => {
    it('enqueues a job', async () => {
      const queue = new InMemoryQueue();

      const jobId = await queue.enqueue({
        type: JobType.SEND_EMAIL,
        priority: 5,
        maxRetries: 3,
      });

      expect(jobId).toBeDefined();
    });

    it('retrieves enqueued job', async () => {
      const queue = new InMemoryQueue();

      const jobId = await queue.enqueue({
        type: JobType.SEND_EMAIL,
        priority: 5,
        maxRetries: 3,
        data: { email: 'test@example.com' },
      });

      const job = await queue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe(JobType.SEND_EMAIL);
      expect(job?.status).toBe(JobStatus.PENDING);
    });

    it('registers job handler', async () => {
      const queue = new InMemoryQueue();

      const handler = jest.fn().mockResolvedValue('success');
      queue.registerHandler(JobType.SEND_EMAIL, handler);

      const jobId = await queue.enqueue({
        type: JobType.SEND_EMAIL,
        priority: 5,
        maxRetries: 1,
      });

      await queue.process();
      expect(handler).toHaveBeenCalled();
    });

    it('handles job failures with retry', async () => {
      const queue = new InMemoryQueue();

      const handler = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success');

      queue.registerHandler(JobType.SEND_EMAIL, handler);

      const jobId = await queue.enqueue({
        type: JobType.SEND_EMAIL,
        priority: 5,
        maxRetries: 2,
      });

      // First attempt fails
      await queue.process();
      let job = await queue.getJob(jobId);
      expect(job?.retries).toBe(1);
      expect(job?.status).toBe(JobStatus.RETRYING);

      // Second attempt succeeds
      await queue.process();
      job = await queue.getJob(jobId);
      expect(job?.status).toBe(JobStatus.COMPLETED);
    });

    it('respects job priority', async () => {
      const queue = new InMemoryQueue();

      const handler = jest.fn().mockResolvedValue('ok');
      queue.registerHandler(JobType.SEND_EMAIL, handler);

      const lowPriorityId = await queue.enqueue({
        type: JobType.SEND_EMAIL,
        priority: 1,
        maxRetries: 1,
      });

      const highPriorityId = await queue.enqueue({
        type: JobType.SEND_EMAIL,
        priority: 10,
        maxRetries: 1,
      });

      // High priority job should be processed first
      const jobs = await queue.process();
      expect(jobs[0]?.id).toBe(highPriorityId);
    });

    it('gets jobs by status', async () => {
      const queue = new InMemoryQueue();

      await queue.enqueue({
        type: JobType.SEND_EMAIL,
        priority: 5,
        maxRetries: 1,
      });

      const pending = await queue.getJobsByStatus(JobStatus.PENDING);
      expect(pending.length).toBeGreaterThan(0);
    });

    it('cancels a job', async () => {
      const queue = new InMemoryQueue();

      const jobId = await queue.enqueue({
        type: JobType.SEND_EMAIL,
        priority: 5,
        maxRetries: 1,
      });

      await queue.cancel(jobId);
      const job = await queue.getJob(jobId);
      expect(job?.status).toBe(JobStatus.FAILED);
    });

    it('clears completed jobs', async () => {
      const queue = new InMemoryQueue();

      const handler = jest.fn().mockResolvedValue('success');
      queue.registerHandler(JobType.SEND_EMAIL, handler);

      const jobId = await queue.enqueue({
        type: JobType.SEND_EMAIL,
        priority: 5,
        maxRetries: 1,
      });

      await queue.process();
      await queue.clearCompleted();

      const job = await queue.getJob(jobId);
      expect(job).toBeUndefined();
    });
  });

  describe('JobType', () => {
    it('has required job types', () => {
      expect(JobType.SEND_EMAIL).toBeDefined();
      expect(JobType.CREDIT_RESET).toBeDefined();
      expect(JobType.AUDIT_MAINTENANCE).toBeDefined();
      expect(JobType.ANALYTICS_AGGREGATION).toBeDefined();
    });
  });

  describe('JobStatus', () => {
    it('has required job statuses', () => {
      expect(JobStatus.PENDING).toBeDefined();
      expect(JobStatus.PROCESSING).toBeDefined();
      expect(JobStatus.COMPLETED).toBeDefined();
      expect(JobStatus.FAILED).toBeDefined();
      expect(JobStatus.RETRYING).toBeDefined();
    });
  });
});
