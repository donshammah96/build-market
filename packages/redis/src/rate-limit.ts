/**
 * Rate limiting via @upstash/ratelimit.
 *
 * Replaces the previous Lua EVAL sliding-window script, which is not
 * supported by Upstash's REST API. The Ratelimit class from @upstash/ratelimit
 * implements the same sliding-window algorithm atomically on Upstash's
 * infrastructure without requiring EVAL.
 *
 * Two entry points are exported:
 *
 *   checkSlidingWindowRateLimit  — drop-in replacement for the old function.
 *   createRateLimiter            — factory for reusable limiter instances with
 *                                  a fixed limit/window, preferred for
 *                                  per-resource namespacing.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { getRedisClient } from "./client.js";

// ---------------------------------------------------------------------------
// Ratelimit instance cache
// A single Ratelimit instance per (limit, windowMs) pair is sufficient;
// key-level isolation is handled by the key argument passed to .limit().
// ---------------------------------------------------------------------------

const limiterCache = new Map<string, Ratelimit>();

function getLimiterCacheKey(limit: number, windowMs: number): string {
  return `${limit}:${windowMs}`;
}

// In-memory cache shared across limiters to deduplicate Redis writes within the process
const ephemeralCache = new Map();

function getOrCreateLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = getLimiterCacheKey(limit, windowMs);
  const cached = limiterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const limiter = new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    // Prefix all rate-limit keys with "rl:" to isolate them from other
    // namespaces in the same Upstash database.
    prefix: "rl",
    ephemeralCache,
    analytics: false,
  });

  limiterCache.set(cacheKey, limiter);
  return limiter;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SlidingWindowRateLimitParams {
  /** Fully-qualified rate-limit key, e.g. "actor:{userId}:create_project" */
  key: string;
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface SlidingWindowRateLimitResult {
  /** true when the request is within the limit */
  success: boolean;
  /** The configured limit */
  limit: number;
  /** Remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  reset: number;
}

// ---------------------------------------------------------------------------
// Drop-in replacement for the previous checkSlidingWindowRateLimit function.
// Callers that already pass (key, limit, windowMs) require no changes.
// ---------------------------------------------------------------------------

/**
 * Check a sliding-window rate limit for the given key.
 *
 * Internally delegates to @upstash/ratelimit so no Lua EVAL is required.
 * The nowMs and member parameters from the old signature are intentionally
 * absent — they were only needed to drive the Lua script internally.
 */
export async function checkSlidingWindowRateLimit(
  params: SlidingWindowRateLimitParams,
): Promise<SlidingWindowRateLimitResult> {
  const key = params.key.trim();
  if (!key) {
    throw new Error("key must be a non-empty string");
  }

  if (!Number.isFinite(params.limit) || params.limit <= 0) {
    throw new Error("limit must be a positive number");
  }

  if (!Number.isFinite(params.windowMs) || params.windowMs <= 0) {
    throw new Error("windowMs must be a positive number");
  }

  const limiter = getOrCreateLimiter(
    Math.trunc(params.limit),
    Math.trunc(params.windowMs),
  );

  const result = await limiter.limit(key);

  return {
    success: result.success,
    limit: result.limit,
    remaining: Math.max(0, result.remaining),
    reset: result.reset,
  };
}

// ---------------------------------------------------------------------------
// Factory for reusable per-namespace limiters
// ---------------------------------------------------------------------------

export interface RateLimiterOptions {
  /** Maximum requests per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimiter {
  /**
   * Check and record a request against this limiter for the given key.
   * The key should be scoped to the actor and operation being protected,
   * e.g. `actor:${userId}:upload_document`.
   */
  check(key: string): Promise<SlidingWindowRateLimitResult>;
}

/**
 * Create a reusable rate limiter with a fixed limit and window.
 *
 * Prefer this over calling checkSlidingWindowRateLimit directly when a
 * route family shares the same limit/window configuration. The returned
 * object is safe to store at module scope.
 *
 * @example
 * const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
 * const result = await limiter.check(`actor:${userId}:create_project`);
 * if (!result.success) return apiError("Too many requests", 429);
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  return {
    async check(key: string): Promise<SlidingWindowRateLimitResult> {
      return checkSlidingWindowRateLimit({
        key,
        limit: options.limit,
        windowMs: options.windowMs,
      });
    },
  };
}

/**
 * Flush the in-process limiter instance cache.
 * Intended for use in tests only — do not call in production.
 */
export function resetLimiterCache(): void {
  limiterCache.clear();
  ephemeralCache.clear();
}
