import { getRedisClient } from "./client.js";
import type { CacheOptions, Serializer } from "./types.js";

// Default JSON serializer
const jsonSerializer: Serializer<unknown> = {
  serialize: (value) => JSON.stringify(value),
  deserialize: (raw) => JSON.parse(raw),
};

/**
 * Redis-backed cache with typed get/set operations
 */
export class RedisCache<T = unknown> {
  private readonly prefix: string;
  private readonly defaultTtl: number;
  private readonly serializer: Serializer<T>;

  constructor(
    namespace: string,
    options: CacheOptions & { serializer?: Serializer<T> } = {},
  ) {
    this.prefix = options.prefix ? `${options.prefix}:${namespace}` : namespace;
    this.defaultTtl = options.ttl ?? 3600; // 1 hour default
    this.serializer = (options.serializer ?? jsonSerializer) as Serializer<T>;
  }

  private buildKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Get a value from cache
   */
  async get(key: string): Promise<T | null> {
    const redis = getRedisClient();
    const fullKey = this.buildKey(key);

    const raw = await redis.get(fullKey);
    if (!raw) return null;

    try {
      return this.serializer.deserialize(raw);
    } catch (err) {
      console.error(`[RedisCache] Failed to deserialize key ${fullKey}:`, err);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    const redis = getRedisClient();
    const fullKey = this.buildKey(key);
    const serialized = this.serializer.serialize(value);
    const expiry = ttl ?? this.defaultTtl;

    if (expiry > 0) {
      await redis.setex(fullKey, expiry, serialized);
    } else {
      await redis.set(fullKey, serialized);
    }
  }

  /**
   * Get value from cache, or compute and store it if missing
   */
  async getOrSet(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Delete a specific key
   */
  async delete(key: string): Promise<boolean> {
    const redis = getRedisClient();
    const fullKey = this.buildKey(key);
    const deleted = await redis.del(fullKey);
    return deleted > 0;
  }

  /**
   * Delete all keys matching a pattern in this namespace
   * Use with caution in production!
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const redis = getRedisClient();
    const fullPattern = this.buildKey(pattern);

    const keys = await redis.keys(fullPattern);
    if (keys.length === 0) return 0;

    return redis.del(...keys);
  }

  /**
   * Clear all keys in this namespace
   */
  async clear(): Promise<number> {
    return this.invalidatePattern("*");
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const redis = getRedisClient();
    const fullKey = this.buildKey(key);
    const result = await redis.exists(fullKey);
    return result === 1;
  }

  /**
   * Get remaining TTL for a key (in seconds)
   */
  async getTtl(key: string): Promise<number> {
    const redis = getRedisClient();
    const fullKey = this.buildKey(key);
    return redis.ttl(fullKey);
  }
}

/**
 * Simple key-value helpers for one-off operations
 */
export const redisCache = {
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedisClient();
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  },

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const redis = getRedisClient();
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
  },

  async delete(key: string): Promise<boolean> {
    const redis = getRedisClient();
    const result = await redis.del(key);
    return result > 0;
  },
};
