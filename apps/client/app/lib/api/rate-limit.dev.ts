import type { RateLimitResult } from "./rate-limit";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up stale entries periodically so local memory does not grow unbounded.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(
    () => {
      const now = Date.now();
      Object.keys(store).forEach((key) => {
        const entry = store[key];
        if (entry && entry.resetTime < now) {
          delete store[key];
        }
      });
    },
    5 * 60 * 1000,
  );

  if (typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }
}

export async function checkRateLimitInMemory(
  identifier: string,
  limit: number,
  window: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const key = identifier;

  if (!store[key] || store[key].resetTime < now) {
    store[key] = {
      count: 0,
      resetTime: now + window,
    };
  }

  store[key].count += 1;

  return {
    success: store[key].count <= limit,
    limit,
    remaining: Math.max(0, limit - store[key].count),
    reset: store[key].resetTime,
  };
}
