// src/lib/queues/export.queue.ts
import { Queue, JobsOptions } from "bullmq";
import { createRedisConnection } from "./redis-connection";

export interface ExportJobData {
  exportId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
}

export const exportQueue = new Queue<ExportJobData>("gdpr-data-export", {
  connection: createRedisConnection() as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

// Named job types for better observability
export const JobNames = {
  PROCESS_EXPORT: "process-export",
  CLEANUP_EXPIRED: "cleanup-expired",
} as const;

export async function addExportJob(data: ExportJobData, opts?: JobsOptions) {
  return exportQueue.add(JobNames.PROCESS_EXPORT, data, {
    jobId: data.exportId, // Ensure unique job per exportId (idempotency)
    ...opts,
  });
}
