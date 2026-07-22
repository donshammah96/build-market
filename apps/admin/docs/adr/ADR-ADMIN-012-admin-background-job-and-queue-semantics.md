# ADR-ADMIN-012: Admin Background Job and Queue Semantics

## Status

Proposed

## Context

`apps/admin` contains background workflows for exports, compliance, GDPR erasure, anonymization, data retention, asset cleanup, license expiry, email notification retries, Redis/BullMQ-backed queues, and NATS-backed verification integrations. These workflows are production-critical because they enforce privacy obligations, compliance state, user notifications, and operator exports outside the request/response path.

The production-readiness audit found that queue and job modules exist, but the repository lacks one normative contract for idempotency, retry behavior, dead-letter handling, poison-message isolation, alerting, replay, and rollback. Without that contract, background failures can remain invisible while still violating privacy, export, retention, or notification obligations.

## Decision

Every admin background job and queue must have a registered operational contract that defines:

- Job or queue name.
- Owning domain and on-call owner.
- Trigger source: cron, route/action enqueue, webhook, queue consumer, or manual operator action.
- Payload schema and data classification.
- Idempotency key and duplicate handling semantics.
- Retry policy, backoff policy, maximum attempts, and timeout.
- Dead-letter or failed-job destination.
- Poison-message isolation behavior.
- Replay procedure and replay authorization requirement.
- Required audit log behavior for compliance-significant work.
- Metrics, logs, traces, dashboards, and alerts.
- Rollback behavior and safe disable switch.

Queue providers must be selected through the environment governance contract in ADR-ADMIN-013. Production must not use in-memory queue semantics for compliance, export, notification, or GDPR workloads.

All job handlers must be idempotent. A retry must either produce the same durable result or no-op safely. Any non-idempotent external side effect must be guarded by an idempotency key, provider idempotency feature, outbox record, or explicit dedupe repository.

Failed GDPR erasure, anonymization, export cleanup, data retention, audit export, verification notification, or compliance queue jobs must alert before obligations are breached. Silent failed-job accumulation is not acceptable in production.

### Rollout Sequence

1. Create a job/queue registry covering `src/lib/jobs/**`, `src/lib/queues/**`, verification notification workers, and export/compliance queues.
2. Add payload schema validation for each queue/job entrypoint.
3. Add idempotency keys and dedupe checks where absent.
4. Define retry, backoff, timeout, and dead-letter policies in code and docs.
5. Add queue/job metrics required by ADR-ADMIN-011.
6. Add replay and rollback runbooks for GDPR, exports, compliance, verification notifications, and retention.
7. Add tests for duplicate delivery, retry, dead-letter behavior, and poison-message handling.
8. Mark this ADR Accepted only after all production jobs are registered and tested.

### Not Yet Implemented

- Central job/queue registry.
- Complete idempotency and payload-schema coverage across all background workflows.
- Dead-letter and poison-message tests for each provider-backed queue.
- Replay runbooks and alert thresholds.

## Consequences

Background work becomes reviewable as production infrastructure rather than utility code. New jobs cannot be introduced without an owner, payload schema, idempotency plan, retry/dead-letter semantics, and observability.

This increases up-front implementation work for jobs, but it materially reduces compliance and incident-response risk.

## Verification

After implementation, run:

```bash
pnpm --filter admin test -- src/lib/jobs src/lib/queues src/lib/domains/verification/internal
pnpm --filter admin check-env-contract
```

The future queue registry check must be deterministic and should fail if a job file exists without a corresponding registry entry:

```bash
pnpm --filter admin check-security-drift
```

## Related Documentation

- `apps/admin/docs/ADMIN-PRODUCTION-READINESS-AUDIT-2026-07-22.md`
- `apps/admin/docs/adr/ADR-ADMIN-011-admin-observability-slo-and-telemetry-contract.md`
- `apps/admin/docs/adr/ADR-ADMIN-013-admin-environment-and-secret-governance.md`
- `apps/admin/docs/VERIFICATION.md`
