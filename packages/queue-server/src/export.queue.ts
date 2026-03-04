import { Queue, JobsOptions } from "bullmq";
import { redisConnection } from "./redis-connection";

export interface ExportJobData {
  exportId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
}

export const exportQueue = new Queue<ExportJobData>("gdpr-data-export", {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export const JobNames = {
  PROCESS_EXPORT: "process-export",
  CLEANUP_EXPIRED: "cleanup-expired",
} as const;

export async function addExportJob(data: ExportJobData, opts?: JobsOptions) {
  return exportQueue.add(JobNames.PROCESS_EXPORT, data, {
    jobId: data.exportId,
    ...opts,
  });
}
