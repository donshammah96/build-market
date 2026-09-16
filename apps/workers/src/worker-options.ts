import {
  getQueueBackendType,
  getQueueConnectionOptions,
  normalizeQueueEnvKey,
} from "@build/queue-server";

export interface WorkerOptionsLogger {
  info: (msg: string, ctx?: Record<string, unknown>) => void;
  error: (msg: string, err?: Error, ctx?: Record<string, unknown>) => void;
}

export interface WorkerLimiterConfig {
  max: number;
  duration: number;
}

/**
 * Resolves BullMQ Worker configuration options safely with diagnostic logging and fail-closed validation.
 * Emits actionable remediation instructions if an unsupported backend (e.g. PostgreSQL in BullMQ v5) is configured.
 */
export function resolveWorkerOptions(
  queueName: string,
  concurrency: number = 5,
  limiter?: WorkerLimiterConfig,
  logger?: WorkerOptionsLogger,
) {
  const backend = getQueueBackendType(queueName);
  logger?.info(
    `[Worker:${queueName}] Initializing worker with backend: ${backend}`,
    {
      queueName,
      backend,
      concurrency,
    },
  );

  try {
    return {
      connection: getQueueConnectionOptions(queueName) as any,
      stalledInterval: 300_000,
      drainDelay: 30,
      concurrency,
      ...(limiter ? { limiter } : {}),
    };
  } catch (err) {
    const envSuffix = normalizeQueueEnvKey(queueName);
    logger?.error(
      `[Fatal] Failed to configure connection options for worker queue "${queueName}". ` +
        `Remediation: BullMQ v5 strictly requires Redis (REDIS_URL). If QUEUE_BACKEND=postgres or ` +
        `QUEUE_BACKEND_${envSuffix}=postgres is set in your environment (e.g. Render Dashboard), revert it to "redis". ` +
        `PostgreSQL queue backend migration is deferred until BullMQ v6 (see apps/workers/docs/adr/adr-bullmq-nats-queue-split.md).`,
      err instanceof Error ? err : new Error(String(err)),
      {
        queueName,
        backend,
        envVarName: `QUEUE_BACKEND_${envSuffix}`,
        remediation: `Set QUEUE_BACKEND=redis and remove QUEUE_BACKEND_${envSuffix}`,
      },
    );
    throw err;
  }
}
