# Admin Architecture Guidelines

This document defines the canonical architecture for adding or refactoring a domain slice in `apps/admin`.

Use it when:

- adding a new admin domain (audit, finance, content, users, verification, etc.)
- migrating an action slice from direct Prisma to the domain service boundary
- auditing an existing action or route against the hardened action architecture

This is not a generic pattern library. It is the repo-specific source of truth for how `apps/admin` should be structured after the Phase 0–5 overhaul.

## Scope And Precedence

This guide covers `apps/admin` architecture exclusively.

Use it when a task touches:

- `src/actions/admin/**`
- `src/lib/domains/**`
- `src/lib/security/**`
- `src/lib/infrastructure/env.ts`
- admin ADRs under `apps/admin/docs/adr/**`

Do not apply it to:

- `apps/client` — see `.agent/API-TO-FRONTEND-ARCHITECTURE.md`
- standalone backend services outside `apps/admin`
- tasks that do not change action, domain, or browser-facing admin code

Conflict rules:

1. `.github/copilot-instructions.md` remains the repo-wide baseline.
2. This guide wins for narrower `apps/admin` architecture questions.
3. Admin ADRs at `apps/admin/docs/adr/` are the Tier 0 rationale for decisions documented here.
4. If two docs disagree, follow the narrower or stricter rule and surface the drift explicitly.

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
  -> Route Handler (src/app/api/admin/<resource>/route.ts)
  -> assertAdmin() + capability check
  -> Domain Service (src/lib/domains/<slice>/service.ts)
  -> Repository (src/lib/domains/<slice>/repository.ts)
  -> @build/db
