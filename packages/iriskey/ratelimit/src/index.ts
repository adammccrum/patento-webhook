/**
 * IrisKey Platform - Rate Limiting Service
 * Supports in-memory and Redis backends for distributed rate limiting
 */

import type { NextRequest } from 'next/server';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string; // Default: IP address
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  current: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * In-memory rate limiter (for single instance)
 */
class InMemoryRateLimiter {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(private windowMs: number) {}

  check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      this.store.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return {
        success: true,
        limit: 1,
        current: 1,
        resetTime: now + this.windowMs,
      };
    }

    if (now >= entry.resetTime) {
      // Window expired, reset
      this.store.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return {
        success: true,
        limit: 1,
        current: 1,
        resetTime: now + this.windowMs,
      };
    }

    entry.count++;
    return {
      success: true,
      limit: entry.count,
      current: entry.count,
      resetTime: entry.resetTime,
    };
  }

  isLimited(key: string, maxRequests: number): boolean {
    const result = this.check(key);
    return result.current > maxRequests;
  }

  reset(key?: string): void {
    if (key) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Redis rate limiter (for distributed systems)
 */
class RedisRateLimiter {
  constructor(private redis: any) {} // Redis client

  async check(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Use ZSET to store requests with timestamp as score
    const requestKey = `ratelimit:${key}`;

    // Remove old entries
    await this.redis.zremrangebyscore(requestKey, 0, windowStart);

    // Count current requests
    const count = await this.redis.zcard(requestKey);

    // Add current request
    await this.redis.zadd(requestKey, now, `${now}-${Math.random()}`);

    // Set expiration
    await this.redis.expire(requestKey, Math.ceil(windowMs / 1000));

    return {
      success: true,
      limit: count + 1,
      current: count + 1,
      resetTime: now + windowMs,
    };
  }

  async isLimited(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<boolean> {
    const result = await this.check(key, windowMs);
    return result.current > maxRequests;
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      await this.redis.del(`ratelimit:${key}`);
    } else {
      const keys = await this.redis.keys('ratelimit:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }
}

/**
 * Rate limiter factory
 */
export class RateLimiter {
  private inMemory: InMemoryRateLimiter;
  private redis?: RedisRateLimiter;

  constructor(windowMs: number, redisClient?: any) {
    this.inMemory = new InMemoryRateLimiter(windowMs);
    if (redisClient) {
      this.redis = new RedisRateLimiter(redisClient);
    }
  }

  async check(key: string, windowMs: number): Promise<RateLimitResult> {
    if (this.redis) {
      return this.redis.check(key, windowMs);
    }
    return this.inMemory.check(key, windowMs);
  }

  async isLimited(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<boolean> {
    if (this.redis) {
      return this.redis.isLimited(key, windowMs, maxRequests);
    }
    return this.inMemory.isLimited(key, maxRequests);
  }

  async reset(key?: string): Promise<void> {
    if (this.redis) {
      return this.redis.reset(key);
    }
    this.inMemory.reset(key);
  }

  cleanup(): void {
    this.inMemory.cleanup();
  }
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitPresets = {
  // Login: 5 attempts per 15 minutes
  login: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  },
  // Registration: 3 attempts per hour
  registration: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
  },
  // Password reset: 3 attempts per hour
  passwordReset: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
  },
  // General API: 100 requests per minute
  api: {
    windowMs: 60 * 1000,
    maxRequests: 100,
  },
  // AI requests: 10 per minute
  aiRequest: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  // Credit operations: 20 per hour
  creditOperations: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
  },
  // File uploads: 5 per hour
  fileUpload: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
  },
};

/**
 * Helper function to get IP address from request
 */
export function getIpAddress(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Create rate limit middleware
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig,
  limiter: RateLimiter
) {
  return async (request: NextRequest) => {
    const keyGenerator =
      config.keyGenerator || ((req: NextRequest) => getIpAddress(req));

    const key = keyGenerator(request);
    const isLimited = await limiter.isLimited(
      key,
      config.windowMs,
      config.maxRequests
    );

    return {
      limited: isLimited,
      retryAfter: isLimited ? Math.ceil(config.windowMs / 1000) : undefined,
      message: config.message || 'Too many requests, please try again later.',
    };
  };
}

/**
 * Rate limit store for managing different limits
 */
export class RateLimitStore {
  private limiters: Map<string, RateLimiter> = new Map();
  private redisClient?: any;

  constructor(redisClient?: any) {
    this.redisClient = redisClient;
  }

  /**
   * Get or create a limiter
   */
  getLimiter(name: string, windowMs: number): RateLimiter {
    if (!this.limiters.has(name)) {
      this.limiters.set(
        name,
        new RateLimiter(windowMs, this.redisClient)
      );
    }
    return this.limiters.get(name)!;
  }

  /**
   * Check rate limit
   */
  async checkLimit(
    name: string,
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult & { limited: boolean }> {
    const limiter = this.getLimiter(name, config.windowMs);
    const result = await limiter.check(key, config.windowMs);
    return {
      ...result,
      limited: result.current > config.maxRequests,
    };
  }

  /**
   * Reset a specific limit
   */
  async reset(name: string, key?: string): Promise<void> {
    const limiter = this.limiters.get(name);
    if (limiter) {
      await limiter.reset(key);
    }
  }

  /**
   * Clear all limiters
   */
  async clearAll(): Promise<void> {
    for (const [, limiter] of this.limiters) {
      await limiter.reset();
    }
  }
}

/**
 * Global rate limit store instance
 */
let globalRateLimitStore: RateLimitStore | null = null;

/**
 * Initialize global rate limit store
 */
export function initializeRateLimitStore(redisClient?: any): RateLimitStore {
  if (!globalRateLimitStore) {
    globalRateLimitStore = new RateLimitStore(redisClient);
  }
  return globalRateLimitStore;
}

/**
 * Get global rate limit store
 */
export function getRateLimitStore(): RateLimitStore {
  if (!globalRateLimitStore) {
    globalRateLimitStore = new RateLimitStore();
  }
  return globalRateLimitStore;
}
