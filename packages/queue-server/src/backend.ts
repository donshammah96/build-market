import { createRedisConnection } from "@build/redis/tcp";
import type { ConnectionOptions } from "bullmq";

export type QueueBackendType = "postgres" | "redis";

export interface PostgresQueueConnectionConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  schema?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  max?: number;
}

/**
 * Normalizes a queue name to its uppercase environment flag suffix.
 * Example: "maintenance-jobs" -> "MAINTENANCE_JOBS"
 */
export function normalizeQueueEnvKey(queueName: string): string {
  return queueName.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

/**
 * Resolves the queue backend type for a specific queue.
 * Prioritizes granular per-queue environment variables (e.g. QUEUE_BACKEND_MAINTENANCE_JOBS)
 * before falling back to the global QUEUE_BACKEND variable. Default is "redis".
 */
export function getQueueBackendType(queueName: string): QueueBackendType {
  const envSuffix = normalizeQueueEnvKey(queueName);
  const specificEnv = process.env[`QUEUE_BACKEND_${envSuffix}`]
    ?.trim()
    ?.toLowerCase();
  if (specificEnv?.startsWith("postgres") || specificEnv === "redis") {
    return specificEnv.startsWith("postgres") ? "postgres" : "redis";
  }

  const globalEnv = process.env.QUEUE_BACKEND?.trim()?.toLowerCase();
  if (globalEnv?.startsWith("postgres") || globalEnv === "redis") {
    return globalEnv.startsWith("postgres") ? "postgres" : "redis";
  }

  return "redis";
}

/**
 * Validates that a PostgreSQL connection string for BullMQ does not target a transaction-mode pooler.
 * BullMQ requires session-level LISTEN/NOTIFY and advisory locks, which break behind port 6543 / transaction poolers.
 */
export function validatePostgresQueueDatabaseUrl(url?: string): void {
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (
      parsed.port === "6543" ||
      parsed.searchParams.get("pgbouncer") === "true"
    ) {
      throw new Error(
        `[BullMQ Postgres] Transaction-mode pooler detected on port 6543 or with pgbouncer=true. ` +
          `BullMQ requires session-level LISTEN/NOTIFY and advisory locks, which silently break behind transaction-mode poolers. ` +
          `Please use a direct connection or Session Pooler (port 5432) via QUEUE_DATABASE_URL or DATABASE_URL.`,
      );
    }
  } catch (err: any) {
    if (err.message?.includes("[BullMQ Postgres]")) throw err;
  }
}

/**
 * Builds PostgreSQL connection options scoped to the dedicated "bullmq" schema.
 * Enforces explicit TLS rejection in production and configurable pool sizes per queue.
 */
export function getPostgresQueueConnectionOptions(
  queueName?: string,
): PostgresQueueConnectionConfig {
  const isProd = process.env.NODE_ENV === "production";
  const databaseUrl =
    process.env.QUEUE_DATABASE_URL ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL;

  validatePostgresQueueDatabaseUrl(databaseUrl);

  let maxPool = 3;
  if (queueName) {
    const envSuffix = normalizeQueueEnvKey(queueName);
    const specificPool = process.env[`QUEUE_POOL_MAX_${envSuffix}`];
    if (specificPool && !Number.isNaN(Number(specificPool))) {
      maxPool = Math.max(1, Number(specificPool));
    } else if (
      process.env.QUEUE_POOL_MAX &&
      !Number.isNaN(Number(process.env.QUEUE_POOL_MAX))
    ) {
      maxPool = Math.max(1, Number(process.env.QUEUE_POOL_MAX));
    }
  } else if (
    process.env.QUEUE_POOL_MAX &&
    !Number.isNaN(Number(process.env.QUEUE_POOL_MAX))
  ) {
    maxPool = Math.max(1, Number(process.env.QUEUE_POOL_MAX));
  }

  return {
    connectionString: databaseUrl,
    schema: "bullmq",
    ssl: isProd ? { rejectUnauthorized: true } : undefined,
    max: maxPool,
  };
}

/**
 * Returns the appropriate connection options for BullMQ Queue and Worker instances.
 * BullMQ v5 is an ioredis-driven queue runner; connection options must provide
 * valid Redis TCP options (from REDIS_URL).
 */
export function getQueueConnectionOptions(
  _queueName?: string,
): ConnectionOptions {
  return createRedisConnection() as unknown as ConnectionOptions;
}
