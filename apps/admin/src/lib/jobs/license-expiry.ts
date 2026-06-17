// apps/admin/src/lib/jobs/license-expiry.ts
import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@/lib/queues/redis-connection";
import { prisma } from "@build/db";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { createAuditLog } from "@/lib/domains/verification/internal/audit-service";
import { createProducer } from "@build/nats";

const logger = new StructuredLogger("license-expiry-job");

// Configuration from environment variables
const EXPIRY_CRON_PATTERN = adminEnvConfig.LICENSE_EXPIRY_CRON ?? "0 1 * * *"; // Default: 1 AM daily
const EXPIRY_BATCH_SIZE = adminEnvConfig.LICENSE_EXPIRY_BATCH_SIZE ?? 100;
const EXPIRY_MAX_RETRIES = 3;

export const licenseExpiryQueue = new Queue("maintenance-jobs", {
  connection: createRedisConnection() as any,
});

const expiryQueue = licenseExpiryQueue;

interface ExpiryMetrics {
  expiredFound: number;
  expiredSuccess: number;
  expiredFailure: number;
  warningsSent: number;
  startTime: number;
  endTime?: number;
}

let natsProducer: any = null;

async function publishLicenseEvent(event: any) {
  try {
    if (!adminEnvConfig.NATS_URL && !adminEnvConfig.DATABASE_URL) {
      // In CI or test environments without NATS
      logger.info("NATS URL not configured, skipping event publication", {
        event,
      });
      return;
    }
    if (!natsProducer) {
      natsProducer = createProducer("license-expiry-job");
      await natsProducer.connect();
    }
    const subject = `license.${event.action}`;
    await natsProducer.publishWithRetry(subject, event, {
      msgId: `license-expiry-${event.licenseId}-${event.action}-${Date.now()}`,
      maxRetries: 3,
    });
  } catch (err) {
    logger.error(
      "Failed to publish license expiry event to NATS",
      err as Error,
      {
        licenseId: event.licenseId,
        action: event.action,
      },
    );
  }
}

export async function scheduleLicenseExpiry() {
  const correlationId = CorrelationIdManager.generate();

  try {
    await expiryQueue.add(
      "expire-pending-licenses",
      {},
      {
        repeat: {
          pattern: EXPIRY_CRON_PATTERN,
        },
        jobId: "daily-license-expiry", // Ensure only one scheduled job exists
        attempts: EXPIRY_MAX_RETRIES,
        backoff: {
          type: "exponential",
          delay: 60000,
        },
      },
    );

    logger.info("License expiry job scheduled successfully", {
      correlationId,
      cronPattern: EXPIRY_CRON_PATTERN,
      batchSize: EXPIRY_BATCH_SIZE,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule license expiry job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId },
    );
    throw error;
  }
}

