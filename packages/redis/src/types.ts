export interface RedisConfig {
  host: string;
  port: number;
  family?: 4 | 6;
  username?: string;
  password?: string;
  db?: number;
  keyPrefix?: string;
  tls?: boolean;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
}

export interface CacheOptions {
  /** TTL in seconds */
  ttl?: number;
  /** Max size of the cache (for in-memory caching) */
  maxSize?: number;
  /** Stale while revalidate */
  staleWhileRevalidate?: number;
  /** Key prefix for namespacing cache keys */
  prefix?: string;
}

export interface CacheEntry<T> {
  value: T;
  cacheAt: number;
  expires?: number;
}

export type Serializer<T> = {
  serialize: (value: T) => string;
  deserialize: (raw: string) => T;
};
