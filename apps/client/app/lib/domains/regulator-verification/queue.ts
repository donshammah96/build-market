import { Queue } from "bullmq";
import { prisma } from "@build/db";
import { createRedisConnection } from "@build/redis/tcp";
import { dedupeKeyFor } from "./evidence-store";
import type { RegulatorVerificationRequest } from "./gateway";

import { env, envConfig } from "@/app/lib/infrastructure/env";

export const LICENSE_VERIFICATION_QUEUE_NAME = "license-verification";
export const LICENSE_VERIFICATION_MAX_ATTEMPTS = 5;

let queue: Queue<RegulatorVerificationRequest> | null = null;

export function getLicenseVerificationQueue(): Queue<RegulatorVerificationRequest> {
  // Guard 1: Next.js static build phase or client-side runtime
  if (env.isBuildPhase || typeof window !== "undefined") {
    return {
      add: async () => undefined,
      getJob: async () => null,
      close: async () => undefined,
    } as unknown as Queue<RegulatorVerificationRequest>;
  }

  // Guard 2: CI / local dev without Redis or when background jobs are disabled
  if (!envConfig.redis.url || envConfig.jobs.disableBackgroundJobs) {
    return {
      add: async () => undefined,
      getJob: async () => null,
      close: async () => undefined,
    } as unknown as Queue<RegulatorVerificationRequest>;
  }

  if (!queue) {
    queue = new Queue(LICENSE_VERIFICATION_QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: LICENSE_VERIFICATION_MAX_ATTEMPTS,
        backoff: { type: "exponential", delay: 5_000 },
        // Failed jobs are kept (not removed) so DEAD_LETTER cases remain
        // inspectable in the BullMQ board alongside RegulatorVerificationCase.
        removeOnComplete: { age: 60 * 60 * 24 * 7 },
        removeOnFail: false,
      },
    });
  }
  return queue;
}

/**
 * Enqueues a license for verification, deduped by authority + license
 * number + professional ID. Uses the same dedupe key as the
 * RegulatorVerificationCase row (dedupeKeyFor === buildRegulatorVerificationJobId)
 * as the BullMQ jobId, so a duplicate `professional.onboarding_submitted`
 * event - or a resubmission with the same license - is a safe no-op: BullMQ
 * rejects re-adding a job with an in-flight/waiting jobId, and the case
 * upsert below is idempotent.
 */
export async function enqueueLicenseVerification(
  request: RegulatorVerificationRequest,
): Promise<{ jobId: string; alreadyQueued: boolean }> {
  const jobId = dedupeKeyFor(request);

  await prisma.regulatorVerificationCase.upsert({
    where: { dedupeKey: jobId },
    create: {
      professionalId: request.professionalId,
      licenseId: request.licenseId ?? "",
      authority: request.authority,
      licenseNumber: request.licenseNumber,
      dedupeKey: jobId,
      status: "QUEUED",
      maxAttempts: LICENSE_VERIFICATION_MAX_ATTEMPTS,
      correlationId: request.correlationId,
    },
    // Don't reset an in-progress/completed case just because the same
    // license was submitted again (e.g. the person re-submitted the wizard
    // step) - only the queue-side dedupe below matters for re-processing.
    update: {},
  });

  const existingJob = await getLicenseVerificationQueue().getJob(jobId);
  if (existingJob) {
    return { jobId, alreadyQueued: true };
  }

  await getLicenseVerificationQueue().add("verify-license", request, { jobId });
  return { jobId, alreadyQueued: false };
}