export function createLicenseExpiryWorker() {
  const worker = new Worker(
    "maintenance-jobs",
    async (job: Job) => {
      if (job.name !== "expire-pending-licenses") {
        logger.warn("Received unexpected job type", {
          jobName: job.name,
          jobId: job.id,
        });
        return;
      }

      const correlationId = CorrelationIdManager.generate();
      CorrelationIdManager.set(correlationId);

      const metrics: ExpiryMetrics = {
        expiredFound: 0,
        expiredSuccess: 0,
        expiredFailure: 0,
        warningsSent: 0,
        startTime: Date.now(),
      };

      logger.info("Starting license expiry job", {
        correlationId,
        jobId: job.id,
        batchSize: EXPIRY_BATCH_SIZE,
      });

      try {
        // 1. Process EXPIRED licenses (VERIFIED with past validUntil)
        const expiredLicenses = await prisma.professionalLicense.findMany({
          where: {
            status: "VERIFIED",
            validUntil: { lt: new Date(), not: null },
          },
          take: EXPIRY_BATCH_SIZE,
          select: {
            id: true,
            professionalId: true,
            authority: true,
            licenseNumber: true,
            validUntil: true,
          },
        });

        metrics.expiredFound = expiredLicenses.length;

        logger.info("Found expired licenses to transition", {
          correlationId,
          count: expiredLicenses.length,
        });

        for (const license of expiredLicenses) {
          try {
            // Update status to EXPIRED
            await prisma.professionalLicense.update({
              where: { id: license.id },
              data: {
                status: "EXPIRED",
                verificationMethod: "SYSTEM",
              },
            });

            // Create system audit log
            await createAuditLog({
              adminId: "SYSTEM",
              action: "EXPIRE_LICENSE",
              entityType: "ProfessionalLicense",
              entityId: license.id,
              oldStatus: "VERIFIED",
              newStatus: "EXPIRED",
              metadata: {
                authority: license.authority,
                licenseNumber: license.licenseNumber,
                validUntil: license.validUntil?.toISOString(),
                correlationId,
              },
            });

            // Publish NATS event
            await publishLicenseEvent({
              licenseId: license.id,
              professionalId: license.professionalId,
              authority: license.authority,
              licenseNumber: license.licenseNumber,
              previousStatus: "VERIFIED",
              newStatus: "EXPIRED",
              action: "expired",
              verificationMethod: "SYSTEM",
              correlationId,
              timestamp: new Date().toISOString(),
              validUntil: license.validUntil?.toISOString(),
            });

            metrics.expiredSuccess++;
          } catch (error) {
            metrics.expiredFailure++;
            logger.error(
              "Failed to transition expired license",
              error as Error,
              {
                correlationId,
                licenseId: license.id,
              },
            );
          }
        }

        // 2. Process EXPIRING_SOON warning licenses (VERIFIED with validUntil in <= 30 days)
        const thirtyDaysFromNow = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        );
        const expiringSoonLicenses = await prisma.professionalLicense.findMany({
          where: {
            status: "VERIFIED",
            validUntil: {
              gte: new Date(),
              lte: thirtyDaysFromNow,
            },
          },
          take: EXPIRY_BATCH_SIZE,
          select: {
            id: true,
            professionalId: true,
            authority: true,
            licenseNumber: true,
            validUntil: true,
          },
        });

        logger.info("Found licenses expiring soon to warning-check", {
          correlationId,
          count: expiringSoonLicenses.length,
        });

        for (const license of expiringSoonLicenses) {
          try {
            // Check if we already logged WARN_LICENSE_EXPIRY in last 30 days for this license
            const alreadyWarned = await prisma.adminAuditLog.findFirst({
              where: {
                targetType: "ProfessionalLicense",
                targetId: license.id,
                action: "WARN_LICENSE_EXPIRY",
                createdAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
            });

            if (!alreadyWarned) {
              // Log warning to audit log
              await createAuditLog({
                adminId: "SYSTEM",
                action: "WARN_LICENSE_EXPIRY",
                entityType: "ProfessionalLicense",
                entityId: license.id,
                oldStatus: "VERIFIED",
                newStatus: "VERIFIED",
                reason: "License is expiring in less than 30 days",
                metadata: {
                  authority: license.authority,
                  licenseNumber: license.licenseNumber,
                  validUntil: license.validUntil?.toISOString(),
                  correlationId,
                },
              });

              // Publish NATS event
              await publishLicenseEvent({
                licenseId: license.id,
                professionalId: license.professionalId,
                authority: license.authority,
                licenseNumber: license.licenseNumber,
                previousStatus: "VERIFIED",
                newStatus: "VERIFIED",
                action: "expiring_soon",
                verificationMethod: "SYSTEM",
                correlationId,
                timestamp: new Date().toISOString(),
                validUntil: license.validUntil?.toISOString(),
              });

              metrics.warningsSent++;
            }
          } catch (error) {
            logger.error(
              "Failed to process warning for license expiring soon",
              error as Error,
              {
                correlationId,
                licenseId: license.id,
              },
            );
          }
        }

        metrics.endTime = Date.now();
        const durationMs = metrics.endTime - metrics.startTime;

        logger.info("License expiry job completed", {
          correlationId,
          jobId: job.id,
          metrics: {
            ...metrics,
            durationMs,
            durationSeconds: Math.round(durationMs / 1000),
          },
        });

        return metrics;
      } catch (error) {
        metrics.endTime = Date.now();
        logger.error(
          "License expiry job failed",
          error instanceof Error ? error : new Error(String(error)),
          {
            correlationId,
            jobId: job.id,
            metrics,
          },
        );
        throw error;
      }
    },
    {
      connection: createRedisConnection() as any,
      concurrency: 1,
      limiter: {
        max: 1,
        duration: 60000,
      },
    },
  );

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(
      "Received shutdown signal, closing license-expiry worker gracefully",
      {
        signal,
      },
    );
    try {
      await worker.close();
      logger.info("License-expiry worker closed successfully");
    } catch (error) {
      logger.error("Error during worker shutdown", error as Error);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  worker.on("completed", (job: Job, result: unknown) => {
    logger.info("License expiry job completed", {
      jobId: job.id,
      result,
    });
  });

  worker.on("failed", (job: Job | undefined, error: Error) => {
    logger.error("License expiry job failed", error, {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on("error", (error: Error) => {
    logger.error("License expiry worker error occurred", error);
  });

  return worker;
}
