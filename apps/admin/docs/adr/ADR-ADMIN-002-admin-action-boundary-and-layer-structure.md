# ADR-ADMIN-002: Admin Action Boundary and Layer Structure

## Status

Accepted

## Context

Phase 0 found 20 action-layer files with direct Prisma access and 23 action-layer `.parse()` calls. Business logic is spread across actions, services, jobs, and GDPR modules.

## Decision

`src/actions/admin/` is the adapter layer. It owns input validation, admin actor resolution, authorization checks, domain calls, cache revalidation, and serialization-safe responses.

Admin business logic lives in `src/lib/domains/` or an explicitly migrated `src/lib/services/` module. Persistence-only Prisma access lives in repository files. Import direction is actions -> services/domains -> repositories; nothing imports actions.

Expected control flow uses `Result<T, AdminDomainError>`. All authenticated admin mutations use `safeAction`. Zod `.safeParse()` is mandatory in action adapters; `.parse()` is prohibited there.

## Consequences

Existing action files will be migrated incrementally after Phase 2. Direct Prisma in actions remains a tracked defect until the relevant domain is migrated.

## Verification

Security drift reports action Prisma imports/calls, action `.parse()`, and unwrapped authenticated mutations. Phase 3 action-boundary tests cover authentication, authorization, recent-auth rejection, actor-scoped rate limiting, and actor forwarding. Phase 4/5 will close direct Prisma and action `.safeParse()` migration debt.

Accepted on 2026-05-18 by Phase 3 implementation in `feat/admin-overhaul/auth-hardening`.

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/client/docs/adr/ADR-002-client-layer-boundaries.md`
- `apps/client/docs/adr/ADR-003-domain-structure-and-import-direction.md`
