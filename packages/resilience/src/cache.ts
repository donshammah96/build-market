/**
 * Aggressive caching with multi-layer support and stale-while-revalidate
 */

import { LRUCache } from "lru-cache";
import { CacheConfig } from "./types.js";
import { Logger } from "./logger.js";
import { RedisCache } from "@build/redis";

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  staleAt?: number;
}

/**
 * Default cache configuration
 * @deprecated Use getDefaultCacheConfig() for environment-aware defaults
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttl: 60000, // 60s default TTL
  maxSize: 1000, // 1000 entries max
  staleWhileRevalidate: 0, // No stale-while-revalidate by default
};

/**
 * Multi-layer cache with in-memory LRU and optional Redis support
 */
export class ResilientCache<T = any> {
  private readonly memoryCache: LRUCache<string, CacheEntry<T>>;
  private readonly config: CacheConfig;
  private readonly logger?: Logger;
  private readonly revalidationPromises = new Map<string, Promise<T>>();
  private readonly redisCache?: RedisCache<T>;

  constructor(
    private readonly name: string,
    config: Partial<CacheConfig> = {},
    logger?: Logger,
  ) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.logger = logger;

    this.memoryCache = new LRUCache<string, CacheEntry<T>>({
      max: this.config.maxSize,
      ttl: this.config.ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });

    const redisCfg = this.config.redis;
    if (redisCfg?.enabled) {
      // Convert TTL from milliseconds to seconds for Redis
      const redisTtlSeconds =
        redisCfg.ttlSeconds ?? Math.floor(this.config.ttl / 1000);
      this.redisCache = new RedisCache<T>(redisCfg.namespace ?? this.name, {
        ttl: redisTtlSeconds,
      });
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<T | undefined> {
    // L1: Check in-memory cache first
    const entry = this.memoryCache.get(key);
    if (entry) {
      const now = Date.now();
      const isStale = entry.staleAt && now > entry.staleAt;

      if (isStale) {
        this.logger?.debug(`Cache hit (stale) for key: ${key}`, {
          cacheName: this.name,
          key,
          age: now - entry.timestamp,
        });
      } else {
        this.logger?.debug(`Cache hit for key: ${key}`, {
          cacheName: this.name,
          key,
          age: now - entry.timestamp,
        });
      }
      return entry.value;
    }

    // L2: Check Redis cache if enabled
    if (this.redisCache) {
      const cached = await this.redisCache.get(key);
      if (cached !== null) {
        // Backfill L1 cache only — do NOT write back to L2 Redis on a read hit
        this.setMemoryOnly(key, cached);
        this.logger?.debug(`Cache hit (Redis) for key: ${key}`, {
          cacheName: this.name,
          key,
        });
        return cached;
      }
    }

    // Cache miss
    this.logger?.debug(`Cache miss for key: ${key}`, {
      cacheName: this.name,
      key,
    });
    return undefined;
  }

  /**
   * Set value in in-memory L1 cache only (used for backfilling without Redis write amplification)
   */
  private setMemoryOnly(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const effectiveTtl = ttl ?? this.config.ttl;
    const staleAt = this.config.staleWhileRevalidate
      ? now + effectiveTtl
      : undefined;

    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      staleAt,
    };

    this.memoryCache.set(key, entry, {
      ttl: effectiveTtl + (this.config.staleWhileRevalidate ?? 0),
    });
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTtl = ttl ?? this.config.ttl;

    // L1: Set in-memory cache
    this.setMemoryOnly(key, value, effectiveTtl);

    // L2: Set in Redis cache if enabled
    if (this.redisCache) {
      // Convert TTL from milliseconds to seconds for Redis
      const redisTtlSeconds = Math.floor(effectiveTtl / 1000);
      await this.redisCache.set(key, value, redisTtlSeconds);
    }

    this.logger?.debug(`Cache set for key: ${key}`, {
      cacheName: this.name,
      key,
      ttl: effectiveTtl,
    });
  }

