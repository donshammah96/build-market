# Build Market — Copilot Instructions

> **Agent guideline:** For the detailed API-to-frontend blueprint, migration playbook, and architecture change log, see [`.agent/API-TO-FRONTEND-ARCHITECTURE.md`](../.agent/API-TO-FRONTEND-ARCHITECTURE.md).
>
> For the document hierarchy and conflict-resolution algorithm, see [`.agent/DOCUMENT-HIERARCHY.md`](../.agent/DOCUMENT-HIERARCHY.md).

## Instruction Discovery And Precedence

Use the instruction surfaces in this order:

1. `.github/copilot-instructions.md` — repo-wide defaults and hard rules.
2. `.agent/API-TO-FRONTEND-ARCHITECTURE.md` — when work touches `apps/client` routes, actions, domain services, client facades, hooks, or migration planning. **This is the implementational canon for `apps/client`. Do not duplicate its content here.**
3. `.agent/ADMIN-ARCHITECTURE.md` — when work touches `apps/admin` actions, domain services, or admin-specific patterns. **This is the implementational canon for `apps/admin`. Do not apply `apps/client` route patterns there.**
4. Slice-local docs such as `app/lib/domains/README.md` or route-family READMEs for implementation detail inside a single vertical.

Conflict rules:

- ADRs win over this file on any question they explicitly address.
- This file wins over `API-TO-FRONTEND-ARCHITECTURE.md` only for cross-package rules that apply outside `apps/client`.
- Narrower scope beats broader scope when rules are compatible.
- Stricter architectural boundary beats older permissive guidance when rules overlap.
- `apps/admin` follows its own section in this file; do not apply the client-app route model there.
- If this file and the architecture guide ever diverge, follow the stricter rule for the current task and surface the drift for resolution.

Discovery rules:

- Always consult this file first for workspace-wide behavior.
- Load the architecture guide whenever a task changes API-to-frontend flow in `apps/client`.
- Do not apply the architecture guide mechanically to unrelated packages or services outside its scope.

## Scoped Instruction Deconstruction

To keep this file canonical while reducing instruction sprawl, repository-scoped instruction files live under `.github/instructions/` and apply to narrow paths.

Deconstructed instruction map:

- `apps-client-api-adapters.instructions.md` for `apps/client/app/api/**`
- `apps-client-server-actions.instructions.md` for `apps/client/app/actions/**`
- `apps-client-domain-layer.instructions.md` for `apps/client/app/lib/domains/**`
- `apps-client-browser-facades.instructions.md` for `apps/client/lib/facades/**/*-client.ts` — canonical colocated facades (ADR-002 Phase 5); flat `lib/*-client.ts` stubs are `@deprecated`
- `apps-client-hooks-react-query.instructions.md` for `apps/client/lib/facades/**` — domain hooks are colocated with facades here; `apps/client/hooks/**` is now reserved for cross-domain and UI-only hooks
- `apps-client-env-boundary.instructions.md` for `apps/client/**`
- `apps-client-testing-risk.instructions.md` for `apps/client/__tests__/**`
- `apps-client-adr-authoring.instructions.md` for `apps/client/docs/adr/**`
- `apps-admin-action-boundaries.instructions.md` for `apps/admin/src/actions/admin/**` — governs `safeAction` wrapper, `AdminActor` forwarding, `.safeParse()` validation, domain service delegation, and declarative audit log requirements

Governance:

1. This file remains the canonical repo-wide policy source.
2. Scoped instruction files operationalize policy for specific paths and should stay concise.
3. When documents diverge, apply the stricter rule and resolve drift explicitly.

## Architecture Overview

Turborepo monorepo for a Kenya-focused construction marketplace connecting homeowners, professionals, vendors, and suppliers. The main frontends are `apps/client` on port `3500` and `apps/admin` on port `3005`. Package manager: `pnpm 11.1.2`.

Shared packages imported as `@build/<name>`:

- `@build/db` — Prisma client plus shared enums and types
- `@build/types` — shared Zod schemas and mirrored model contracts
- `@build/resilience` — resilient execution primitives
- `@build/redis` — cache helpers and Redis abstractions
- `@build/nats` — JetStream-based event messaging
- `@build/ui` — shared UI components

## Key Commands

