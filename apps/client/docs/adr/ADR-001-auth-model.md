# ADR-001: Clerk as the Primary Runtime Identity Provider

## Status

Accepted

## Context

`apps/client` currently exposes multiple authentication surfaces:

- Clerk middleware and Clerk session claims for runtime route protection.
- NextAuth credentials/OAuth configuration under `app/lib/auth`.
- Mixed role handling semantics (`professional` vs `PROFESSIONAL`) across middleware and onboarding paths.

This creates policy drift and makes authorization behavior harder to reason about and test.

## Decision

For `apps/client`, Clerk is the single runtime identity provider for request authentication.

- Request authentication and session identity come from Clerk only.
- Database role/profile fields are treated as domain state, not alternate identity.
- Authenticated adapters should resolve and pass role-bearing actor context into domain services rather than bare user IDs where authorization-sensitive behavior exists.
- Authorization decisions are enforced in service/policy modules, not only middleware.
- NextAuth modules remain temporarily for compatibility, but are considered legacy and not the source of truth for route/API authorization.

### Canonical UserRole Registry

| Role           | Domain meaning            | Clerk session | Financial access     | Initial status                                 |
| -------------- | ------------------------- | ------------- | -------------------- | ---------------------------------------------- |
| `CLIENT`       | Marketplace buyer         | Yes           | Yes (escrow)         | `ONBOARDING -> ACTIVE`                         |
| `PROFESSIONAL` | Verified service provider | Yes           | Yes (payouts)        | `ONBOARDING -> PENDING_VERIFICATION -> ACTIVE` |
| `ADMIN`        | Internal operator         | Yes           | Depends on adminRole | `ACTIVE` (provisioned)                         |

`UserRole.ADMIN` is the operator container role. Fine-grained capability is resolved from `User.adminRole` in database state and applied in domain policy checks.

### AdminRole And The Admin Actor Type

Admin capability checks must use a typed admin actor with non-null `adminRole`, resolved from the `User` record at request time.

- `adminRole` must not be derived from Clerk session claims.
- Adapter layers build the typed admin actor before calling admin-gated domain methods.
- Domain services that accept an `AdminActor` can enforce capability checks without nullable role branches.

### Clerk Metadata Sync Requirements

Role mutations require metadata synchronization to avoid stale session claims.

- After a successful DB role mutation, update Clerk `publicMetadata.role` before finalizing the response.
- If Clerk metadata update fails, treat the mutation as failed, keep any idempotent mutation retryable, and return a retryable `503` rather than emitting a successful privilege-changing response.

```typescript
await clerkClient.users.updateUserMetadata(actor.clerkId, {
  publicMetadata: { role: newRole },
});
```

### Session Freshness And Role-Transition Invalidation Requirements

Session freshness and role-transition invalidation are mandatory controls for privileged operations.

- Adapter-layer entry points for payout, escrow release, verification transitions, role mutation, and account-identity mutations must require recent authentication claims before domain execution.
- If freshness assertions fail or required claims are absent, adapters return `401`/`unauthorized` and must not execute domain handlers.
- Successful role transitions must invalidate stale privilege state in active sessions before returning success. At minimum:
  1. update Clerk `publicMetadata.role`
  2. trigger session claim refresh or revoke stale sessions through Clerk session-management APIs
  3. fail closed (or compensate) if metadata sync or invalidation cannot be confirmed
- Onboarding transitions satisfy this requirement with a shared Clerk metadata finalizer plus a client-side claim refresh barrier (`getToken({ skipCache: true })` and `user.reload()`) before any dashboard redirect.

### Actor Context Shapes

Authorization-sensitive domain services must accept typed actor context from `app/lib/domains/shared/contracts.ts`:

- `MarketplaceActor`
- `AdminActor`
- `DomainActor`

Passing `{ userId: string }` alone is not sufficient for authorization-sensitive operations.

## Consequences

### Positive

- A single identity source reduces auth drift and debugging complexity.
- Middleware and API guards can share one canonical role normalization model.
- Security tests can target one deterministic auth path.

### Negative

- Migration work is required to deprecate legacy NextAuth dependencies.
- Some env settings and old auth routes may remain until cleanup completes.

## Migration Notes

1. Introduce canonical role normalization and typed session metadata parsing.
2. Move resource authorization into policy guards or actor-aware domain services (`canReadThread`, `canSendMessage`, `canManageProject`).
3. Keep middleware as route orchestration only.
4. Treat the database-backed user record as actor enrichment for policy and ownership decisions, not a second identity provider.
5. Remove or archive legacy NextAuth entry points once all consumers are migrated.
6. Any successful domain mutation of `UserRole` must trigger Clerk session metadata refresh through the Clerk Backend API before the mutation response is finalized, so active sessions do not retain stale privilege claims.
7. High-risk mutations must enforce recent-auth checks at adapter boundaries before domain execution and return structured unauthorized failures when freshness assertions do not pass.
8. Role-transition routes and server actions must confirm session invalidation (metadata refresh and/or session revocation) before emitting successful privilege-changing responses.

## Amendment 2026-04-11

Provenance: Autopsy report 2026-04-11 (defects 3.2 and 3.5).

Status: Accepted. This amendment extends ADR-001 without changing its base decision.

### Amendment 1: Tiered recentAuth Windows

The base ADR requires freshness checks for sensitive mutations. This amendment
defines canonical values by operation tier.

Define and import these constants from `app/lib/security/high-risk-auth-windows.ts`:

```typescript
export const TIER1_RECENT_AUTH_MAX_AGE_SECONDS = 180 as const;
export const TIER2_RECENT_AUTH_MAX_AGE_SECONDS = 300 as const;
```

Tier mapping:

- Tier 1 (180): payout initiation and cancellation, escrow fund/release/dispute,
  user export, user deletion, user rectification.
- Tier 2 (300): verification document/license/certificate mutations,
  onboarding submit and skip transitions.

Enforcement rule:

- Route and action implementations use named constants.
- High-risk registry snippets for Tier 1 freshness checks use numeric `180`
  literals so drift checks verify values, not only option presence.

### Amendment 2: Actor Context Completeness

For browser-originated requests authenticated with `withAuth`, `clerkId` is
available and must be forwarded for verification and identity-transition flows.

Adapter rule:

- Destructure `clerkId` from auth context and pass it through actor objects for
  verification and onboarding mutations when domain contracts accept it.

Domain contract rule:

- Verification and onboarding domain contracts must explicitly declare whether
  `clerkId` is required or optional in actor types.
- Services that require Clerk-side correlation must not rely on implicit,
  undeclared `actor.clerkId` assumptions.

## Verification

1. Confirm `TIER1_RECENT_AUTH_MAX_AGE_SECONDS` is `180` and
   `TIER2_RECENT_AUTH_MAX_AGE_SECONDS` is `300` in
   `app/lib/security/high-risk-auth-windows.ts`.
2. Confirm Tier 1 route families (escrow, payout, and user-rights mutations)
   use the Tier 1 constant in adapter freshness options.
3. Confirm high-risk registry freshness snippets for Tier 1 operations verify
   numeric `180` values.
4. Confirm verification and onboarding adapters forward `clerkId` where domain
   actor contracts support Clerk correlation.

## Related Documentation

- `apps/client/docs/adr/ADR-006-data-classification.md`
- `apps/client/docs/adr/ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md`
- `.agent/API-TO-FRONTEND-ARCHITECTURE.md`
