import { Queue, type JobsOptions } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { env } from "@/app/lib/infrastructure/env";
import type {
  NewsletterEspSyncJobData,
  NewsletterConfirmationEmailJobData,
} from "@/app/lib/domains/newsletter/contracts";

const isBuildPhase = env.isBuildPhase;

/**
 * Was `add(name: string, data: any, opts?: any)`. Every other file in
 * this domain went out of its way to remove `any` (see esp-sync.ts's own
 * changelog comment), so a producer that accepts `any` for job payloads
 * was the one place a typo'd field name would silently reach a worker
 * and fail at runtime instead of at compile time. Generic over the job
 * data shape now — each SafeQueue instance below is pinned to its
 * corresponding contracts.ts type.
 */
class SafeQueue<TData> {
  private queue: Queue<TData> | null = null;

  constructor(private name: string) {}

  add(name: string, data: TData, opts?: JobsOptions) {
    if (isBuildPhase) {
      console.warn(
        `[Queue: ${this.name}] Bypassed add during build phase:`,
        name,
        data,
      );
      return Promise.resolve({ id: "dummy-build-job-id" });
    }
    if (!this.queue) {
      this.queue = new Queue<TData>(this.name, {
        connection: createRedisConnection(),
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          // Previously unset — esp-sync.worker.ts's own comment claims
          // "BullMQ handles the job-level retry/backoff (see queue.ts)"
          // but no attempts/backoff were actually configured here, which
          // means BullMQ's default of a single attempt (no retry) was
          // silently in effect. A transient ESP 5xx or a Redis blip would
          // have exhausted the DB-side retry bookkeeping the worker does
          // (espSyncAttempts, espNextRetryAt) without BullMQ ever
          // re-invoking the job to act on it. Explicit now.
          attempts: 5,
          backoff: { type: "exponential", delay: 60_000 },
        },
      });
    }
    return this.queue.add(name as any, data as any, opts);
  }
}

export const newsletterEspSyncQueue = new SafeQueue<NewsletterEspSyncJobData>(
  "newsletter-esp-sync",
);
export const newsletterEmailQueue =
  new SafeQueue<NewsletterConfirmationEmailJobData>(
    "newsletter-confirmation-email",
  );
