import { checkRateLimit as checkRateLimitFromRedis } from "@build/redis";
import type { RateLimitAlgorithm } from "@build/redis";
import type { RateLimitResult } from "./rate-limit";

const RATE_LIMIT_KEY_PREFIX = "client-rate-limit";

export async function checkRateLimitWithRedis(
  identifier: string,
  limit: number,
  window: number,
  algorithm?: RateLimitAlgorithm,
): Promise<RateLimitResult> {
  return checkRateLimitFromRedis({
    key: `${RATE_LIMIT_KEY_PREFIX}:${identifier}`,
    limit,
    windowMs: window,
    algorithm: algorithm ?? "sliding",
  });
}
