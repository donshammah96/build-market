# ADR-008: HTTP Surface Security

Status: Accepted
Owner: Client Architecture
Next review: 2026-12-03

## Status

Accepted

## Context

`apps/client` exposes authenticated API routes, webhook receivers, and browser-facing mutations that share the same HTTP attack surface. Existing rules are distributed across multiple docs and are easy to apply inconsistently per route.

The highest-risk gaps are not domain-policy gaps; they are transport and edge-boundary gaps:

- CORS drift on authenticated routes
- CSRF exposure on cookie-authenticated unsafe methods
- Sensitive response caching at browser/proxy/CDN layers
- Incomplete or inconsistent security headers
- Weak webhook and callback authenticity/replay checks

These controls must be governed as one cohesive HTTP security policy, not as isolated per-feature guidance.

## Decision

Adopt a consolidated HTTP surface security contract for all `apps/client` API and webhook adapters.

### 1. CORS Policy (Fail Closed)

CORS configuration is centralized and `envConfig`-driven.

Rules:

1. Authenticated or user-specific routes must not use `Access-Control-Allow-Origin: *`.
2. Allowed origins must come from a typed allowlist sourced from `app/lib/infrastructure/env.ts`.
3. If credentials are allowed, `Access-Control-Allow-Credentials: true` must only be emitted for allowlisted origins.
4. Preflight handling must be adapter-consistent and not route-local ad hoc logic.
5. CORS failures must fail closed (no permissive fallback origin).

### 2. CSRF Controls For Cookie-Auth Mutations

For unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) that rely on browser cookies, adapters must enforce CSRF protections.

Rules:

1. Validate `Origin` against the same trusted-origin policy used by CORS.
2. Reject missing or mismatched origin on unsafe methods with `403`.
3. Require a CSRF token mechanism for cross-origin embedding scenarios (`SameSite=None`) or any route that cannot rely on strict same-site guarantees.
4. Domain services do not own CSRF checks; CSRF is an adapter boundary concern.
5. Service-to-service routes that do not rely on browser cookies are exempt from CSRF token checks but must still enforce authentication and integrity controls.

### 3. Anti-Caching Contract For Sensitive Responses

Sensitive responses must not be cacheable by browsers, shared proxies, or CDNs.

Rules:

1. User-specific authenticated responses must emit `Cache-Control: no-store, max-age=0`.
2. Include compatibility headers for legacy intermediaries where required (`Pragma: no-cache`, `Expires: 0`).
3. Do not return cacheable responses for endpoints that expose profile, consent, finance, verification, messaging, or webhook-processing outcomes.
4. For responses that can be cached, caching must be intentional and documented by route family.

### 4. Security Header Baseline

`apps/client/next.config.ts` defines the default header baseline for all route responses.

Required baseline:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` with:
  - `default-src 'self'`
  - explicit allowlists per source type
  - no `unsafe-eval`
  - no wildcard script origins

Governance:

- CSP source exceptions require inline justification in config (source owner, reason, and necessity).
- `next.config.ts` is a bootstrap exception for direct env access and must remain tightly scoped per ADR-004.

**Implemented (Nonce Strategy):**

- **CSP `script-src-elem` Nonce:** Per-request cryptographic nonces are generated in middleware, injected into the CSP header for document responses, and passed to Clerk via `ClerkProvider`. `script-src` and `script-src-elem` both carry the nonce to ensure consistent enforcement.
- **Current fallback:** The static CSP in `next-config-csp.ts` retains `script-src-elem 'unsafe-inline'` until production shows zero CSP violations across the rollout window.
- **Phase 2 follow-ups:** Remove the static `'unsafe-inline'` fallback after the rollout gate and consolidate duplicated CSP origin arrays between the middleware and static CSP builders.
- **Verification:** `__tests__/middleware/csp-nonce.test.ts` and `__tests__/middleware/route-guards.test.ts` cover nonce generation, CSP directive assembly, and middleware header injection.

### 5. Webhook And Callback Integrity

Webhook and callback handlers are authenticity-first adapters.

Rules:

1. Verify provider signatures before any business processing.
2. Enforce replay protection using timestamp window checks and replay-key tracking.
3. Compare signatures in constant time.
4. Use idempotent processing semantics for duplicate deliveries.
5. Reject unsigned, expired, or malformed callbacks with non-2xx status and structured audit logging.
6. Secrets for callback verification come from canonical env boundaries only (`app/lib/infrastructure/env.ts`), never inline constants.
7. Callback routes must not accept trust-by-IP as the only authenticity control.

## Implementation Boundaries

- Adapter layer owns CORS, CSRF, anti-caching headers, header baselines, and webhook authenticity checks.
- Domain layer owns business authorization and invariants after adapter admission succeeds.
- Repository layer remains persistence-only and does not branch on HTTP security concerns.

## Consequences

### Positive

- One canonical contract reduces route-family drift and copy-paste security regressions.
- Security controls become reviewable as architecture invariants instead of local implementation detail.
- Incident response improves because transport-level failures map to consistent adapter behavior and logs.

### Negative

- Existing routes may need incremental refactors to align with centralized CORS/CSRF/header handling.
- Strict anti-caching defaults can reduce perceived performance if teams previously depended on implicit cache behavior.
- Webhook replay protection introduces small storage and operational overhead.

## Migration Notes

1. Standardize CORS/origin allowlist resolution through shared helpers using `envConfig`.
2. Enforce unsafe-method origin checks across cookie-authenticated adapters.
3. Normalize anti-caching headers on sensitive route families.
4. Confirm security header baseline in `next.config.ts` and document each exception.
5. Refactor webhook handlers to strict signature verification and replay-safe idempotency.
6. Add policy and adapter tests for:
   - wildcard CORS rejection on authenticated routes
   - CSRF origin rejection
   - no-store headers on sensitive responses
   - webhook signature/replay rejection paths

## Related Documentation

- `ADR-001-auth-model.md`
- `ADR-002-client-layer-boundaries.md`
- `ADR-004-cannonical-env-access-boundary.md`
- `ADR-005-cannonical-observability-contract.md`
- `ADR-006-data-classification.md`
- `ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md`
- `.agent/API-TO-FRONTEND-ARCHITECTURE.md`
- `.github/copilot-instructions.md`
