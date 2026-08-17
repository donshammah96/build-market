# ADR-ADMIN-016: Admin Background Worker Isolation and Daemon Migration

## Status

Accepted

**Date:** 2026-08-17

## Context

`apps/admin` previously maintained background worker modules under `src/lib/workers/` (specifically `export/worker.ts`, `compliance/incident.worker.ts`, and `compliance/notification.worker.ts`) that instantiated top-level BullMQ `Worker` consumers on module load.

While ADR-ADMIN-012 established the administrative contract for background job registration and queue semantics, running consumer polling loops inside the Next.js admin web application caused severe operational risks:

1. **Module Evaluation Side-Effects**: Importing utilities or models from worker directories unintentionally instantiated active Redis worker connections.
2. **Resource Starvation**: Heavy CPU/memory tasks (e.g., streaming ZIP archive generation in `ExportProcessor` and multipart S3 uploads) degraded HTTP response times for active admin console operators.
3. **Execution Timeouts & Process Leaks**: Serverless and containerized web runtimes lacking long-running daemon lifecycles could terminate mid-export or leave zombie Redis connections.

## Decision

1. **Extraction of Consumers to `apps/workers`**:
   - All BullMQ consumer implementations for `gdpr-data-export`, `security-incidents`, and `compliance-notifications` are permanently migrated to the dedicated [`apps/workers`](../../../apps/workers) daemon.
   - Top-level `new Worker(...)` instantiations are completely removed from `apps/admin`.

2. **Admin Application as Producer**:
   - `apps/admin` retains administrative action boundaries and scheduler definitions (`src/lib/jobs/index.ts`).
   - Admin actions, compliance dashboards, and verification flows enqueue jobs via typed producers in `@build/queue-server` (`addExportJob`, `queueEmergencyProtocol`, `queueUserNotification`, `addMaintenanceJob`).

3. **Job Registry & Audit Alignment**:
   - The job registration contract in `src/lib/queues/queue-registry.ts` and audit logging requirements in ADR-ADMIN-008 remain binding.
   - Any job enqueueing initiated by an admin action must record an append-only `AdminAuditLog` entry before returning success.

## Consequences

- **Isolation**: Heavy I/O workloads (ZIP archiving, S3 uploads, high-concurrency notification fan-outs) are fully isolated from the admin web tier.
- **Fail-Closed & High Availability**: Background workers are supervised by container orchestration with dedicated health probes (`/healthz`) and signal traps (`SIGTERM`/`SIGINT`).
- **Clean Architecture**: `apps/admin` codebase is strictly web-adapter and domain-service focused, eliminating background socket leaks.

## Related ADRs

- `ADR-ADMIN-002`: Admin Action Boundary and Layer Structure
- `ADR-ADMIN-008`: Admin Audit Log Contract
- `ADR-ADMIN-012`: Admin Background Job and Queue Semantics
- `ADR-010`: Background Job Execution and Worker Daemon Boundary (`apps/client`)
