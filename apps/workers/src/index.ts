/* eslint-disable no-restricted-syntax -- bootstrap-only: Datadog APM initialization requires early bootstrap before module imports */
import tracer from "dd-trace";
tracer.init({
  service: "buildmarket-workers",
  env: process.env.DD_ENV,
  logInjection: true,
  site: process.env.DD_SITE, // e.g. "us5.datadoghq.com" — same site as everywhere else
  // DD_API_KEY is picked up automatically from the environment
});
/* eslint-enable no-restricted-syntax */

import { validateWorkerEnv } from "./env.js";
import { initOtel, shutdownOtel } from "./otel.js";
import { startHealthServer } from "./health.js";
import { processMaintenanceJob } from "./processors/maintenance.processor.js";
import { processNotificationRetryJob } from "./processors/notification.processor.js";
import { processDataExportJob } from "./processors/export.processor.js";
import { processIncidentJob } from "./processors/incident.processor.js";
import { processComplianceNotificationJob } from "./processors/compliance-notification.processor.js";
import {
  processConfirmationEmailJob,
  processEspSyncJob,
} from "./processors/newsletter.processor.js";
import { processImageUploadJob } from "./processors/upload.processor.js";
import { processLicenseVerificationJob } from "./processors/license-verification.processor.js";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import {
  getBullMQConnectionOptions,
  type MaintenanceJobData,
  type NotificationRetryJobData,
  type ExportJobData,
  type IncidentJobData,
  type UserNotificationJobData,
  type NewsletterConfirmationEmailJobData,
  type NewsletterEspSyncJobData,
  type ImageUploadProcessingJobData,
  type LicenseVerificationJobData,
} from "@build/queue-server";
import {
  createConsumer,
  type JetStreamConsumer,
  type MessagePayload,
} from "@build/nats";
import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

// 1. Fail-closed boot validation (P0: Must run before any socket initialization)
const env = validateWorkerEnv();

// 2. OpenTelemetry / Datadog APM instrumentation initialization
initOtel(env);

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
let isNatsConnected = false;
const activeWorkers: Worker[] = [];
let natsConsumer: JetStreamConsumer | null = null;
let licenseNatsConsumer: JetStreamConsumer | null = null;

// Global crash handlers.
process.on("uncaughtException", (err) => {
  logger.error(
    "[Fatal] Uncaught exception — terminating for orchestrator restart",
    err,
  );
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error(
    "[Fatal] Unhandled promise rejection — terminating for orchestrator restart",
    reason instanceof Error ? reason : new Error(String(reason)),
  );
  process.exit(1);
});

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

  // GDPR Data Export Worker
  const exportWorker = new Worker<ExportJobData>(
    "gdpr-data-export",
    async (job: Job<ExportJobData>) => {
      return CorrelationIdManager.run(
        job.id || CorrelationIdManager.generate(),
        async () => {
          return processDataExportJob(job);
        },
      );
    },
    {
      connection: redisConnectionOptions,
      concurrency: 2,
    },
  );

  exportWorker.on("failed", (job, err) => {
    logger.error(`[Worker:export] Job failed: ${job?.name}`, err, {
      jobId: job?.id,
      exportId: job?.data?.exportId,
    });
  });

  // Security Incident Worker
  const incidentWorker = new Worker<IncidentJobData>(
    "security-incidents",
    async (job: Job<IncidentJobData>) => {
      return CorrelationIdManager.run(
        job.id || CorrelationIdManager.generate(),
        async () => {
          return processIncidentJob(job);
        },
      );
    },
    {
      connection: redisConnectionOptions,
      concurrency: 2,
      limiter: {
        max: 10,
        duration: 60000,
      },
    },
  );

  incidentWorker.on("failed", (job, err) => {
    logger.error(`[Worker:incident] Job failed: ${job?.name}`, err, {
      jobId: job?.id,
      incidentId: job?.data?.incidentId,
    });
  });

  // Compliance User Notification Batch Worker
  const complianceNotificationWorker = new Worker<UserNotificationJobData>(
    "compliance-notifications",
    async (job: Job<UserNotificationJobData>) => {
      return CorrelationIdManager.run(
        job.id || CorrelationIdManager.generate(),
        async () => {
          return processComplianceNotificationJob(job);
        },
      );
    },
    {
      connection: redisConnectionOptions,
      concurrency: 2,
    },
  );

  complianceNotificationWorker.on("failed", (job, err) => {
    logger.error(`[Worker:compliance-notifications] Job failed`, err, {
      jobId: job?.id,
      incidentId: job?.data?.incidentId,
    });
  });

  // Newsletter Confirmation Email Worker
  const newsletterEmailWorker = new Worker<NewsletterConfirmationEmailJobData>(
    "newsletter-confirmation-email",
    async (job: Job<NewsletterConfirmationEmailJobData>) => {
      return CorrelationIdManager.run(
        job.id || CorrelationIdManager.generate(),
        async () => {
          return processConfirmationEmailJob(job);
        },
      );
    },
    {
      connection: redisConnectionOptions,
      concurrency: 5,
    },
  );

  newsletterEmailWorker.on("failed", (job, err) => {
    logger.error("[Worker:newsletter-confirmation-email] Job failed", err, {
      jobId: job?.id,
      subscriberId: job?.data?.subscriberId,
    });
  });

  // Newsletter ESP Sync Worker
  const newsletterEspSyncWorker = new Worker<NewsletterEspSyncJobData>(
    "newsletter-esp-sync",
    async (job: Job<NewsletterEspSyncJobData>) => {
      return CorrelationIdManager.run(
        job.id || CorrelationIdManager.generate(),
        async () => {
          return processEspSyncJob(job);
        },
      );
    },
    {
      connection: redisConnectionOptions,
      concurrency: 5,
    },
  );

  newsletterEspSyncWorker.on("failed", (job, err) => {
    logger.error("[Worker:newsletter-esp-sync] Job failed", err, {
      jobId: job?.id,
      subscriberId: job?.data?.subscriberId,
    });
  });

  // Upload Processing Worker
  const uploadProcessingWorker = new Worker<ImageUploadProcessingJobData>(
    "uploads-image-processing",
    async (job: Job<ImageUploadProcessingJobData>) => {
      return CorrelationIdManager.run(
        job.id || CorrelationIdManager.generate(),
        async () => {
          return processImageUploadJob(job);
        },
      );
    },
    {
      connection: redisConnectionOptions,
      concurrency: 2,
      limiter: {
        max: 20,
        duration: 60000,
      },
    },
  );

  uploadProcessingWorker.on("failed", (job, err) => {
    logger.error("[Worker:uploads-image-processing] Job failed", err, {
      jobId: job?.id,
      uploadId: job?.data?.uploadId,
    });
  });

  // License Verification Worker
  const licenseVerificationWorker = new Worker<LicenseVerificationJobData>(
    "license-verification",
    async (job: Job<LicenseVerificationJobData>) => {
      return CorrelationIdManager.run(
        job.id || CorrelationIdManager.generate(),
        async () => {
          return processLicenseVerificationJob(job);
        },
      );
    },
    {
      connection: redisConnectionOptions,
      concurrency: 5,
    },
  );

  licenseVerificationWorker.on("failed", (job, err) => {
    logger.error("[Worker:license-verification] Job failed", err, {
      jobId: job?.id,
      professionalId: job?.data?.professionalId,
    });
  });

  activeWorkers.push(
    maintenanceWorker,
    notificationWorker,
    exportWorker,
    incidentWorker,
    complianceNotificationWorker,
    newsletterEmailWorker,
    newsletterEspSyncWorker,
    uploadProcessingWorker,
    licenseVerificationWorker,
  );
}

