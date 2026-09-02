import { Queue, type JobsOptions } from "bullmq";
import { getQueueConnectionOptions } from "./backend.js";
import { QueueRetentionPolicies } from "./retention.js";

export const MaintenanceJobNames = {
  CLEANUP_EXPIRED_EXPORTS: "cleanup-expired-exports",
  DATA_RETENTION_ENFORCEMENT: "data-retention-enforcement",
  ANONYMIZATION_BATCH: "anonymization-batch",
  ASSET_CLEANUP: "asset-cleanup",
  ONBOARDING_UPLOAD_CLEANUP: "onboarding-upload-cleanup",
  NEWSLETTER_SWEEP: "newsletter-sweep",
  LICENSE_EXPIRY: "license-expiry",
  GDPR_ERASURE: "gdpr-erasure",
  ARCHIVE_SETTLED_RECORDS: "archive-settled-records",
} as const;

export type MaintenanceJobName =
  (typeof MaintenanceJobNames)[keyof typeof MaintenanceJobNames];

export interface MaintenanceJobData {
  name: MaintenanceJobName;
  timestamp?: string;
  triggeredBy?: string;
  batchSize?: number;
  metadata?: Record<string, unknown>;
}

let maintenanceQueueInstance: Queue<
  MaintenanceJobData,
  unknown,
  MaintenanceJobName
> | null = null;

/**
 * Returns the singleton BullMQ Queue instance for maintenance jobs.
 * Used by producers in API routes and scheduler functions to enqueue jobs.
 */
export function getMaintenanceQueue(): Queue<
  MaintenanceJobData,
  unknown,
  MaintenanceJobName
> {
  if (!maintenanceQueueInstance) {
    maintenanceQueueInstance = new Queue<
      MaintenanceJobData,
      unknown,
      MaintenanceJobName
    >("maintenance-jobs", {
      connection: getQueueConnectionOptions("maintenance-jobs"),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        ...QueueRetentionPolicies.STANDARD,
      },
    });
  }
  return maintenanceQueueInstance;
}

export async function addMaintenanceJob(
  name: MaintenanceJobName,
  data: Partial<MaintenanceJobData> = {},
  opts?: JobsOptions,
) {
  const queue = getMaintenanceQueue();
  return queue.add(
    name,
    {
      name,
      timestamp: new Date().toISOString(),
      ...data,
    },
    opts,
  );
}
