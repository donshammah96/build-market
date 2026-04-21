/**
 * Upstash Redis REST client.
 *
 * Uses HTTP transport — safe for serverless, edge, and Next.js route handlers.
 * Never creates persistent TCP connections, so there is no connection pool to
 * manage and no risk of exhausting Upstash's concurrent connection limit from
 * short-lived Lambda/Vercel function invocations.
 *
 * For BullMQ workers that require a persistent ioredis connection, see
 * redis-connection.ts instead.
 */

import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/**
 * Returns the shared Upstash REST client singleton.
 *
 * Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from the
 * environment. Both must be present in production; the client throws at
 * construction time if either is missing so startup fails fast rather than
 * producing silent undefined behaviour at the first Redis call.
 */
export function getRedisClient(): Redis {
  if (client) {
    return client;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw new Error(
      "Missing Upstash credentials. Set UPSTASH_REDIS_REST_URL and " +
        "UPSTASH_REDIS_REST_TOKEN before initialising the Redis client.",
    );
  }

  client = new Redis({ url, token });
  return client;
}

/**
 * Reset the singleton — intended for use in tests only.
 * Calling this in production discards the shared instance and forces
 * re-initialisation on the next getRedisClient() call.
 */
export function resetRedisClient(): void {
  client = null;
}

/**
 * Ping the Upstash REST endpoint and return true if the response is "PONG".
 * Safe to call from a health-check route without creating a TCP connection.
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const result = await getRedisClient().ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

export type { Redis as RedisClient };
