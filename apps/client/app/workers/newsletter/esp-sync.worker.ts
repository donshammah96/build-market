/**
 * Processes "newsletter-esp-sync" jobs: the actual outbound call to the
 * configured ESP (Resend by default), run entirely outside the request
 * path. BullMQ handles the job-level retry/backoff (now explicitly
 * configured in newsletter.queue.ts — attempts: 5, exponential backoff);
 * this worker additionally records attempt/error/next-retry state on the
 * NewsletterSubscriber row itself, mirroring the existing
 * FailedNotification pattern elsewhere in this schema, so ops has the
 * same visibility here as for other retryable background work.
 *
 * Wire this up wherever the other BullMQ workers are started (e.g. a
 * worker process/entrypoint) — it does nothing until instantiated. This
 * file, and confirmation-email.worker.ts, MUST only ever be imported by
 * that dedicated worker entrypoint/process — never by anything under
 * app/api/** or app/**. Importing a Worker into a Next.js route handler
 * means every serverless invocation (or every hot-reload in dev) opens
 * its own Redis connection and BullMQ polling loop, which leaks
 * connections and can silently double-process jobs. There is nothing in
 * the type system that prevents this mistake — enforce it with an eslint
 * import-restriction rule (see audit doc) rather than convention alone.
 */
import { Worker, type Job } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { newsletterRepository } from "@/app/lib/domains/newsletter/repository";
import { syncSubscriberToEsp } from "@/app/lib/domains/newsletter/esp-sync";
import { getConfiguredEspProvider } from "@/app/lib/domains/newsletter/esp-provider";
import { NEWSLETTER_CONFIG } from "@/app/lib/validation/newsletter-validation";
import type { NewsletterEspSyncJobData } from "@/app/lib/domains/newsletter/contracts";
import { StructuredLogger } from "@build/resilience";

const logger = new StructuredLogger("newsletter-esp-sync");

export async function processEspSyncJob(job: Job<NewsletterEspSyncJobData>) {
  const { subscriberId, action } = job.data;

  logger.info("Syncing newsletter subscriber to ESP", {
    operationName: "esp_sync",
    outcome: "processing",
    subscriberId,
    action,
    jobId: job.id,
  });

  const subscriber = await newsletterRepository.findById(subscriberId);
  if (!subscriber) {
    logger.warn(
      "Sync aborted: subscriber not found (possibly deleted via GDPR)",
      {
        operationName: "esp_sync",
        outcome: "aborted",
        subscriberId,
        jobId: job.id,
      },
    );
    return;
  }

  const result = await syncSubscriberToEsp(subscriber.email, action);
  const provider = getConfiguredEspProvider();

  if (result.ok) {
    logger.info("Successfully synced newsletter subscriber to ESP", {
      operationName: "esp_sync",
      outcome: "success",
      subscriberId,
      action,
      provider,
      espContactId: result.data.espContactId,
      jobId: job.id,
    });
    await newsletterRepository.updateEspSyncSuccess(
      subscriberId,
      provider,
      result.data.espContactId,
    );
    return;
  }

  const attemptsSoFar = subscriber.espSyncAttempts + 1;
  const exhausted = attemptsSoFar >= NEWSLETTER_CONFIG.ESP_SYNC_MAX_ATTEMPTS;
  const error = new Error(`${result.error}: ${result.message}`);

  logger.error("Failed to sync newsletter subscriber to ESP", error, {
    operationName: "esp_sync",
    outcome: exhausted ? "dead_letter" : "failure",
    subscriberId,
    action,
    provider,
    attempt: attemptsSoFar,
    exhausted,
    jobId: job.id,
  });

  await newsletterRepository.updateEspSyncFailure(
    subscriberId,
    `${result.error}: ${result.message}`,
    exhausted ? null : nextRetryAt(attemptsSoFar),
    exhausted ? "DEAD_LETTER" : "FAILED",
  );

  if (exhausted) {
    // A row has fallen out of both BullMQ's own retry budget and our
    // backoff schedule with no human ever being told. Today DEAD_LETTER
    // is a status value nobody queries proactively — see the audit doc's
    // "Dead-letter alerting" recommendation for wiring this to an actual
    // page/Slack notification rather than a value that only shows up if
    // someone thinks to look.
    logger.error(
      "Newsletter subscriber ESP sync moved to DEAD_LETTER — needs manual attention",
      error,
      {
        operationName: "esp_sync",
        outcome: "dead_letter",
        subscriberId,
        action,
        provider,
        jobId: job.id,
      },
    );
  }

  // Re-throw so BullMQ's own retry/backoff also applies — the DB fields
  // above are for observability/ops, not a replacement for BullMQ retry.
  throw error;
}

function nextRetryAt(attempt: number): Date {
  // 1m, 2m, 4m, 8m, 16m — matches the queue's own backoff config so the
  // DB's espNextRetryAt stays a reasonably accurate reflection of BullMQ's
  // actual next attempt, for dashboards/ops queries that don't want to
  // reach into Redis directly.
  const delayMinutes = Math.min(2 ** (attempt - 1), 16);
  return new Date(Date.now() + delayMinutes * 60_000);
}

export const newsletterEspSyncWorker = new Worker<NewsletterEspSyncJobData>(
  "newsletter-esp-sync",
  processEspSyncJob,
  { connection: createRedisConnection(), concurrency: 5 },
);

newsletterEspSyncWorker.on("failed", (job, error) => {
  logger.error("esp-sync job failed", error, {
    operationName: "esp_sync",
    outcome: "failure",
    jobId: job?.id,
    subscriberId: job?.data.subscriberId,
    action: job?.data.action,
  });
});
