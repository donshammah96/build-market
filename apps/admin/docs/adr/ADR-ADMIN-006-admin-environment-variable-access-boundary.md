# ADR-ADMIN-006: Admin Environment Variable Access Boundary

## Status

Proposed

## Context

Phase 0 found 81 direct `process.env` reads across admin source and scripts. There is no canonical admin env module.

## Decision

`src/lib/infrastructure/env.ts` is the canonical admin env access module. All runtime `process.env` reads outside this module are boundary violations unless explicitly documented as bootstrap-only.

Bootstrap exceptions are `next.config.ts`, `instrumentation.ts`, and edge-runtime call sites that execute before the env module can be initialized. Exceptions carry an inline `// bootstrap-only: <reason>` comment.

Admin env templates are maintained in `.env.example`, `.env.test`, and `.env.development`.

## Consequences

Workers, jobs, components, actions, notification services, encryption, and scripts must migrate to typed env access in later phases.

## Verification

`admin:check-env-contract` verifies env templates cover the admin contract. `admin:report-security-drift:strict` flags direct env reads outside the boundary and bootstrap exceptions.

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/client/docs/adr/ADR-004-cannonical-env-access-boundary.md`