```bash
pnpm install
pnpm run dev:client
pnpm run dev:admin
pnpm run db:migrate:deploy
pnpm run client:test:all
pnpm run client:tsc-noemit
pnpm run admin:check-types
pnpm run admin:check-env-contract
pnpm run admin:report-security-drift
pnpm run admin:test:all
```

## Canonical Client-App Architecture

> **Implementation patterns, code examples, and layer responsibility details live in `.agent/API-TO-FRONTEND-ARCHITECTURE.md`.** The sections below are navigational summaries only.

For `apps/client`, the canonical server-side business layer is `app/lib/domains/**`.

Primary dependency flow:

```text
browser consumer / hook
  -> lib/facades/<domain>/<name>-client.ts   ← canonical (ADR-002 Phase 5)
  -> app/api/<domain>/**
  -> app/lib/domains/<domain>/service.ts
  -> app/lib/domains/<domain>/repository.ts
  -> @build/db
```

> **Note:** Flat `lib/<domain>-client.ts` files are `@deprecated` backward-compat re-export stubs. New facades must be created under `lib/facades/<domain>/` and imported via `@/facades/<domain>/<name>-client`.

Server-side form or mutation workflows:

```text
Server Action
  -> secureAction
  -> app/lib/domains/<domain>/service.ts
  -> app/lib/domains/<domain>/repository.ts
```

Hard rules:

1. `app/api/*` and `app/actions/*` are adapters only.
2. `app/lib/domains/*` is the canonical home for business logic.
3. Repositories are persistence-only.
4. Hooks and client components must not import server actions or domain services directly.
5. Browser facades under `lib/facades/<domain>/` must use HTTP, not direct server imports.
6. Authorization-sensitive domain methods must accept typed actor context (`MarketplaceActor`, `AdminActor`, or `DomainActor` from `app/lib/domains/shared/contracts.ts`), not bare user IDs.
7. New business logic should not be added to `lib/services/*` unless the slice is explicitly still in migration.
8. Domain services must not import other domain services or repositories directly; cross-domain reads go through the owning domain `index.ts`, multi-domain writes are lifted into a shared orchestration surface, and cross-domain repositories live in `app/lib/domains/shared/repositories/`.

### TypeScript Path Aliases (enforced via `tsconfig.json`)

| Alias | Resolves to | Guards |
|---|---|---|
| `@/domains/*` | `app/lib/domains/*` | Domain boundary |
| `@/facades/*` | `lib/facades/*` | Client boundary (colocated facades + hooks) |
| `@/routes` | `lib/routes` barrel | No inline URL strings |
| `@/infra/*` | `app/lib/infrastructure/*` | Infrastructure boundary |
| `@/security/*` | `app/lib/security/*` | Auth/authz policy |
| `@/config/*` | `app/lib/config/*` | Domain constants |
| `@/validation/*` | `app/lib/validation/*` | Zod schemas |
| `@/ui/*` | `components/*` | Presentation |
| `@/app/lib/errors/result` | `app/lib/errors/result` | No local `Result` redefinitions |

New aliases require a corresponding `no-restricted-imports` rule reviewed in the same PR.

For full route handler structure, mock patterns, domain examples, and browser facade contracts, see Section 4 of `API-TO-FRONTEND-ARCHITECTURE.md`.

## Domain Layer Rules

`app/lib/domains/**` owns business policy, actor-aware authorization, orchestration, canonical DTO shaping, and structured `Result<T, DomainError>` outcomes.

`app/lib/domains/**/repository.ts` owns Prisma reads and writes only. Repositories must not own role checks, response envelopes, action or route semantics, or user-facing error strings.

**`Result<T, E>` import rule:** Import `Result`, `DomainError`, `ok()`, and `err()` from `@/app/lib/errors/result`. Local redefinitions (`DomainResult<T>`, `ServiceResult<T>`, or any custom `{ success: boolean }` shape) are boundary violations. The canonical discriminant is `ok` — not `success`.

**Shared repositories:** When a repository is consumed by more than one domain service, move it to `app/lib/domains/shared/repositories/<name>.repository.ts` and document it with `// Shared repository: consumed by [domain-a], [domain-b]`.

Use `app/lib/domains/README.md` as the current service-versus-repository reference.

