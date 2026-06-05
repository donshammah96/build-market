# ADR-ADMIN-006: Admin Environment Variable Access Boundary

## Status

Accepted

## Context

Phase 0 found 81 direct `process.env` reads across admin source and scripts. There is no canonical admin env module.

## Decision

`src/lib/infrastructure/env.ts` is the canonical admin env access module. All runtime `process.env` reads outside this module are boundary violations unless explicitly documented as bootstrap-only.

Bootstrap exceptions are `next.config.ts`, `instrumentation.ts`, and edge-runtime call sites that execute before the env module can be initialized. Exceptions carry an inline `// bootstrap-only: <reason>` comment.

Admin env templates are maintained in `.env.example`, `.env.test`, and `.env.development`.

## Alternatives Considered

**Individual `process.env.X` reads at each call site:** No abstraction — each module reads the variable it needs. Simple, familiar, no dependencies. Rejected because it makes it impossible to validate the full env shape at startup, scatters defaults and coercion logic, and prevents static analysis of which variables are in use.

**`dotenv` or `T3-env` library:** Third-party env validation libraries (notably `t3-oss/t3-env`) provide an ergonomic Zod-backed env schema with client/server separation. Considered but rejected in favour of a hand-written Zod schema because: the admin app has no client/server env split (all admin code is server-side), the hand-written approach gives full control over the bootstrap phase detection logic, and adding another workspace dependency to the admin-only surface was not warranted.

**Per-module env schemas:** Each `lib/infrastructure/*` module validates its own variables on import. Rejected because it produces partial validation errors at runtime (only the modules that have been imported get validated) and makes it impossible to verify the full env contract at boot or in CI.

## Consequences

Workers, jobs, components, actions, notification services, encryption, and scripts must migrate to typed env access in later phases.

## Verification

`admin:check-env-contract` verifies env templates cover the admin contract. `admin:report-security-drift:strict` flags direct env reads outside the boundary and bootstrap exceptions.

## Revision History

| Date       | Author        | Change                                                                             |
| ---------- | ------------- | ---------------------------------------------------------------------------------- |
| 2026-05-15 | Phase 2 impl  | Initial acceptance. Branch: `chore/admin-overhaul/tooling`.                        |
| 2026-06-04 | Phase 12 impl | 59 boundary keys confirmed; zero drift findings. GDPR/encryption modules migrated. |
| 2026-06-05 | Autopsy impl  | Added Alternatives Considered and Revision History (F-Doc1).                       |

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/client/docs/adr/ADR-004-cannonical-env-access-boundary.md`
