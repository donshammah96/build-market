# ADR-ADMIN-001: Admin Authentication and Authorization Model

## Status

Proposed

## Context

Admin requests currently resolve Clerk identity in middleware and action helpers, but action helpers still mix session metadata, `User.role`, and database state. Phase 0 found raw thrown errors, direct role-string checks, and no canonical actor type for admin actions.

## Decision

Admin request handling resolves Clerk identity server-side. The canonical admin actor is `{ clerkId: string; dbUserId: string; adminRole: AdminRole }`.

`adminRole` is resolved from the database `AdminProfile` record and not from Clerk session claims. Clerk claims may help route-level coarse access, but they are not authoritative for high-risk admin action execution.

`SUPER_ADMIN` is the only full-capability bypass role. Every other `AdminRole` is authorized through explicit capability maps.

High-risk mutations require session freshness: Tier 1 uses `180` seconds and Tier 2 uses `300` seconds unless a later admin ADR narrows these values.

`assertAdmin()` resolves the actor or returns a typed unauthorized result. `safeAction` wraps authenticated admin mutations, performs actor resolution, policy checks, validation failure mapping, optional freshness/rate-limit/audit behavior, and fail-closed execution.

## Consequences

Admin actions stop relying on session metadata for final authorization. Existing helpers must be migrated without changing behavior outside the guarded action surface.

## Verification

Policy tests must cover every `AdminRole`, `SUPER_ADMIN` bypass behavior, missing `AdminProfile`, inactive admin profiles, and freshness rejection.

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/client/docs/adr/ADR-001-auth-model.md`
- `apps/client/docs/adr/ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md`