## Server Actions

In `apps/client`, server actions are not the browser data-fetching layer. Use them for server-only form submissions, mutation flows that need revalidation, and authenticated workflows that should not go through a browser facade.

Requirements: `secureAction` for validated authenticated action flows; full actor context into the domain when authz matters; cache revalidation in the action layer; explicit DTOs across the action boundary.

`secureAction` contract in `app/lib/actions/secure-action.ts`:

1. Validates Clerk session and resolves a known DB user.
2. Constructs and forwards typed `DomainActor` context into the wrapped action.
3. Emits structured `validation_error` outcomes and returns typed errors for auth resolution failures (does not throw).

Cache invalidation rule: use `revalidatePath()` when invalidating a full route segment. Prefer `revalidateTag()` for fine-grained invalidation when tags are already instrumented.

Do not import server actions into hooks or `lib/*-client.ts`.

## Browser Client Facades and Hooks

Browser-facing facades live at `lib/facades/<domain>/<name>-client.ts` (canonical, ADR-002 Phase 5). They must use `fetch` or `apiFetch` against `/api/...`, parse normalized `ApiResponse<T>` envelopes, and define explicit DTOs at the network boundary. Flat `lib/*-client.ts` files are `@deprecated` backward-compat stubs — do not create new ones.

Domain hooks are colocated with their facade at `lib/facades/<domain>/use<Name>.ts`. Import from `@/facades/<domain>/use<Name>`. The `hooks/` root is reserved for cross-domain, infrastructure, and purely UI hooks (e.g., `use-toast.ts`, `usePerformance.ts`). Do not add domain-specific hooks there.

Hooks must use React Query, centralize `unwrapApiResponse()` error handling, own query keys and invalidation behavior, preserve caller-provided mutation callbacks after internal invalidation, and follow TanStack Query v5 signatures exactly.

Query caching default: prefer a `QueryClient` app-level `staleTime` default (`60_000` for read-heavy, slower-changing data), and override to `staleTime: 0` only for genuinely volatile data (for example messaging and notification counters).

## Auth Model

For `apps/client`, Clerk is the primary runtime identity provider. Authorization is enforced in domain services or policy helpers, not only in middleware. Database role and profile state enriches the actor; it is not an alternate identity provider.

Common auth helpers: `withAuth(handler)` for authenticated API routes; `withRole([...])` when route-level gating is still appropriate.

`withAuth` must fail closed. Any failure to resolve Clerk identity (timeout, upstream 5xx, malformed or expired token, or session parsing failure) returns `401` and must not execute the wrapped handler.

Fail-open auth fallbacks are prohibited. Adapters must not continue execution as anonymous or best-effort authenticated when Clerk resolution fails.

Actor context shape: use typed actor types from `app/lib/domains/shared/contracts.ts` — `MarketplaceActor`, `AdminActor`, or `DomainActor`. Passing a bare `{ userId, clerkId, role }` object literal is not sufficient for authorization-sensitive operations. `clerkId` may be absent in service-to-service calls without a Clerk session; domain contracts must explicitly declare whether it is required or optional.

For admin-capability-gated operations, adapters must construct and pass an admin actor with non-null `adminRole` resolved from the DB user record (not from Clerk claims), following ADR-007.

Role-mutation operations must synchronize Clerk `publicMetadata.role` before finalizing successful responses so active sessions do not retain stale privilege claims (see ADR-001 and ADR-007). If the Clerk metadata update fails, treat the entire mutation as failed, keep the operation idempotently retryable, and return a retryable `503` — never emit a successful privilege-changing response with a stale session.

Session cookies from Clerk (or future session providers) must be verified to include `HttpOnly`, `Secure` (in production), and at least `SameSite=Lax`. `SameSite=None` requires explicit cross-origin embedding justification.

Sensitive mutations must enforce recent-auth or freshness assertions in the adapter layer before domain execution. This is mandatory for financial operations, role or verification transitions, and account-identity mutations.

## Validation, Idempotency, and Concurrency

Use shared helpers: `app/lib/api-guards.ts`; `app/lib/services/idempotency.service.ts` for replay policy registration; `app/lib/services/idempotency-helpers.ts` for `safeIdempotencyComplete()` — the canonical completion wrapper (use this in route and action handlers instead of writing inline try-catch); `app/lib/services/*-operations.service.ts` for optimistic-lock flows; and `app/lib/config/<domain>.config.ts` for shared constants.

