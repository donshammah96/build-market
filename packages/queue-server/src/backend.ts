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
 * Builds PostgreSQL connection options scoped to the dedicated "bullmq" schema.
 * Enforces explicit TLS rejection in production and bounds pool sizes.
 */
export function getPostgresQueueConnectionOptions(
  _queueName?: string,
): PostgresQueueConnectionConfig {
  const isProd = process.env.NODE_ENV === "production";
  const databaseUrl = process.env.DATABASE_URL;

  return {
    connectionString: databaseUrl,
    schema: "bullmq",
    ssl: isProd ? { rejectUnauthorized: true } : undefined,
    max: 3, // Bounded client pool per queue backend instance
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
