/**
 * Rate limiting package tests
 */

import { InMemoryRateLimiter, RateLimitPresets } from './src/index';

describe('@iriskey/ratelimit', () => {
  describe('InMemoryRateLimiter', () => {
    it('allows requests within limit', async () => {
      const limiter = new InMemoryRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      for (let i = 0; i < 5; i++) {
        const result = await limiter.check('test-key');
        expect(result.success).toBe(true);
      }
    });

    it('rejects requests exceeding limit', async () => {
      const limiter = new InMemoryRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      await limiter.check('test-key');
      await limiter.check('test-key');
      const result = await limiter.check('test-key');

      expect(result.success).toBe(false);
      expect(result.current).toBeGreaterThan(result.limit);
    });

    it('resets after window expires', async () => {
      const limiter = new InMemoryRateLimiter({
        windowMs: 100,
        maxRequests: 2,
      });

      await limiter.check('test-key');
      await limiter.check('test-key');
      let result = await limiter.check('test-key');
      expect(result.success).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      result = await limiter.check('test-key');
      expect(result.success).toBe(true);
    });

    it('tracks multiple keys independently', async () => {
      const limiter = new InMemoryRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      await limiter.check('key-1');
      await limiter.check('key-1');
      let result1 = await limiter.check('key-1');
      expect(result1.success).toBe(false);

      const result2 = await limiter.check('key-2');
      expect(result2.success).toBe(true);
    });
  });

  describe('RateLimitPresets', () => {
    it('has login preset', () => {
      expect(RateLimitPresets.login).toBeDefined();
      expect(RateLimitPresets.login.maxRequests).toBe(5);
      expect(RateLimitPresets.login.windowMs).toBe(15 * 60 * 1000); // 15 minutes
    });

    it('has registration preset', () => {
      expect(RateLimitPresets.registration).toBeDefined();
      expect(RateLimitPresets.registration.maxRequests).toBe(3);
      expect(RateLimitPresets.registration.windowMs).toBe(60 * 60 * 1000); // 1 hour
    });

    it('has password reset preset', () => {
      expect(RateLimitPresets.passwordReset).toBeDefined();
      expect(RateLimitPresets.passwordReset.maxRequests).toBe(3);
    });

    it('has API preset', () => {
      expect(RateLimitPresets.api).toBeDefined();
      expect(RateLimitPresets.api.maxRequests).toBe(100);
    });
  });
});