  /**
   * Get or compute value with stale-while-revalidate support
   */
  async getOrCompute(
    key: string,
    computer: () => Promise<T>,
    ttl?: number,
  ): Promise<{ value: T; fromCache: boolean; isStale: boolean }> {
    // L1: Check in-memory cache first
    const cachedEntry = this.memoryCache.get(key);
    const now = Date.now();

    if (cachedEntry) {
      const isExpired = now > cachedEntry.timestamp + (ttl ?? this.config.ttl);
      const isStale = cachedEntry.staleAt && now > cachedEntry.staleAt;

      if (isExpired) {
        // Expired - must recompute
        const value = await computer();
        await this.set(key, value, ttl);
        return { value, fromCache: false, isStale: false };
      }

      if (isStale) {
        // Stale but valid - return stale value and revalidate in background
        this.revalidateInBackground(key, computer, ttl);
        return { value: cachedEntry.value, fromCache: true, isStale: true };
      }

      // Fresh cache hit
      return { value: cachedEntry.value, fromCache: true, isStale: false };
    }

    // L2: Check Redis cache if enabled
    if (this.redisCache) {
      const cached = await this.redisCache.get(key);
      if (cached !== null) {
        // Backfill L1 only and return
        this.setMemoryOnly(key, cached, ttl);
        return { value: cached, fromCache: true, isStale: false };
      }
    }

    // Cache miss - compute value
    const value = await computer();
    await this.set(key, value, ttl);
    return { value, fromCache: false, isStale: false };
  }

  /**
   * Revalidate cache entry in the background
   */
  private revalidateInBackground(
    key: string,
    computer: () => Promise<T>,
    ttl?: number,
  ): void {
    // Check if revalidation is already in progress
    if (this.revalidationPromises.has(key)) {
      return;
    }

    const revalidationPromise = computer()
      .then((value) => {
        this.set(key, value, ttl);
        this.logger?.debug(
          `Background revalidation completed for key: ${key}`,
          {
            cacheName: this.name,
            key,
          },
        );
        return value;
      })
      .catch((error) => {
        this.logger?.warn(`Background revalidation failed for key: ${key}`, {
          cacheName: this.name,
          key,
          error: error.message,
        });
        throw error;
      })
      .finally(() => {
        this.revalidationPromises.delete(key);
      });

    this.revalidationPromises.set(key, revalidationPromise);
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    // L1: Delete from in-memory cache
    this.memoryCache.delete(key);

    // L2: Delete from Redis cache if enabled
    if (this.redisCache) {
      await this.redisCache.delete(key);
    }

    this.logger?.debug(`Cache delete for key: ${key}`, {
      cacheName: this.name,
      key,
    });
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    // L1: Clear in-memory cache
    this.memoryCache.clear();

    // L2: Clear Redis cache if enabled
    if (this.redisCache) {
      await this.redisCache.clear();
    }

    this.logger?.info(`Cache cleared: ${this.name}`, {
      cacheName: this.name,
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate?: number;
  } {
    return {
      size: this.memoryCache.size,
      maxSize: this.config.maxSize,
    };
  }
}

/**
 * Cache Registry for managing multiple caches
 */
export class CacheRegistry {
  private caches = new Map<string, ResilientCache<any>>();
  private readonly defaultConfig: CacheConfig;
  private readonly logger?: Logger;

  constructor(defaultConfig: Partial<CacheConfig> = {}, logger?: Logger) {
    this.defaultConfig = { ...DEFAULT_CACHE_CONFIG, ...defaultConfig };
    this.logger = logger;
  }

  /**
   * Get or create a cache
   */
  getCache<T = any>(
    name: string,
    config?: Partial<CacheConfig>,
  ): ResilientCache<T> {
    if (!this.caches.has(name)) {
      const cacheConfig = { ...this.defaultConfig, ...config };
      this.caches.set(
        name,
        new ResilientCache<T>(name, cacheConfig, this.logger),
      );
    }
    return this.caches.get(name)! as ResilientCache<T>;
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    const clearPromises = Array.from(this.caches.values()).map((cache) =>
      cache.clear(),
    );
    await Promise.all(clearPromises);
  }

  /**
   * Get statistics for all caches
   */
  getAllStats(): Map<string, ReturnType<ResilientCache["getStats"]>> {
    const stats = new Map<string, ReturnType<ResilientCache["getStats"]>>();
    this.caches.forEach((cache, name) => {
      stats.set(name, cache.getStats());
    });
    return stats;
  }
}
