# API Design

## Purpose

This document explains how the `apps/client` API should be designed, not just what utilities exist.

It captures the intended shape of route and action adapters, the current domain-core architecture, and the design constraints that keep the client app maintainable as more slices move onto the canonical boundary.

## Design Principles

### Thin Adapters

Routes and server actions should be small transport shells.

They may own:

- auth extraction
- rate limiting
- validation
- idempotency setup
- resilience wrappers
- cache revalidation
- HTTP or action response mapping

They should not own:

- resource authorization logic
- business transitions
- persistence orchestration for domain behavior
- duplicated actor-resolution or validation patterns when shared helpers exist

### Domain-Centered Business Logic

Business behavior belongs in `app/lib/domains/**`.

The domain layer should be where the code answers questions like:

- can this actor read or mutate the resource?
- what constitutes a valid transition?
- how should public-safe or client-safe DTOs be shaped?
- what follow-on side effects are required?

### Persistence as an Implementation Detail

Repositories exist to isolate Prisma and transactional data access.

They should support the service layer, not replace it.

### Explicit Outcome Mapping

Expected domain failures should surface as structured domain errors, then be mapped at the adapter boundary.

This keeps HTTP semantics out of the core business layer while preserving precise route behavior.

## Canonical Request Flow

### Route Flow

```text
Request
  -> correlation id
  -> rate limit
  -> auth / actor resolution
  -> schema validation
  -> resilient executor
  -> domain service
  -> domain result mapping
  -> API response envelope
```

### Server Action Flow

```text
Action invocation
  -> secureAction actor resolution
  -> schema validation
  -> domain service
  -> domain result mapping
  -> cache revalidation
  -> action response
```

## Current Architecture Shape

```text
app/api/** or app/actions/**
  -> app/lib/security/** and transport helpers
  -> app/lib/domains/**
      -> repository.ts
      -> service.ts
      -> contracts.ts
      -> supporting modules
  -> @build/db and other infrastructure only through repositories or focused infrastructure helpers
```

For browser consumers:

```text
components / hooks
  -> lib/*-client.ts facades
  -> /api/**
```

## Core Design Decisions

### Authentication

Clerk is the runtime identity provider.

Implications:

- middleware and adapters should rely on Clerk-derived identity
- database role/profile state enriches the actor, but does not replace identity
- legacy alternate auth surfaces are compatibility debt, not architectural precedent

### Authorization

Authorization must live in services or shared policy helpers, not only middleware.

Why:

- middleware can decide entry, but not resource ownership
- actions and routes need the same reusable policy behavior
- domain tests should prove permission logic directly

### Actor Propagation

Pass full actor context into the domain.

Avoid raw `dbUserId`-only service signatures when:

- role affects behavior
- admin override exists
- `403` versus `404` matters
- collection reads require policy enforcement

### Result Contracts

Use normalized `Result<T, DomainError>` contracts in migrated domains.

This makes route and action boundaries predictable and easier to test.

### Rollout Gates

When a capability is staged behind a flag, enforce the gate at every public consumer entrypoint, not just one implementation path.

The generic projects API is the current reference case.

## Utility Roles

### `api-middleware.ts`

Use for:

- Clerk-backed route auth
- coarse role entry checks
- typed actor context extraction

Do not use it as a substitute for resource authorization.

### `resilient-api.ts`

Use for:

- correlation IDs
- structured logging
- resilient executor access
- canonical success and error envelopes

Prefer `getResilientExecutor().execute(...)` over older ad hoc or legacy wrappers.

### `api-response.ts`

Use for:

- `HttpStatus`
- response types
- error code constants where they remain useful

Treat its older response builders as compatibility utilities, not the main design center.

### `api-utils.ts`

Use for:

- pagination parsing
- shared query helpers
- composable adapter-level helpers

Keep it focused on transport concerns. It should not become a hidden business-logic bucket.

### `rate-limit.ts`

Use shared rate tiers and central helpers rather than route-local implementations.

## Reference Vertical Patterns

These slices are the strongest current examples of the intended design:

- messaging for actor-aware service enforcement and thin route adapters
- projects for a large route family delegating into a canonical service with rollout-gated client access
- CRM for public versus authenticated service contracts inside one domain family
- user-profile for onboarding, completion-state sync, and compliance orchestration

## Anti-Patterns to Avoid

- route files that import Prisma and also make authorization decisions
- server actions with duplicated auth parsing instead of `secureAction`
- repositories returning HTTP-shaped outcomes
- browser hooks importing `app/lib/domains/**`
- using middleware to carry business rules that should be shared across routes and actions
- keeping deprecated compatibility layers alive after all consumers have moved

## Testing Expectations

A staff-level change should usually prove behavior at more than one layer.

Recommended coverage mix:

- direct domain tests for policy and business rules
- route or action tests for transport mapping
- hook or client-facade tests when the consumer contract changed

This pattern is already used in the migrated CRM, projects, properties, portfolio, onboarding, and profile slices.

## How To Add a New API Slice

1. Create a domain folder under `app/lib/domains/<slice>/`.
2. Add `contracts.ts` if the slice needs route-safe or action-safe schemas and DTOs.
3. Add `repository.ts` for Prisma access.
4. Add `service.ts` for business rules, actor enforcement, and result shaping.
5. Keep routes thin and map domain errors explicitly.
6. Use `secureAction` for server actions.
7. Add direct domain tests and focused adapter tests.
8. Update the slice README, ADRs if the boundary changed materially, and the changelog.

## Bottom Line

The API design for `apps/client` is intentionally converging on a domain-first model with small adapters, explicit actor propagation, shared result contracts, and repository isolation. Any new API work should reinforce that direction rather than introduce one-off route patterns.
