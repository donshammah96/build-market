# Admin Architecture Guidelines

This document defines the canonical architecture for adding, refactoring, hardening, or operating a production-critical surface in `apps/admin`.

Use it when:

- adding a new admin domain (audit, finance, content, users, verification, etc.)
- migrating an action slice from direct Prisma to the domain service boundary
  - auditing an existing action, route, job, queue, or browser-facing admin surface against the hardened action architecture
  - implementing production-readiness work from [ADMIN-PRODUCTION-READINESS-AUDIT.md](file:///c:/Users/User/build-market/apps/admin/docs/ADMIN-PRODUCTION-READINESS-AUDIT.md)
  - implementing or reviewing ADR-ADMIN-010 through ADR-ADMIN-016

This is not a generic pattern library. It is the repo-specific source of truth for how `apps/admin` is structured after the Phase 0–12 overhaul and the subsequent production-readiness autopsy.

## Scope And Precedence

This guide covers `apps/admin` architecture exclusively.

Use it when a task touches:

- `apps/admin/next.config.ts`
- `src/actions/admin/**`
  - `src/app/**`
- `src/lib/domains/**`
- `src/lib/security/**`
  - `src/lib/infrastructure/**`
  - `src/lib/jobs/**`
  - `src/lib/queues/**`
- `src/lib/infrastructure/env.ts`
  - `src/instrumentation.ts`
  - `src/middleware.ts`
  - `apps/admin/docs/**`
- admin ADRs under `apps/admin/docs/adr/**`

Do not apply it to:

- `apps/client` — see `.agent/API-TO-FRONTEND-ARCHITECTURE.md`
- standalone backend services outside `apps/admin`
- tasks that do not change action, domain, or browser-facing admin code

Conflict rules:

1. `.github/copilot-instructions.md` remains the repo-wide baseline.
2. This guide wins for narrower `apps/admin` architecture questions.
3. Admin ADRs at `apps/admin/docs/adr/` are the Tier 0 rationale for decisions documented here.
4. [ADMIN-PRODUCTION-READINESS-AUDIT.md](file:///c:/Users/User/build-market/apps/admin/docs/ADMIN-PRODUCTION-READINESS-AUDIT.md) is the Tier 0 backlog and severity source for production hardening gaps until the relevant ADRs are accepted.
5. If two docs disagree, follow the narrower or stricter rule and surface the drift explicitly.

### Production-Readiness ADR Index

**Complete index:** [`ADR-ADMIN-001` through `ADR-ADMIN-016`](../apps/admin/docs/adr/). Check each ADR's lifecycle metadata before treating a proposed decision as an implemented control.

The Phase 0–12 architecture remains valid, but production hardening is now governed by the following additional ADRs:

| ADR                                                                                                                                           | Status   | Governs                                                  | Implementation posture                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [ADR-ADMIN-010](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-010-admin-browser-security-headers-and-csp.md)               | Accepted | Browser security headers and CSP                         | New browser-facing work must be compatible with a central header/CSP policy.                                          |
| [ADR-ADMIN-011](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-011-admin-observability-slo-and-telemetry-contract.md)       | Accepted | Observability SLOs and telemetry                         | New P0/P1 workflows must define metrics, alerts, dashboards, and runbooks.                                            |
| [ADR-ADMIN-012](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-012-admin-background-job-and-queue-semantics.md)             | Accepted | Background job and queue semantics                       | New jobs/queues must declare owner, schema, idempotency, retry, DLQ, replay, and rollback behavior.                   |
| [ADR-ADMIN-013](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-013-admin-environment-and-secret-governance.md)              | Proposed | Environment and secret governance                        | New config must be capability-scoped and profile-aware; production must fail closed on missing critical dependencies. |
| [ADR-ADMIN-014](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-014-admin-incident-response-and-break-glass-access.md)       | Proposed | Incident response and break-glass access                 | Emergency access must be explicit, time-boxed, scoped, audited, and alerted.                                          |
| [ADR-ADMIN-015](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-015-admin-data-retention-export-and-tamper-evident-audit.md) | Accepted | Data retention, export custody, and tamper-evident audit | High-risk operations must be ready for audit coverage, retention, export custody, and tamper-evidence gates.          |
| [ADR-ADMIN-016](../apps/admin/docs/adr/ADR-ADMIN-016-admin-background-worker-isolation-and-daemon-migration.md) | Accepted | Background worker isolation and daemon migration | Long-running BullMQ/NATS consumers run in `apps/workers`, not in a Next.js deployment. |

Proposed ADRs remain forward-looking; accepted ADRs define current architectural authority. Neither status is a substitute for the evidence and exclusions recorded in the application status pages and launch scorecard.

---

## 1. Architecture Overview

`apps/admin` is a Next.js app (`src/` layout) that primarily uses server actions rather than the browser-facade + API-route model used by `apps/client`.

### Primary Action Flow

```text
Browser / Server Component
  -> Server Action (src/actions/admin/<slice>.ts)
  -> safeAction wrapper
  -> Domain Service (src/lib/domains/<slice>/service.ts)
  -> Repository (src/lib/domains/<slice>/repository.ts)
  -> @build/db
```

### Route Handler Flow (where applicable)

```text
HTTP Request
  -> Route Handler (src/actions/admin/<resource>/route.ts or app/api/admin/<resource>/route.ts)
  -> resolveAdminRouteActor() + capability check
  -> Domain Service (src/lib/domains/<slice>/service.ts)
  -> Repository (src/lib/domains/<slice>/repository.ts)
  -> @build/db
```

> `assertAdmin()` is the legacy actor-resolution helper used by routes that predate the Phase 3 hardening. All new route handlers must use `resolveAdminRouteActor()`. Existing callers are tracked as ADM-012 in `apps/admin/docs/DEFECTS.md`.

### Architectural Rules

1. `src/actions/admin/**` is the adapter layer. It owns input validation, admin actor resolution, authorization checks, domain calls, cache revalidation, and serialization-safe responses.
2. Business logic lives in `src/lib/domains/<slice>/service.ts`. Repositories at `src/lib/domains/<slice>/repository.ts` are persistence-only.
3. Import direction is actions → services/domains → repositories. Nothing imports from the action layer.
4. All authenticated admin mutations must use `safeAction`. Unauthenticated action execution is prohibited.
5. Expected control flow uses `Result<T, AdminDomainError>`. All expected failures return typed errors; they do not throw.
6. Zod `.safeParse()` is mandatory in action adapters. `.parse()` is prohibited — it escapes as an unstructured 500.
7. Direct Prisma access in action files is a tracked critical defect. It must be migrated in the relevant domain phase.
8. The admin overhaul uses a strangler-fig pattern: new behavior ships behind `AdminFeatureFlag` values; old routes remain functional until documented retirement.
9. All env reads go through `adminEnvConfig` from `src/lib/infrastructure/env.ts`. Direct `process.env` is a boundary violation.
10. Mutation inputs use Zod `.strict()` to prevent mass-assignment. Never use `.passthrough()` on admin mutation schemas.
11. Browser-facing routes must be compatible with a central security header and CSP bundle. Do not add third-party script, image, frame, or connect origins without documenting the owner and removal criteria.
12. Background work is production infrastructure. New jobs and queues require payload schemas, idempotency, retry/dead-letter semantics, telemetry, replay, and rollback documentation before merge.
13. High-risk operations must be designed for audit coverage, retention/export custody, and future tamper-evidence gates. Do not add manual audit side channels.
14. Configuration changes must declare the deployment profiles and capabilities they affect. Production-only surprises are defects.

### Production Readiness Flow

```text
Production hardening change
  -> Relevant ADR-ADMIN-010..016 contract
  -> Runtime adapter / config / job / action implementation
  -> Drift or registry check
  -> Targeted tests
  -> VERIFICATION.md / runbook / rollback update
  -> Changelog entry
```

---

## 2. Admin Actor and Authorization Model

> **Canonical ADR:** `apps/admin/docs/adr/ADR-ADMIN-001-admin-authentication-and-authorization-model.md`

### Actor Shape

```typescript
type AdminActor = {
  clerkId: string;
  dbUserId: string;
  adminRole: AdminRole;
};
```

- `clerkId` is resolved from the active Clerk session server-side.
- `dbUserId` is the database user ID resolved from the Clerk identity.
- `adminRole` is resolved from the database `AdminProfile` record — **not** from Clerk session claims. Clerk claims may inform route-level coarse access, but they are not authoritative for high-risk action execution.

### Role and Capability Model

`SUPER_ADMIN` is the only full-capability bypass. Every other `AdminRole` is authorized through explicit `AdminCapability` maps. Do not perform raw role-string comparisons in business logic — use the capability policy map.

```typescript
// ✅ Correct — capability-based authorization
await requireAdminCapability(actor, AdminCapability.MANAGE_USERS);

// ❌ Wrong — raw role string comparison
if (actor.adminRole === "ADMIN") { ... }
```

### `safeAction` Wrapper

`safeAction` is the canonical wrapper for all authenticated admin mutations. It:

1. Resolves the Clerk identity server-side.
2. Requires an active database `AdminProfile`.
3. Authorizes using `AdminRole` and the capability policy map.
4. Enforces policy-provided recent-auth windows for high-risk operations (Tier 1: 180s, Tier 2: 300s).
5. Applies actor-scoped rate limits.
6. Optionally attaches declarative `auditLog` metadata for high-risk ops.
7. Emits a structured log event and returns a typed error result on resolution failure — it does not throw.

### Session Freshness

| Tier              | Operations                                                         | maxAgeSeconds |
| ----------------- | ------------------------------------------------------------------ | ------------- |
| Tier 1 — Critical | Role changes, user deletion, data export, payout/escrow operations | 180           |
| Tier 2 — High     | Verification overrides, document mutations, account transitions    | 300           |

Tier 1 routes must not rely on default freshness. Verify assigned constant values, not only constant-name presence.

---

## 3. Layer Responsibilities

### Action Layer (`src/actions/admin/`)

Files: `src/actions/admin/<slice>.ts`

Responsibilities:

- wrap mutations in `safeAction` (always)
- validate input with `.safeParse()` — never `.parse()`
- use `.strict()` on mutation schemas to prevent mass-assignment
- construct and forward full `AdminActor` context into the domain
- map `Result<T, AdminDomainError>` outcomes to serialization-safe action responses
- call `revalidatePath()` or `revalidateTag()` after successful mutations
- attach declarative `auditLog` for high-risk operations
- pass idempotency keys to `runWithIdempotency` on all state-changing mutations

Must not own:

- direct Prisma queries
- role or ownership policy decisions
- multi-step domain orchestration
- infrastructure reads (`adminEnvConfig` is the boundary — do not import services that bypass it)

### Domain Layer (`src/lib/domains/<slice>/`)

Files follow the same pattern as `apps/client`:

- `contracts.ts` — `AdminActor`, input DTOs, output DTOs, `AdminDomainErrorCode` union, `Result<T, E>` aliases
- `service.ts` — actor-aware business logic, `AdminCapability` enforcement, `ok()`/`err()` outcomes
- `repository.ts` — Prisma reads and writes; persistence-only
- `index.ts` — public surface; exports contracts, service singleton, and repository singleton only

Responsibilities:

- actor-aware authorization via `AdminCapability` policy
- business rules and invariants
- orchestration across repositories
- normalized `Result<T, AdminDomainError>` outcomes for all expected failures

Repositories must not own:

- authorization checks
- response envelopes
- action semantics
- user-facing error messages

### Trust Boundaries

- The action layer treats all input as untrusted until `.safeParse()` validation succeeds.
- The domain layer treats `AdminActor` as trusted only when resolved through `safeAction` or `resolveAdminRouteActor()` — never from request body fields.
- The repository layer uses only Prisma parameterized query APIs. Raw SQL with user-controlled interpolation is prohibited.

---

## 4. Audit Log, Export Custody, and Retention Contract

> **Canonical ADR:** [`apps/admin/docs/adr/ADR-ADMIN-008-admin-audit-log-contract.md`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-008-admin-audit-log-contract.md)
> **Production-readiness ADR:** [`apps/admin/docs/adr/ADR-ADMIN-015-admin-data-retention-export-and-tamper-evident-audit.md`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-015-admin-data-retention-export-and-tamper-evident-audit.md)

Audit entries are required for:

- role changes
- user suspension and deletion
- data export (GDPR/compliance)
- manual payment operations and escrow overrides
- verification status overrides
- content moderation actions

### Canonical Audit Event Shape

```typescript
type AdminAuditEvent = {
  actorAdminRole: AdminRole;
  operationName: string; // stable <verb>_<resource> format
  targetResourceType: string;
  targetResourceId: string; // Class C/D only — see data classification
  outcome: "success" | "failure";
  timestamp: string; // ISO 8601
  correlationId: string;
};
```

### Declarative Audit via `safeAction`

Prefer declarative audit metadata in the `safeAction` options over manual `auditLog()` calls:

```typescript
// ✅ Correct — declarative audit in safeAction
safeAction(
  "delete_user",
  async ({ actor }) => {
    const parsed = DeleteUserSchema.safeParse(rawInput);
    if (!parsed.success) {
      return mapValidationError(parsed.error);
    }
    return usersService.deleteUser(actor, parsed.data.userId);
  },
  {
    auditLog: {
      operation: "delete_user",
      targetResourceType: "user",
    },
  },
);
```

Audit entries are append-only and written before success is returned. The current accepted baseline treats audit write failures as non-blocking but requires a structured admin error event. [`ADR-ADMIN-015`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-015-admin-data-retention-export-and-tamper-evident-audit.md) proposes a stricter production target: critical mutations fail closed when audit persistence fails unless a narrow ADR-approved exception exists. New high-risk work should be designed for the stricter target.

`targetResourceId` for user records is Class B sensitive data and must be handled per the data classification ADR.

### High-Risk Operation Requirements

Until a high-risk operation registry exists, reviewers must manually verify that role changes, deletion, exports, verification overrides, manual payment operations, GDPR/retention workflows, and audit-log reads/exports include:

- capability policy entry
- recent-auth policy where required
- actor-scoped rate limit for mutation paths
- idempotency key for state-changing or replayable operations
- declarative audit metadata
- stable `operationName`
- retention/export custody consideration when artifacts are generated
- telemetry plan per [`ADR-ADMIN-011`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-011-admin-observability-slo-and-telemetry-contract.md)

Export artifacts must have requester, purpose, filters, generated object, expiry, download access, deletion status, and audit linkage once [`ADR-ADMIN-015`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-015-admin-data-retention-export-and-tamper-evident-audit.md) implementation begins. Do not add new export paths that cannot carry this metadata.

---

## 5. Observability, SLO, and Telemetry Contract

> **Canonical ADR:** [`apps/admin/docs/adr/ADR-ADMIN-003-admin-observability-contract.md`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-003-admin-observability-contract.md)
> **Production-readiness ADR:** [`apps/admin/docs/adr/ADR-ADMIN-011-admin-observability-slo-and-telemetry-contract.md`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-011-admin-observability-slo-and-telemetry-contract.md)

Admin adapter layers emit structured events. The minimum required field set:

```typescript
type AdminStructuredLogEvent = {
  correlationId: string;
  operationName: string; // stable <verb>_<resource> format
  adminRole: AdminRole; // safe to log — capability enum, not identity
  outcome:
    | "success"
    | "domain_error"
    | "forbidden"
    | "unauthorized"
    | "validation_error"
    | "rate_limited"
    | "session_stale"
    | "internal_error";
  httpStatus?: number;
  durationMs: number;
};
```

### PII Exclusions — Hard Rules

- Never log `userId`, `clerkId`, `userEmail`, `email`, `phone`, `nationalId`, request bodies, or response bodies.
- `adminRole` is safe to log (it is a capability enum, not an identity field).
- Services and repositories do not log routine outcomes. Adapter layers do.

### `operationName` Convention

Stable `<verb>_<resource>` format: `delete_user`, `approve_verification`, `export_user_data`.

- Renaming is a breaking observability change — requires coordinated dashboard update.
- Must be compile-time static (string literal or registered `AdminOperationName` constant), never derived from request params or input.
- All operation names must be registered in [`src/lib/infrastructure/operation-names.ts`](file:///c:/Users/User/build-market/apps/admin/src/lib/infrastructure/operation-names.ts).

### SLO and Alerting Requirements

For new P0/P1 workflows, logging alone is insufficient. The implementation plan must identify:

- service-level indicators and objectives
- metric names, units, labels, and cardinality boundaries
- dashboard panel ownership
- alert thresholds and escalation owner
- runbook link
- trace/log correlation strategy
- PII redaction strategy

Acceptable metric labels include operation name, outcome, admin role, route class, job name, queue name, and deployment environment. Never use raw user identifiers, emails, target names, request bodies, or unbounded resource IDs as metric labels.

---

## 6. Environment Variable, Deployment Profile, and Secret Governance

> **Canonical ADR:** [`apps/admin/docs/adr/ADR-ADMIN-006-admin-environment-variable-access-boundary.md`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-006-admin-environment-variable-access-boundary.md)
> **Production-readiness ADR:** [`apps/admin/docs/adr/ADR-ADMIN-013-admin-environment-and-secret-governance.md`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-013-admin-environment-and-secret-governance.md)

**Canonical module:** `apps/admin/src/lib/infrastructure/env.ts` → exported as `adminEnvConfig`

All runtime `process.env` reads in `apps/admin` must go through this module. Direct `process.env` reads outside the boundary are a layer violation and a tracked drift finding.

```typescript
// ✅ Correct
import { adminEnvConfig } from "@/lib/infrastructure/env";
const clerkSecret = adminEnvConfig.clerkSecretKey;

// ❌ Wrong — flagged by admin:report-security-drift
const clerkSecret = process.env.CLERK_SECRET_KEY!;
```

**Bootstrap-only exceptions** (same pattern as `apps/client`):

- `next.config.ts`
- `instrumentation.ts`
- Edge-runtime call sites that execute before the env module can be initialized

Each exception must carry: `// bootstrap-only: <reason>`

Admin env templates are maintained in `.env.example`, `.env.test`, and `.env.development`. `pnpm run admin:check-env-contract` verifies all templates cover the declared boundary keys.

### Profile-Aware Configuration Rules

ADR-ADMIN-013 is not yet implemented, but new config must be shaped for it:

- Add new variables to `adminEnvSchema`, `.env.example`, tests, and docs in one change.
- State whether the variable applies to `local`, `test`, `preview`, `staging`, and `production`.
- State the capability it enables: auth, database, queue, storage, encryption, privacy, notifications, NATS/Redis/BullMQ, observability, or base app identity.
- Public variables must use `NEXT_PUBLIC_*` only when browser exposure is intentional and safe.
- Feature flags that enable provider-backed behavior must imply provider dependencies for staging/production.
- Production must fail closed for missing auth, database, queue, storage, encryption, privacy, notification, and observability dependencies unless a documented feature is disabled.

## 7. Browser Security Surface

> **Production-readiness ADR:** [`apps/admin/docs/adr/ADR-ADMIN-010-admin-browser-security-headers-and-csp.md`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-010-admin-browser-security-headers-and-csp.md)
> **Related ADR:** [`apps/admin/docs/adr/ADR-ADMIN-005-admin-http-and-security-surface.md`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-005-admin-http-and-security-surface.md)

Admin is an operator-only browser surface. UI and route changes must assume a strict security header bundle will be enforced centrally.

### Browser Hardening Rules

- Do not add new third-party script, image, frame, font, style, or connect origins without documenting owner, purpose, data classification, and removal criteria.
- Prefer server-side data access and minimal client components for sensitive admin workflows.
- Do not persist Class A or Class B data in browser storage.
- Avoid raw exception messages in user-facing error states; show a generic error and correlation ID instead.
- Browser-facing routes must be compatible with `Cache-Control: no-store` when they expose user data, financial data, audit logs, operational state, or compliance data.
- New auth or dashboard routes must be included in future security-header tests.

### CSP Readiness Checklist

Before adding an integration that needs browser access, answer:

1. Which CSP directive changes (`script-src`, `img-src`, `connect-src`, etc.)?
2. Is the origin environment-specific or global?
3. Does it process Class A/B/C/D data?
4. Who owns the integration?
5. How is it rolled back or removed?

## 8. Background Jobs, Queues, and Integration Semantics

> **Production-readiness ADR:** [`apps/admin/docs/adr/ADR-ADMIN-012-admin-background-job-and-queue-semantics.md`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-012-admin-background-job-and-queue-semantics.md)

Admin jobs and queues are production infrastructure. Treat GDPR, export, compliance, verification notification, retention, cleanup, Redis/BullMQ, and NATS work as privileged workflows, not helper scripts.

Every new job or queue must define:

- owner and owning domain
- trigger source
- payload schema
- data classification
- idempotency key and duplicate behavior
- retry, backoff, timeout, and maximum attempts
- dead-letter or failed-job destination
- poison-message handling
- replay procedure and replay authorization
- metrics, logs, traces, dashboards, and alerts
- rollback or safe-disable switch

Production compliance, export, notification, and GDPR workloads must not rely on in-memory queue semantics. If a local/test in-memory provider exists, ensure it cannot touch production data and is profile-gated through `adminEnvConfig`.

## 9. Incident Response and Break-Glass Access

> **Production-readiness ADR:** [`apps/admin/docs/adr/ADR-ADMIN-014-admin-incident-response-and-break-glass-access.md`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-014-admin-incident-response-and-break-glass-access.md)

Emergency access must not be an implicit bypass. `DEV_ADMIN_BYPASS` is a local-development convenience only and must never be used as a production break-glass control.

Production break-glass work must be:

- disabled by default
- time-boxed
- scoped to minimum capabilities
- approved through an incident workflow
- protected by recent auth or equivalent strong re-authentication
- fully audited
- alerted on enablement, use, extension, and expiry

Any direct database intervention during an incident must be explicitly documented, externally logged, approved, and reconciled back into audit history.

---

## 10. Strangler-Fig and Feature Flag Pattern

> **Canonical ADR:** `apps/admin/docs/adr/ADR-ADMIN-009-admin-strangler-fig-and-feature-flag-strategy.md`

New admin behavior is introduced behind typed `AdminFeatureFlag` values. Flags are environment-driven and read through `adminEnvConfig`.

### Flag Lifecycle

1. New v2 behavior ships under a flag-gated route (e.g., `/users-v2`) or conditional layout.
2. Old routes remain functional while the flag is disabled.
3. Rollback is performed by disabling the flag — any phase that cannot roll back by flag alone documents the irreversible data or schema state.
4. Retirement criteria (30-day stability, feature parity, test coverage, observability) are documented in `apps/admin/docs/adr/ADR-ADMIN-009`.
5. Rollback variables, retirement steps, and irreversible-state tracking live in `apps/admin/docs/ROLLBACK-CONTRACTS.md`.

### Active Flags (Phase 10)

| Flag                          | Disable with                                       | Rollback effect                                   |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `admin_v2_user_management`    | `NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT=false`    | `/users-v2` redirects to `/users`                 |
| `admin_v2_verification_queue` | `NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE=false` | `/verifications-v2` redirects to `/verifications` |
| `admin_v2_finance_dashboard`  | `NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD=false`  | `/analytics-v2` redirects to `/analytics`         |
| `admin_v2_audit_log_ui`       | `NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI=false`       | `/audit-v2` redirects to `/audit`                 |

See `apps/admin/docs/ROLLBACK-CONTRACTS.md` for the full rollback contracts and retirement checklist.

---

## 11. Data Classification and Handling

> **Canonical ADR:** `apps/admin/docs/adr/ADR-ADMIN-004-admin-data-classification-and-handling.md`

Admin operators can view and mutate sensitive data. Field classification governs logging, audit metadata, UI surface, and export controls.

| Class          | Examples                                                             | Logging | Browser storage | Minimum necessary display                              |
| -------------- | -------------------------------------------------------------------- | ------- | --------------- | ------------------------------------------------------ |
| A — Restricted | Credentials, payment secrets                                         | Never   | Never           | Never exposed beyond auth surfaces                     |
| B — Sensitive  | Email, phone, ID numbers, uploaded documents, user identity          | Never   | Never           | Admin default; bulk export requires explicit audit log |
| C — Internal   | Correlation IDs, capability roles, UUID resource IDs, audit metadata | Allowed | Not restricted  | Allowed                                                |
| D — Public     | Public profile display data, listing titles                          | Allowed | Allowed         | Allowed                                                |

---

## 12. Admin Anti-Patterns To Reject

Reject these during review:

1. Direct Prisma access in any `src/actions/admin/**` file. All persistence must go through domain repositories.
2. `.parse()` in action files. Always use `.safeParse()` — a Zod parse exception escapes as an unstructured 500 and loses the structured log event.
3. Direct `process.env` reads outside `adminEnvConfig`. Use `adminEnvConfig` from `src/lib/infrastructure/env.ts`.
4. `adminRole` resolved from Clerk session claims for high-risk authorization. Always resolve from the database `AdminProfile`.
5. Raw role-string comparisons (`actor.adminRole === "ADMIN"`) instead of `AdminCapability` policy map checks.
6. Missing `auditLog` in `safeAction` for high-risk operations (role changes, deletion, data export, verification overrides, manual payment operations).
7. Mutation routes and actions missing a `safeAction` wrapper. Unauthenticated admin mutations are a critical security defect.
8. Business logic (policy, orchestration, role checks) embedded in the action adapter instead of the domain service.
9. Mutation schemas without `.strict()` — `.passthrough()` on a mutation schema allows mass-assignment and is prohibited.
10. A new admin feature shipped without an `AdminFeatureFlag` when the feature is part of the strangler-fig overhaul — new behavior must be flag-gated until verified.
11. `console.log`, `console.error`, or string-interpolated log calls in action or domain adapter code. Use the structured admin logger via `getAdminLogger()`.
12. Log events including `userId`, `clerkId`, `userEmail`, `email`, `phone`, `nationalId`, request body payloads, or response body content.
13. An action or domain service that skips the `Result<T, AdminDomainError>` pattern and throws directly for expected business failures (`forbidden`, `not_found`, `invalid_state`).
14. `operationName` values not registered in [`src/lib/infrastructure/operation-names.ts`](file:///c:/Users/User/build-market/apps/admin/src/lib/infrastructure/operation-names.ts). All operation names must be compile-time constants from the registry.
15. `safeVerificationAction` instead of `safeAction` for new verification-domain actions. `safeVerificationAction` is a deprecated duplicate tracked as ADM-011 in [`apps/admin/docs/DEFECTS.md`](file:///c:/Users/User/build-market/apps/admin/docs/DEFECTS.md).
16. A browser integration that requires new CSP origins but lacks owner, purpose, data classification, and rollback/removal criteria.
17. A job or queue without payload schema, idempotency, retry/dead-letter semantics, telemetry, and replay/rollback instructions.
18. A production config variable added without profile/capability documentation or env-contract coverage.
19. A high-risk export path without custody metadata, expiry/deletion behavior, and audit linkage.
20. Any production break-glass or emergency-access mechanism that bypasses capability checks globally, lacks expiry, or lacks audit/alert coverage.

---

## 13. Testing Standard

Admin testing follows the same risk-centric model as `apps/client` (see Section 7 of `API-TO-FRONTEND-ARCHITECTURE.md`), adapted for the action-first admin architecture.

### Test Types

| Type                          | Job                                                                                             | What it catches                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Policy tests**              | Exhaustively assert `AdminRole × AdminCapability × operation` outcomes                          | Authorization gaps; missing capability checks; wrong `forbidden` vs `not_found` distinction |
| **Action boundary tests**     | Assert that actions delegate to domain service and do not contain persistence or business logic | Direct Prisma regression; business-logic drift back into adapters                           |
| **Domain service tests**      | Prove business rules, ownership checks, and `Result` outcomes                                   | Policy regressions; missing validation; incorrect error codes                               |
| **Repository contract tests** | Assert correct Prisma query shapes, soft-delete guards, and mutation behavior                   | Repository contract drift after schema changes                                              |
| **Security-header tests**     | Assert CSP/security headers on dashboard, auth, error, and admin API routes                     | Browser hardening regressions; missing CSP or anti-cache headers                            |
| **Env profile tests**         | Assert local/test/preview/staging/production env profiles fail open or closed correctly         | Unsafe preview/local degradation; missing production secrets                                |
| **Queue/job tests**           | Assert payload validation, idempotent retry, DLQ/failed-job handling, and replay constraints    | Silent background workflow failure; poison-message loops                                    |
| **Telemetry tests**           | Assert route/action/job metrics and log correlation on representative paths                     | Missing SLO signals; unalertable P0/P1 workflows                                            |
| **Audit coverage tests**      | Assert high-risk operations declare required audit/export/retention metadata                    | Unreconstructable admin incidents; export custody gaps                                      |

### Verification Commands

```bash
# Type check the full admin surface
pnpm run admin:check-types

# Lint
pnpm run admin:lint

# Verify env contract completeness
pnpm run admin:check-env-contract

# Security drift report (permissive — pass with known backlog)
pnpm run admin:report-security-drift

# Security drift report (strict — must be zero; gate for all merges)
pnpm run admin:report-security-drift:strict

# Run all admin test suites
pnpm run admin:test:all

# Run targeted slice suites
pnpm -C apps/admin exec vitest run src/lib/domains/<slice>/__tests__/ src/actions/admin/__tests__/<slice>-actions.test.ts --pool=threads --maxWorkers=1
```

See `apps/admin/docs/VERIFICATION.md` for the gate policy, what-each-command-checks table, and latest verification results.

---

## 14. Admin Overhaul and Production-Readiness Phase Map

> Read `apps/admin/docs/PROGRESS-SUMMARY.md` as the live execution surface before starting any admin work. This section is the structural map; the progress summary is the current state.

| Phase               | Scope                                                                                   | Status      |
| ------------------- | --------------------------------------------------------------------------------------- | ----------- |
| Phase 0             | Autopsy — critical/high findings catalogued                                             | Complete    |
| Phase 1             | ADR Foundation — ADR-ADMIN-001 through ADR-ADMIN-009                                    | Complete    |
| Phase 2             | Tooling Scaffold — env boundary, drift reporter, tightened TypeScript/ESLint, admin CI  | Complete    |
| Phase 3             | Auth Hardening — canonical `AdminActor`, `safeAction`, capability policy                | Complete    |
| Phase 10            | Feature Flag Foundation — env-driven `AdminFeatureFlag`, v2 route gates, rollback docs  | Complete    |
| Phase 4             | Domain/Repository Layer — all 13 domain slices                                          | Complete    |
| Phase 5             | Action Slice Migration — all slices migrated to `safeAction` + domain service           | Complete    |
| Phase 7 (Track C)   | Observability Foundation — structured logger, correlation threading, operation registry | Complete    |
| Track A (Phase 5/6) | Audit/Export, Finance, Stores, Leads, GDPR action slices                                | Complete    |
| Phase 8             | Audit Log Implementation — declarative `safeAction` audit integration                   | Complete    |
| Phase 12            | Security Hardening Pass — ASVS L2, mass-assignment, zero drift findings                 | Complete    |
| Post-Phase-12       | Architecture Autopsy & Documentation Hardening (F-Doc1, F-Doc2, F-Doc3)                 | Complete    |
| Production Autopsy  | Production-readiness audit and P0/P1/P2 hardening roadmap                               | Complete    |
| ADR-ADMIN-010..016  | Production governance and worker-isolation contracts; see each ADR lifecycle status    | Mixed       |
| Production Gates    | Runtime implementation of CSP, SLOs, queues, env profiles, incidents, audit integrity   | Not started |

### Slice Status (from `apps/admin/docs/PROGRESS-SUMMARY.md`)

All slices reached full compliance at Phase 12 completion.

| Slice                        | Auth/Policy | Actions   | Domain/Repo | Tests     | Observability | Overall   |
| ---------------------------- | ----------- | --------- | ----------- | --------- | ------------- | --------- |
| users                        | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| verification                 | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| audit                        | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| GDPR/export                  | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| finance/analytics            | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| stores/properties/projects   | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| leads/services/professionals | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| UI shell/components          | N/A         | N/A       | N/A         | compliant | N/A           | compliant |

---

## 15. Open Defects & Next Priority Work

> **Source of truth:** `apps/admin/docs/DEFECTS.md`

The following high-priority defects from the Post-Phase-12 autopsy have not yet been resolved. Reject PRs that worsen these findings.

| ID      | Severity | Description                                                   | Priority |
| ------- | -------- | ------------------------------------------------------------- | -------- |
| ADM-011 | High     | `safeVerificationAction` is a near-duplicate of `safeAction`  | P0       |
| ADM-012 | High     | Legacy auth helpers still exported from `shared.ts` (footgun) | P0       |
| ADM-013 | High     | `logAdminAction` is a parallel, schema-divergent audit path   | P0       |
| ADM-014 | Medium   | `shared.ts` is a 952-line god-file                            | P1       |
| ADM-015 | Medium   | `parseActionInput` duplicated across 8 action files           | P1       |
| ADM-016 | Medium   | `Result<T, E>` discriminant inconsistency (`ok` vs `success`) | P1       |

See [`apps/admin/docs/DEFECTS.md`](file:///c:/Users/User/build-market/apps/admin/docs/DEFECTS.md) for the full registry (ADM-011 through ADM-020) and [`apps/admin/docs/ARCHITECTURE-AUTOPSY.md`](file:///c:/Users/User/build-market/apps/admin/docs/ARCHITECTURE-AUTOPSY.md) for the complete improvement roadmap (I-1 through I-23, P0–P3).

### Production-Readiness Priorities

[`apps/admin/docs/ADMIN-PRODUCTION-READINESS-AUDIT.md`](file:///c:/Users/User/build-market/apps/admin/docs/ADMIN-PRODUCTION-READINESS-AUDIT.md) adds the production gate backlog. Treat these as release-blocking until implemented or explicitly waived by engineering leadership:

| Priority | Area                 | Source ADR                                                                                                                                                                                                                                                                                                                                                                  | Required direction                                                         |
| -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| P0       | Build correctness    | Audit P0-1                                                                                                                                                                                                                                                                                                                                                                  | Remove `typescript.ignoreBuildErrors` and gate typecheck before build.     |
| P0       | Environment contract | [`ADR-ADMIN-013`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-013-admin-environment-and-secret-governance.md)                                                                                                                                                                                                                                          | Add deployment profiles and production-required dependency validation.     |
| P0       | Browser hardening    | [`ADR-ADMIN-010`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-010-admin-browser-security-headers-and-csp.md)                                                                                                                                                                                                                                           | Add central security headers and CSP with tests.                           |
| P0       | Authorization drift  | [`ADR-ADMIN-001`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-001-admin-authentication-and-authorization-model.md) / [`009`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-009-admin-strangler-fig-and-feature-flag-strategy.md) / audit                                                                                            | Generate or test route/action policy coverage.                             |
| P0       | Error disclosure     | [`ADR-ADMIN-003`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-003-admin-observability-contract.md) / [`004`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-004-admin-data-classification-and-handling.md) / [`010`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-010-admin-browser-security-headers-and-csp.md) | Replace raw user-facing diagnostics with correlation IDs.                  |
| P1       | Observability SLOs   | [`ADR-ADMIN-011`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-011-admin-observability-slo-and-telemetry-contract.md)                                                                                                                                                                                                                                   | Add metrics, dashboards, alerts, and runbooks for P0/P1 workflows.         |
| P1       | Audit integrity      | [`ADR-ADMIN-015`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-015-admin-data-retention-export-and-tamper-evident-audit.md)                                                                                                                                                                                                                             | Add coverage proof, retention/export custody, and tamper-evidence design.  |
| P1       | Jobs and queues      | [`ADR-ADMIN-012`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-012-admin-background-job-and-queue-semantics.md)                                                                                                                                                                                                                                         | Add registry, idempotency, DLQ, replay, and alerts.                        |
| P1       | Incident response    | [`ADR-ADMIN-014`](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-014-admin-incident-response-and-break-glass-access.md)                                                                                                                                                                                                                                   | Add break-glass controls, incident runbooks, tests, and tabletop evidence. |

---

## 16. Admin Reference Files

| File                                                                                                                                          | Purpose                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [ADR-ADMIN-001](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-001-admin-authentication-and-authorization-model.md)         | Auth and authorization model — `AdminActor`, `AdminRole`, freshness tiers                        |
| [ADR-ADMIN-002](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-002-admin-action-boundary-and-layer-structure.md)            | Action boundary and layer structure — adapter/domain/repository import direction                 |
| [ADR-ADMIN-003](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-003-admin-observability-contract.md)                         | Observability contract — structured log fields, PII exclusions                                   |
| [ADR-ADMIN-004](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-004-admin-data-classification-and-handling.md)               | Data classification — Class A–D handling in logging, UI, and export                              |
| [ADR-ADMIN-005](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-005-admin-http-and-security-surface.md)                      | HTTP and security surface — CSRF, cache control, CSP, webhook integrity                          |
| [ADR-ADMIN-006](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-006-admin-environment-variable-access-boundary.md)           | Env access boundary — `adminEnvConfig`, bootstrap exceptions                                     |
| [ADR-ADMIN-007](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-007-admin-ui-component-contract.md)                          | UI component contract — state variants, accessibility invariants, design tokens                  |
| [ADR-ADMIN-008](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-008-admin-audit-log-contract.md)                             | Audit log contract — mandatory operations, append-only, declarative `safeAction` integration     |
| [ADR-ADMIN-009](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-009-admin-strangler-fig-and-feature-flag-strategy.md)        | Strangler-fig and feature flag strategy — `AdminFeatureFlag`, v2 gates, retirement criteria      |
| [ADR-ADMIN-010](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-010-admin-browser-security-headers-and-csp.md)               | Browser security headers and CSP — central header bundle, CSP rollout, integration ownership     |
| [ADR-ADMIN-011](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-011-admin-observability-slo-and-telemetry-contract.md)       | Observability SLO and telemetry — SLIs/SLOs, metrics, dashboards, alerts, runbooks               |
| [ADR-ADMIN-012](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-012-admin-background-job-and-queue-semantics.md)             | Background job and queue semantics — idempotency, retries, DLQ, replay, rollback                 |
| [ADR-ADMIN-013](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-013-admin-environment-and-secret-governance.md)              | Environment and secret governance — deployment profiles, capability-scoped env validation        |
| [ADR-ADMIN-014](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-014-admin-incident-response-and-break-glass-access.md)       | Incident response and break-glass — emergency access scope, expiry, audit, alerting              |
| [ADR-ADMIN-015](file:///c:/Users/User/build-market/apps/admin/docs/adr/ADR-ADMIN-015-admin-data-retention-export-and-tamper-evident-audit.md) | Data retention, export custody, and tamper-evident audit                                         |
| [ADMIN-PRODUCTION-READINESS-AUDIT.md](file:///c:/Users/User/build-market/apps/admin/docs/ADMIN-PRODUCTION-READINESS-AUDIT.md)                 | Staff-level production-readiness autopsy, severity model, roadmap, and checklist                 |
| [PROGRESS-SUMMARY.md](file:///c:/Users/User/build-market/apps/admin/docs/PROGRESS-SUMMARY.md)                                                 | Live execution surface — active phase, slice status, completed phases, next priority             |
| [DEFECTS.md](file:///c:/Users/User/build-market/apps/admin/docs/DEFECTS.md)                                                                   | Open defect registry with severity, class, status, and owner (ADM-001 through ADM-020)           |
| [VERIFICATION.md](file:///c:/Users/User/build-market/apps/admin/docs/VERIFICATION.md)                                                         | Verification commands, gate policy, and latest test/drift/type-check results                     |
| [ROLLBACK-CONTRACTS.md](file:///c:/Users/User/build-market/apps/admin/docs/ROLLBACK-CONTRACTS.md)                                             | Feature flag rollback table, irreversible-state tracker, and retirement checklist                |
| [CONTRIBUTING.md](file:///c:/Users/User/build-market/apps/admin/docs/CONTRIBUTING.md)                                                         | Contributor how-to — domain slice, action, feature flag checklists, test conventions             |
| [ARCHITECTURE-AUTOPSY.md](file:///c:/Users/User/build-market/apps/admin/docs/ARCHITECTURE-AUTOPSY.md)                                         | Staff-level architectural audit — 23 findings, improvement table, priority roadmap (P0–P3)       |
| [CHANGELOG.md](file:///c:/Users/User/build-market/apps/admin/docs/CHANGELOG.md)                                                               | Admin overhaul architectural milestones                                                          |
| [authorization-policy.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/security/authorization-policy.ts)                             | `AdminCapability` map and `requireAdminCapability()` implementation                              |
| [operation-names.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/infrastructure/operation-names.ts)                                 | Typed `AdminOperationName` registry — all valid operation name constants                         |
| [env.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/infrastructure/env.ts)                                                         | Validated admin environment boundary and future deployment-profile enforcement surface           |
| [otel.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/infrastructure/otel.ts)                                                       | OpenTelemetry setup surface for ADR-ADMIN-011                                                    |
| [jobs/](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs)                                                                           | Background job implementations governed by ADR-ADMIN-012                                         |
| [queues/](file:///c:/Users/User/build-market/apps/admin/src/lib/queues)                                                                       | Queue adapters governed by ADR-ADMIN-012                                                         |
| [users.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/users.ts)                                                          | Reference: migrated action slice with `safeAction`, domain service delegation, declarative audit |
| [verification.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/verification.ts)                                            | Reference: migrated action slice with domain-service-backed queue/stats/details/mutations        |
| [users/](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/users)                                                                 | Reference: domain contracts, repository, service for the users slice                             |
| [verification/](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/verification)                                                   | Reference: domain contracts, repository, service for the verification slice                      |

---

## 17. Related Documentation

- [API-TO-FRONTEND-ARCHITECTURE.md](file:///c:/Users/User/build-market/.agent/API-TO-FRONTEND-ARCHITECTURE.md) — canonical architecture for `apps/client`
- [DOCUMENT-HIERARCHY.md](file:///c:/Users/User/build-market/.agent/DOCUMENT-HIERARCHY.md) — conflict-resolution algorithm for all repo docs
- [copilot-instructions.md](file:///c:/Users/User/build-market/.github/copilot-instructions.md) — repo-wide baseline rules
- [ADMIN-PRODUCTION-READINESS-AUDIT.md](file:///c:/Users/User/build-market/apps/admin/docs/ADMIN-PRODUCTION-READINESS-AUDIT.md) — production-readiness audit and implementation roadmap
- [ADR-001-auth-model.md](file:///c:/Users/User/build-market/apps/client/docs/adr/ADR-001-auth-model.md) — client auth model (admin auth cross-references this)
- [ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md](file:///c:/Users/User/build-market/apps/client/docs/adr/ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md) — admin sub-role model as seen from the client app
