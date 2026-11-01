import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryCacheStore, RedisCacheStore, createCacheStore } from '../src/cache/index.js';

describe('Core Caching Tier', () => {
  describe('InMemoryCacheStore', () => {
    let cache: InMemoryCacheStore;

    beforeEach(() => {
      cache = new InMemoryCacheStore();
    });

    it('stores and retrieves values accurately', async () => {
      await cache.set('pkg:chalk', { name: 'chalk', version: '5.3.0' });
      const retrieved = await cache.get<{ name: string; version: string }>('pkg:chalk');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('chalk');
      expect(retrieved?.version).toBe('5.3.0');
    });

    it('returns null on cache miss', async () => {
      const retrieved = await cache.get('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('checks existence with has()', async () => {
      expect(await cache.has('foo')).toBe(false);
      await cache.set('foo', 'bar');
      expect(await cache.has('foo')).toBe(true);
    });

    it('deletes entries with del()', async () => {
      await cache.set('key-to-del', 42);
      expect(await cache.has('key-to-del')).toBe(true);

      await cache.del('key-to-del');
      expect(await cache.has('key-to-del')).toBe(false);
      expect(await cache.get('key-to-del')).toBeNull();
    });

    it('enforces TTL expiration', async () => {
      vi.useFakeTimers();
      try {
        await cache.set('expiring-key', 'ephemeral', 1); // 1 second TTL
        expect(await cache.get('expiring-key')).toBe('ephemeral');

        // Advance clock by 1.5 seconds
        vi.advanceTimersByTime(1500);

        expect(await cache.get('expiring-key')).toBeNull();
        expect(await cache.has('expiring-key')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('clears all entries upon close()', async () => {
      await cache.set('a', 1);
      await cache.set('b', 2);
      await cache.close();

      expect(await cache.get('a')).toBeNull();
      expect(await cache.get('b')).toBeNull();
    });
  });

  describe('RedisCacheStore graceful degradation', () => {
    it('handles offline Redis gracefully without throwing unhandled exceptions', async () => {
      // Connect to unreachable local port with lazyConnect and no retries
      const redisCache = new RedisCacheStore({
        redisUrl: 'redis://127.0.0.1:19999',
        keyPrefix: 'test-offline:'
      });

      // All calls should safely return null/false without crashing
      const val = await redisCache.get('any-key');
      expect(val).toBeNull();

      expect(await redisCache.has('any-key')).toBe(false);

      // set and del should not throw
      await expect(redisCache.set('any-key', { foo: 'bar' }, 60)).resolves.toBeUndefined();
      await expect(redisCache.del('any-key')).resolves.toBeUndefined();

      await redisCache.close();
    });
  });

  describe('RedisCacheStore — connected-client paths (mock client)', () => {
    // Build a fake Redis client that simulates a live connection so we can
    // reach the branches that require isConnected === true.
    function makeMockClient(overrides: Record<string, unknown> = {}) {
      return {
        status: 'ready',
        on: vi.fn(),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        exists: vi.fn().mockResolvedValue(0),
        quit: vi.fn().mockResolvedValue('OK'),
        disconnect: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        ...overrides
      };
    }

    it('get() returns the parsed value when Redis has the key', async () => {
      const mockClient = makeMockClient({
        get: vi.fn().mockResolvedValue(JSON.stringify({ name: 'lodash' }))
      });

      const store = new RedisCacheStore({});
      // Inject the mock client and mark as connected
      (store as unknown as { client: unknown; isConnected: boolean }).client = mockClient;
      (store as unknown as { isConnected: boolean }).isConnected = true;

      const result = await store.get<{ name: string }>('pkg:lodash');
      expect(result).toEqual({ name: 'lodash' });
    });

    it('get() returns null on cache miss', async () => {
      const mockClient = makeMockClient({ get: vi.fn().mockResolvedValue(null) });
      const store = new RedisCacheStore({});
      (store as unknown as { client: unknown; isConnected: boolean }).client = mockClient;
      (store as unknown as { isConnected: boolean }).isConnected = true;

      expect(await store.get('missing-key')).toBeNull();
    });

    it('set() with TTL calls Redis SET EX', async () => {
      const mockSet = vi.fn().mockResolvedValue('OK');
      const mockClient = makeMockClient({ set: mockSet });
      const store = new RedisCacheStore({});
      (store as unknown as { client: unknown; isConnected: boolean }).client = mockClient;
      (store as unknown as { isConnected: boolean }).isConnected = true;

      await store.set('key', { value: 42 }, 300);
      expect(mockSet).toHaveBeenCalledWith(
        expect.stringContaining('key'),
        JSON.stringify({ value: 42 }),
        'EX',
        300
      );
    });

    it('set() without TTL calls Redis SET without EX', async () => {
      const mockSet = vi.fn().mockResolvedValue('OK');
      const mockClient = makeMockClient({ set: mockSet });
      const store = new RedisCacheStore({});
      (store as unknown as { client: unknown; isConnected: boolean }).client = mockClient;
      (store as unknown as { isConnected: boolean }).isConnected = true;

      await store.set('noTTL', 'hello');
      // Should be called with just key + value (2 args), not EX
      expect(mockSet).toHaveBeenCalledWith(
        expect.stringContaining('noTTL'),
        JSON.stringify('hello')
      );
    });

    it('has() returns true when key exists', async () => {
      const mockClient = makeMockClient({ exists: vi.fn().mockResolvedValue(1) });
      const store = new RedisCacheStore({});
      (store as unknown as { client: unknown; isConnected: boolean }).client = mockClient;
      (store as unknown as { isConnected: boolean }).isConnected = true;

      expect(await store.has('existing-key')).toBe(true);
    });

    it('del() calls Redis del on the prefixed key', async () => {
      const mockDel = vi.fn().mockResolvedValue(1);
      const mockClient = makeMockClient({ del: mockDel });
      const store = new RedisCacheStore({ keyPrefix: 'test:' });
      (store as unknown as { client: unknown; isConnected: boolean }).client = mockClient;
      (store as unknown as { isConnected: boolean }).isConnected = true;

      await store.del('mykey');
      expect(mockDel).toHaveBeenCalledWith('test:mykey');
    });

    it('close() calls quit when client is not ended', async () => {
      const mockQuit = vi.fn().mockResolvedValue('OK');
      const mockClient = makeMockClient({ status: 'ready', quit: mockQuit });
      const store = new RedisCacheStore({});
      (store as unknown as { client: unknown }).client = mockClient;

      await store.close();
      expect(mockQuit).toHaveBeenCalledOnce();
    });
  });

  describe('createCacheStore factory', () => {
    it('creates InMemoryCacheStore by default', () => {
      const store = createCacheStore();
      expect(store).toBeInstanceOf(InMemoryCacheStore);
    });

    it('creates RedisCacheStore when specified', async () => {
      const store = createCacheStore({ type: 'redis', redisUrl: 'redis://127.0.0.1:19999' });
      expect(store).toBeInstanceOf(RedisCacheStore);
      await store.close();
    });
  });
});
