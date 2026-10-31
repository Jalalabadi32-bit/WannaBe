import { Redis, type RedisOptions } from 'ioredis';
import type { ICacheStore } from './types.js';

export interface RedisCacheOptions {
  redisUrl?: string;
  redisOptions?: RedisOptions;
  keyPrefix?: string;
}

export class RedisCacheStore implements ICacheStore {
  private client: Redis;
  private keyPrefix: string;
  private isConnected: boolean = false;

  constructor(options: RedisCacheOptions = {}) {
    this.keyPrefix = options.keyPrefix ?? 'wannabe:';
    const url = options.redisUrl ?? process.env['REDIS_URL'];

    const baseOpts: RedisOptions = {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      enableOfflineQueue: false,
      // TODO(infra): add Sentinel / Redis Cluster topology failover configs once HA cluster is provisioned in staging
      ...options.redisOptions
    };

    if (url) {
      this.client = new Redis(url, baseOpts);
    } else {
      this.client = new Redis(baseOpts);
    }

    this.client.on('connect', () => {
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      this.isConnected = true;
    });

    this.client.on('error', () => {
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });
  }

  private fullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private async ensureConnected(): Promise<boolean> {
    if (this.isConnected) {
      return true;
    }
    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
        this.isConnected = true;
        return true;
      }
      return this.client.status === 'ready' || this.client.status === 'connect';
    } catch {
      this.isConnected = false;
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const ready = await this.ensureConnected();
    if (!ready) {
      return null;
    }

    try {
      const raw = await this.client.get(this.fullKey(key));
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ready = await this.ensureConnected();
    if (!ready) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
        await this.client.set(this.fullKey(key), serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(this.fullKey(key), serialized);
      }
    } catch {
      // Non-blocking on cache write failure
    }
  }

  async del(key: string): Promise<void> {
    const ready = await this.ensureConnected();
    if (!ready) {
      return;
    }

    try {
      await this.client.del(this.fullKey(key));
    } catch {
      // Non-blocking on cache del failure
    }
  }

  async has(key: string): Promise<boolean> {
    const ready = await this.ensureConnected();
    if (!ready) {
      return false;
    }

    try {
      const exists = await this.client.exists(this.fullKey(key));
      return exists === 1;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.client.status !== 'end') {
        await this.client.quit();
      }
    } catch {
      this.client.disconnect();
    }
  }
}
