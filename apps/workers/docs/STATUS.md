# Workers Current Status

Status: Not public-launch ready; documentation-governance snapshot only.
Scope: `apps/workers` daemon documentation, health semantics, and queue recovery controls; this is not evidence of processed production jobs.
Evidence date: 2026-09-03
Git SHA: 38e18958c2eebb62fecdf260427c04e8974eaa18
Environment: Repository checkout; no deployed worker, Redis, PostgreSQL, NATS, storage, or provider environment was exercised for this snapshot.
Commands and results: No worker release command was executed for this baseline document; release evidence must be attached before a go decision.
Owner: Platform Engineering
Known exclusions: Queue outage drill, NATS outage drill, callback replay, regulated-provider availability, object-store erasure, and financial reconciliation evidence.
Next review: 2026-12-03 or before any public-launch decision.

## Authority and evidence

The daemon boundary is governed by client [`ADR-010`](../../client/docs/adr/ADR-010-background-job-execution-and-worker-daemon-boundary.md) and admin [`ADR-ADMIN-012`](../../admin/docs/adr/ADR-ADMIN-012-admin-background-job-and-queue-semantics.md) / [`ADR-ADMIN-016`](../../admin/docs/adr/ADR-ADMIN-016-admin-background-worker-isolation-and-daemon-migration.md). Operational recovery is defined in the [`queue recovery runbook`](QUEUE_RECOVERY_RUNBOOK.md). The launch decision is tracked in the repository-wide [`GO / NO-GO scorecard`](../../../docs/launch/GO_NO_GO.md).