Idempotent replay storage is a governed persistence boundary:

1. New idempotent route or action scopes must register an explicit replay policy in `app/lib/services/idempotency.service.ts` before `IdempotencyService.complete()` may persist their success payload.
2. Replay payloads must be the public DTO or response envelope already exposed to clients, never raw provider payloads, raw Prisma records, or ad-hoc internal objects.
3. Default replay policy allows only ADR-006 Class C and Class D fields. Any scope that must retain minimum-necessary Class B fields to preserve an existing public contract must opt in explicitly in the registry and remain reviewable there.
4. Class A data is never allowed in replay persistence.

For versioned entities: GET and successful mutation responses return `ETag`; PATCH and DELETE require `If-Match`; route adapters map conflict outcomes to `409`.

## Observability and Operational Readiness

For `apps/client`, observability is part of the adapter contract, not optional debug output.

Hard requirements:

1. Route handlers and server actions must emit structured, machine-readable log events (not ad-hoc `console.log` output).
2. Structured events should include at least: `correlationId`, `operationName`, `httpMethod`, `routePattern`, `actorRole`, `outcome`, `httpStatus`, and `durationMs`.
3. Do not log PII: never log `userId`, `clerkId`, `userEmail`, `phone`, `nationalId`, `idNumber`, raw request bodies, or response payload bodies.
4. Domain services and repositories must not own logging concerns. Domain returns structured `Result<T, DomainError>`; adapter layers log final outcomes.
5. Treat `operationName` as a stable observability join key. Renaming it is a breaking observability change and requires coordinated dashboard updates.
6. `durationMs` timing starts at the first adapter statement (before auth, parse, and validation) and ends at response mapping.
7. Operational metrics are derived from structured logs, so field-name stability is part of the runtime contract.

For admin-gated operations, `actorAdminRole` is an allowed optional structured log field (enum-only, non-PII) per ADR-005 and ADR-007.

Use Section 5.6 in `.agent/API-TO-FRONTEND-ARCHITECTURE.md` and ADR-005 for full contract details and migration guidance.

## DTO Boundary Rules

Do not rely on implicit Prisma or server-action return inference across HTTP or action boundaries. Prefer explicit DTO interfaces, `Date` fields serialized to `string`, explicit `ApiResponse<T>` generics in browser facades, and explicit action return types when crossing the Next.js serialization boundary.

Use the canonical `Result<T, DomainError>` type from the domain layer. Import it; do not re-define a local `Result` union. If import locations vary by slice, use `app/lib/domains/README.md` as the source of truth.

DTOs crossing HTTP or server-action boundaries should classify fields using `ADR-006-data-classification.md`. DTOs carrying Class A or Class B fields require explicit minimum-necessary-surface review notes.

This rule is mandatory for browser-facing hooks and client facades.

## Database and Persistence Rules

- Prisma schema lives in `packages/db/prisma/schema.prisma`
- Most core models use UUID primary keys and explicit `@@map` table names
- Soft-deleted models should be queried with `deletedAt: null` unless the use case intentionally includes deleted records
- Kenya-specific enums and compliance fields are part of the core domain model and should not be bypassed in validation or DTO shaping

## Testing Standards

Tests for `apps/client` live under `apps/client/__tests__/` with Vitest globals enabled.

Testing is risk-centric, not only layer-centric. For material architecture changes, include coverage that addresses boundary, policy, and journey risks as applicable:

1. Direct domain tests for business rules and authorization.
2. Focused route or action tests for adapter mapping.
3. Hook or client-facade tests when browser-side contracts change.
4. Contract tests for boundary shape regressions (`__tests__/contracts/**`) when repository/service or DTO edges change.
5. Policy matrix tests (`__tests__/policy/**`) for authorization-sensitive operations.
6. Critical-journey E2E tests for protected-route and high-risk authz flows (blocking CI surface when impacted).

Route test patterns, mock structure, risk matrix expectations, and critical-journey requirements are documented in Section 7 of `.agent/API-TO-FRONTEND-ARCHITECTURE.md`.