```

### Architectural Rules

1. `src/actions/admin/**` is the adapter layer. It owns input validation, admin actor resolution, authorization checks, domain calls, cache revalidation, and serialization-safe responses.
2. Business logic lives in `src/lib/domains/<slice>/service.ts`. Repositories at `src/lib/domains/<slice>/repository.ts` are persistence-only.
3. Import direction is actions → services/domains → repositories. Nothing imports from the action layer.
4. All authenticated admin mutations must use `safeAction`. Unauthenticated action execution is prohibited.
5. Expected control flow uses `Result<T, AdminDomainError>`. All expected failures return typed errors; they do not throw.
6. Zod `.safeParse()` is mandatory in action adapters. `.parse()` is prohibited — it escapes as an unstructured 500.
7. Direct Prisma access in action files is a tracked critical defect. It must be migrated in the relevant domain phase.
8. The admin overhaul uses a strangler-fig pattern: new behavior ships behind `AdminFeatureFlag` values; old routes remain functional until documented retirement.

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
7. Emits a structured validation-error event and returns a typed error result on resolution failure — it does not throw.

### `assertAdmin()` Helper

`assertAdmin()` resolves the canonical `AdminActor` or returns a typed unauthorized result. Use it in route handlers that cannot use `safeAction` (e.g., API routes used by verification workflows).

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
- construct and forward full `AdminActor` context into the domain
- map `Result<T, AdminDomainError>` outcomes to serialization-safe action responses
- call `revalidatePath()` or `revalidateTag()` after successful mutations
- attach declarative `auditLog` for high-risk operations

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
- The domain layer treats `AdminActor` as trusted only when resolved through `safeAction` or `assertAdmin()` — never from request body fields.
- The repository layer uses only Prisma parameterized query APIs. Raw SQL with user-controlled interpolation is prohibited.

---

## 4. Audit Log Contract

> **Canonical ADR:** `apps/admin/docs/adr/ADR-ADMIN-008-admin-audit-log-contract.md`

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
  {
    auditLog: {
      operationName: "delete_user",
      targetResourceType: "user",
    },
  },
  async (actor, input) => {
    return usersService.deleteUser(actor, input.userId);
  },
);
```

Audit entries are append-only and written before success is returned. Audit write failures are non-blocking but must emit a structured admin error event.

`targetResourceId` for user records is Class B sensitive data and must be handled per the data classification ADR.

---

## 5. Observability Contract

> **Canonical ADR:** `apps/admin/docs/adr/ADR-ADMIN-003-admin-observability-contract.md`

Admin adapter layers emit structured events. The minimum required field set:

```typescript
type AdminStructuredLogEvent = {
  correlationId: string;
  operationName: string; // stable <verb>_<resource> format
  adminRole: AdminRole; // safe to log — capability enum, not identity
  outcome:
    | "success"
    | "domain_error"
    | "validation_error"
    | "rate_limited"
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

Same rules as `apps/client` (see Section 5.6.4 of `API-TO-FRONTEND-ARCHITECTURE.md`):

- Stable `<verb>_<resource>` format: `delete_user`, `approve_verification`, `export_user_data`.
- Renaming is a breaking observability change — requires coordinated dashboard update.
- Must be compile-time static (string literal or enum value), never derived from request params or input.

---

## 6. Environment Variable Access Boundary

> **Canonical ADR:** `apps/admin/docs/adr/ADR-ADMIN-006-admin-environment-variable-access-boundary.md`

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

---

## 7. Strangler-Fig and Feature Flag Pattern

> **Canonical ADR:** `apps/admin/docs/adr/ADR-ADMIN-009-admin-strangler-fig-and-feature-flag-strategy.md`

New admin behavior is introduced behind typed `AdminFeatureFlag` values. Flags are environment-driven and read through `adminEnvConfig`.

### Flag Lifecycle

1. New v2 behavior ships under a flag-gated route (e.g., `/users-v2`) or conditional layout.
2. Old routes remain functional while the flag is disabled.
3. Rollback is performed by disabling the flag — any phase that cannot roll back by flag alone documents the irreversible data or schema state.
4. Retirement steps are documented in `apps/admin/docs/PROGRESS-SUMMARY.md` before the flag is removed.

### Rollback Variables (Phase 10 flags)

| Flag                          | Disable with                                       | Rollback effect                                   |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `admin_v2_user_management`    | `NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT=false`    | `/users-v2` redirects to `/users`                 |
| `admin_v2_verification_queue` | `NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE=false` | `/verifications-v2` redirects to `/verifications` |
| `admin_v2_finance_dashboard`  | `NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD=false`  | `/analytics-v2` redirects to `/analytics`         |
| `admin_v2_audit_log_ui`       | `NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI=false`       | `/audit-v2` redirects to `/audit`                 |

---

## 8. Data Classification and Handling

> **Canonical ADR:** `apps/admin/docs/adr/ADR-ADMIN-004-admin-data-classification-and-handling.md`

Admin operators can view and mutate sensitive data. Field classification governs logging, audit metadata, UI surface, and export controls.

| Class          | Examples                                                             | Logging | Browser storage | Minimum necessary display                              |
| -------------- | -------------------------------------------------------------------- | ------- | --------------- | ------------------------------------------------------ |
| A — Restricted | Credentials, payment secrets                                         | Never   | Never           | Never exposed beyond auth surfaces                     |
| B — Sensitive  | Email, phone, ID numbers, uploaded documents, user identity          | Never   | Never           | Admin default; bulk export requires explicit audit log |
| C — Internal   | Correlation IDs, capability roles, UUID resource IDs, audit metadata | Allowed | Not restricted  | Allowed                                                |
| D — Public     | Public profile display data, listing titles                          | Allowed | Allowed         | Allowed                                                |

---

## 9. Admin Anti-Patterns To Reject

Reject these during review:

1. Direct Prisma access in any `src/actions/admin/**` file. All persistence must go through domain repositories.
2. `.parse()` in action files. Always use `.safeParse()` — a Zod parse exception escapes as an unstructured 500 and loses the structured log event.
3. Direct `process.env` reads outside `adminEnvConfig`. Use `adminEnvConfig` from `src/lib/infrastructure/env.ts`.
4. `adminRole` resolved from Clerk session claims for high-risk authorization. Always resolve from the database `AdminProfile`.
5. Raw role-string comparisons (`actor.adminRole === "ADMIN"`) instead of `AdminCapability` policy map checks.
6. Missing `auditLog` in `safeAction` for high-risk operations (role changes, deletion, data export, verification overrides, manual payment operations).
7. Mutation routes and actions missing a `safeAction` wrapper. Unauthenticated admin mutations are a critical security defect.
8. Business logic (policy, orchestration, role checks) embedded in the action adapter instead of the domain service.
9. Direct Prisma from an action file for mutations, bypassing the repository boundary.
10. A new admin feature shipped without an `AdminFeatureFlag` when the feature is part of the strangler-fig overhaul — new behavior must be flag-gated until verified.
11. `console.log`, `console.error`, or string-interpolated log calls in action or domain adapter code. Use the structured admin logger.
12. Log events including `userId`, `clerkId`, `userEmail`, `email`, `phone`, `nationalId`, request body payloads, or response body content.
13. An action or domain service that skips the `Result<T, AdminDomainError>` pattern and throws directly for expected business failures (`forbidden`, `not_found`, `invalid_state`).

---

## 10. Testing Standard

Admin testing follows the same risk-centric model as `apps/client` (see Section 7 of `API-TO-FRONTEND-ARCHITECTURE.md`), adapted for the action-first admin architecture.

### Test Types

| Type                          | Job                                                                                             | What it catches                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Policy tests**              | Exhaustively assert `AdminRole × AdminCapability × operation` outcomes                          | Authorization gaps; missing capability checks; wrong `forbidden` vs `not_found` distinction |
| **Action boundary tests**     | Assert that actions delegate to domain service and do not contain persistence or business logic | Direct Prisma regression; business-logic drift back into adapters                           |
| **Domain service tests**      | Prove business rules, ownership checks, and `Result` outcomes                                   | Policy regressions; missing validation; incorrect error codes                               |
| **Repository contract tests** | Assert correct Prisma query shapes, soft-delete guards, and mutation behavior                   | Repository contract drift after schema changes                                              |

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

# Security drift report (strict — must be zero for a clean phase)
pnpm run admin:report-security-drift:strict

# Run all admin test suites
pnpm run admin:test:all

# Run targeted slice suites
pnpm -C apps/admin exec vitest run src/lib/domains/<slice>/__tests__/ src/actions/admin/__tests__/<slice>-actions.test.ts --pool=threads --maxWorkers=1
```

---

## 11. Admin Overhaul Phase Map

> Read `apps/admin/docs/PROGRESS-SUMMARY.md` as the live execution surface before starting any admin work. This section is the structural map; the progress summary is the current state.

| Phase               | Scope                                                                                                           | Status                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Phase 0             | Autopsy — critical/high findings catalogued                                                                     | Complete                      |
| Phase 1             | ADR Foundation — ADR-ADMIN-001 through ADR-ADMIN-009                                                            | Complete                      |
| Phase 2             | Tooling Scaffold — env boundary, drift reporter, tightened TypeScript/ESLint, admin CI                          | Complete                      |
| Phase 3             | Auth Hardening — canonical `AdminActor`, hardened `safeAction`, capability policy, high-risk registry           | Complete                      |
| Phase 10            | Feature Flag Foundation — env-driven `AdminFeatureFlag`, v2 route gates, rollback docs                          | Complete                      |
| Phase 4             | Domain/Repository Layer — users, verification, content, finance, audit domains                                  | Complete                      |
| Phase 5 (partial)   | Action Slice Migration — users, verification actions migrated                                                   | Implemented, pending PR merge |
| Phase 5 (remaining) | Action Slice Migration — audit/GDPR, finance, content, stores/properties/projects, leads/services/professionals | Queued                        |
| Phase 6             | Token and Route Boundary                                                                                        | Queued                        |
| Phase 7             | Observability — structured logging, PII log key removal                                                         | Queued                        |
| Phases 8–9          | Additional hardening                                                                                            | Queued                        |

### Slice Status (from `apps/admin/docs/PROGRESS-SUMMARY.md`)

| Slice                        | Auth/Policy  | Actions      | Domain/Repo  | Tests       | Observability | Overall      |
| ---------------------------- | ------------ | ------------ | ------------ | ----------- | ------------- | ------------ |
| users                        | compliant    | compliant    | compliant    | compliant   | known defect  | in progress  |
| verification                 | compliant    | compliant    | compliant    | compliant   | known defect  | in progress  |
| audit                        | known defect | known defect | in progress  | compliant   | known defect  | in progress  |
| GDPR/export                  | in progress  | N/A          | known defect | in progress | known defect  | known defect |
| finance/analytics            | known defect | known defect | in progress  | compliant   | known defect  | in progress  |
| stores/properties/projects   | known defect | known defect | in progress  | compliant   | known defect  | in progress  |
| leads/services/professionals | known defect | known defect | in progress  | in progress | known defect  | known defect |
| UI shell/components          | N/A          | N/A          | N/A          | in progress | N/A           | in progress  |

---

## 12. Admin Reference Files

| File                                         | Purpose                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/admin/docs/adr/ADR-ADMIN-001`          | Auth and authorization model — `AdminActor`, `AdminRole`, freshness tiers                        |
| `apps/admin/docs/adr/ADR-ADMIN-002`          | Action boundary and layer structure — adapter/domain/repository import direction                 |
| `apps/admin/docs/adr/ADR-ADMIN-003`          | Observability contract — structured log fields, PII exclusions                                   |
| `apps/admin/docs/adr/ADR-ADMIN-004`          | Data classification — Class A–D handling in logging, UI, and export                              |
| `apps/admin/docs/adr/ADR-ADMIN-005`          | HTTP and security surface                                                                        |
| `apps/admin/docs/adr/ADR-ADMIN-006`          | Env access boundary — `adminEnvConfig`, bootstrap exceptions                                     |
| `apps/admin/docs/adr/ADR-ADMIN-007`          | UI component contract                                                                            |
| `apps/admin/docs/adr/ADR-ADMIN-008`          | Audit log contract — mandatory operations, append-only, declarative `safeAction` integration     |
| `apps/admin/docs/adr/ADR-ADMIN-009`          | Strangler-fig and feature flag strategy — `AdminFeatureFlag`, v2 gates, rollback-by-flag         |
| `apps/admin/docs/PROGRESS-SUMMARY.md`        | Live execution surface — current phase, open defects, slice status, verification results         |
| `apps/admin/docs/CHANGELOG.md`               | Admin overhaul architectural milestones                                                          |
| `apps/admin/docs/progress/AUTOPSY-REPORT.md` | Phase 0 autopsy — original critical and high-severity findings                                   |
| `src/lib/security/authorization-policy.ts`   | `AdminCapability` map and `requireAdminCapability()` implementation                              |
| `src/actions/admin/users.ts`                 | Reference: migrated action slice with `safeAction`, domain service delegation, declarative audit |
| `src/actions/admin/verification.ts`          | Reference: migrated action slice with domain-service-backed queue/stats/details/mutations        |
| `src/lib/domains/users/`                     | Reference: domain contracts, repository, service for the users slice                             |
| `src/lib/domains/verification/`              | Reference: domain contracts, repository, service for the verification slice                      |

---

## 13. Related Documentation

- `.agent/API-TO-FRONTEND-ARCHITECTURE.md` — canonical architecture for `apps/client`
- `.agent/DOCUMENT-HIERARCHY.md` — conflict-resolution algorithm for all repo docs
- `.github/copilot-instructions.md` — repo-wide baseline rules
- `apps/client/docs/adr/ADR-001-auth-model.md` — client auth model (admin auth cross-references this)
- `apps/client/docs/adr/ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md` — admin sub-role model as seen from the client app
