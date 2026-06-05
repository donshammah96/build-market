# ADR-ADMIN-008: Admin Audit Log Contract

## Status

Accepted

## Context

Admin audit logging exists, but it is manually invoked and stores identity fields. The overhaul needs a consistent audit contract for high-risk operator actions.

## Decision

Audit entries are required for role changes, user suspension/deletion, data export, manual payment operations, verification overrides, and content moderation actions.

The canonical audit event shape is `actorAdminRole`, `operationName`, `targetResourceType`, `targetResourceId`, `outcome`, `timestamp`, and `correlationId`. Metadata is Class C/D only.

Audit entries are append-only and written before success is returned. Audit write failures are non-blocking but emit structured admin error events.

`targetResourceId` may be sensitive when the resource is a user record and must be handled under the data classification ADR.

## Alternatives Considered

**Append-only event log in a separate audit table:** Storing audit events in a dedicated table (rather than the application's main database) provides stronger isolation — an application-layer compromise cannot rewrite audit history. Considered for a future phase. Currently the audit log uses the application database with append-only enforcement via `safeAction` (entries are written before success is returned; there is no update path). The separate-table approach remains an open upgrade path.

**Audit middleware that wraps every action automatically:** Auto-instrumenting all actions with audit events regardless of risk classification avoids missing entries. Rejected because low-risk reads (dashboard stats, list queries) in audit logs produce noise that hides high-risk signal. The declarative `auditLog` option on `safeAction` keeps audit entries opt-in and explicit, which is also the model taken by ASVS L2 (log significant events, not all events).

**Immutable audit log via a dedicated service (e.g., event sourcing):** A separate audit microservice with write-once semantics provides the strongest tamper-evidence guarantee. Deferred — the admin surface is internal and the operational complexity of a separate service is not yet warranted. The current implementation's append-only contract plus the data classification ADR provides an acceptable risk posture.

## Consequences

Manual audit calls should be replaced by declarative `safeAction` audit options after the safe action hardening phase.

## Verification

Action tests verify audit calls for all classified operations. Drift tooling flags missing audit integration for registered high-risk operations.

## Revision History

| Date       | Author        | Change                                                                  |
| ---------- | ------------- | ----------------------------------------------------------------------- |
| 2026-06-04 | Phase 8 impl  | Initial acceptance. Branch: `feat/admin-overhaul/audit-log`.            |
| 2026-06-04 | Phase 12 impl | 368/368 tests passing; all high-risk operations confirmed audit-logged. |
| 2026-06-05 | Autopsy impl  | Added Alternatives Considered and Revision History (F-Doc1).            |

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/admin/docs/adr/ADR-ADMIN-004-admin-data-classification-and-handling.md`
