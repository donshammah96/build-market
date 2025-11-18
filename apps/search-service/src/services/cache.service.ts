import redisClient from "../config/redis.js";

export class CacheService {
  private defaultTTL = parseInt(process.env.CACHE_TTL || "3600"); // 1 hour

  // Generate cache key
  private generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join("|");
    return `search:${prefix}:${sortedParams}`;
  }

  // Get cached data
  async get<T>(prefix: string, params: Record<string, any>): Promise<T | null> {
    try {
      const key = this.generateKey(prefix, params);
      const cached = await redisClient.get(key);
      
      if (cached) {
        console.log(`✅ Cache hit: ${key}`);
        return JSON.parse(cached) as T;
      }
      
      console.log(`❌ Cache miss: ${key}`);
      return null;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  // Set cached data
  async set(
    prefix: string,
    params: Record<string, any>,
    data: any,
    ttl?: number
  ): Promise<void> {
    try {
      const key = this.generateKey(prefix, params);
      const expiryTime = ttl || this.defaultTTL;
      
      await redisClient.setex(key, expiryTime, JSON.stringify(data));
      console.log(`✅ Cached: ${key} (TTL: ${expiryTime}s)`);
    } catch (error) {
      console.error("Cache set error:", error);
    }
  }

  // Invalidate cache by pattern
  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(`search:${pattern}*`);
      
      if (keys.length > 0) {
        await redisClient.del(...keys);
        console.log(`✅ Invalidated ${keys.length} cache keys matching: ${pattern}`);
      }
    } catch (error) {
      console.error("Cache invalidate error:", error);
    }
  }

  // Clear all search cache
  async clearAll(): Promise<void> {
    try {
      const keys = await redisClient.keys("search:*");
      
      if (keys.length > 0) {
        await redisClient.del(...keys);
        console.log(`✅ Cleared all search cache (${keys.length} keys)`);
      }
    } catch (error) {
      console.error("Cache clear error:", error);
    }
  }

  // Get cache statistics
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsed: string;
  }> {
    try {
      const keys = await redisClient.keys("search:*");
      const info = await redisClient.info("memory");
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      
      return {
        totalKeys: keys.length,
        memoryUsed: memoryMatch && memoryMatch[1] ? memoryMatch[1].trim() : "unknown",
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return { totalKeys: 0, memoryUsed: "unknown" };
    }
  }
}

export default new CacheService();