Preferred verification commands:

**`apps/client` and Global:**
- `pnpm run format:check` and `pnpm run lint` for formatting and linting
- `pnpm run client:check-env-contract` and `pnpm run client:report-security-drift:strict` for boundary/security checks
- `pnpm run client:tsc-noemit` or `pnpm run check-types` for type checking
- `pnpm run test` for unit tests, or targeted `pnpm run client:test:<suite>` commands
- `pnpm -C apps/client exec vitest run __tests__/contracts __tests__/policy` for fast boundary and policy checks
- `pnpm run cypress:run --spec "cypress/e2e/critical-journeys/**"` when protected-route or authz behavior is touched

**`apps/admin`:**
- `pnpm run admin:check-types` for type checking
- `pnpm run admin:lint` for linting
- `pnpm run admin:check-env-contract` for env boundary checks
- `pnpm run admin:report-security-drift:strict` for security drift checks
- `pnpm run admin:test:all` for all admin tests

Critical-journey E2E tests are a blocking CI surface for high-severity auth and routing regressions. Mandatory journeys include unauthenticated redirect, onboarded professional access, non-professional denial, incomplete onboarding redirect, thread read authz, and thread send authz.

## Client-Side Patterns

- Use React Query for browser-side fetching and mutations
- Treat `apiSuccess()` responses as wrapped envelopes and unwrap deliberately
- Use `lib/routes/*.routes.ts` route constants and URL helpers instead of ad hoc path strings
- Keep browser code free of server-only imports

## UI And Presentation Standards

For `apps/client`, onboarding and form workflows must follow the Section 3 invariants in `.agent/API-TO-FRONTEND-ARCHITECTURE.md`: progressive profiling, one primary CTA per view, explicit validation state machine (`untouched`, `touched`, `validating`, `valid`, `invalid`), eight interactive component states, WCAG AA accessibility wiring, conversion instrumentation, and desktop and mobile readiness before completion.

## Anti-Patterns Callout

Reject high-risk boundary violations during review, especially:

1. Browser or hook imports of server actions or domain services.
2. Business logic or Prisma-heavy orchestration embedded in route handlers.
3. Repository-level authorization checks, HTTP semantics, or user-facing strings.
4. Direct `process.env` reads outside the canonical env boundary.
5. Unstructured logging or any log event that includes PII.
6. `Access-Control-Allow-Origin: *` on authenticated or user-specific routes. Allowed origins must be controlled by shared CORS policy with `envConfig`-driven allowlists.
7. Webhook or callback handlers that skip signature verification and replay-window enforcement before processing.

The full reject list is maintained in Section 6 of `.agent/API-TO-FRONTEND-ARCHITECTURE.md`.

## Event Messaging (NATS JetStream)

Use `@build/nats` for cross-service communication instead of ad hoc internal HTTP when a workflow is event-oriented.

Core components: `JetStreamProducer`, `JetStreamConsumer`, `StreamManager`, `createServiceClient(name)`.

## Admin App (`apps/admin`)

> **Canonical architecture guide:** `.agent/ADMIN-ARCHITECTURE.md` — read this before touching `apps/admin` code.
> **Admin ADR precedent:** `apps/admin/docs/adr/ADR-ADMIN-001` through `ADR-ADMIN-009`
> **Current overhaul state:** `apps/admin/docs/PROGRESS-SUMMARY.md` (Phases 0–5 complete; Phases 6–12 queued)

`apps/admin` differs materially from `apps/client`. It is a Next.js app with a `src/` layout that uses server actions as its primary interaction model, not the browser-facade + API-route pattern of the client app.

### Admin Action Model

All authenticated admin mutations must use `safeAction`. The wrapper:

1. Resolves Clerk identity server-side and requires an active database `AdminProfile`.
2. Authorizes using `AdminRole` and explicit `AdminCapability` policy maps — not raw role-string comparisons.
3. Enforces session freshness: Tier 1 operations (role changes, deletion, data export, financial mutations) require `maxAgeSeconds: 180`; Tier 2 (verification overrides, account transitions) require `maxAgeSeconds: 300`.
4. Applies actor-scoped rate limits.
5. Optionally attaches declarative `auditLog` metadata for classified high-risk operations.

