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

export type RateLimitAlgorithm = "sliding" | "cachedFixed";

const limiterCache = new Map<string, Ratelimit>();

function getLimiterCacheKey(
  limit: number,
  windowMs: number,
  algorithm: RateLimitAlgorithm,
): string {
  return `${algorithm}:${limit}:${windowMs}`;
}

// In-memory cache shared across limiters to deduplicate Redis writes within the process
const ephemeralCache = new Map();

function getOrCreateLimiter(
  limit: number,
  windowMs: number,
  algorithm: RateLimitAlgorithm = "sliding",
): Ratelimit {
  const cacheKey = getLimiterCacheKey(limit, windowMs, algorithm);
  const cached = limiterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const limiterAlgorithm =
    algorithm === "cachedFixed"
      ? Ratelimit.cachedFixedWindow(limit, `${windowMs} ms`)
      : Ratelimit.slidingWindow(limit, `${windowMs} ms`);

  const limiter = new Ratelimit({
    redis: getRedisClient(),
    limiter: limiterAlgorithm,
    // Prefix all rate-limit keys with "rl:" to isolate them from other
    // namespaces in the same Upstash database.
    prefix: `rl:${algorithm === "cachedFixed" ? "cfw" : "sw"}`,
    ephemeralCache,
    analytics: false,
  });

  limiterCache.set(cacheKey, limiter);
  return limiter;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RateLimitParams {
  /** Fully-qualified rate-limit key, e.g. "actor:{userId}:create_project" */
  key: string;
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Rate-limiting algorithm: "sliding" (default, strict) or "cachedFixed" (read/high-throughput optimized) */
  algorithm?: RateLimitAlgorithm;
}

export type SlidingWindowRateLimitParams = RateLimitParams;

export interface RateLimitResult {
  /** true when the request is within the limit */
  success: boolean;
  /** The configured limit */
  limit: number;
  /** Remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  reset: number;
}

export type SlidingWindowRateLimitResult = RateLimitResult;

// ---------------------------------------------------------------------------
// Check functions
// ---------------------------------------------------------------------------

/**
 * Check a rate limit for the given key.
 *
 * Supports both "sliding" (strict distributed sliding window) and
 * "cachedFixed" (in-memory cached fixed window for high-throughput reads).
 */
export async function checkRateLimit(
  params: RateLimitParams,
): Promise<RateLimitResult> {
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

  const algorithm = params.algorithm ?? "sliding";
  const limiter = getOrCreateLimiter(
    Math.trunc(params.limit),
    Math.trunc(params.windowMs),
    algorithm,
  );

  const result = await limiter.limit(key);

  return {
    success: result.success,
    limit: result.limit,
    remaining: Math.max(0, result.remaining),
    reset: result.reset,
  };
}

/**
 * Backward-compatible wrapper for checkRateLimit using the sliding-window algorithm.
 */
export async function checkSlidingWindowRateLimit(
  params: SlidingWindowRateLimitParams,
): Promise<SlidingWindowRateLimitResult> {
  return checkRateLimit({ ...params, algorithm: "sliding" });
}

// ---------------------------------------------------------------------------
// Factory for reusable per-namespace limiters
// ---------------------------------------------------------------------------

export interface RateLimiterOptions {
  /** Maximum requests per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Rate-limiting algorithm */
  algorithm?: RateLimitAlgorithm;
}

export interface RateLimiter {
  /**
   * Check and record a request against this limiter for the given key.
   * The key should be scoped to the actor and operation being protected,
   * e.g. `actor:${userId}:upload_document`.
   */
  check(key: string): Promise<RateLimitResult>;
}

/**
 * Create a reusable rate limiter with a fixed limit and window.
 *
 * Prefer this over calling checkRateLimit directly when a
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
    async check(key: string): Promise<RateLimitResult> {
      return checkRateLimit({
        key,
        limit: options.limit,
        windowMs: options.windowMs,
        algorithm: options.algorithm ?? "sliding",
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
