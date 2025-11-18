import { NextRequest } from 'next/server';

/**
 * Simple in-memory rate limiter (for development)
 * For production, use Redis-based rate limiting with @upstash/ratelimit
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    Object.keys(store).forEach((key) => {
      const entry = store[key];
      if (entry && entry.resetTime < now) {
        delete store[key];
      }
    });
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for an identifier
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param limit - Maximum requests allowed
 * @param window - Time window in milliseconds
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 10,
  window: number = 10000 // 10 seconds
): Promise<RateLimitResult> {
  const now = Date.now();
  const key = identifier;

  // Initialize or reset if window expired
  if (!store[key] || store[key].resetTime < now) {
    store[key] = {
      count: 0,
      resetTime: now + window,
    };
  }

  // Increment count
  store[key].count++;

  const remaining = Math.max(0, limit - store[key].count);
  const success = store[key].count <= limit;

  return {
    success,
    limit,
    remaining,
    reset: store[key].resetTime,
  };
}

/**
 * Get rate limit identifier from request
 * Uses IP address or falls back to a default
 */
export function getRateLimitIdentifier(req: NextRequest): string {
  // Try to get real IP from various headers
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'anonymous';

  return ip;
}

/**
 * Rate limit configurations for different endpoints
 */
export const RateLimits = {
  // Strict limits for auth endpoints
  AUTH: { limit: 5, window: 60000 }, // 5 requests per minute

  // Standard API limits
  API: { limit: 30, window: 60000 }, // 30 requests per minute

  // Relaxed limits for read operations
  READ: { limit: 100, window: 60000 }, // 100 requests per minute

  // Very strict for webhooks
  WEBHOOK: { limit: 100, window: 60000 }, // 100 requests per minute
} as const;

/**
 * NOTE: For production, replace this with Redis-based rate limiting:
 * 
 * ```typescript
 * import { Ratelimit } from '@upstash/ratelimit';
 * import { Redis } from '@upstash/redis';
 * 
 * export const ratelimit = new Ratelimit({
 *   redis: Redis.fromEnv(),
 *   limiter: Ratelimit.slidingWindow(10, '10 s'),
 *   analytics: true,
 * });
 * ```
 */

