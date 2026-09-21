# Worker Queue Recovery Runbook

**Owner:** Platform Engineering (primary); the domain owner listed below owns business-impact triage.
**Review date:** 2026-09-03
**Next review:** 2026-12-03

## Safety boundary

Do not delete, retry, or replay jobs until the affected queue, processor, failure mode, and business owner are identified. BullMQ delivery is at-least-once: recovery may repeat a processor invocation. Preserve job IDs, correlation IDs, failure payload metadata, and the time range in the incident record before changing queue state.

`DISABLE_BACKGROUND_JOBS=true` is the emergency pause: it leaves the process and health server up but intentionally prevents BullMQ workers and NATS consumers from starting. It is a containment control, not evidence that the dependency is healthy.

## Detection and common recovery sequence

1. Confirm process liveness and aggregate readiness at `/healthz`. A 503 identifies a failed readiness dependency; it does not identify a failed individual job.
2. Inspect structured worker logs for the queue name, `jobId`, correlation ID, attempt count, and processor error. Inspect queue failed/delayed/stalled counts using the approved operator tooling.
3. Decide with the domain owner whether to pause producer traffic, set `DISABLE_BACKGROUND_JOBS=true`, or leave healthy queues running. Do not pause all queues for an isolated, retryable failure.
4. Fix or remove the root cause, then restart the daemon. Confirm Redis, PostgreSQL where configured, BullMQ workers, and NATS are all ready before resuming traffic.
5. Retry only the documented affected job set. Confirm durable side effects in the database/storage/provider, not merely that a BullMQ job became `completed`.
6. Record the recovery decision, queue, job identifiers, operator, domain-owner approval, and post-recovery evidence in the incident/change record.

## Queue ownership and recovery verification

| Queue / consumer                                             | Domain owner                          | Detection                                                    | Recovery verification                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `maintenance-jobs`                                           | Privacy and Platform Engineering      | Failed/stalled jobs and maintenance processor errors         | Confirm the job-specific state transition below; do not interpret completion as full deletion unless the processor deletes the object. |
| `notification-retries` and `notification-retry-worker-group` | Marketplace Operations                | Failed jobs or NATS consumer disconnect                      | Confirm an in-app `Notification` record exists and any matching `FailedNotification` is completed.                                     |
| `gdpr-data-export`                                           | Privacy Operations                    | Failed export jobs or `DataExport.status=FAILED`             | Confirm export status, expiry, storage object/download URL, and user notification according to the request.                            |
| `security-incidents` and `compliance-notifications`          | Trust, Safety, and Privacy Operations | Failed job, provider error, or incident state not advanced   | Confirm the expected incident notification/escalation records and downstream delivery result.                                          |
| `newsletter-confirmation-email` and `newsletter-esp-sync`    | Growth Operations                     | Failed job or provider error                                 | Confirm the subscriber state and provider response using the relevant processor logs.                                                  |
| `uploads-image-processing`                                   | Platform Engineering                  | Failed/stalled upload job                                    | Confirm the upload processing state and generated derivative records/assets.                                                           |
| `license-verification` and `license-auto-verify-group`       | Verification Operations               | Failed job or NATS consumer disconnect                       | Confirm the verification case transition and preserve regulator response evidence.                                                     |
| `mpesa-payments` and `mpesa-reconciliation`                  | Finance and Platform Engineering      | Failed job, callback mismatch, or reconciliation discrepancy | Do not replay automatically. Reconcile provider evidence and transaction idempotency before any retry.                                 |

## Maintenance job semantics and exclusions

| Job                          | Implemented effect                                                                                                       | Explicit exclusion                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `cleanup-expired-exports`    | Marks eligible `DataExport` records as `EXPIRED`.                                                                        | Does not delete the referenced storage object.                                           |
| `data-retention-enforcement` | Sets `scheduledDeletionAt` for eligible users.                                                                           | Does not deactivate, anonymize, or delete the user itself.                               |
| `anonymization-batch`        | Replaces selected user profile fields, archives the account, and records `anonymizedAt`.                                 | Does not by itself prove all related records, providers, backups, or assets were erased. |
| `asset-cleanup`              | Marks eligible `Asset` records with `deletedAt`.                                                                         | Does not delete the backing object-store asset.                                          |
| `onboarding-upload-cleanup`  | Marks staged, expired onboarding uploads as `EXPIRED`.                                                                   | Does not delete uploaded binary data.                                                    |
| `newsletter-sweep`           | Deletes unconfirmed newsletter subscriber records older than 48 hours.                                                   | Does not assert deletion from external ESP systems.                                      |
| `license-expiry`             | Transitions eligible verified professional licences to `EXPIRED`.                                                        | Does not re-query a regulator or notify the professional.                                |
| `gdpr-erasure`               | Deactivates eligible scheduled users and records `deletionRequestedAt`.                                                  | Does not perform complete GDPR erasure or cross-system deletion.                         |
| `archive-settled-records`    | Copies eligible M-Pesa transactions to the archive table and deletes the source transaction in one database transaction. | Does not archive verification cases despite the historical job description.              |

## Escalation

Escalate immediately to the listed domain owner when a privacy deletion/export, verification, incident, or M-Pesa queue is delayed beyond its applicable service objective, a retry could duplicate financial or regulatory effects, or the root cause involves Redis, PostgreSQL, NATS, storage, or a third-party provider outage.
