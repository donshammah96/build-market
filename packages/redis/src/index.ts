// REST client (serverless / Next.js / edge)
export { getRedisClient, resetRedisClient, isRedisHealthy } from "./client.js";
export type { RedisClient } from "./client.js";

// Cache
export { RedisCache, redisCache } from "./cache.js";

// Rate limiting
export {
  checkRateLimit,
  checkSlidingWindowRateLimit,
  createRateLimiter,
  resetLimiterCache,
} from "./rate-limit.js";
export type {
  RateLimitAlgorithm,
  RateLimitParams,
  RateLimitResult,
  SlidingWindowRateLimitParams,
  SlidingWindowRateLimitResult,
  RateLimiterOptions,
  RateLimiter,
} from "./rate-limit.js";

// Shared types
export type {
  RedisConfig,
  CacheOptions,
  CacheEntry,
  Serializer,
} from "./types.js";