```typescript
// Canonical AdminActor shape (ADR-ADMIN-001)
type AdminActor = {
  clerkId: string;
  dbUserId: string;
  adminRole: AdminRole; // resolved from DB AdminProfile, not Clerk claims
};
```

### Admin Layer Responsibilities (ADR-ADMIN-002)

- **`src/actions/admin/`** — adapter layer: input validation (`.safeParse()` mandatory, `.parse()` prohibited), actor resolution, capability checks, domain calls, cache revalidation, audit log attachment.
- **`src/lib/domains/<slice>/service.ts`** — business logic: `AdminCapability` enforcement, `Result<T, AdminDomainError>` outcomes. Must not contain Prisma queries or HTTP semantics.
- **`src/lib/domains/<slice>/repository.ts`** — persistence only: Prisma reads and writes. No authorization, no response envelopes, no user-facing error strings.
- Import direction is `actions → services/domains → repositories`. Nothing imports from the action layer.

### Admin Audit Log (ADR-ADMIN-008)

Audit entries are required for: role changes, user suspension/deletion, data export, manual payment operations, verification overrides, and content moderation actions. Use declarative `auditLog` in `safeAction` options rather than manual audit calls.

### Admin Env Boundary (ADR-ADMIN-006)

All runtime `process.env` reads must go through `adminEnvConfig` from `src/lib/infrastructure/env.ts`. Direct `process.env` is a tracked critical drift finding. Bootstrap exceptions (`next.config.ts`, `instrumentation.ts`) must carry `// bootstrap-only: <reason>` comments.

### Admin Feature Flags (ADR-ADMIN-009)

New admin behavior ships behind `AdminFeatureFlag` values. Old routes remain functional until a documented retirement step. Rollback is performed by disabling the flag. Do not ship new admin behavior without a flag gate during the active overhaul.

### Admin Hard Rules

1. Direct Prisma in `src/actions/admin/**` is a critical defect — migrate to domain repository.
2. `.parse()` in action files is prohibited — use `.safeParse()` and return a typed error.
3. Raw `AdminRole` string comparisons are prohibited — use `AdminCapability` maps.
4. `adminRole` must be resolved from the database `AdminProfile`, not from Clerk session claims.
5. High-risk operations must have declarative `auditLog` in `safeAction`.
6. Direct `process.env` reads in non-bootstrap files are a security drift finding.
7. Do not apply `apps/client` resilience, Redis, or NATS patterns in `apps/admin` — the admin app does not use them.

## Staff Engineer Mandate

When making architectural or design decisions:

**For `apps/client`:**

- Prioritize consistency with accepted ADRs and migrated slices over local convenience.
- Move business logic toward `app/lib/domains/<slice>/` rather than adding adapter-local orchestration.
- Preserve actor-aware authorization boundaries.
- Apply idempotency, optimistic locking, and consent or compliance rules where the business flow requires them.
- Use `getResilientExecutor().execute()` for client-app API operations.
- Prefer structured result mapping over exception-string parsing.
- Preserve observability contracts: structured adapter logging, PII exclusions, and stable `operationName` semantics.

**For `apps/admin`:**

- Use `safeAction` for all authenticated admin mutations — never call domain services from unwrapped actions.
- Enforce authorization through `AdminCapability` maps, not raw `AdminRole` string comparisons.
- Write declarative `auditLog` in `safeAction` for all high-risk operations (role changes, deletion, data export, verification overrides, manual payment operations).
- Keep action files as thin adapters — business logic belongs in domain services.
- Use `adminEnvConfig` for all env access — reject new `process.env` reads outside the boundary.
- Gate new admin behavior behind `AdminFeatureFlag` values during the active overhaul.
- Run `pnpm run admin:report-security-drift` after touching admin action or domain files to confirm drift count does not increase.

Current reference slices for canonical client-app patterns: projects, properties, portfolio, messaging, CRM, user-profile.

Current reference slices for canonical admin patterns: `src/actions/admin/users.ts`, `src/actions/admin/verification.ts`, `src/lib/domains/users/`, `src/lib/domains/verification/`.

Current client migration priority queue: professionals, calendar, idea books, notifications, seller dashboard read models (`inventory`, `orders`, `products`), reviews.

