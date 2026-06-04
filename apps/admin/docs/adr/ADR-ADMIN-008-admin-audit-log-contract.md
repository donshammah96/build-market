# ADR-ADMIN-008: Admin Audit Log Contract

## Status

Accepted on 2026-06-04 by Phase 8 implementation in `feat/admin-overhaul/audit-log`.

## Context

Admin audit logging exists, but it is manually invoked and stores identity fields. The overhaul needs a consistent audit contract for high-risk operator actions.

## Decision

Audit entries are required for role changes, user suspension/deletion, data export, manual payment operations, verification overrides, and content moderation actions.

The canonical audit event shape is `actorAdminRole`, `operationName`, `targetResourceType`, `targetResourceId`, `outcome`, `timestamp`, and `correlationId`. Metadata is Class C/D only.

Audit entries are append-only and written before success is returned. Audit write failures are non-blocking but emit structured admin error events.

`targetResourceId` may be sensitive when the resource is a user record and must be handled under the data classification ADR.

## Consequences

Manual audit calls should be replaced by declarative `safeAction` audit options after the safe action hardening phase.

## Verification

Action tests verify audit calls for all classified operations. Drift tooling flags missing audit integration for registered high-risk operations.

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/admin/docs/adr/ADR-ADMIN-004-admin-data-classification-and-handling.md`
