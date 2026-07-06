/**
 * BullMQ-compatible Redis connection via Upstash TCP endpoint.
 *
 * BullMQ requires ioredis with a persistent TCP connection; the REST client
 * in client.ts is not compatible with BullMQ's blocking command patterns
 * (BRPOP, BLPOP, etc.). Upstash exposes a standard rediss:// TCP endpoint
 * alongside its REST API, so ioredis continues to work here.
 *
 * Required environment variable:
 *   REDIS_URL — rediss://:TOKEN@credible-urchin-103242.upstash.io:6379
 *
 * The token is the same value as UPSTASH_REDIS_REST_TOKEN. Using a URL
 * rather than discrete host/port/password keeps configuration portable and
 * avoids the need for individual REDIS_HOST / REDIS_PORT / REDIS_PASSWORD
 * variables in services that only need this module.
 *
 * maxmemory-policy enforcement has been removed. Upstash manages eviction
 * policy on managed databases; CONFIG SET is not permitted.
 */

import type { RedisOptions } from "ioredis";

export type BullMQRedisConnectionOptions = RedisOptions & {
  /**
   * When true, suppresses BullMQ's Redis version compatibility warning.
   * We set this to true globally because we run a centralised policy check
   * from this package rather than per Queue/Worker.
   */
  skipVersionCheck?: boolean;
};

export interface BullMQConnectionSummary {
  source: "url" | "default";
  host: string;
  port: number;
  username?: string;
  db: number;
  tls: boolean;
  hasPassword: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseIntOrDefault(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function requireRedisUrl(): string {
  const url = process.env.REDIS_URL?.trim();

  if (!url) {
    // During Next.js build, return a dummy URL to satisfy module initialization.
    // lazyConnect: true ensures we don't actually try to dial this dummy endpoint.
    // IMPORTANT: This guard is scoped to NEXT_PHASE only. The CI env var must NOT
    // be checked here because it remains set during `next start` in the smoke gate,
    // causing BullMQ to dial dummy.upstash.io at runtime and crash the server.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return "rediss://:DUMMY@dummy.upstash.io:6379";
    }

    throw new Error(
      "REDIS_URL is required for BullMQ connections. " +
        "Set it to the Upstash TCP endpoint: " +
        "rediss://:TOKEN@<host>.upstash.io:6379",
    );
  }

  return url;
}

function buildConnectionFromUrl(redisUrl: string): RedisOptions {
  const parsed = new URL(redisUrl);
  const db = parseIntOrDefault(parsed.pathname.replace(/^\//, ""), 0);

  return {
    host: parsed.hostname || "localhost",
    port: parseIntOrDefault(parsed.port, 6379),
    username: parsed.username || undefined,
    // URL-encoded password is decoded automatically by the URL constructor
    password: parsed.password || undefined,
    db,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns ioredis options suitable for BullMQ instantiation.
 *
 * Callers can pass overrides to customise individual fields, though this
 * should rarely be needed — prefer adjusting the REDIS_URL instead.
 */
export function getBullMQConnectionOptions(
  overrides: Partial<BullMQRedisConnectionOptions> = {},
): BullMQRedisConnectionOptions {
  const base = buildConnectionFromUrl(requireRedisUrl());

  return {
    ...base,
    // BullMQ requires maxRetriesPerRequest: null — do not override this.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    skipVersionCheck: true,
    lazyConnect: true,
    retryStrategy(times: number) {
      const delay = Math.min(times * 500, 30_000);
      console.warn(`[Redis:BullMQ] Reconnect attempt ${times} in ${delay}ms`);
      return delay;
    },
    reconnectOnError(err: Error) {
      const retryOn = ["READONLY", "ECONNRESET", "ECONNREFUSED"];
      return retryOn.some((code) => err.message.includes(code));
    },
    ...overrides,
  };
}

/**
 * Returns a summary of the current connection configuration for logging.
 * Intentionally omits the password.
 */
export function getBullMQConnectionSummary(): BullMQConnectionSummary {
  const url = requireRedisUrl();
  const config = buildConnectionFromUrl(url);

  return {
    source: "url",
    host: config.host ?? "localhost",
    port: config.port ?? 6379,
    username: config.username,
    db: config.db ?? 0,
    tls: Boolean(config.tls),
    hasPassword: Boolean(config.password),
  };
}

/**
 * Build BullMQ connection options.
 *
 * Returning plain options (instead of a concrete ioredis instance) avoids
 * cross-package type incompatibilities when multiple ioredis versions are
 * present in a monorepo dependency graph.
 */
export function createRedisConnection(
  overrides: Partial<BullMQRedisConnectionOptions> = {},
): BullMQRedisConnectionOptions {
  return getBullMQConnectionOptions(overrides);
}
