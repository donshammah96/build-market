/**
 * Aggressive caching with multi-layer support and stale-while-revalidate
 */

import { LRUCache } from 'lru-cache';
import { CacheConfig } from './types';
import { Logger } from './logger';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  staleAt?: number;
}

// Default cache configuration
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttl: 60000,              // 60s default TTL
  maxSize: 1000,           // 1000 entries max
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

  constructor(
    private readonly name: string,
    config: Partial<CacheConfig> = {},
    logger?: Logger
  ) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.logger = logger;

    this.memoryCache = new LRUCache<string, CacheEntry<T>>({
      max: this.config.maxSize,
      ttl: this.config.ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<T | undefined> {
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      this.logger?.debug(`Cache miss for key: ${key}`, {
        cacheName: this.name,
        key,
      });
      return undefined;
    }

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

  /**
   * Set value in cache
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
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

    this.memoryCache.set(key, entry, { ttl: effectiveTtl + (this.config.staleWhileRevalidate ?? 0) });

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
    ttl?: number
  ): Promise<{ value: T; fromCache: boolean; isStale: boolean }> {
    const cachedEntry = this.memoryCache.get(key);
    const now = Date.now();

    if (!cachedEntry) {
      // Cache miss - compute value
      const value = await computer();
      await this.set(key, value, ttl);
      return { value, fromCache: false, isStale: false };
    }

    const isExpired = now > (cachedEntry.timestamp + (ttl ?? this.config.ttl));
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

  /**
   * Revalidate cache entry in the background
   */
  private revalidateInBackground(
    key: string,
    computer: () => Promise<T>,
    ttl?: number
  ): void {
    // Check if revalidation is already in progress
    if (this.revalidationPromises.has(key)) {
      return;
    }

    const revalidationPromise = computer()
      .then((value) => {
        this.set(key, value, ttl);
        this.logger?.debug(`Background revalidation completed for key: ${key}`, {
          cacheName: this.name,
          key,
        });
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
    this.memoryCache.delete(key);
    this.logger?.debug(`Cache delete for key: ${key}`, {
      cacheName: this.name,
      key,
    });
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
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

  constructor(
    defaultConfig: Partial<CacheConfig> = {},
    logger?: Logger
  ) {
    this.defaultConfig = { ...DEFAULT_CACHE_CONFIG, ...defaultConfig };
    this.logger = logger;
  }

  /**
   * Get or create a cache
   */
  getCache<T = any>(
    name: string,
    config?: Partial<CacheConfig>
  ): ResilientCache<T> {
    if (!this.caches.has(name)) {
      const cacheConfig = { ...this.defaultConfig, ...config };
      this.caches.set(name, new ResilientCache<T>(name, cacheConfig, this.logger));
    }
    return this.caches.get(name)! as ResilientCache<T>;
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    const clearPromises = Array.from(this.caches.values()).map((cache) => cache.clear());
    await Promise.all(clearPromises);
  }

  /**
   * Get statistics for all caches
   */
  getAllStats(): Map<string, ReturnType<ResilientCache['getStats']>> {
    const stats = new Map<string, ReturnType<ResilientCache['getStats']>>();
    this.caches.forEach((cache, name) => {
      stats.set(name, cache.getStats());
    });
    return stats;
  }
}
