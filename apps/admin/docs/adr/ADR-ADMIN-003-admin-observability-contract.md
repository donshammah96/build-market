# ADR-ADMIN-003: Admin Observability Contract

## Status

Proposed

## Context

Admin currently uses client-oriented logging helpers and `console.*` calls. Phase 0 found 104 console calls in action/lib surfaces and PII-bearing log contexts.

## Decision

Admin adapter layers emit structured events with at least `correlationId`, `operationName`, `adminRole`, `outcome`, `httpStatus` where applicable, and `durationMs`.

Never log `userId`, `clerkId`, `userEmail`, `email`, `phone`, `nationalId`, request bodies, or response bodies. `adminRole` is safe to log because it is a capability enum rather than an identity.

`operationName` is a stable join key in `<verb>_<resource>` form. Renames require coordinated documentation and dashboard updates. Services and repositories do not log routine operation outcomes; adapter layers do.

## Consequences

Existing client logger usage and console logging become migration targets. Drift tooling must flag PII keys and unstructured console calls in admin server surfaces.

## Verification

`admin:report-security-drift:strict` reports zero unsafe log calls and PII log keys before the observability phase closes.

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/client/docs/adr/ADR-005-cannonical-observability-contract.md`
