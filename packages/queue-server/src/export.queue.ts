import { Queue, type JobsOptions } from "bullmq";
import { getQueueConnectionOptions } from "./backend.js";
import { QueueRetentionPolicies } from "./retention.js";

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

export type ExportJobName = (typeof JobNames)[keyof typeof JobNames];

let exportQueueInstance: Queue<ExportJobData, unknown, ExportJobName> | null =
  null;

export function getExportQueue(): Queue<ExportJobData, unknown, ExportJobName> {
  if (!exportQueueInstance) {
    exportQueueInstance = new Queue<ExportJobData, unknown, ExportJobName>(
      "gdpr-data-export",
      {
        connection: getQueueConnectionOptions("gdpr-data-export"),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          ...QueueRetentionPolicies.STANDARD,
        },
      },
    );
  }
  return exportQueueInstance;
}

/**
 * Proxy for backward compatibility with direct exportQueue access
 */
export const exportQueue = new Proxy(
  {} as Queue<ExportJobData, unknown, ExportJobName>,
  {
    get(_target, prop, receiver) {
      const queue = getExportQueue();
      const value = Reflect.get(queue, prop, receiver);
      return typeof value === "function" ? value.bind(queue) : value;
    },
  },
);

export async function addExportJob(data: ExportJobData, opts?: JobsOptions) {
  const queue = getExportQueue();
  return queue.add(JobNames.PROCESS_EXPORT, data, {
    jobId: data.exportId,
    ...opts,
  });
}
