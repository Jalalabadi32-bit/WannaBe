import type { ICacheStore } from './types.js';
import { InMemoryCacheStore } from './memory-cache.js';
import { RedisCacheStore } from './redis-cache.js';

export type { ICacheStore } from './types.js';
export { InMemoryCacheStore } from './memory-cache.js';
export { RedisCacheStore, type RedisCacheOptions } from './redis-cache.js';

export interface CacheFactoryOptions {
  type?: 'redis' | 'memory';
  redisUrl?: string;
  keyPrefix?: string;
}

export function createCacheStore(options: CacheFactoryOptions = {}): ICacheStore {
  if (options.type === 'redis' || (options.type === undefined && process.env['REDIS_URL'])) {
    return new RedisCacheStore({
      redisUrl: options.redisUrl ?? process.env['REDIS_URL'],
      keyPrefix: options.keyPrefix
    });
  }
  return new InMemoryCacheStore();
}
