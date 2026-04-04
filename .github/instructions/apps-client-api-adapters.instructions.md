---
description: "Use when editing apps/client API route handlers, HTTP methods, and adapter response mapping."
applyTo: "apps/client/app/api/**"
---

# Client API Adapter Boundary

Last aligned with canonical on: 2026-04-04.

## Scope

- Applies to route handlers in apps/client/app/api.
- Operationalizes adapter-layer policy from .github/copilot-instructions.md.

## Rules

1. Treat routes as adapters only. Keep business policy in app/lib/domains.
2. Route handlers call domain services and map Result outcomes to HTTP responses.
3. Keep role checks and actor enrichment aligned with withAuth or withRole where required.
4. For versioned entities, return ETag and enforce If-Match on PATCH and DELETE.
5. Emit structured adapter logs with correlationId, operationName, httpMethod, routePattern, actorRole, outcome, httpStatus, and durationMs.
6. Never log PII such as userId, clerkId, email, full payloads, or raw bodies.
7. Treat operationName as a stable observability join key and coordinate any rename.
8. Start durationMs timing at the first adapter statement before auth, parsing, and validation.
9. Read environment values through app/lib/infrastructure/env.ts, not process.env.
10. Apply CORS through shared policy helpers only; never return wildcard origin on authenticated or user-specific routes.
11. Enforce HTTP method semantics: GET routes must not parse request bodies.
12. Keep client-facing error messages safe and pre-approved; never pass raw exception strings to apiError.

## Validation

- Confirm no new business logic was added to route handlers.
- Confirm domain outcomes are mapped intentionally to status codes.
- Confirm logging fields, timing start point, and PII exclusions are present.
- Confirm CORS origin policy is helper-driven and not wildcarded for auth surfaces.
