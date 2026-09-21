/**
 * Compliance Notifications Worker (Producer / Daemon Boundary)
 *
 * Per ADR-ADMIN-016, consumer loops run exclusively inside the standalone
 * `apps/workers` daemon (`apps/workers/src/processors/compliance-notification.processor.ts`).
 *
 * In Next.js web/admin instances, top-level Worker instantiations are omitted
 * to prevent Redis TCP socket leaks and serverless lifecycle degradation.
 *
 * Producers should enqueue notification batches using `userNotificationQueue`
 * from `@build/queue-server`.
 */
export {
  userNotificationQueue,
  ComplianceJobs,
  type UserNotificationJobData,
} from "@build/queue-server";
