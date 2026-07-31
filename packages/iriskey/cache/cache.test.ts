/**
 * Cache package tests
 */

import { InMemoryCache, DefaultTTL, CacheKeyPrefixes } from './src/index';

describe('@iriskey/cache', () => {
  describe('InMemoryCache', () => {
    it('stores and retrieves values', async () => {
      const cache = new InMemoryCache();

      await cache.set('test-key', { value: 'test-data' });
      const result = await cache.get('test-key');

      expect(result).toEqual({ value: 'test-data' });
    });

    it('deletes cached values', async () => {
      const cache = new InMemoryCache();

      await cache.set('test-key', 'test-data');
      await cache.delete('test-key');
      const result = await cache.get('test-key');

      expect(result).toBeNull();
    });

    it('respects TTL expiration', async () => {
      const cache = new InMemoryCache();

      await cache.set('test-key', 'test-data', 100); // 100ms TTL
      let result = await cache.get('test-key');
      expect(result).toBe('test-data');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));
      result = await cache.get('test-key');
      expect(result).toBeNull();
    });

    it('checks if key exists', async () => {
      const cache = new InMemoryCache();

      await cache.set('test-key', 'test-data');
      const exists = await cache.has('test-key');

      expect(exists).toBe(true);
    });

    it('clears all cached data', async () => {
      const cache = new InMemoryCache();

      await cache.set('key-1', 'data-1');
      await cache.set('key-2', 'data-2');
      await cache.clear();

      const result1 = await cache.get('key-1');
      const result2 = await cache.get('key-2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('handles concurrent operations', async () => {
      const cache = new InMemoryCache();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          cache.set(`key-${i}`, `data-${i}`)
        );
      }

      await Promise.all(promises);

      const result = await cache.get('key-50');
      expect(result).toBe('data-50');
    });
  });

  describe('DefaultTTL', () => {
    it('has session TTL', () => {
      expect(DefaultTTL.SESSION).toBe(30 * 24 * 60 * 60 * 1000); // 30 days
    });

    it('has user profile TTL', () => {
      expect(DefaultTTL.USER_PROFILE).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('has feature flag TTL', () => {
      expect(DefaultTTL.FEATURE_FLAG).toBe(60 * 60 * 1000); // 1 hour
    });

    it('has configuration TTL', () => {
      expect(DefaultTTL.CONFIGURATION).toBe(24 * 60 * 60 * 1000); // 24 hours
    });
  });

  describe('CacheKeyPrefixes', () => {
    it('has session prefix', () => {
      expect(CacheKeyPrefixes.SESSION).toBe('session');
    });

    it('has user prefix', () => {
      expect(CacheKeyPrefixes.USER).toBe('user');
    });

    it('has feature flag prefix', () => {
      expect(CacheKeyPrefixes.FEATURE_FLAG).toBe('feature_flag');
    });

    it('has configuration prefix', () => {
      expect(CacheKeyPrefixes.CONFIGURATION).toBe('config');
    });
  });

  describe('Cache-aside pattern', () => {
    it('implements get-or-set pattern', async () => {
      const cache = new InMemoryCache();

      const fetchData = jest.fn().mockResolvedValue({ id: '123', name: 'Test' });

      // First call - misses cache, calls fetchData
      let result = await cache.getOrSet('test-key', fetchData, 60000);
      expect(result).toEqual({ id: '123', name: 'Test' });
      expect(fetchData).toHaveBeenCalledTimes(1);

      // Second call - hits cache, doesn't call fetchData
      result = await cache.getOrSet('test-key', fetchData, 60000);
      expect(result).toEqual({ id: '123', name: 'Test' });
      expect(fetchData).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });
});
