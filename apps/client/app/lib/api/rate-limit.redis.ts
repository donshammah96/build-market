import { checkSlidingWindowRateLimit } from "@build/redis";
import type { RateLimitResult } from "./rate-limit";

const RATE_LIMIT_KEY_PREFIX = "client-rate-limit";

export async function checkRateLimitWithRedis(
  identifier: string,
  limit: number,
  window: number,
): Promise<RateLimitResult> {
  return checkSlidingWindowRateLimit({
    key: `${RATE_LIMIT_KEY_PREFIX}:${identifier}`,
    limit,
    windowMs: window,
  });
}
