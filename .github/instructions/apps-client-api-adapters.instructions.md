---
description: "Use when editing apps/client API route handlers, HTTP methods, and adapter response mapping."
applyTo: "apps/client/app/api/**"
---

# Client API Adapter Boundary

Last aligned with canonical on: 2026-06-05.
Previous alignment: 2026-03-30.
Change rationale: Autopsy report 2026-04-11 identified four adapter-layer
patterns that escaped both code review and drift enforcement: variable-rebound
domain message passthrough, unconditional rethrow of idempotency completion
failures, actor context omissions, and missing registry entries for new routes.

## Scope

- Applies to route handlers in apps/client/app/api.
- Operationalizes adapter-layer policy from .github/copilot-instructions.md and
  API-TO-FRONTEND-ARCHITECTURE.md Sections 4, 5, and 6.

## Rules

1.  Treat routes as adapters only. Keep business policy in app/lib/domains.
2.  Route handlers call domain services and map Result outcomes to HTTP responses.
3.  Keep role checks and actor enrichment aligned with withAuth or withRole where
    required.
4.  For versioned entities, return ETag and enforce If-Match on PATCH and DELETE.
    DELETE handlers must use extractExpectedVersionFromIfMatch() directly - never
    extractExpectedVersion(), which retains a body-fallback path incompatible with
    GAP-017 header-only semantics.
5.  Emit structured adapter logs with correlationId, operationName, httpMethod,
    routePattern, actorRole, outcome, httpStatus, and durationMs.
6.  Never log PII such as userId, clerkId, email, full payloads, or raw bodies.
7.  Treat operationName as a stable observability join key and coordinate any rename.
8.  Start durationMs timing at the first adapter statement before auth, parsing,
    and validation.
9.  Read environment values through app/lib/infrastructure/env.ts, not process.env.
10. Apply CORS through shared policy helpers only; never return wildcard origin on
    authenticated or user-specific routes.
11. Enforce HTTP method semantics: GET routes must not parse request bodies.
12. Keep client-facing error messages safe and pre-approved; never pass raw
    exception strings to apiError(). This prohibition covers all of the following
    forms - they are semantically identical to apiError(error.message, ...) and
    are all violations:

        ```
        apiError(err.message ?? "fallback", status)
        apiError(data.message ?? "fallback", status)
        apiError(result.data.message ?? "fallback", status)
        apiError((data as { message?: string }).message ?? "fallback", status)
        apiError((err as { message: string }).message, status)
        ```

        The variable name does not matter. If the string passed to apiError() as the
        first argument is derived from a domain result field (error.message,
        data.message, result.data.message, or any locally rebound form), it is not
        a pre-approved message. Use a static string constant instead and log the
        domain message at warn level with the correlation ID.

13. Wrap every IdempotencyService.complete() call in an isolated try-catch that
    marks the key failed and logs the error, but does NOT rethrow. The domain
    operation succeeded when complete() throws - the client must receive the
    success response. Rethrowing causes a 500 response after a successful domain
    mutation and leaves the key in PENDING, blocking retries. See the required
    pattern in API-TO-FRONTEND-ARCHITECTURE.md Section 5.A.

14. Destructure clerkId from AuthContext and include it in the actor object for
    all handlers that call verification or identity-transition domain services.
    Confirm the domain contract accepts clerkId before forwarding. Never silently
    omit it from routes that handle document, license, certificate, or onboarding
    mutations.

15. Every route that performs a Tier 1 (financial, identity-destruction) or Tier 2
    (verification, account-transition) sensitive operation must have a corresponding
    entry in HIGH_VALUE_ROUTE_GUARD_RULES in app/lib/security/high-risk-registry.ts.
    Adding a financial or verification mutation route without a registry entry is a
    review-blocking defect. A clean drift run does not verify an unregistered route.

16. Use getActorRateLimitIdentifier(dbUserId, namespace) for rate-limit keys on all
    authenticated high-risk routes. getRateLimitIdentifier(req) (IP-based) is only
    acceptable for public/unauthenticated surfaces. Rate-limit namespaces must be
    consistent within a resource family: use a single prefix (e.g., "certificates-")
    for all operations on the same resource type, not mixed plural/singular forms.

17. Tier 1 operations (financial mutations, identity destruction) must use
    recentAuth: { maxAgeSeconds: 180 }, not the default 300. Confirm the named
    constant's assigned value, not just its presence in the options block.
    Tier 2 operations (verification, onboarding) use recentAuth: { maxAgeSeconds: 300 }.

## Validation

- Confirm no new business logic was added to route handlers.
- Confirm domain outcomes are mapped intentionally to status codes.
- Confirm logging fields, timing start point, and PII exclusions are present.
- Confirm CORS origin policy is helper-driven and not wildcarded for auth surfaces.
- Confirm apiError() first argument is a static string constant - not any form of
  domain result message field, regardless of variable name.
- Confirm IdempotencyService.complete() has an isolated try-catch that does not
  rethrow, and that the catch block calls fail() and logs before falling through.
- Confirm clerkId is destructured and forwarded for verification and identity
  routes.
- Confirm the route has a registry entry in high-risk-registry.ts if it performs
  a Tier 1 or Tier 2 operation.
- Confirm actor-scoped rate-limit keys are used for authenticated routes, and
  the namespace is consistent with the rest of the resource family.
- Confirm Tier 1 routes use maxAgeSeconds: 180 and Tier 2 routes use
  maxAgeSeconds: 300 - verify the constant value, not just the constant name.
