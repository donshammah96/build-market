# apps/admin — Staff-Level Architecture Autopsy

> **Scope:** Full structural, architectural, and design-pattern review of `apps/admin` as of Phase 12 completion (2026-06-05).
> **Audience:** Engineering leads, staff engineers, and future contributors.
> **Goal:** Identify what is working well, what carries genuine architectural debt, what carries cosmetic/structural debt, and the ordered improvement path forward.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [File & Folder Hierarchy Inventory](#2-file--folder-hierarchy-inventory)
3. [Layer Boundary Analysis](#3-layer-boundary-analysis)
4. [What Is Working Well](#4-what-is-working-well)
5. [Structural Findings (File & Folder Organisation)](#5-structural-findings-file--folder-organisation)
6. [Architectural Findings](#6-architectural-findings)
7. [Design Pattern Findings](#7-design-pattern-findings)
8. [Security & Observability Findings](#8-security--observability-findings)
9. [Test Coverage Findings](#9-test-coverage-findings)
10. [Documentation Findings](#10-documentation-findings-implemented-2026-06-05)
11. [Proposed Staff-Level Improvements](#11-proposed-staff-level-improvements)
12. [Priority Roadmap](#12-priority-roadmap)

---

## 1. Executive Summary

The admin app has undergone a rigorous, multi-phase overhaul (Phases 0–12) that successfully eliminated the most severe pre-existing defects: direct Prisma access in the action layer, unconstrained `process.env` reads, `@ts-nocheck` suppression, raw auth checks, and unstructured logging. The canonical `safeAction` wrapper, `AdminActor`, capability-based policy map, typed `Result<T, E>` returns, `adminEnvConfig`, and a structured logger represent a genuinely staff-level security posture for an internal admin platform.

That said, the overhaul left several **structural** and **architectural** residuals — primarily around duplication inside the action layer, a bloated `shared.ts` that serves too many masters, a `src/lib/` layout that mixes infrastructure and domain concerns inconsistently, and a `(dashboard)/layout.tsx` that fuses the shell, navigation, and data-fetching concerns in a single 230-line file. The v2 route duplication and `safeVerificationAction` as a distinct primitive also require resolution.

The findings below are classified strictly:

| Class                      | What it means                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **A — Architectural**      | Violates layer boundaries, ADRs, or creates a hardening regression risk. Must be addressed before the next major feature. |
| **B — Structural**         | Correct logic in the wrong file/folder or with unnecessary duplication. No security risk; a maintenance tax.              |
| **C — Design Pattern**     | Established patterns that are inconsistently applied or partially implemented.                                            |
| **D — Cosmetic/Ergonomic** | Naming, organisation, or developer-experience issues with no systemic consequence.                                        |

**Score:** This app is well-architected at the security and domain layers. The majority of open findings are class B/C/D — maintainability taxes, not correctness defects. The only class-A finding is the `safeVerificationAction` duplication risk.

---

## 2. File & Folder Hierarchy Inventory

```text
apps/admin/
├── __tests__/                          ← Root integration tests (mixed with action tests)
│   ├── admin-verification/
│   │   ├── audit-service.test.ts
│   │   ├── notification-service.test.ts
│   │   ├── verification-types.test.ts
│   │   ├── verify-api.test.ts
│   │   └── verify-document-api.test.ts
│   ├── compliance-queue-status.test.ts ← Standalone file at root level
│   ├── config/
│   └── security/
│       └── admin-authorization-policy.test.ts
├── docs/
│   ├── CHANGELOG.md
│   ├── PROGRESS-SUMMARY.md
│   ├── adr/
│   │   ├── ADR-ADMIN-001 through ADR-ADMIN-009
│   ├── archive/
│   └── progress/
├── scripts/
│   ├── check-env-contract.mjs
│   ├── high-risk-admin-registry.mjs
│   ├── promote-admin.ts
│   ├── report-security-drift.mjs
│   └── sync-clerk-users.ts
└── src/
    ├── actions/
    │   └── admin/                      ← Adapter layer (correct)
    │       ├── __tests__/              ← Action boundary tests (correct position)
    │       ├── analytics.ts
    │       ├── audit.ts
    │       ├── compliance/             ← Sub-directory in flat action layer (inconsistent)
    │       ├── dashboard.ts
    │       ├── idempotency.ts
    │       ├── index.ts
    │       ├── leads.ts
    │       ├── onboarding-remediation.ts
    │       ├── pending-verifications/   ← Sub-directory (inconsistent)
    │       ├── professionals.ts
    │       ├── projects.ts
    │       ├── properties.ts
    │       ├── services.ts
    │       ├── settings.ts
    │       ├── shared.ts               ← Overloaded; 952 lines
    │       ├── stores.ts
    │       ├── types.ts
    │       ├── users.ts
    │       ├── verification-details/   ← Sub-directory (inconsistent)
    │       ├── verification-stats/     ← Sub-directory (inconsistent)
    │       ├── verification.ts
    │       ├── verify/                 ← Sub-directory (inconsistent)
    │       ├── verify-document/        ← Sub-directory (inconsistent)
    │       └── verify-professional/    ← Sub-directory (inconsistent)
    ├── app/
    │   ├── (auth)/
    │   ├── (dashboard)/
    │   │   ├── analytics/
    │   │   ├── analytics-v2/           ← v2 shadow routes (strangler-fig in progress)
    │   │   ├── audit/
    │   │   ├── audit-v2/               ← v2 shadow routes
    │   │   ├── leads/
    │   │   ├── professionals/
    │   │   ├── projects/
    │   │   ├── properties/
    │   │   ├── services/
    │   │   ├── settings/
    │   │   ├── stores/
    │   │   ├── users/
    │   │   ├── users-v2/               ← v2 shadow routes
    │   │   ├── verifications/
    │   │   ├── verifications-v2/       ← v2 shadow routes
    │   │   ├── layout.tsx              ← Shell + nav + data-fetching in one file
    │   │   └── page.tsx
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── tokens.css
    ├── components/
    │   ├── AddUser.tsx                 ← Top-level (no sub-folder grouping)
    │   ├── AppAreaChart.tsx
    │   ├── AppBarChart.tsx
    │   ├── AppLineChart.tsx
    │   ├── AppPieChart.tsx
    │   ├── AppSidebar.tsx              ← Unused; nav is inline in layout.tsx
    │   ├── CardList.tsx
    │   ├── EditUser.tsx
    │   ├── Navbar.tsx                  ← Unused/orphaned
    │   ├── TablePagination.tsx
    │   ├── admin/
    │   │   ├── breadcrumbs.tsx
    │   │   ├── certificate-manager.tsx
    │   │   ├── leads/
    │   │   ├── professional-profile-editor.tsx
    │   │   ├── properties/
    │   │   └── verification/
    │   ├── providers/
    │   └── ui/
    ├── hooks/
    │   └── use-mobile.ts               ← Single file; no sub-structure warranted
    ├── lib/
    │   ├── api/                        ← HTTP adapter utilities
    │   ├── auth-sync.ts                ← Standalone file at lib root
    │   ├── config/                     ← Feature flags + domain configs
    │   ├── domains/                    ← Domain layer (correct structure)
    │   │   ├── audit/
    │   │   ├── content/
    │   │   ├── dashboard/
    │   │   ├── finance/
    │   │   ├── gdpr/
    │   │   ├── leads/
    │   │   ├── professionals/
    │   │   ├── projects/
    │   │   ├── properties/
    │   │   ├── services/
    │   │   ├── settings/
    │   │   ├── stores/
    │   │   ├── users/
    │   │   └── verification/
    │   ├── errors/
    │   │   └── result.ts               ← Only one file; a folder is unnecessary
    │   ├── gdpr/                       ← Parallel to domains/gdpr (ambiguous split)
    │   │   ├── encryption/
    │   │   └── services/
    │   ├── infrastructure/             ← Correctly placed cross-cutting concerns
    │   │   ├── correlation.ts
    │   │   ├── env.ts
    │   │   ├── logger.ts
    │   │   ├── mailer.ts
    │   │   └── sms.ts
    │   ├── jobs/                       ← Scheduled jobs (correct placement)
    │   ├── notifications/              ← Notification services
    │   ├── observability/
    │   │   └── operation-names.ts      ← Only one file; folder adds no value yet
    │   ├── queues/                     ← BullMQ queue definitions
    │   ├── security/                   ← Auth/authz primitives (correct placement)
    │   ├── services/                   ← Verification-specific services (ambiguous)
    │   │   ├── idempotency.service.ts
    │   │   └── verification/
    │   ├── users/
    │   │   └── user-roles.ts           ← Single file; folder adds no value
    │   ├── utils.ts
    │   ├── validation/                 ← 18 Zod schema files (partially unused)
    │   └── workers/                    ← BullMQ worker implementations
    └── proxy.ts
```

---

## 3. Layer Boundary Analysis

The intended layering model (ADR-ADMIN-002) is:

```text
UI (app/*)
  ↓ imports
Actions (src/actions/admin/)       ← adapter: auth, validation, domain call, revalidate
  ↓ imports
Domains (src/lib/domains/)         ← business logic, Result<T, E>
  ↓ imports
Repositories (within domains/)     ← Prisma only, no logic
  ↓ imports
Database (@build/db)
```

Cross-cutting services that sit orthogonally:

```text
Infrastructure  (env, logger, correlation, mailer, sms)
Security        (actor, policy, claims, rate-limit, route-auth)
Queues/Workers  (BullMQ)
Jobs            (cron orchestration)
GDPR            (encryption, compliance services)
Notifications   (email/sms dispatchers)
```

**Observed import direction violations:** None found in the action or domain layers. The boundary is clean.

---

## 4. What Is Working Well

These are genuinely staff-level implementations that should be preserved and extended as patterns:

### 4.1 `safeAction` Execution Wrapper

The `safeAction` in `shared.ts` is a well-constructed execution fence. It enforces, in strict order:

1. Actor resolution with fail-closed error returns
2. Policy lookup from `ADMIN_ACTION_POLICY_MAP`
3. Capability enforcement per `AdminCapability`
4. Session freshness enforcement (Tier 1: 180s, Tier 2: 300s)
5. Actor-scoped rate limiting
6. Correlated execution with `withAdminCorrelation`
7. Declarative audit logging (before-return, not best-effort)
8. Structured log emission with `correlationId`, `operationName`, `adminRole`, `outcome`, `durationMs`

This is a correct, ADR-001-compliant implementation. The ordering (policy → capability → freshness → rate limit → execute → audit) matches the threat model.

### 4.2 Capability-Based Policy Map

`ADMIN_ACTION_POLICY_MAP` is a sealed, compile-time-checked record mapping action names to typed policies:

```ts
} as const satisfies Record<string, AdminActionPolicy>;
```

The `satisfies` constraint is exactly right — it catches shape mismatches without losing literal types. The `strictMutationPolicy` and `lowRiskReadPolicy` factory functions reduce repetition and enforce consistent defaults.

### 4.3 `Result<T, E>` Domain Contracts

Every domain service function returns `Result<T, DomainError>`. Error codes are domain-specific (`VERIFICATION_NOT_FOUND`, `USER_NOT_FOUND`), not generic HTTP status codes. The `ok()`/`err()` factories and `isOk()` predicate are minimal and correct.

### 4.4 `adminEnvConfig` Boundary

All 59 env keys are consumed through a single validated Zod schema at module load time. Direct `process.env` in production code is zero. Build-phase graceful degradation via `isStaticBuildPhase()` is correctly handled. The `check-env-contract.mjs` script enforces the boundary in CI.

### 4.5 Structured Logger with Type-Level PII Exclusion

`AdminLogEvent` excludes PII keys at the type level (`Omit<Record<string, unknown>, ProhibitedPiiKeys>`) and then scrubs them again at runtime. The flag-gated fallback to `console.log` is a pragmatic bridge. This is an unusually thorough implementation.

### 4.6 ADR Coverage

Nine ADRs cover authentication, layer structure, observability, data classification, HTTP security, environment access, UI contracts, audit logging, and strangler-fig strategy. The ADRs are concise, accepted, and have matching implementation. Verification sections describe testable outcomes.

### 4.7 Idempotency on All Mutations

Every mutation action wraps the business operation in `runWithIdempotency(...)` with per-actor, per-resource idempotency keys and configurable TTLs. This is the correct pattern for admin operations where double-submit or retry storms are high risk.

### 4.8 Security Drift Reporter

`report-security-drift.mjs` is a project-local static analysis script that detects:

- Direct Prisma imports in actions
- `.parse()` calls in actions
- `process.env` reads outside `env.ts`
- Unstructured log patterns

The `--strict` variant asserts zero findings and is wired into CI. This is the correct approach to enforcing architectural boundaries at scale.

---

## 5. Structural Findings (File & Folder Organisation)

### F-S1 · Class B · `shared.ts` is a 952-line multi-role file

**What it is:**

`src/actions/admin/shared.ts` currently exports:

- `safeAction` (execution wrapper)
- `safeVerificationAction` (duplicate execution wrapper — see F-A1)
- `assertAdmin` / `assertVerificationAdmin` (legacy auth helpers — still exported)
- `getAdminPermissions` / `requireAdminGranularRole` (pre-`safeAction` auth helpers)
- `logAdminAction` (legacy audit bridge that writes directly to DB)
- `callClientApi` (HTTP client utility, unrelated to auth)
- `AdminPermissions` type, `SafeActionOptions` type, internal helpers

This is a textbook god-file. It exports primitives from four different responsibility buckets into a single module that every action file imports.

**Impact:** Any change to `safeAction` requires touching the same file as `callClientApi`. Internal types and helpers are not discoverable. The surface area of `shared.ts` is a contributor-training problem.

**Proposed split:**

```text
src/actions/admin/
├── _core/
│   ├── safe-action.ts         ← safeAction, SafeActionOptions, AdminPermissions
│   ├── actor-resolver.ts      ← resolveAdminActor (private to _core)
│   ├── audit.ts               ← recordDeclarativeAudit (private to _core)
│   ├── client-api.ts          ← callClientApi, ClientApiOptions
│   └── index.ts               ← re-exports safe-action, client-api only
```

Legacy helpers (`assertAdmin`, `logAdminAction`) should be moved to a `_legacy/` folder marked for deletion rather than exported from the main surface.

---

### F-S2 · Class B · Action sub-directories are inconsistently structured

**What it is:**

The `actions/admin/` folder mixes flat `.ts` action files with sub-directories:

```text
actions/admin/
├── compliance/           ← sub-directory (contains a single route handler)
├── pending-verifications/← sub-directory
├── verification-details/ ← sub-directory
├── verification-stats/   ← sub-directory
├── verify/               ← sub-directory
├── verify-document/      ← sub-directory
├── verify-professional/  ← sub-directory
├── verification.ts       ← flat file for main verification actions
├── users.ts              ← flat file
...
```

Some domain actions are flat files; others are split into sub-directories. There is no discernible principle for when a flat file becomes a directory.

**Impact:** A contributor looking for the "verify professional" action has to check both `verification.ts` and `verify-professional/`. The indexing in `index.ts` partially compensates but does not eliminate the confusion.

**Proposed rule:** The action layer is flat unless a domain action file exceeds ~400 lines, at which point it splits into a named sub-directory with an `index.ts` barrel. Sub-directories for single-file slices should be collapsed.

---

### F-S3 · Class B · `src/lib/gdpr/` and `src/lib/domains/gdpr/` represent an ambiguous split

**What it is:**

GDPR-related code lives in two separate top-level `lib` directories:

```text
src/lib/gdpr/
├── encryption/         ← Prisma extension, key rotation, AES-GCM
├── services/
│   ├── anonymization.service.ts
│   ├── asset-cleanup.service.ts
│   ├── compliance.service.ts
│   ├── consent.service.ts
│   └── export.service.ts

src/lib/domains/gdpr/
├── contracts.ts
├── repository.ts
└── service.ts
```

The `lib/gdpr/services/` files are substantive domain services (anonymization, export, compliance) but live outside `domains/`. The `domains/gdpr/service.ts` is a thin wrapper around the compliance queue. Neither location is obviously the "canonical" home.

**Impact:** A contributor working on GDPR compliance has to navigate two separate trees. The `lib/gdpr/services/` services bypass the `domains/` contract pattern (no `Result<T, E>` in most of them), which is silent ADR-002 drift.

**Proposed fix:** Consolidate under `domains/gdpr/`:

```text
domains/gdpr/
├── contracts.ts
├── repository.ts
├── service.ts          ← compliance queue, data-access events
├── anonymization/
│   └── service.ts
├── export/
│   └── service.ts
├── encryption/
│   └── ...
└── index.ts
```

---

### F-S4 · Class D · `src/lib/services/` is an opaque catch-all

**What it is:**

`src/lib/services/` contains:

```text
lib/services/
├── idempotency.service.ts   ← Idempotency state machine (Redis-backed)
└── verification/
    ├── audit-service.ts
    ├── notification.service.ts
    ├── professional-verification.service.ts
    ├── property-verification.service.ts
    ├── store-verification.service.ts
    └── types.ts
```

The `verification/` sub-services are verification-specific but not discoverable as part of `domains/verification/`. They are called by `domains/verification/service.ts` but live elsewhere, making the domain slice feel incomplete.

**Impact:** `domains/verification/service.ts` imports from `lib/services/verification/` which imports from nothing in `domains/`. This is not an import-direction violation, but it creates a non-obvious abstraction boundary.

**Proposed fix:** Move `lib/services/verification/` into `domains/verification/` as an internal module:

```text
domains/verification/
├── contracts.ts
├── index.ts
├── repository.ts
├── service.ts
└── internal/
    ├── audit-service.ts
    ├── notification.service.ts
    ├── professional-verification.service.ts
    ├── property-verification.service.ts
    ├── store-verification.service.ts
    └── types.ts
```

Move `lib/services/idempotency.service.ts` to `lib/infrastructure/idempotency.service.ts` since it is infrastructure, not a domain service.

---

### F-S5 · Class D · `src/lib/validation/` is largely unused by the current action layer

**What it is:**

`src/lib/validation/` contains 18 Zod schema files covering calendars, certificates, documents, finance, portfolios, stores, etc. These appear to be schemas from the pre-overhaul action layer that have not been removed after domain slices took over validation.

**Impact:** 18 files that create confusion about "which schema to use" when adding new validation. Some schemas may be genuinely in use by API route handlers; others are orphans.

**Proposed action:** Audit each file with `grep -r "validation/"` across the src tree. Delete schemas that are only referenced by deleted or legacy code. Document the remainder under a `README.md` explaining their scope.

---

### F-S6 · Class B · `components/` root is unorganised

**What it is:**

The `components/` root contains 10 files mixed with 3 sub-directories:

```text
components/
├── AddUser.tsx           ← Feature-specific, should be in components/admin/users/
├── AppAreaChart.tsx      ← Shared chart — could stay at root or move to ui/
├── AppBarChart.tsx
├── AppLineChart.tsx
├── AppPieChart.tsx
├── AppSidebar.tsx        ← Navigation component; app uses inline nav in layout.tsx
├── CardList.tsx          ← Generic list card
├── EditUser.tsx          ← Feature-specific
├── Navbar.tsx            ← Appears orphaned; app's nav is inline in layout.tsx
├── TablePagination.tsx
├── admin/                ← Domain-specific components (correct)
├── providers/
└── ui/                   ← shadcn/ui primitives (correct)
```

`AppSidebar.tsx` and `Navbar.tsx` appear to be orphans from an earlier layout refactor that introduced the inline nav in `layout.tsx`. `AddUser.tsx` and `EditUser.tsx` are feature-level components that belong in `components/admin/users/`.

**Proposed structure:**

```text
components/
├── charts/               ← AppAreaChart, AppBarChart, AppLineChart, AppPieChart
├── admin/
│   ├── users/            ← AddUser, EditUser
│   ├── verification/
│   ├── leads/
│   ├── properties/
│   └── ...
├── layout/               ← TablePagination, CardList (shared layout helpers)
├── providers/
└── ui/                   ← shadcn/ui primitives
```

Delete `AppSidebar.tsx` and `Navbar.tsx` after confirming they have zero imports.

---

### F-S7 · Class D · `src/lib/errors/`, `src/lib/users/`, `src/lib/observability/` are single-file folders

Single-file folders add no structural value and create navigation overhead.

- `errors/result.ts` → move to `lib/result.ts`
- `users/user-roles.ts` → move to `lib/domains/users/user-roles.ts` (it is a domain concept)
- `observability/operation-names.ts` → move to `lib/infrastructure/operation-names.ts`

---

## 6. Architectural Findings

### F-A1 · Class A · `safeVerificationAction` is a near-duplicate of `safeAction`

**What it is:**

`shared.ts` exports two execution wrappers:

- `safeAction` (lines 485–666): Full policy enforcement including capabilities.
- `safeVerificationAction` (lines 668–828): Nearly identical; the only difference is that it **skips the capability check loop** (`for (const capability of policy.capabilities)`).

Both wrappers share the same:

- `resolveAdminActor` call
- `enforceRecentAuth` call
- `enforceActorRateLimit` call
- `recordDeclarativeAudit` call
- Structured log emission pattern
- Error-handling `catch` block

The 160-line duplication (85% identical code) is a latent defect. Any future hardening of `safeAction` — a new enforcement step, a new log field, a new audit field — will silently fail to apply to `safeVerificationAction` unless both files are updated in parallel.

**Why `safeVerificationAction` exists:** Looking at its call sites (`properties.ts`, `stores.ts`, `professionals.ts`), it is used for verify/reject mutations that have `300s` session freshness (Tier 2) but use `MANAGE_VERIFICATION` capability. There is no functional reason it needs to skip the capability loop — `safeAction` already enforces capabilities for those actions via `getAdminActionPolicy`.

**Resolution:** Delete `safeVerificationAction`. All call sites should use `safeAction`. The action policy map already encodes the 300s freshness for `verify_professional` / `reject_professional`. The capability checks it skips would be additive safety, not breaking changes.

```ts
// BEFORE (properties.ts, stores.ts, professionals.ts)
return safeVerificationAction("verifyProperty", async ({ actor }) => { ... });

// AFTER — no change needed at policy level; safeAction handles it
return safeAction("verify_property", async ({ actor }) => { ... }, { ... });
```

---

### F-A2 · Class A · Legacy auth helpers are still exported from `shared.ts`

**What it is:**

`shared.ts` still exports the following pre-`safeAction` helpers:

```ts
export async function assertVerificationAdmin();
export async function assertAdmin();
export async function getAdminPermissions();
export async function requireAdminGranularRole();
```

A grep for their usage in the current codebase returns zero results from action files, but they remain in the public export surface of `shared.ts` and `index.ts`. Any future contributor can reach for them instead of `safeAction`.

**Risk:** A new contributor writing a new action file and importing `assertAdmin()` bypasses the entire `safeAction` pipeline: no audit log, no structured log, no rate limit, no session freshness enforcement. This is a capability-bypass footgun.

**Resolution:** Move these functions to a `_legacy/` folder within `actions/admin/` and remove them from all public exports. Add a JSDoc `@deprecated` tag and a comment pointing to `safeAction`. Delete them once no call sites exist.

---

### F-A3 · Class A · `logAdminAction` in `shared.ts` is a parallel audit path

**What it is:**

`shared.ts` line 830 exports `logAdminAction`, which writes directly to the database audit log via `securityRepository.createAdminAuditLog`. This is a separate, older audit path that predates the `auditService.recordAdminAuditEvent` path used by `recordDeclarativeAudit`.

Two audit paths with different schemas, different metadata shapes, and different operation name conventions create divergence in the audit log. `logAdminAction` does not produce `correlationId`, `operationName`, or structured `outcome`.

**Resolution:** Remove `logAdminAction` from the public export surface. Audit call sites. If any remain, migrate them to the declarative `auditLog` option on `safeAction`.

---

### F-A4 · Class B · `(dashboard)/layout.tsx` mixes shell, navigation, and data-fetching

**What it is:**

The 229-line dashboard layout file:

1. Calls `syncUserRole()` as a layout-level side effect
2. Calls `currentUser()` to populate the user footer
3. Calls `getPendingVerifications()` to populate the verification badge count
4. Renders a 150-line inline sidebar navigation
5. Renders the mobile header

**Problems:**

- **Verification badge fetch in layout:** Every page render inside `(dashboard)` triggers a `getPendingVerifications` call to populate the sidebar badge. This is an N+1 data-fetch pattern at layout scope. As the app grows, this layout becomes a global performance bottleneck.
- **Inline navigation:** The `AppSidebar.tsx` component exists but is not used; the navigation is hardcoded inline. Any nav change requires modifying the layout file.
- **Role display from `user.publicMetadata.role`:** This reads the Clerk-side role from session claims (`publicMetadata.role`) for display purposes. While cosmetically benign (it's only a display label), it contradicts ADR-001's principle that session claims are not authoritative. A super-admin who had their Clerk metadata updated may see a stale display label until their next session refresh.

**Proposed fix:**

1. Extract the sidebar navigation into a `NavigationSidebar` server component.
2. Move the pending verification badge into a `Suspense`-wrapped `VerificationBadgeCount` component so the count loads independently and does not block the layout render.
3. The role display label should be sourced from the `AdminActor.adminRole` (DB-resolved), not Clerk public metadata.

---

### F-A5 · Class C · `src/lib/config/` mixes feature flags with domain-specific configs

**What it is:**

`src/lib/config/` contains:

```text
config/
├── document.config.ts
├── feature-flags.ts
├── lead.config.ts
├── portfolio.config.ts
├── professional.config.ts
├── project.config.ts
├── property.config.ts
└── store.config.ts
```

Domain configs (field limits, allowed document types, etc.) live alongside the feature flag system. These are different concerns with different ownership and lifecycle.

**Proposed split:**

```text
lib/config/
└── feature-flags.ts   ← stays here (cross-cutting, platform concern)

lib/domains/properties/
└── property.config.ts ← domain-owned config, colocated with domain

lib/domains/leads/
└── lead.config.ts     ← etc.
```

---

### F-A6 · Class B · `parseActionInput` is duplicated across 8 action files

**What it is:**

The helper function:

```ts
function parseActionInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fallbackMessage: string,
): T { ... }
```

Is copy-pasted identically into:

- `verification.ts`
- `users.ts`
- `settings.ts`
- `services.ts`
- `projects.ts`
- `professionals.ts`
- `leads.ts`

Seven copies of the same 10-line function. Any change to the error-shape of validation failures (e.g., surfacing all issues, not just the first) must be applied in 7 places.

**Resolution:** Export `parseActionInput` from the proposed `_core/safe-action.ts`. Each action file imports it.

---

## 7. Design Pattern Findings

### F-D1 · Class C · `Result<T, E>` is defined twice

`src/lib/errors/result.ts` exports `Result<T, E>` with `{ ok: true | false }` discriminant.

`src/lib/security/authorization-policy.ts` defines a local `Result<T, E>` type with `{ success: true | false }` discriminant (line 4-6).

These are structurally incompatible types with the same name. The security layer uses `success`; the domain layer uses `ok`. This means:

```ts
// Domain service:
if (!result.ok) return result;

// Security layer:
if (!result.success) return { ... };
```

Contributors have to know which layer they are calling to pick the right discriminant. The inconsistency is especially visible in `verification/service.ts` which calls both.

**Resolution:** Standardise on `ok`/`error` discriminant everywhere. Extend `adminEnvConfig` to re-export `ok`/`err` from the canonical `lib/errors/result.ts`. Update `authorization-policy.ts` to re-export from the canonical module.

---

### F-D2 · Class C · `entity: Record<string, any>` in `VerificationDetails`

`src/actions/admin/types.ts` line 134:

```ts
entity: Record<string, any>;
```

This is a typed escape hatch that bypasses TypeScript's safety net for the entity-detail payload. Since `VerificationDetails` is the primary return type for the verification detail view, `Record<string, any>` means the UI layer has no type safety over the entity fields it renders.

**Resolution:** Define per-entity detail types:

```ts
export type ProfessionalEntityDetail = { ... };
export type StoreEntityDetail = { ... };
export type PropertyEntityDetail = { ... };

export type VerificationDetails =
  | { entityType: "professional"; entity: ProfessionalEntityDetail; ... }
  | { entityType: "store"; entity: StoreEntityDetail; ... }
  | { entityType: "property"; entity: PropertyEntityDetail; ... };
```

This discriminated union gives the UI full type safety when branching on `entityType`.

---

### F-D3 · Class C · v2 shadow routes have no retirement timeline

**What it is:**

Four v2 route segments exist alongside their v1 predecessors:

```text
(dashboard)/
├── analytics/      ← v1
├── analytics-v2/   ← v2 (feature-flag gated)
├── audit/
├── audit-v2/
├── users/
├── users-v2/       ← users-v2/page.tsx is currently 41 bytes (placeholder only)
├── verifications/
└── verifications-v2/
```

ADR-ADMIN-009 documents the strangler-fig strategy correctly. However:

1. `users-v2/page.tsx` is 41 bytes — a stub with no implementation.
2. There is no documented retirement date or migration criteria for any of the v2 routes.
3. The feature flag names (`ADMIN_V2_USER_MANAGEMENT`, etc.) suggest a v2 that will eventually be the only version, but the timeline is unspecified.

**Risk:** Without documented retirement criteria, v1 and v2 routes will coexist indefinitely, doubling the maintenance surface for any nav or data-fetching change.

**Proposed fix:** Extend ADR-ADMIN-009 to specify:

- Migration criteria for each flag (e.g., "retire v1 analytics after 30 days with v2 flag enabled in production")
- The checklist for retirement (delete v1 route, remove flag, update docs)
- Owner for each v2 migration

---

### F-D4 · Class C · Sidebar navigation is not access-controlled

**What it is:**

The dashboard layout renders all navigation links unconditionally, regardless of the current user's `adminRole`. A `SUPPORT_AGENT` sees "Settings" and "Audit Logs" in the sidebar even though they lack `SYSTEM_ADMIN_ONLY` and `EXPORT_DATA` capabilities.

This is a **display-only** gap, not a security gap — the underlying `safeAction` wrapper will reject unauthorised requests. But it creates a poor UX and confusing error states when users click links to pages they cannot access.

**Resolution:** Pass the resolved `AdminRole` to the navigation component and conditionally render nav items based on capability membership:

```tsx
<NavigationSidebar adminRole={resolvedActor.adminRole} />
```

Use `ADMIN_CAPABILITY_ROLE_MAP` to determine which nav groups are visible.

---

## 8. Security & Observability Findings

### F-O1 · Class B · `getAdminLogger()` is called once per action invocation but is not memoised

Each call to `safeAction` calls `getAdminLogger()`, which calls `isAdminFeatureEnabled(...)`, which reads `adminEnvConfig[envKey]`. This is a trivial cost but is an unnecessary re-evaluation on every action call for a value that is stable for the process lifetime.

**Resolution:** Memoize the logger at module load time:

```ts
const logger = getAdminLogger(); // computed once at import time
```

Since feature flags are env-var-driven and Next.js does not hot-reload env mid-process, this is safe.

---

### F-O2 · Class C · `syncUserRole()` is called in both `layout.tsx` and `resolveAdminActor`

`DashboardLayout` calls `await syncUserRole()` before rendering. `resolveAdminActor` (inside `safeAction`) also calls `await syncUserRole()` as a background catch-ignored call. This means every admin action execution triggers the layout sync AND the action sync in the same request cycle.

The layout-level sync is cosmetic (keeps the display label fresh). The action-level sync in `resolveAdminActor` is a safety net. Running both doubles the Clerk API calls per request.

**Resolution:** Remove the layout-level `syncUserRole()`. The action layer's sync is sufficient for the security model. The display label will be slightly stale (by one page load) which is acceptable for an internal tool.

---

### F-O3 · Class D · `compliance.queue.ts` uses `Record<string, any>` for metadata

`src/lib/queues/compliance.queue.ts` lines 60 and 91:

```ts
metadata?: Record<string, any>;
```

Queue job payloads should have typed shapes. `Record<string, any>` means a stale worker handler will silently receive malformed metadata without a type error.

**Resolution:** Define a discriminated `ComplianceJobMetadata` type for each job kind and use it in the queue payload definition.

---

## 9. Test Coverage Findings

### F-T1 · Class B · Root `__tests__/` and `src/actions/admin/__tests__/` serve different purposes but look identical

**What it is:**

Tests live in three locations:

1. `__tests__/` (root) — integration-style tests for action boundaries, verification flows, security policy
2. `src/actions/admin/__tests__/` — action slice tests
3. `src/lib/domains/*/` `__tests__/` — domain unit tests

The root `__tests__/` and the action `__tests__/` serve overlapping scopes. The `__tests__/compliance-queue-status.test.ts` is a lone file at root level.

**Proposed consolidation:**

```text
__tests__/
├── integration/
│   ├── verification-flows/   ← multi-layer action→domain integration tests
│   └── security/
└── compliance-queue-status.test.ts → move to src/actions/admin/__tests__/
```

---

### F-T2 · Class C · UI/component layer has no tests

`components/` and `app/` have zero test coverage. While server components are hard to unit test in isolation, the domain-specific components (`AddUser.tsx`, `EditUser.tsx`, `professional-profile-editor.tsx`) contain non-trivial form logic that could be tested with React Testing Library.

**Proposed fix:** Add at minimum:

- Form submission tests for `AddUser.tsx` and `EditUser.tsx`
- Policy-driven nav visibility tests for the navigation sidebar once it is extracted (F-A4)

---

### F-T3 · Class D · Test file naming is inconsistent

Action test files use both `*.test.ts` and the directory names imply grouping that doesn't match the file names inside:

- `__tests__/admin-verification/verify-api.test.ts` — tests `verifyEntity` from the action layer
- `src/actions/admin/__tests__/verification-actions.test.ts` — also tests verification actions

Use a single convention: `<slice>.actions.test.ts` in `src/actions/admin/__tests__/` for all action-boundary tests, and `<slice>.service.test.ts` within `domains/*/` `__tests__/` for all domain tests.

---

## 10. Documentation Findings Implemented (2026-06-05)

### F-Doc1 · Class D · ADRs are minimal and lack consequence tracking · Done

The nine ADRs are correct and accepted. However, they are very brief (~30-40 lines each). They document decisions but lack:

- **Alternatives considered** — why was this approach chosen over alternatives?
- **Revision history** — if the decision was amended (e.g., session freshness window was tightened), there is no record of the amendment.
- **Link to implementing PR/commit** — each ADR mentions the branch name but not a PR or commit hash.

**Resolution:** All nine ADRs have been extended with `## Alternatives Considered` sections (3 alternatives each, with explicit rejection rationale) and `## Revision History` tables. ADR-ADMIN-009 additionally received a Migration Criteria section and retirement checklist (addressing F-D3).

**Implemented files:**

- [`ADR-ADMIN-001`](adr/ADR-ADMIN-001-admin-authentication-and-authorization-model.md)
- [`ADR-ADMIN-002`](adr/ADR-ADMIN-002-admin-action-boundary-and-layer-structure.md)
- [`ADR-ADMIN-003`](adr/ADR-ADMIN-003-admin-observability-contract.md)
- [`ADR-ADMIN-004`](adr/ADR-ADMIN-004-admin-data-classification-and-handling.md)
- [`ADR-ADMIN-005`](adr/ADR-ADMIN-005-admin-http-and-security-surface.md)
- [`ADR-ADMIN-006`](adr/ADR-ADMIN-006-admin-environment-variable-access-boundary.md)
- [`ADR-ADMIN-007`](adr/ADR-ADMIN-007-admin-ui-component-contract.md)
- [`ADR-ADMIN-008`](adr/ADR-ADMIN-008-admin-audit-log-contract.md)
- [`ADR-ADMIN-009`](adr/ADR-ADMIN-009-admin-strangler-fig-and-feature-flag-strategy.md)

---

### F-Doc2 · Class D · No `CONTRIBUTING.md` or `ARCHITECTURE.md` for the admin app · Done

New contributors to `apps/admin` must piece together the architectural model from 9 ADRs, 1 progress summary, and 1 changelog. There is no single entry-point document that explains:

- The layer model
- How to add a new domain slice (checklist)
- How to add a new action (checklist)
- How to add a new feature flag
- The test convention

**Resolution:** [`docs/CONTRIBUTING.md`](CONTRIBUTING.md) has been created covering:

1. Architecture Quick Reference (layer diagram + golden rules table)
2. Adding a New Domain Slice (step-by-step with annotated code)
3. Adding a New Action (step-by-step with annotated code and all `safeAction` rules)
4. Adding a New Feature Flag (step-by-step including env schema and template updates)
5. Writing Tests (naming convention table, what to test per layer)
6. Observability Checklist
7. Security Checklist
8. Pre-PR verification sequence

---

### F-Doc3 · Class B · `PROGRESS-SUMMARY.md` conflates phase log with open-defects registry · ✅ Done

The `PROGRESS-SUMMARY.md` is simultaneously a phase completion log, a defect tracker, a verification command reference, and a rollback contract. This is four documents in one, making it hard to extract "what is the current state" vs "what was done in Phase X."

**Resolution:** Split into four focused documents:

```text
docs/
├── PROGRESS-SUMMARY.md      ← Slim: active phase, next priority, slice status table
├── DEFECTS.md               ← Open/resolved defects with severity, status, owner (ADM-001–ADM-020)
├── VERIFICATION.md          ← Command reference, gate policy, latest verification results
└── ROLLBACK-CONTRACTS.md    ← Feature flag rollback table, irreversible state tracker, retirement checklist
```

**Implemented files:**

- [`PROGRESS-SUMMARY.md`](PROGRESS-SUMMARY.md) — slimmed to ~60 lines
- [`DEFECTS.md`](DEFECTS.md) — resolved Phase 0–12 defects + new autopsy defects ADM-011–ADM-020
- [`VERIFICATION.md`](VERIFICATION.md) — commands, gate policy, latest results
- [`ROLLBACK-CONTRACTS.md`](ROLLBACK-CONTRACTS.md) — active flags, irreversible states, retirement checklist

---

## 11. Proposed Staff-Level Improvements

The following improvements are ordered by systemic impact. Each is classified by effort (S/M/L) and risk (Low/Med/High).

| ID   | Finding | Action                                                                       | Effort | Risk | Priority |
| ---- | ------- | ---------------------------------------------------------------------------- | ------ | ---- | -------- |
| I-1  | F-A1    | Delete `safeVerificationAction`; migrate call sites to `safeAction`          | S      | Low  | **P0**   |
| I-2  | F-A2    | Deprecate and delete legacy auth helpers (`assertAdmin`, etc.)               | S      | Low  | **P0**   |
| I-3  | F-A3    | Remove `logAdminAction`; migrate remaining call sites to declarative audit   | S      | Low  | **P0**   |
| I-4  | F-S1    | Split `shared.ts` into `_core/{safe-action, client-api, actor-resolver}`     | M      | Low  | **P1**   |
| I-5  | F-A6    | Extract `parseActionInput` to shared export; remove 7 duplicates             | S      | Low  | **P1**   |
| I-6  | F-D1    | Standardise `Result<T, E>` on `ok` discriminant; update security layer       | M      | Med  | **P1**   |
| I-7  | F-A4    | Extract `NavigationSidebar`; move badge count to `Suspense` boundary         | M      | Low  | **P1**   |
| I-8  | F-S3    | Consolidate `lib/gdpr/` into `domains/gdpr/`                                 | M      | Low  | **P2**   |
| I-9  | F-S4    | Move `lib/services/verification/` into `domains/verification/internal/`      | M      | Low  | **P2**   |
| I-10 | F-D2    | Replace `entity: Record<string, any>` with discriminated union               | M      | Med  | **P2**   |
| I-11 | F-S6    | Reorganise `components/` root; delete orphaned `AppSidebar`, `Navbar`        | S      | Low  | **P2**   |
| I-12 | F-D4    | Add capability-based nav item visibility                                     | M      | Low  | **P2**   |
| I-13 | F-D3    | Add `RETIREMENT.md` for v2 shadow routes with migration criteria             | S      | Low  | **P2**   |
| I-14 | F-S2    | Enforce flat-file rule in action layer; collapse single-file sub-directories | M      | Low  | **P3**   |
| I-15 | F-A5    | Move domain configs into their domain slice                                  | S      | Low  | **P3**   |
| I-16 | F-S7    | Collapse single-file folders (`errors/`, `users/`, `observability/`)         | S      | Low  | **P3**   |
| I-17 | F-O1    | Memoize logger at module-load time                                           | S      | Low  | **P3**   |
| I-18 | F-O2    | Remove layout-level `syncUserRole()`                                         | S      | Low  | **P3**   |
| I-19 | F-T1    | Consolidate test root structure                                              | S      | Low  | **P3**   |
| I-20 | F-T2    | Add component-level tests for `AddUser`, `EditUser`, nav visibility          | M      | Low  | **P3**   |
| I-21 | F-Doc2  | ~~Write `docs/CONTRIBUTING.md` with new-slice checklist~~ ✅ Done            | M      | None | **P3**   |
| I-22 | F-Doc3  | ~~Split `PROGRESS-SUMMARY.md` into focused documents~~ ✅ Done               | S      | None | **P3**   |
| I-23 | F-S5    | Audit `lib/validation/`; delete orphaned schemas                             | M      | Low  | **P3**   |

---

## 12. Priority Roadmap

### P0 — Dead Code & Footgun Removal (immediate)

These items carry active architectural risk because they provide surface area for security bypasses:

1. **Delete `safeVerificationAction`** and migrate its 6 call sites to `safeAction`. The policy map already encodes the Tier 2 freshness window for those actions.
2. **Remove legacy auth helper exports** (`assertAdmin`, `assertVerificationAdmin`, `getAdminPermissions`, `requireAdminGranularRole`, `logAdminAction`) from the public API surface.
3. **Run the security drift reporter** after each P0 change to confirm zero regressions.

### P1 — Core Infrastructure Cleanup (next sprint)

1. **Split `shared.ts`** into purpose-specific modules under `_core/`.
2. **De-duplicate `parseActionInput`** into a single shared export.
3. **Standardise `Result` discriminant** to `ok` across all layers.
4. **Extract `NavigationSidebar`** and wrap the badge fetch in `Suspense`.

### P2 — Domain & Component Organisation (backlog sprint)

1. Consolidate GDPR, verification services into their domain slices.
2. Fix `VerificationDetails.entity` type.
3. Reorganise `components/`.
4. Add capability-based nav visibility.
5. Document v2 route retirement criteria.

### P3 — Ergonomics & Housekeeping (ongoing)

1. All remaining structural, naming, and documentation improvements from the findings table above.
2. **Documentation findings (F-Doc1, F-Doc2, F-Doc3) implemented 2026-06-05.** See Section 10 for links to generated files.

---

Generated: 2026-06-05 · Admin app Phase 12 baseline · Reviewed against ADR-ADMIN-001 through ADR-ADMIN-009\_
