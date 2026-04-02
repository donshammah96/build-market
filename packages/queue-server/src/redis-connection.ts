import Redis, { type RedisOptions } from "ioredis";

const DEFAULT_REDIS_URL = "redis://localhost:6379";

export interface BullMQConnectionSummary {
  enabled: boolean;
  source: "url" | "discrete" | "default";
  host: string;
  port: number;
  username?: string;
  db: number;
  tls: boolean;
  hasPassword: boolean;
}

function parseIntOrDefault(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function buildConnectionFromUrl(redisUrl: string): RedisOptions {
  const parsedUrl = new URL(redisUrl);
  const db = parseIntOrDefault(parsedUrl.pathname.replace(/^\//, ""), 0);

  return {
    host: parsedUrl.hostname || "localhost",
    port: parseIntOrDefault(parsedUrl.port, 6379),
    username: parsedUrl.username || undefined,
    password: parsedUrl.password || undefined,
    db,
    tls: parsedUrl.protocol === "rediss:" ? {} : undefined,
  };
}

function buildConnectionFromEnv(): RedisOptions {
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseIntOrDefault(process.env.REDIS_PORT, 6379),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseIntOrDefault(process.env.REDIS_DB, 0),
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
  };
}

export function getBullMQConnectionOptions(
  overrides: Partial<RedisOptions> = {},
): RedisOptions {
  const baseConfig = process.env.REDIS_URL
    ? buildConnectionFromUrl(process.env.REDIS_URL)
    : buildConnectionFromEnv();

  return {
    ...baseConfig,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 500, 30000);
      console.log(`[Redis] Reconnecting attempt ${times}, delay: ${delay}ms`);
      return delay;
    },
    reconnectOnError: (err: Error) => {
      const targetErrors = ["READONLY", "ECONNRESET", "ECONNREFUSED"];
      return targetErrors.some((code) => err.message.includes(code));
    },
    ...overrides,
  };
}

export function getBullMQConnectionSummary(): BullMQConnectionSummary {
  const source = process.env.REDIS_URL
    ? "url"
    : process.env.REDIS_HOST || process.env.REDIS_PORT
      ? "discrete"
      : "default";
  const effectiveUrl = process.env.REDIS_URL || DEFAULT_REDIS_URL;
  const config =
    source === "url"
      ? buildConnectionFromUrl(effectiveUrl)
      : buildConnectionFromEnv();

  return {
    enabled:
      source !== "default" ||
      process.env.REDIS_URL === DEFAULT_REDIS_URL ||
      Boolean(process.env.REDIS_HOST) ||
      Boolean(process.env.REDIS_PORT),
    source,
    host: config.host || "localhost",
    port: config.port || 6379,
    username: config.username,
    db: config.db || 0,
    tls: Boolean(config.tls),
    hasPassword: Boolean(config.password),
  };
}

export function createRedisConnection(
  overrides: Partial<RedisOptions> = {},
): Redis {
  return new Redis(getBullMQConnectionOptions(overrides));
}

export const redisConnection = createRedisConnection();

redisConnection.on("error", (err: Error) => {
  console.error("[Redis] Connection error:", err.message);
});

redisConnection.on("connect", () => {
  console.log("[Redis] Connected successfully");
});

redisConnection.on("ready", () => {
  console.log("[Redis] Ready to accept commands");
});

redisConnection.on("close", () => {
  console.log("[Redis] Connection closed");
});

process.on("SIGTERM", async () => {
  console.log("[Redis] Shutting down gracefully...");
  await redisConnection.quit();
});

process.on("SIGINT", async () => {
  console.log("[Redis] Received SIGINT, shutting down...");
  await redisConnection.quit();
});
