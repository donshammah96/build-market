import { NextRequest } from "next/server";
import { envConfig } from "@/app/lib/infrastructure/env";
import { checkRateLimitInMemory } from "./rate-limit.dev";
import { checkRateLimitWithRedis } from "./rate-limit.redis";

type ConfiguredRateLimitBackend = "auto" | "memory" | "redis";
type ResolvedRateLimitBackend = "memory" | "redis";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

function resolveRateLimitBackend(): ResolvedRateLimitBackend {
  const configuredBackend = envConfig.redis
    .rateLimitBackend as ConfiguredRateLimitBackend;

  if (configuredBackend === "memory") {
    return "memory";
  }

  if (configuredBackend === "redis") {
    if (!envConfig.redis.enabled && envConfig.isProd) {
      throw new Error(
        "RATE_LIMIT_BACKEND=redis requires REDIS_ENABLED=true in production.",
      );
    }

    return envConfig.redis.enabled ? "redis" : "memory";
  }

  if (envConfig.isTest) {
    return "memory";
  }

  if (envConfig.isProd) {
    return "redis";
  }

  return envConfig.redis.enabled ? "redis" : "memory";
}

/**
 * Check rate limit for an identifier.
 *
 * Authenticated actor-scoped key format:
 *   {resourceType}-{operation}:{dbUserId}
 *   e.g. "prof-certificates-write:a1b2c3d4-uuid"
 *
 * Public fallback key format:
 *   {resourceType}-{operation}:ip:{hashedIp}
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 10,
  window: number = 10000, // 10 seconds
): Promise<RateLimitResult> {
  const backend = resolveRateLimitBackend();

  if (backend === "redis") {
    try {
      return await checkRateLimitWithRedis(identifier, limit, window);
    } catch {
      // Production must fail closed if the configured limiter backend fails.
      if (envConfig.isProd) {
        return {
          success: false,
          limit,
          remaining: 0,
          reset: Date.now() + window,
        };
      }

      return checkRateLimitInMemory(identifier, limit, window);
    }
  }

  return checkRateLimitInMemory(identifier, limit, window);
}

/**
 * Returns an actor-scoped rate-limit identifier for authenticated routes.
 * Use IP-based identifiers only for anonymous/public endpoints.
 */
export function getActorRateLimitIdentifier(
  dbUserId: string,
  routeNamespace: string,
): string {
  return `${routeNamespace}:${dbUserId}`;
}

/**
 * Get rate limit identifier from request
 * Uses IP address or falls back to a default
 */
export function getRateLimitIdentifier(req: NextRequest): string {
  // Try to get real IP from various headers
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0] || realIp || "anonymous";

  return ip;
}

/**
 * Rate limit configurations for different endpoints
 */
export const RateLimits = {
  // Strict limits for auth endpoints
  AUTH: { limit: 5, window: 60000 }, // 5 requests per minute

  // Export limits
  EXPORT: { limit: 1, window: 24 * 60 * 60 * 1000 }, // 1 request per 24 hours

  // Standard API limits
  API: { limit: 30, window: 60000 }, // 30 requests per minute

  // Relaxed limits for read operations
  READ: { limit: 100, window: 60000 }, // 100 requests per minute

  // Stricter limits for write operations
  WRITE: { limit: 10, window: 60000 }, // 10 requests per minute

  // Very strict for webhooks
  WEBHOOK: { limit: 100, window: 60000 }, // 100 requests per minute
} as const;
