/**
 * Redis-backed cache using the Upstash REST client.
 *
 * The public API of RedisCache and the redisCache helpers is unchanged from
 * the previous ioredis-based version — callers require no migration.
 *
 * Note on invalidatePattern / clear: the @upstash/redis client supports SCAN
 * but not KEYS. Pattern-based invalidation uses SCAN under the hood to stay
 * within Upstash's command allowlist. For very large keyspaces, prefer
 * explicit key deletion or TTL-based expiry over wildcard invalidation.
 */

import { getRedisClient } from "./client.js";
import type { CacheOptions, Serializer } from "./types.js";

const jsonSerializer: Serializer<unknown> = {
  serialize: (value) =>
    typeof value === "string" ? value : JSON.stringify(value),
  deserialize: (raw: string | unknown) => {
    if (typeof raw !== "string") {
      return raw;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },
};

/**
 * Redis-backed cache with typed get/set operations.
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
    this.defaultTtl = options.ttl ?? 3600;
    this.serializer = (options.serializer ?? jsonSerializer) as Serializer<T>;
  }

  private buildKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get(key: string): Promise<T | null> {
    const redis = getRedisClient();
    const raw = await redis.get<unknown>(this.buildKey(key));
    if (raw === null || raw === undefined) return null;

    try {
      return this.serializer.deserialize(raw);
    } catch (err) {
      console.error(
        `[RedisCache] Failed to deserialize key ${this.buildKey(key)}:`,
        err,
      );
      return null;
    }
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    const redis = getRedisClient();
    const serialized = this.serializer.serialize(value);
    const expiry = ttl ?? this.defaultTtl;

    if (expiry > 0) {
      await redis.setex(this.buildKey(key), expiry, serialized);
    } else {
      await redis.set(this.buildKey(key), serialized);
    }
  }

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

  async delete(key: string): Promise<boolean> {
    const redis = getRedisClient();
    const deleted = await redis.del(this.buildKey(key));
    return deleted > 0;
  }

  /**
   * Delete all keys matching a pattern in this namespace using SCAN.
   *
   * KEYS is not available on Upstash; this iterates via SCAN instead.
   * Avoid calling this on large keyspaces in hot paths — it makes multiple
   * round trips proportional to the number of matching keys.
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const redis = getRedisClient();
    const fullPattern = this.buildKey(pattern);
    let deleted = 0;
    let cursor = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: fullPattern,
        count: 100,
      });

      cursor = Number(nextCursor);

      if (keys.length > 0) {
        // @upstash/redis del accepts an array
        deleted += await redis.del(...(keys as [string, ...string[]]));
      }
    } while (cursor !== 0);

    return deleted;
  }

  async clear(): Promise<number> {
    return this.invalidatePattern("*");
  }

  async exists(key: string): Promise<boolean> {
    const redis = getRedisClient();
    const result = await redis.exists(this.buildKey(key));
    return result === 1;
  }

  async getTtl(key: string): Promise<number> {
    const redis = getRedisClient();
    return redis.ttl(this.buildKey(key));
  }
}

/**
 * Simple key-value helpers for one-off operations outside a named namespace.
 */
export const redisCache = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await getRedisClient().get<unknown>(key);
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }
    return raw as T;
  },

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const redis = getRedisClient();
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
  },

  async delete(key: string): Promise<boolean> {
    const result = await getRedisClient().del(key);
    return result > 0;
  },
};
