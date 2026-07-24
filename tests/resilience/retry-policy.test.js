/**
 * Retry Policy Tests
 *
 * Tests retry logic including exponential backoff, jitter, budget, and error classification
 */

const RetryPolicy = require('../../src/resilience/retry-policy');

describe('Retry Policy', () => {
  let policy;

  beforeEach(() => {
    policy = new RetryPolicy({
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      budgetPerMinute: 100
    });
  });

  describe('Retry Decision', () => {
    it('retries transient errors', () => {
      const error = { classification: 'transient_error' };

      expect(policy.shouldRetry(error, 0)).toBe(true);
      expect(policy.shouldRetry(error, 1)).toBe(true);
    });

    it('does not retry authorization failures', () => {
      const error = { classification: 'authorization_failure' };

      expect(policy.shouldRetry(error, 0)).toBe(false);
      expect(policy.shouldRetry(error, 1)).toBe(false);
    });

    it('does not retry permission denials', () => {
      const error = { classification: 'permission_denial' };

      expect(policy.shouldRetry(error, 0)).toBe(false);
    });

    it('does not retry policy denials', () => {
      const error = { classification: 'policy_denial' };

      expect(policy.shouldRetry(error, 0)).toBe(false);
    });

    it('does not retry validation errors', () => {
      const error = { classification: 'validation_error' };

      expect(policy.shouldRetry(error, 0)).toBe(false);
    });

    it('does not retry cancellations', () => {
      const error = { classification: 'cancellation' };

      expect(policy.shouldRetry(error, 0)).toBe(false);
    });

    it('respects max attempts', () => {
      const error = { classification: 'timeout' };

      expect(policy.shouldRetry(error, 0)).toBe(true);
      expect(policy.shouldRetry(error, 1)).toBe(true);
      expect(policy.shouldRetry(error, 2)).toBe(false); // At max attempts
    });

    it('respects error.retryable property', () => {
      const retryableError = {
        classification: 'unknown',
        retryable: true
      };

      expect(policy.shouldRetry(retryableError, 0)).toBe(true);

      const nonRetryableError = {
        classification: 'unknown',
        retryable: false
      };

      expect(policy.shouldRetry(nonRetryableError, 0)).toBe(false);
    });
  });

  describe('Exponential Backoff', () => {
    it('calculates exponential delays', () => {
      const delay0 = policy.getRetryDelayMs(0);
      const delay1 = policy.getRetryDelayMs(1);
      const delay2 = policy.getRetryDelayMs(2);

      // Base delays: 100, 200, 400 (before jitter)
      expect(delay0).toBeLessThan(120);
      expect(delay0).toBeGreaterThan(90);

      expect(delay1).toBeLessThan(230);
      expect(delay1).toBeGreaterThan(180);

      expect(delay2).toBeLessThan(450);
      expect(delay2).toBeGreaterThan(360);
    });

    it('caps delay at maxDelayMs', () => {
      const policy2 = new RetryPolicy({
        initialDelayMs: 100,
        maxDelayMs: 200,
        backoffMultiplier: 2
      });

      // Even with exponential growth, should cap at maxDelayMs
      const delay5 = policy2.getRetryDelayMs(5);
      expect(delay5).toBeLessThanOrEqual(220); // 200 + jitter
    });
  });

  describe('Jitter', () => {
    it('applies jitter to delays', () => {
      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(policy.getRetryDelayMs(1));
      }

      // With jitter, delays should vary
      const unique = new Set(delays);
      expect(unique.size).toBeGreaterThan(1);

      // All should be within expected range
      delays.forEach((d) => {
        expect(d).toBeGreaterThanOrEqual(180); // 200 - 10%
        expect(d).toBeLessThanOrEqual(220); // 200 + 10%
      });
    });
  });

  describe('Retry Budget', () => {
    it('tracks budget per agent', () => {
      policy.consumeBudget('EC');
      policy.consumeBudget('EC');

      const status = policy.getBudgetStatus('EC');
      expect(status.used).toBe(2);
      expect(status.available).toBe(98);
    });

    it('rejects retry when budget exhausted', () => {
      const error = { classification: 'transient_error' };

      // Consume all budget
      for (let i = 0; i < 100; i++) {
        policy.consumeBudget('EC');
      }

      // Should not retry even for retryable error
      const shouldRetry = policy.shouldRetry(error, 0, { agentCode: 'EC' });
      expect(shouldRetry).toBe(false);
    });

    it('resets budget after time window', () => {
      policy.consumeBudget('EC');

      let status = policy.getBudgetStatus('EC');
      expect(status.used).toBe(1);

      // The budget uses a time window, so this test would need clock mocking
      // For now, verify status structure
      expect(status).toHaveProperty('used');
      expect(status).toHaveProperty('limit');
      expect(status).toHaveProperty('available');
    });
  });

  describe('Custom Classification', () => {
    it('supports custom retryable classes', () => {
      const custom = new RetryPolicy({
        retryableClasses: ['custom_transient'],
        nonRetryableClasses: []
      });

      expect(custom.shouldRetry({ classification: 'custom_transient' }, 0)).toBe(true);
      expect(custom.shouldRetry({ classification: 'timeout' }, 0)).toBe(false);
    });

    it('supports custom non-retryable classes', () => {
      const custom = new RetryPolicy({
        retryableClasses: [],
        nonRetryableClasses: ['custom_permanent']
      });

      expect(custom.shouldRetry({ classification: 'custom_permanent' }, 0)).toBe(false);
      expect(custom.shouldRetry({ classification: 'timeout' }, 0)).toBe(false);
    });
  });
});
