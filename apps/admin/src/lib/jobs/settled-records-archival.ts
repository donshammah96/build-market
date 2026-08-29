// apps/admin/src/lib/jobs/settled-records-archival.ts
import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@/lib/queues/redis-connection";
import {
  prisma,
  TransactionStatus,
  RegulatorVerificationCaseStatus,
} from "@build/db";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { validateJobPayload } from "@/lib/queues/queue-registry";
import {
  jobAttemptCounter,
  jobDurationHistogram,
} from "@/lib/infrastructure/metrics";

const logger = new StructuredLogger("settled-records-archival-job");

// Configuration from environment variables
const ARCHIVAL_CRON_PATTERN =
  adminEnvConfig.SETTLED_ARCHIVAL_CRON ?? "0 4 1 * *"; // 4 AM on the 1st of every month
const ARCHIVAL_BATCH_SIZE = adminEnvConfig.SETTLED_ARCHIVAL_BATCH_SIZE ?? 250;
const ARCHIVAL_MAX_RETRIES = 3;
const RETENTION_DAYS = 180;

export const settledRecordsArchivalQueue = new Queue("maintenance-jobs", {
  connection: createRedisConnection() as any,
});

export interface ArchivalMetrics {
  mpesaFound: number;
  mpesaArchived: number;
  regulatorCasesFound: number;
  regulatorCasesArchived: number;
  errors: number;
  startTime: number;
  endTime?: number;
}

// Settled status definitions
const SETTLED_MPESA_STATUSES: TransactionStatus[] = [
  TransactionStatus.SUCCESS,
  TransactionStatus.FAILED,
  TransactionStatus.REVERSED,
  TransactionStatus.CANCELLED,
];

const SETTLED_REGULATOR_STATUSES: RegulatorVerificationCaseStatus[] = [
  RegulatorVerificationCaseStatus.APPROVED,
  RegulatorVerificationCaseStatus.REJECTED,
  RegulatorVerificationCaseStatus.EXPIRED,
  RegulatorVerificationCaseStatus.DEAD_LETTER,
];

/**
 * Schedule the monthly settled records archival job
 */
export async function scheduleSettledRecordsArchival(): Promise<void> {
  const correlationId = CorrelationIdManager.generate();

  try {
    await settledRecordsArchivalQueue.add(
      "archive-settled-records",
      {},
      {
        repeat: {
          pattern: ARCHIVAL_CRON_PATTERN,
        },
        jobId: "monthly-settled-records-archival",
        attempts: ARCHIVAL_MAX_RETRIES,
        backoff: {
          type: "exponential",
          delay: 60000,
        },
      },
    );

    logger.info("Settled records archival job scheduled successfully", {
      correlationId,
      cronPattern: ARCHIVAL_CRON_PATTERN,
      batchSize: ARCHIVAL_BATCH_SIZE,
      retentionDays: RETENTION_DAYS,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule settled records archival job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId },
    );
    throw error;
  }
}

/**
 * Archive settled MpesaTransaction records older than cutoffDate in batches
 */
async function archiveMpesaTransactions(
  cutoffDate: Date,
  correlationId: string,
  metrics: ArchivalMetrics,
): Promise<void> {
  while (true) {
    const batch = await prisma.mpesaTransaction.findMany({
      where: {
        status: { in: SETTLED_MPESA_STATUSES },
        createdAt: { lt: cutoffDate },
      },
      take: ARCHIVAL_BATCH_SIZE,
    });

    if (batch.length === 0) break;
    metrics.mpesaFound += batch.length;

    const ids = batch.map((item) => item.id);

    await prisma.$transaction(async (tx) => {
      await tx.mpesaTransactionArchive.createMany({
        data: batch.map((row) => ({
          id: row.id,
          merchantRequestId: row.merchantRequestId,
          checkoutRequestId: row.checkoutRequestId,
          idempotencyKey: row.idempotencyKey,
          userId: row.userId,
          projectId: row.projectId,
          escrowId: row.escrowId,
          transactionType: row.transactionType,
          amount: row.amount,
          phoneNumber: row.phoneNumber,
          status: row.status,
          resultCode: row.resultCode,
          resultDesc: row.resultDesc,
          mpesaReceiptNumber: row.mpesaReceiptNumber,
          transactionDate: row.transactionDate,
          callbackReceivedAt: row.callbackReceivedAt,
          callbackPayload: row.callbackPayload as any,
          reversalTransactionId: row.reversalTransactionId,
          isReversed: row.isReversed,
          retryCount: row.retryCount,
          nextRetryAt: row.nextRetryAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          archivedAt: new Date(),
        })),
      });

      await tx.mpesaTransaction.deleteMany({
        where: { id: { in: ids } },
      });
    });

    metrics.mpesaArchived += batch.length;

    logger.info("Archived MpesaTransaction batch", {
      correlationId,
      batchSize: batch.length,
      totalArchived: metrics.mpesaArchived,
    });

    if (batch.length < ARCHIVAL_BATCH_SIZE) break;
  }
}

/**
 * Archive settled RegulatorVerificationCase records older than cutoffDate in batches
 */
