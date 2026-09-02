# ADR-007: Role Model Consolidation and Actor Context Boundaries

Status: Accepted
Owner: Client Architecture
Next review: 2026-12-03

## Status

Accepted

## Context

The role and actor model had four cross-cutting risks:

- Dual support representation (`UserRole.SUPPORT` and `AdminRole.SUPPORT_AGENT`) created duplicated authorization checks.
- Duplicate full-access admin variants (`SUPER_ADMIN` and `SYSTEM_ADMIN`) increased policy and audit ambiguity.
- Professional onboarding needed first-class status states before `ACTIVE`.
- Adapter and domain boundaries needed a consistent, typed actor context for authorization-sensitive operations.

This ADR defines the canonical model and records the completed implementation state.

## Decision

### 1. Canonical Role Registry

`UserRole` is:

- `CLIENT`
- `PROFESSIONAL`
- `ADMIN`

`AdminRole` is:

- `SUPER_ADMIN`
- `CONTENT_MODERATOR`
- `SUPPORT_AGENT`
- `FINANCE_MANAGER`
- `AUDITOR`

`UserRole.SUPPORT` and `AdminRole.SYSTEM_ADMIN` are removed from the canonical model.

### 2. Canonical Status Registry

`UserStatus` is:

- `ONBOARDING`
- `PENDING_VERIFICATION`
- `ACTIVE`
- `SUSPENDED`
- `BANNED`
- `DEACTIVATED`
- `ARCHIVED`

`ONBOARDING` and `PENDING_VERIFICATION` are required onboarding lifecycle states and are not optional aliases.

### 3. Admin Capability Source

Admin capability is resolved from `AdminProfile.role` and enforced through adapter/domain authorization checks.

- Clerk role claims are identity hints, not authoritative admin capability.
- Legacy `SUPPORT` claims are normalized to `ADMIN` at trust boundaries.
- `SUPER_ADMIN` is the only full-access bypass role.

### 4. Actor Context Boundary

Authorization-sensitive operations must use actor context from authenticated adapters.

- Adapter context includes `clerkId`, `dbUserId`, `userRole`, and `adminRole` (when admin).
- Domain/service authorization must consume this context instead of bare user IDs where policy decisions are required.

## Implementation Status (Audit)

Implemented end-to-end:

1. Schema and migration
   - `UserRole` and `AdminRole` contracted to canonical values.
   - `UserStatus` expanded with onboarding states.
   - Migration `20260402120000_adr007_role_model_phase1` provisions support-user `AdminProfile`, migrates `SYSTEM_ADMIN` to `SUPER_ADMIN`, migrates `SUPPORT` to `ADMIN`, and contracts enums.
2. Runtime role normalization and gating
   - Client role normalization maps legacy `SUPPORT` to `ADMIN`.
   - Client admin-role guard uses `SUPER_ADMIN` as the only bypass.
3. Validation boundaries
   - Clerk webhook role resolution maps legacy `SUPPORT` claims to canonical `ADMIN`.
4. Shared enum parity
   - Shared enum package now matches canonical `UserRole`, `AdminRole`, and `UserStatus` registries.
5. Tests
   - Client middleware tests aligned with canonical roles.
   - Properties policy tests no longer use removed top-level `SUPPORT` role.

## Consequences

### Positive

- Authorization checks are simpler and less error-prone.
- Onboarding progression is explicit in persisted status values.
- Enum parity between schema/runtime/shared contracts is tighter.
- Admin capability semantics are clearer for auditing and incident response.

### Trade-offs

- Legacy input normalization must remain at trust boundaries during transition windows.
- Older logs and historical data can contain pre-migration values and need dashboard/query normalization where relevant.

## Verification

Recommended verification surface for ADR-007 changes:

- `pnpm run client:tsc-noemit`
- `pnpm run admin:check-types`
- `pnpm -C apps/client exec vitest run __tests__/lib/api-middleware.test.ts __tests__/policy/properties/authorization.policy.test.ts`

## Related Documentation

- `apps/client/docs/adr/ADR-001-auth-model.md`
- `apps/client/docs/adr/ADR-002-client-layer-boundaries.md`
- `apps/client/docs/adr/ADR-005-cannonical-observability-contract.md`
- `apps/client/docs/adr/ADR-006-data-classification.md`
- `apps/client/docs/adr/ADR-008-http-surface-security.md`