// 4. Initialize NATS JetStream Durable Consumers
async function initializeNatsConsumer() {
  if (env.DISABLE_BACKGROUND_JOBS || !env.NATS_URL) {
    return;
  }

  try {
    // 1. Notification retry consumer group
    natsConsumer = createConsumer(
      "workers-daemon",
      "notification-retry-worker-group",
      {
        servers: env.NATS_URL,
      },
    );

    await natsConsumer.connect();
    isNatsConnected = true;
    logger.info(
      "[NATS] Connected and subscribed with durable consumer: notification-retry-worker-group",
    );

    // 2. License verification consumer group
    licenseNatsConsumer = createConsumer(
      "workers-license-daemon",
      "license-auto-verify-group",
      {
        servers: env.NATS_URL,
      },
    );
    await licenseNatsConsumer.connect();
    await licenseNatsConsumer.subscribe([
      {
        subject: "license.auto_verify_requested",
        consumerOptions: {
          durableName: "workers-license-auto-verify-worker",
        },
        handler: async (msg: MessagePayload) => {
          const event = msg.data as LicenseVerificationJobData;
          msg.working();
          await processLicenseVerificationJob({
            id: `nats-${Date.now()}`,
            data: event,
          } as Job<LicenseVerificationJobData>);
        },
      },
    ]);
    logger.info(
      "[NATS] Connected and subscribed with durable consumer: license-auto-verify-group",
    );
  } catch (err) {
    isNatsConnected = false;
    logger.error(
      "[NATS] Failed to initialize JetStream consumers",
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
  checkWorkers: () => {
    if (env.DISABLE_BACKGROUND_JOBS) return true;
    return (
      activeWorkers.length > 0 && activeWorkers.every((w) => w.isRunning())
    );
  },
  checkNats: () => {
    if (env.DISABLE_BACKGROUND_JOBS || !env.NATS_URL) return true;
    return isNatsConnected;
  },
  isShuttingDown: () => isShuttingDown,
});

// 6. Graceful Shutdown Traps
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error("Graceful shutdown timeout exceeded (30s). Forcing exit.");
    process.exit(1);
  }, 30000);

  try {
    // 1. Stop NATS consumers
    if (natsConsumer) {
      await natsConsumer.disconnect();
      logger.info("[NATS] JetStream retry consumer disconnected.");
    }
    if (licenseNatsConsumer) {
      await licenseNatsConsumer.disconnect();
      logger.info("[NATS] JetStream license consumer disconnected.");
    }

    // 2. Close BullMQ workers (drain active jobs)
    await Promise.all(activeWorkers.map((w) => w.close()));
    logger.info("[BullMQ] All workers closed gracefully.");

    // 3. Disconnect Redis
    await healthRedisClient.quit();

    // 4. Close health server last
    healthServer.close();

    // 5. Flush and terminate OpenTelemetry
    await shutdownOtel();

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
