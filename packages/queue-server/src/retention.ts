import type { JobsOptions } from "bullmq";

/**
 * Standardized job retention policies across BullMQ queues.
 * Setting explicit age and count limits prevents unbounded table growth
 * in PostgreSQL and prevents key bloat in Redis.
 */
export const QueueRetentionPolicies = {
  /**
   * Default policy for ephemeral jobs (notifications, sweeps, maintenance, exports):
   * - Completed jobs retained for 24h (up to 1,000 jobs) for observability.
   * - Failed jobs retained for 7 days (up to 5,000 jobs) for investigation.
   */
  STANDARD: {
    removeOnComplete: { age: 86_400, count: 1_000 },
    removeOnFail: { age: 7 * 86_400, count: 5_000 },
  } as const satisfies Pick<JobsOptions, "removeOnComplete" | "removeOnFail">,

  /**
   * High-stakes policy for financial & compliance jobs (M-Pesa payments, audit logs):
   * - Completed jobs retained for 24h (up to 1,000 jobs).
   * - Failed jobs are NEVER automatically deleted to ensure full auditability.
   */
  FINANCIAL_AUDIT: {
    removeOnComplete: { age: 86_400, count: 1_000 },
    removeOnFail: false,
  } as const satisfies Pick<JobsOptions, "removeOnComplete" | "removeOnFail">,

  /**
   * High-throughput policy for batch notifications & sweeps:
   * - Completed jobs retained for 12h (up to 500 jobs).
   * - Failed jobs retained for 48h (up to 1,000 jobs).
   */
  HIGH_THROUGHPUT: {
    removeOnComplete: { age: 43_200, count: 500 },
    removeOnFail: { age: 2 * 86_400, count: 1_000 },
  } as const satisfies Pick<JobsOptions, "removeOnComplete" | "removeOnFail">,
};
