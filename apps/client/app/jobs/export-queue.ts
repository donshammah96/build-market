import { Queue, type JobsOptions } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { env, envConfig } from "@/app/lib/infrastructure/env";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";

const logger = new StructuredLogger("export-queue");
const OPERATION_NAME = "export_queue_manager";

export interface ExportJobData {
  exportId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
}

export const JobNames = {
  PROCESS_EXPORT: "process-export",
  CLEANUP_EXPIRED: "cleanup-expired",
} as const;

type ExportJobName = (typeof JobNames)[keyof typeof JobNames];

/**
 * Singleton instance of the queue.
 * DO NOT export this directly to prevent eager instantiation.
 */
let exportQueueInstance: Queue<ExportJobData, unknown, ExportJobName> | null =
  null;

/**
 * Lazy initialization getter for the BullMQ Queue.
 * Safely handles Next.js build phases and CI environments without Redis.
 */
export function getExportQueue(): Queue<ExportJobData, unknown, ExportJobName> {
  // Guard 1: Next.js static build phase
  if (env.isBuildPhase) {
    return {
      add: async (name: string, data: any, opts: any) => {
        logger.warn("Export queue add bypassed during build phase", {
          operationName: OPERATION_NAME,
          jobName: name,
        });
        return undefined;
      },
      close: async () => undefined,
    } as unknown as Queue<ExportJobData, unknown, ExportJobName>;
  }

  // Guard 2: Belt-and-suspenders for CI or local dev without Redis
  if (!envConfig.redis.url || envConfig.jobs.disableBackgroundJobs) {
    return {
      add: async (name: string, data: any, opts: any) => {
        logger.warn("Background jobs disabled: Export job bypassed", {
          operationName: OPERATION_NAME,
          jobName: name,
        });
        return undefined;
      },
      close: async () => undefined,
    } as unknown as Queue<ExportJobData, unknown, ExportJobName>;
  }

  // Guard 3: Lazy instantiation (Singleton)
  if (!exportQueueInstance) {
    logger.info("Initializing export queue connection", {
      operationName: OPERATION_NAME,
    });

    exportQueueInstance = new Queue<ExportJobData, unknown, ExportJobName>(
      "gdpr-data-export",
      {
        connection: createRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: 24 * 3600, count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600 },
        },
      },
    );
  }

  return exportQueueInstance;
}

export async function addExportJob(data: ExportJobData, opts?: JobsOptions) {
  // Fetch existing context ID or generate a new one if this is the boundary
  const correlationId =
    CorrelationIdManager.get() || CorrelationIdManager.generate();

  logger.info("Adding export job to queue", {
    correlationId,
    operationName: OPERATION_NAME,
    exportId: data.exportId,
  });

  try {
    // Always fetch the queue instance via the safe getter
    const queue = getExportQueue();

    const job = await queue.add(JobNames.PROCESS_EXPORT, data, {
      jobId: data.exportId,
      ...opts,
    });

    logger.info("Export job added successfully", {
      correlationId,
      operationName: OPERATION_NAME,
      exportId: data.exportId,
      bullmqJobId: job?.id,
    });

    return job;
  } catch (error) {
    logger.error(
      "Failed to add export job to queue",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        operationName: OPERATION_NAME,
        exportId: data.exportId,
      },
    );
    throw error;
  }
}
