import { validateWorkerEnv } from "./env.js";
import { startHealthServer } from "./health.js";
import { processMaintenanceJob } from "./processors/maintenance.processor.js";
import { processNotificationRetryJob } from "./processors/notification.processor.js";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import {
  getBullMQConnectionOptions,
  type MaintenanceJobData,
  type NotificationRetryJobData,
} from "@build/queue-server";
import { createConsumer, type JetStreamConsumer } from "@build/nats";
import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

// 1. Fail-closed boot validation (P0: Must run before any socket initialization)
const env = validateWorkerEnv();

const logger = new StructuredLogger("workers-daemon");
logger.info("Starting BuildMarket background worker daemon...", {
  nodeEnv: env.NODE_ENV,
  dbPoolMax: env.DB_POOL_MAX,
});

if (env.DISABLE_BACKGROUND_JOBS) {
  logger.warn(
    "DISABLE_BACKGROUND_JOBS is enabled — worker processing will remain dormant.",
  );
}

// 2. Redis connection check probe
const redisConnectionOptions = getBullMQConnectionOptions();
const healthRedisClient = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

let isShuttingDown = false;
const activeWorkers: Worker[] = [];
let natsConsumer: JetStreamConsumer | null = null;

// 3. Initialize BullMQ Workers
function initializeBullMqWorkers() {
  if (env.DISABLE_BACKGROUND_JOBS) {
    return;
  }

  // Maintenance & GDPR Queues Worker
  const maintenanceWorker = new Worker<MaintenanceJobData>(
    "maintenance-jobs",
    async (job: Job<MaintenanceJobData>) => {
      return CorrelationIdManager.run(
        job.id || CorrelationIdManager.generate(),
        async () => {
          return processMaintenanceJob(job);
        },
      );
    },
    {
      connection: redisConnectionOptions,
      concurrency: 5,
    },
  );

  maintenanceWorker.on("failed", (job, err) => {
    logger.error(`[Worker:maintenance] Job failed: ${job?.name}`, err, {
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade: job?.attemptsMade,
    });
  });

  maintenanceWorker.on("completed", (job) => {
    logger.info(`[Worker:maintenance] Job completed: ${job.name}`, {
      jobId: job.id,
      jobName: job.name,
    });
  });

  // Notification Retry Worker
  const notificationWorker = new Worker<NotificationRetryJobData>(
    "notification-retries",
    async (job: Job<NotificationRetryJobData>) => {
      return CorrelationIdManager.run(
        job.id || CorrelationIdManager.generate(),
        async () => {
          return processNotificationRetryJob(job);
        },
      );
    },
    {
      connection: redisConnectionOptions,
      concurrency: 5,
    },
  );

  notificationWorker.on("failed", (job, err) => {
    logger.error("[Worker:notifications] Job failed", err, {
      jobId: job?.id,
    });
  });

  activeWorkers.push(maintenanceWorker, notificationWorker);
}

// 4. Initialize NATS JetStream Durable Consumer (P1)
async function initializeNatsConsumer() {
  if (env.DISABLE_BACKGROUND_JOBS || !env.NATS_URL) {
    return;
  }

  try {
    // Durable consumer group matching contract
    natsConsumer = createConsumer(
      "workers-daemon",
      "notification-retry-worker-group",
      {
        servers: env.NATS_URL,
      },
    );

    await natsConsumer.connect();
    logger.info(
      "[NATS] Connected and subscribed with durable consumer: notification-retry-worker-group",
    );
  } catch (err) {
    logger.error(
      "[NATS] Failed to initialize JetStream consumer",
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}

// 5. Start Healthcheck Server (P1: Port 8080)
const healthServer = startHealthServer({
  port: env.HEALTH_PORT,
  checkRedis: async () => {
    try {
      if (
        healthRedisClient.status !== "ready" &&
        healthRedisClient.status !== "connecting"
      ) {
        await healthRedisClient.connect();
      }
      const pong = await healthRedisClient.ping();
      return pong === "PONG";
    } catch {
      return false;
    }
  },
  isShuttingDown: () => isShuttingDown,
});

// 6. Graceful Shutdown Traps
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  // Allow up to 30 seconds for active jobs to complete
  const shutdownTimeout = setTimeout(() => {
    logger.error("Graceful shutdown timeout exceeded (30s). Forcing exit.");
    process.exit(1);
  }, 30000);

  try {
    // 1. Close health server
    healthServer.close();

    // 2. Stop NATS consumer
    if (natsConsumer) {
      await natsConsumer.disconnect();
      logger.info("[NATS] JetStream consumer disconnected.");
    }

    // 3. Close BullMQ workers (drain active jobs)
    await Promise.all(activeWorkers.map((w) => w.close()));
    logger.info("[BullMQ] All workers closed gracefully.");

    // 4. Disconnect Redis
    await healthRedisClient.quit();

    clearTimeout(shutdownTimeout);
    logger.info("Graceful shutdown complete.");
    process.exit(0);
  } catch (err) {
    logger.error(
      "Error during graceful shutdown",
      err instanceof Error ? err : new Error(String(err)),
    );
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start services
initializeBullMqWorkers();
void initializeNatsConsumer();
