import { Queue, type JobsOptions } from "bullmq";
import { getQueueConnectionOptions } from "./backend.js";
import { QueueRetentionPolicies } from "./retention.js";
import type { LicenseAuthority, Profession } from "@prisma/client";

export interface LicenseVerificationJobData {
  professionalId: string;
  licenseId?: string | null;
  profession?: Profession | null;
  authority: LicenseAuthority;
  licenseNumber: string;
  submittedName?: string | null;
  companyName?: string | null;
  correlationId?: string | null;
  requestedAt?: Date | string;
}

export const LICENSE_VERIFICATION_QUEUE_NAME = "license-verification";
export const LICENSE_VERIFICATION_MAX_ATTEMPTS = 5;

let licenseVerificationQueueInstance: Queue<LicenseVerificationJobData> | null =
  null;

export function getLicenseVerificationQueue(): Queue<LicenseVerificationJobData> {
  if (!licenseVerificationQueueInstance) {
    licenseVerificationQueueInstance = new Queue<LicenseVerificationJobData>(
      LICENSE_VERIFICATION_QUEUE_NAME,
      {
        connection: getQueueConnectionOptions(LICENSE_VERIFICATION_QUEUE_NAME),
        defaultJobOptions: {
          attempts: LICENSE_VERIFICATION_MAX_ATTEMPTS,
          backoff: { type: "exponential", delay: 5_000 },
          ...QueueRetentionPolicies.FINANCIAL_AUDIT,
        },
      },
    );
  }
  return licenseVerificationQueueInstance;
}

export async function addLicenseVerificationJob(
  data: LicenseVerificationJobData,
  opts?: JobsOptions,
) {
  const queue = getLicenseVerificationQueue();
  const jobId = `${data.authority}:${data.licenseNumber}:${data.professionalId}`;
  return queue.add("verify-license", data, {
    jobId,
    ...opts,
  });
}