Current admin overhaul priority: Phase 5 remaining action slices (audit/GDPR, finance, content, stores/properties/projects, leads/services/professionals).

## Project-Specific Conventions

### Kenya Context

Kenya context matters: counties, M-Pesa, NCA, EBK, BORAQS, and KRA semantics should be reflected in naming and validation.

### Layout and Naming

- `apps/admin` uses `src/`; `apps/client` does not.
- Do not define inline service classes inside route files.
- Use `lib/routes/<domain>.routes.ts` domain files or the `@/routes` barrel import for route URL constants and helpers. `lib/links.ts` is a backward-compat re-export stub only (ADR-002 Phase 5) — do not add new entries there.

### Canonical Env Access Boundary

**Canonical module:** `apps/client/app/lib/infrastructure/env.ts`

All environment variable reads in `apps/client` must go through this module. This mirrors the principle that repositories own all Prisma access — env config is an infrastructure concern, not something route handlers or domain services should reach for directly.

Rules:

1. **New code** imports env config from `app/lib/infrastructure/env.ts` only. Direct `process.env.*` reads in routes, services, or UI code are architectural debt.
2. The canonical module validates env values at startup (Zod or equivalent) and exposes typed accessors. Callers receive typed values, not raw strings.
3. **Bootstrap-only exceptions** (`next.config.ts`, `instrumentation.ts`, `sentry.*.config.ts`, and edge-runtime `proxy.ts` before module initialization) may read `process.env` directly. Each exception must carry:
   ```ts
   // bootstrap-only: module graph not initialized at this callsite
   ```
   Bootstrap exceptions must also be listed as a comment block in `app/lib/infrastructure/env.ts` so the full env inventory is auditable from one place (see ADR-004).
4. **Refactor strategy:**
   - New code: import from canonical module, never `process.env` directly.
   - Existing direct reads: migrate in batches during regular slice work. Tag unmigrated reads with `// env-migration-pending` so they are grep-able.
   - Bootstrap-only exceptions: document and freeze. Do not let the exception list grow.

See ADR-002 for the full rationale and migration notes.

### Onboarding and Form Payload Hygiene

When handling onboarding or form payload arrays, explicitly map them into strict domain input shapes instead of passing loosely structured UI payloads through.

### Operations Services

If a slice already has an operations service for optimistic locking, use it rather than re-implementing update or delete logic inline.

### Security Headers

`apps/client/next.config.ts` must define a baseline security header set for all route responses:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` with `default-src 'self'`, explicit origin allowlists, no `unsafe-eval`, and no wildcard script origins

CSP source exceptions must be justified inline in config, including whether the source is first-party or third-party and why it is required.

### HTTP Surface Security

ADR-008 is the canonical policy for HTTP surface controls in `apps/client`. Route and webhook adapters must follow consolidated rules for CORS, CSRF, anti-caching, security headers, and callback integrity.

Key requirements:

- CORS allowlists must be `envConfig`-driven and fail closed.
- Cookie-authenticated unsafe methods must enforce trusted-origin checks (and CSRF tokens where required).
- Sensitive responses must default to non-cacheable headers.
- Webhook and callback endpoints must verify signatures and enforce replay protection before business processing.

## Documentation Lifecycle (ADR-009)

Three document categories govern how documentation is treated (see `apps/client/docs/adr/ADR-009-documentation-lifecycle.md`):

| Category | Location | Status header | Lifespan |
|---|---|---|---|
| **Living** | `docs/adr/`, `app/lib/` | Updated continuously | Permanent — never deleted, only superseded |
| **Progress / implementation plans** | `docs/progress/` | `In Progress` / `Complete` / `Superseded` | Archived to `docs/archive/` within one sprint of completion |
| **Ephemeral working notes** | `docs/scratch/` (if committed at all) | `Status: EPHEMERAL` or `Expires: YYYY-MM-DD` | Deleted at end of work window; never reference from code or ADRs |

Enforcement rules:

- A PR that changes architecture without updating the relevant ADR is blocked at review.
- Completed progress docs must be moved to `docs/archive/` — not left in `docs/progress/` as stale snapshots.
- Ephemeral notes must never be referenced from code, ADRs, or living documents.
- Completions must be summarized in `apps/client/docs/CHANGELOG.md`.
