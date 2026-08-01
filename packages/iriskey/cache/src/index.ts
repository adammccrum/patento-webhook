/**
 * IrisKey Platform - Cache Service
 * Redis-based caching for sessions, config, feature flags, and frequently accessed data
 */

/**
 * Cache key prefixes
 */
export const CacheKeyPrefixes = {
  SESSION: 'session:',
  USER: 'user:',
  PROFILE: 'profile:',
  SETTINGS: 'settings:',
  FEATURE_FLAG: 'feature:',
  PROVIDER_HEALTH: 'provider:',
  RATE_LIMIT: 'ratelimit:',
  CONFIGURATION: 'config:',
};

/**
 * Default TTL values (in seconds)
 */
export const DefaultTTL = {
  SESSION: 30 * 24 * 60 * 60, // 30 days
  USER_PROFILE: 5 * 60, // 5 minutes
  FEATURE_FLAG: 60 * 60, // 1 hour
  PROVIDER_HEALTH: 5 * 60, // 5 minutes
  CONFIGURATION: 24 * 60 * 60, // 24 hours
  RATE_LIMIT: 60, // 1 minute
};

/**
 * In-memory cache (for single instance)
 */
export class InMemoryCache {
  private store: Map<string, { value: unknown; expiresAt?: number }> = new Map();

  set(key: string, value: unknown, ttlSeconds?: number): void {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  get(key: string): unknown {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Redis cache
 */
class RedisCache {
  constructor(private redis: any) {}

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async get(key: string): Promise<unknown> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : undefined;
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.redis.del(key);
    return result > 0;
  }

  async clear(): Promise<void> {
    await this.redis.flushdb();
  }

  async has(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result > 0;
  }

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    const values = await this.redis.mget(...keys);
    const result: Record<string, unknown> = {};

    keys.forEach((key, index) => {
      if (values[index]) {
        result[key] = JSON.parse(values[index]);
      }
    });

    return result;
  }

  async setMany(
    entries: Record<string, unknown>,
    ttlSeconds?: number
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const [key, value] of Object.entries(entries)) {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        pipeline.setex(key, ttlSeconds, serialized);
      } else {
        pipeline.set(key, serialized);
      }
    }

    await pipeline.exec();
  }

  async deleteMany(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.redis.del(...keys);
  }
}

/**
 * Cache factory
 */
export class Cache {
  private inMemory: InMemoryCache;
  private redis?: RedisCache;

  constructor(redisClient?: any) {
    this.inMemory = new InMemoryCache();
    if (redisClient) {
      this.redis = new RedisCache(redisClient);
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (this.redis) {
      return this.redis.set(key, value, ttlSeconds);
    }
    this.inMemory.set(key, value, ttlSeconds);
  }

  async get(key: string): Promise<unknown> {
    if (this.redis) {
      return this.redis.get(key);
    }
    return this.inMemory.get(key);
  }

  async delete(key: string): Promise<boolean> {
    if (this.redis) {
      return this.redis.delete(key);
    }
    return this.inMemory.delete(key);
  }

  async clear(): Promise<void> {
    if (this.redis) {
      return this.redis.clear();
    }
    this.inMemory.clear();
  }

  async has(key: string): Promise<boolean> {
    if (this.redis) {
      return this.redis.has(key);
    }
    return this.inMemory.has(key);
  }

  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== undefined) {
      return cached as T;
    }

    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    if (this.redis) {
      return this.redis.getMany(keys);
    }

    const result: Record<string, unknown> = {};
    for (const key of keys) {
      const value = this.inMemory.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  async setMany(entries: Record<string, unknown>, ttlSeconds?: number): Promise<void> {
    if (this.redis) {
      return this.redis.setMany(entries, ttlSeconds);
    }

    for (const [key, value] of Object.entries(entries)) {
      this.inMemory.set(key, value, ttlSeconds);
    }
  }

  async deleteMany(keys: string[]): Promise<number> {
    if (this.redis) {
      return this.redis.deleteMany(keys);
    }

    let count = 0;
    for (const key of keys) {
      if (this.inMemory.delete(key)) {
        count++;
      }
    }
    return count;
  }

  cleanup(): void {
    this.inMemory.cleanup();
  }
}

/**
 * Global cache instance
 */
let globalCache: Cache | null = null;

/**
 * Initialize global cache
 */
export function initializeCache(redisClient?: any): Cache {
  if (!globalCache) {
    globalCache = new Cache(redisClient);
  }
  return globalCache;
}

/**
 * Get global cache
 */
export function getCache(): Cache {
  if (!globalCache) {
    globalCache = new Cache();
  }
  return globalCache;
}

/**
 * Typed cache wrapper for specific data types
 */
export class TypedCache {
  constructor(private cache: Cache, private prefix: string) {}

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.cache.get(`${this.prefix}${key}`);
    return value as T | undefined;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.cache.set(`${this.prefix}${key}`, value, ttlSeconds);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(`${this.prefix}${key}`);
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(`${this.prefix}${key}`);
  }

  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    return this.cache.getOrSet(`${this.prefix}${key}`, fn, ttlSeconds);
  }
}

/**
 * Cache factories for different data types
 */
export const CacheFactories = {
  sessions: (cache: Cache) => new TypedCache(cache, CacheKeyPrefixes.SESSION),
  users: (cache: Cache) => new TypedCache(cache, CacheKeyPrefixes.USER),
  profiles: (cache: Cache) => new TypedCache(cache, CacheKeyPrefixes.PROFILE),
  settings: (cache: Cache) => new TypedCache(cache, CacheKeyPrefixes.SETTINGS),
  featureFlags: (cache: Cache) => new TypedCache(cache, CacheKeyPrefixes.FEATURE_FLAG),
  providerHealth: (cache: Cache) => new TypedCache(cache, CacheKeyPrefixes.PROVIDER_HEALTH),
  configuration: (cache: Cache) => new TypedCache(cache, CacheKeyPrefixes.CONFIGURATION),
};
