# ADR-ADMIN-001: Admin Authentication and Authorization Model

Status: Accepted
Owner: Admin Architecture
Next review: 2026-12-03

## Status

Accepted

## Context

Admin requests currently resolve Clerk identity in middleware and action helpers, but action helpers still mix session metadata, `User.role`, and database state. Phase 0 found raw thrown errors, direct role-string checks, and no canonical actor type for admin actions.

## Decision

Admin request handling resolves Clerk identity server-side. The canonical admin actor is `{ clerkId: string; dbUserId: string; adminRole: AdminRole }`.

`adminRole` is resolved from the database `AdminProfile` record and not from Clerk session claims. Clerk claims may help route-level coarse access, but they are not authoritative for high-risk admin action execution.

`SUPER_ADMIN` is the only full-capability bypass role. Every other `AdminRole` is authorized through explicit capability maps.

High-risk mutations require session freshness: Tier 1 uses `180` seconds and Tier 2 uses `300` seconds unless a later admin ADR narrows these values.

`assertAdmin()` resolves the actor or returns a typed unauthorized result. `safeAction` wraps authenticated admin mutations, performs actor resolution, policy checks, validation failure mapping, optional freshness/rate-limit/audit behavior, and fail-closed execution.

## Alternatives Considered

**Session-claims-only authorization:** Clerk session claims already carry a `role` field in `publicMetadata`. Using them as the sole authority avoids a database round-trip per action. This was rejected because claims are not invalidated atomically on role change — a window exists between a role downgrade and the user's next token refresh where they retain elevated claims. For an admin surface, this window is unacceptable.

**Middleware-enforced RBAC:** Moving all role checks into Next.js middleware keeps action handlers free of auth logic. This was rejected because middleware runs in the Edge runtime, which cannot access the database directly. It can only apply coarse access gates (is user authenticated? is their Clerk role "admin"?). Fine-grained capability checks still require a service-layer boundary.

**Library-backed RBAC (e.g., CASL, Permify):** External RBAC libraries provide rich policy DSLs. Rejected on the grounds that the capability surface is small and stable, the overhead of learning a new DSL outweighs the benefit, and introducing a third-party runtime dependency into the security-critical path adds supply chain risk.

## Consequences

Admin actions stop relying on session metadata for final authorization. Existing helpers must be migrated without changing behavior outside the guarded action surface.

## Verification

Policy tests cover every `AdminRole`, `SUPER_ADMIN` bypass behavior, freshness rejection, actor-scoped rate limiting, and canonical actor forwarding.

## Revision History

| Date       | Author        | Change                                                                                 |
| ---------- | ------------- | -------------------------------------------------------------------------------------- |
| 2026-05-18 | Phase 3 impl  | Initial acceptance. Branch: `feat/admin-overhaul/auth-hardening`.                      |
| 2026-06-04 | Phase 12 impl | Tier 1 freshness window retained at 180s; Tier 2 retained at 300s after ASVS L2 audit. |
| 2026-06-05 | Autopsy impl  | Added Alternatives Considered and Revision History (F-Doc1).                           |

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/client/docs/adr/ADR-001-auth-model.md`
- `apps/client/docs/adr/ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md`