async function archiveRegulatorVerificationCases(
  cutoffDate: Date,
  correlationId: string,
  metrics: ArchivalMetrics,
): Promise<void> {
  while (true) {
    const batch = await prisma.regulatorVerificationCase.findMany({
      where: {
        status: { in: SETTLED_REGULATOR_STATUSES },
        createdAt: { lt: cutoffDate },
      },
      take: ARCHIVAL_BATCH_SIZE,
    });

    if (batch.length === 0) break;
    metrics.regulatorCasesFound += batch.length;

    const ids = batch.map((item) => item.id);

    await prisma.$transaction(async (tx) => {
      await tx.regulatorVerificationCaseArchive.createMany({
        data: batch.map((row) => ({
          id: row.id,
          professionalId: row.professionalId,
          licenseId: row.licenseId,
          authority: row.authority,
          licenseNumber: row.licenseNumber,
          dedupeKey: row.dedupeKey,
          status: row.status,
          attempts: row.attempts,
          maxAttempts: row.maxAttempts,
          nextAttemptAt: row.nextAttemptAt,
          deadLetteredAt: row.deadLetteredAt,
          deadLetterReason: row.deadLetterReason,
          confidence: row.confidence,
          confidenceReasons: row.confidenceReasons as any,
          confidenceAlgorithmVersion: row.confidenceAlgorithmVersion,
          confidenceBreakdown: row.confidenceBreakdown as any,
          evidence: row.evidence as any,
          retryable: row.retryable,
          retryAfterSeconds: row.retryAfterSeconds,
          manualFallbackReason: row.manualFallbackReason,
          correlationId: row.correlationId,
          requestedAt: row.requestedAt,
          completedAt: row.completedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          archivedAt: new Date(),
        })),
      });

      await tx.regulatorVerificationCase.deleteMany({
        where: { id: { in: ids } },
      });
    });

    metrics.regulatorCasesArchived += batch.length;

    logger.info("Archived RegulatorVerificationCase batch", {
      correlationId,
      batchSize: batch.length,
      totalArchived: metrics.regulatorCasesArchived,
    });

    if (batch.length < ARCHIVAL_BATCH_SIZE) break;
  }
}

/**
 * Execute the settled records archival processing
 */
export async function processSettledRecordsArchival(
  correlationId: string = CorrelationIdManager.generate(),
): Promise<ArchivalMetrics> {
  const startTime = Date.now();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  const metrics: ArchivalMetrics = {
    mpesaFound: 0,
    mpesaArchived: 0,
    regulatorCasesFound: 0,
    regulatorCasesArchived: 0,
    errors: 0,
    startTime,
  };

  logger.info("Starting monthly settled records archival scan", {
    correlationId,
    cutoffDate: cutoffDate.toISOString(),
    retentionDays: RETENTION_DAYS,
  });

  try {
    await archiveMpesaTransactions(cutoffDate, correlationId, metrics);
    await archiveRegulatorVerificationCases(cutoffDate, correlationId, metrics);

    metrics.endTime = Date.now();
    const duration = metrics.endTime - startTime;

    logger.info("Settled records archival completed successfully", {
      correlationId,
      mpesaArchived: metrics.mpesaArchived,
      regulatorCasesArchived: metrics.regulatorCasesArchived,
      durationMs: duration,
    });

    return metrics;
  } catch (error) {
    metrics.errors++;
    metrics.endTime = Date.now();

    logger.error(
      "Settled records archival failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        metrics,
      },
    );

    throw error;
  }
}

/**
 * Create the worker for processing settled records archival jobs
 */
export function createSettledRecordsArchivalWorker(): Worker {
  const worker = new Worker(
    "maintenance-jobs",
    async (job: Job) => {
      validateJobPayload("maintenance-jobs", job.name, job.data);
      if (job.name !== "archive-settled-records") {
        return;
      }

      const correlationId =
        (job.data?.correlationId as string) || CorrelationIdManager.generate();
      const startTime = Date.now();

      jobAttemptCounter.add(1, {
        jobName: "archive-settled-records",
        status: "started",
      });

      try {
        const metrics = await processSettledRecordsArchival(correlationId);

        jobAttemptCounter.add(1, {
          jobName: "archive-settled-records",
          status: "completed",
        });

        jobDurationHistogram.record((Date.now() - startTime) / 1000, {
          jobName: "archive-settled-records",
          status: "completed",
        });

        return metrics;
      } catch (error) {
        jobAttemptCounter.add(1, {
          jobName: "archive-settled-records",
          status: "failed",
        });

        jobDurationHistogram.record((Date.now() - startTime) / 1000, {
          jobName: "archive-settled-records",
          status: "failed",
        });

        throw error;
      }
    },
    {
      connection: createRedisConnection() as any,
      concurrency: 1, // Single worker concurrency for maintenance archival
    },
  );

  worker.on("completed", (job: Job) => {
    logger.info("Settled records archival job finished", {
      jobId: job.id,
      returnValue: job.returnvalue,
    });
  });

  worker.on("failed", (job: Job | undefined, error: Error) => {
    logger.error("Settled records archival job failed", error, {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
    });
  });

  return worker;
}
