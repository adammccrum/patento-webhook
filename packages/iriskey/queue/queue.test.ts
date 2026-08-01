/**
 * Queue package tests
 *
 * InMemoryQueue processes jobs eagerly: enqueue() kicks off processing rather
 * than leaving work for a separate drain step, so these tests await the
 * microtask queue instead of calling a process() method.
 */

import { InMemoryQueue, JobType, JobStatus } from './src/index';

/** Let the eagerly-started process() promise chain settle. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('@iriskey/queue', () => {
  describe('InMemoryQueue', () => {
    it('enqueues a job and returns its id', async () => {
      const queue = new InMemoryQueue();

      const jobId = await queue.enqueue(
        JobType.SEND_EMAIL,
        { email: 'test@example.com' },
        { maxRetries: 3 }
      );

      expect(typeof jobId).toBe('string');
      expect(jobId.length).toBeGreaterThan(0);
    });

    it('retrieves an enqueued job with its data', async () => {
      const queue = new InMemoryQueue();

      const jobId = await queue.enqueue(
        JobType.SEND_EMAIL,
        { email: 'test@example.com' },
        { delayMs: 60_000 } // delayed so it stays pending rather than processing
      );

      const job = queue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe(JobType.SEND_EMAIL);
      expect(job?.data).toEqual({ email: 'test@example.com' });
      expect(job?.status).toBe(JobStatus.PENDING);
    });

    it('runs the registered handler for the job type', async () => {
      const queue = new InMemoryQueue();

      const handler = jest.fn().mockResolvedValue('sent');
      queue.registerHandler(JobType.SEND_EMAIL, handler);

      const jobId = await queue.enqueue(JobType.SEND_EMAIL, {});
      await settle();

      expect(handler).toHaveBeenCalledTimes(1);
      const job = queue.getJob(jobId);
      expect(job?.status).toBe(JobStatus.COMPLETED);
      expect(job?.result).toBe('sent');
    });

    it('marks a job failed once retries are exhausted', async () => {
      const queue = new InMemoryQueue();

      const handler = jest.fn().mockRejectedValue(new Error('Fail'));
      queue.registerHandler(JobType.SEND_EMAIL, handler);

      // maxRetries of 1 means the first failure is terminal.
      const jobId = await queue.enqueue(JobType.SEND_EMAIL, {}, { maxRetries: 1 });
      await settle();

      const job = queue.getJob(jobId);
      expect(job?.status).toBe(JobStatus.FAILED);
      expect(job?.retries).toBe(1);
      expect(job?.error?.message).toBe('Fail');
    });

    it('schedules a retry when attempts remain', async () => {
      const queue = new InMemoryQueue();

      const handler = jest.fn().mockRejectedValue(new Error('Fail'));
      queue.registerHandler(JobType.SEND_EMAIL, handler);

      const jobId = await queue.enqueue(JobType.SEND_EMAIL, {}, { maxRetries: 3 });
      await settle();

      const job = queue.getJob(jobId);
      expect(job?.status).toBe(JobStatus.RETRYING);
      expect(job?.retries).toBe(1);
    });

    it('fails a job when no handler is registered', async () => {
      const queue = new InMemoryQueue();

      const jobId = await queue.enqueue(JobType.SEND_EMAIL, {}, { maxRetries: 1 });
      await settle();

      const job = queue.getJob(jobId);
      expect(job?.status).toBe(JobStatus.FAILED);
      expect(job?.error?.message).toContain('No handler registered');
    });

    it('gets jobs by status', async () => {
      const queue = new InMemoryQueue();

      await queue.enqueue(JobType.SEND_EMAIL, {}, { delayMs: 60_000 });

      const pending = queue.getJobsByStatus(JobStatus.PENDING);
      expect(pending.length).toBe(1);
    });

    it('gets jobs by type', async () => {
      const queue = new InMemoryQueue();

      await queue.enqueue(JobType.SEND_EMAIL, {}, { delayMs: 60_000 });
      await queue.enqueue(JobType.CREDIT_RESET, {}, { delayMs: 60_000 });

      expect(queue.getJobsByType(JobType.SEND_EMAIL).length).toBe(1);
      expect(queue.getJobsByType(JobType.CREDIT_RESET).length).toBe(1);
    });

    it('cancels a pending job, removing it from the queue', async () => {
      const queue = new InMemoryQueue();

      const jobId = await queue.enqueue(JobType.SEND_EMAIL, {}, { delayMs: 60_000 });

      expect(queue.cancel(jobId)).toBe(true);
      expect(queue.getJob(jobId)).toBeUndefined();
    });

    it('refuses to cancel a job that already finished', async () => {
      const queue = new InMemoryQueue();

      queue.registerHandler(JobType.SEND_EMAIL, jest.fn().mockResolvedValue('ok'));
      const jobId = await queue.enqueue(JobType.SEND_EMAIL, {});
      await settle();

      expect(queue.cancel(jobId)).toBe(false);
      expect(queue.getJob(jobId)).toBeDefined();
    });

    it('keeps recently completed jobs when clearing', async () => {
      const queue = new InMemoryQueue();

      queue.registerHandler(JobType.SEND_EMAIL, jest.fn().mockResolvedValue('ok'));
      const jobId = await queue.enqueue(JobType.SEND_EMAIL, {});
      await settle();

      // clearCompleted only drops jobs that finished more than 24h ago.
      queue.clearCompleted();
      expect(queue.getJob(jobId)).toBeDefined();
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
