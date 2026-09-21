# Admin Background Jobs & Queues Runbooks

This document defines the operational contracts and on-call runbooks for all background queues and scheduled tasks in `apps/admin` (ADR-ADMIN-012 & ADR-ADMIN-015).

## Background Queue Registry

The following BullMQ queues are active in the application:

| Queue Name                     | Owning Domain    | Trigger                       | Retry Policy                  | Dead-Letter / Failure Behavior                                                                 |
| ------------------------------ | ---------------- | ----------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| **`security-incidents`**       | Compliance       | Route/Action Enqueue          | 5 attempts, exp backoff 5s    | Retains failed jobs for 90 days. Alerts Slack immediately on CRITICAL incident worker failure. |
| **`compliance-notifications`** | Compliance       | Batch User Breach Notify      | 3 attempts, fixed backoff 60s | Staggered delivery. Failures logged and audited.                                               |
| **`audit-logs`**               | Security         | Declarative Action Logging    | 3 attempts                    | Failures on high-risk operations block user transactions (Fail-Closed).                        |
| **`gdpr-data-export`**         | GDPR / Privacy   | Operator Export Request       | 3 attempts, exp backoff 2s    | Keeps completed for 24h, failed for 7 days.                                                    |
| **`gdpr-erasure`**             | GDPR / Privacy   | Daily cron (6 AM) / Immediate | 5 attempts, exp backoff 5s    | Anonymizes user fields. Errors create `ANONYMIZATION_BATCH_FAILED` audit logs.                 |
| **`data-retention`**           | GDPR / Privacy   | Daily cron (2 AM)             | 3 attempts, exp backoff 60s   | Logs failures to audit log.                                                                    |
| **`asset-cleanup`**            | Storage / Assets | Daily cron (4 AM)             | 3 attempts, exp backoff 60s   | Cleans up expired storage exports.                                                             |
| **`license-expiry`**           | Verification     | Daily cron (1 AM)             | 3 attempts, exp backoff 60s   | Emits warning events on NATS.                                                                  |

---

## On-Call Runbooks

### Runbook: Failed Audit Writes

- **Symptoms:** Server actions for high-risk operations fail with the error message: `Audit logging failed for high-risk operation: ...`
- **Triage Steps:**
  1. Inspect the PostgreSQL database health. Verify connection limits are not exhausted.
  2. Check the structured logs using the action `correlationId`. Look for error log events with `operationName: "record_admin_audit_event"`.
  3. If the DB is operating normally, verify if the `AdminAuditLog` table partition (if any) is writable.
- **Recovery:**
  - Once database connectivity is restored, operations will auto-resume since the action logic runs inside transaction scopes and rolls back safely.

### Runbook: Queue Backlog Remediation

- **Symptoms:** Alert triggers indicating queue lag is high (e.g. `admin.queue.lag` > 10).
- **Triage Steps:**
  1. Inspect Redis memory usage and CPU utilization.
  2. Query the queue status route: `/api/admin/compliance/queue-status` to inspect failed counts and recent failure messages.
  3. Verify if worker processes are alive and polling.
- **Replay Procedures:**
  - If jobs failed due to transient issues (e.g., mailer service rate limit), trigger a retry of failed jobs in Redis using the BullMQ retry mechanism:

    ```javascript
    const queue = new Queue("security-incidents");
    const failedJobs = await queue.getFailed();
    for (const job of failedJobs) {
      await job.retry();
    }
    ```

### Runbook: GDPR Erasure Replay

- **Symptoms:** Anonymization batch cron records a failure.
- **Triage Steps:**
  1. Query the `AuditLog` table for the action `ANONYMIZATION_BATCH_FAILED`.
  2. Read the error message in the audit log details JSON.
  3. Identify if the failure is with Clerk user deletion or local DB anonymization.
- **Reconciliation:**
  - If a user's local database profile was anonymized but Clerk profile deletion failed, verify the user status in Clerk console and manually trigger `anonymizeUser` server action.
