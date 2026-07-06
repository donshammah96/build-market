import { Queue, type JobsOptions } from "bullmq";
import { createRedisConnection } from "@build/redis/tcp";

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
 * BullMQ requires a dedicated ioredis connection per Queue instance.
 * Do not share this connection with Workers or other Queues.
 */
export const exportQueue = new Queue<ExportJobData, unknown, ExportJobName>(
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

export async function addExportJob(data: ExportJobData, opts?: JobsOptions) {
  return exportQueue.add(JobNames.PROCESS_EXPORT, data, {
    jobId: data.exportId,
    ...opts,
  });
}
