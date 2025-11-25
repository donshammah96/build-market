/**
 * Aggressive caching with multi-layer support and stale-while-revalidate
 */
import { CacheConfig } from './types';
import { Logger } from './logger';
export interface CacheEntry<T> {
    value: T;
    timestamp: number;
    staleAt?: number;
}
export declare const DEFAULT_CACHE_CONFIG: CacheConfig;
/**
 * Multi-layer cache with in-memory LRU and optional Redis support
 */
export declare class ResilientCache<T = any> {
    private readonly name;
    private readonly memoryCache;
    private readonly config;
    private readonly logger?;
    private readonly revalidationPromises;
    constructor(name: string, config?: Partial<CacheConfig>, logger?: Logger);
    /**
     * Get value from cache
     */
    get(key: string): Promise<T | undefined>;
    /**
     * Set value in cache
     */
    set(key: string, value: T, ttl?: number): Promise<void>;
    /**
     * Get or compute value with stale-while-revalidate support
     */
    getOrCompute(key: string, computer: () => Promise<T>, ttl?: number): Promise<{
        value: T;
        fromCache: boolean;
        isStale: boolean;
    }>;
    /**
     * Revalidate cache entry in the background
     */
    private revalidateInBackground;
    /**
     * Delete value from cache
     */
    delete(key: string): Promise<void>;
    /**
     * Clear all cache entries
     */
    clear(): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate?: number;
    };
}
/**
 * Cache Registry for managing multiple caches
 */
export declare class CacheRegistry {
    private caches;
    private readonly defaultConfig;
    private readonly logger?;
    constructor(defaultConfig?: Partial<CacheConfig>, logger?: Logger);
    /**
     * Get or create a cache
     */
    getCache<T = any>(name: string, config?: Partial<CacheConfig>): ResilientCache<T>;
    /**
     * Clear all caches
     */
    clearAll(): Promise<void>;
    /**
     * Get statistics for all caches
     */
    getAllStats(): Map<string, ReturnType<ResilientCache['getStats']>>;
}
//# sourceMappingURL=cache.d.ts.map