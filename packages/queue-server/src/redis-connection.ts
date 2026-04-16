import Redis, { type RedisOptions } from "ioredis";

const DEFAULT_REDIS_URL = "redis://localhost:6379";
const DEFAULT_REQUIRED_MAXMEMORY_POLICY = "noeviction";

type RuntimePolicyEnforcementMode = "off" | "warn" | "error";

export type BullMQRedisConnectionOptions = RedisOptions & {
  skipVersionCheck?: boolean;
};

const requiredMaxMemoryPolicy = (
  process.env.REDIS_REQUIRED_MAXMEMORY_POLICY ||
  DEFAULT_REQUIRED_MAXMEMORY_POLICY
)
  .trim()
  .toLowerCase();

const runtimePolicyEnforcementMode = normalizeRuntimePolicyEnforcementMode(
  process.env.REDIS_MAXMEMORY_POLICY_ENFORCEMENT,
);

let runtimePolicyValidationPromise: Promise<void> | null = null;

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

function normalizeRuntimePolicyEnforcementMode(
  value: string | undefined,
): RuntimePolicyEnforcementMode {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "off" || normalized === "warn" || normalized === "error") {
    return normalized;
  }

  return "warn";
}

function getRedisInfoValue(info: string, fieldName: string): string | null {
  const prefix = `${fieldName}:`;
  const lines = info.split(/\r?\n/);

  for (const line of lines) {
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim();
    }
  }

  return null;
}

async function validateRedisRuntimePolicy(connection: Redis): Promise<void> {
  if (runtimePolicyEnforcementMode === "off") {
    return;
  }

  const info = await connection.info();
  const detectedMaxMemoryPolicy = getRedisInfoValue(info, "maxmemory_policy");

  if (!detectedMaxMemoryPolicy) {
    console.warn(
      "[Redis] Runtime policy check skipped: maxmemory_policy was not returned by Redis INFO.",
    );
    return;
  }

  if (detectedMaxMemoryPolicy.toLowerCase() === requiredMaxMemoryPolicy) {
    return;
  }

  const message =
    `[Redis] Runtime policy mismatch: maxmemory_policy=${detectedMaxMemoryPolicy}; ` +
    `expected=${requiredMaxMemoryPolicy}. Configure Redis to prevent BullMQ job loss under memory pressure.`;

  if (runtimePolicyEnforcementMode === "error") {
    throw new Error(message);
  }

  console.warn(message);
}

function handleRuntimePolicyValidationError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  if (runtimePolicyEnforcementMode === "error") {
    console.error(`[Redis] Runtime policy validation failed: ${message}`);
    process.exitCode = 1;
    return;
  }

  console.warn(`[Redis] Runtime policy validation failed: ${message}`);
}

export async function ensureRedisRuntimePolicy(
  connection: Redis,
): Promise<void> {
  if (!runtimePolicyValidationPromise) {
    runtimePolicyValidationPromise = validateRedisRuntimePolicy(connection);
  }

  return runtimePolicyValidationPromise;
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
  overrides: Partial<BullMQRedisConnectionOptions> = {},
): BullMQRedisConnectionOptions {
  const baseConfig = process.env.REDIS_URL
    ? buildConnectionFromUrl(process.env.REDIS_URL)
    : buildConnectionFromEnv();

  return {
    ...baseConfig,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    // BullMQ emits a warning for each Queue/Worker instance when this is false.
    // We run a centralized one-time runtime policy check from this package instead.
    skipVersionCheck: true,
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
  overrides: Partial<BullMQRedisConnectionOptions> = {},
): Redis {
  const options = getBullMQConnectionOptions(overrides);
  const connection = new Redis(options);

  // BullMQ reads skipVersionCheck from the shared connection object.
  (connection as Redis & { skipVersionCheck?: boolean }).skipVersionCheck =
    options.skipVersionCheck ?? true;

  return connection;
}

export const redisConnection = createRedisConnection();

void ensureRedisRuntimePolicy(redisConnection).catch(
  handleRuntimePolicyValidationError,
);

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
