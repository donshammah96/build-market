# Staff-Level Admin App Overhaul — Enhanced Prompt

## Preamble: How to Read This Prompt

This prompt instructs an agent to perform a comprehensive, staff-level architectural overhaul of `apps/admin`. The work follows the same discipline established in `apps/client`: ADRs first, then phased implementation, then verification. Every phase closes with a CHANGELOG entry, a PROGRESS-SUMMARY update, and a passing CI gate before the next phase begins.

**Document authority:** `apps/client` docs are read-only reference material for patterns. `apps/admin` gets its own canonical ADR set, its own CHANGELOG, and its own PROGRESS-SUMMARY. Do not copy-paste client ADRs into admin — derive admin ADRs from first principles, noting where the architectures converge and where they intentionally diverge.

**Completion rule:** A phase is not complete until runtime code, focused tests, strict tooling output, and documentation all align. Partial evidence does not constitute a closed phase.

---

## Branch and Collaboration Strategy

This section is read before any phase begins. Every branch, PR, tag, and merge decision for the duration of the overhaul follows the rules defined here.

### Branch Hierarchy

```text
main  ← always stable, release-ready; no direct overhaul commits
  └── integration/admin-overhaul  ← long-lived gate; all overhaul work merges here first
        ├── docs/admin-overhaul/<area>            ← documentation-only phases (0, 1)
        ├── chore/admin-overhaul/<area>           ← tooling, config, infrastructure (Phase 2)
        ├── feat/admin-overhaul/<slice>           ← implementation phases (3–8, 10)
        ├── test/admin-overhaul/<area>            ← test-dominant work (Phase 9 standalone suites)
        ├── security/admin-overhaul/<area>        ← security hardening pass (Phase 12)
        ├── fix/admin-overhaul/<issue>            ← ad-hoc defect corrections on any phase
        └── spike/admin-overhaul/<topic>          ← throwaway proofs of concept; never merged
```

`main` is the production branch. `integration/admin-overhaul` is the staging convergence point. No short-lived branch is ever opened directly off `main` for overhaul work.

### Naming Conventions

| Branch type   | Pattern                          | Examples                                                                                        |
| ------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| Integration   | `integration/admin-overhaul`     | (one branch, fixed name)                                                                        |
| Documentation | `docs/admin-overhaul/<area>`     | `docs/admin-overhaul/autopsy`, `docs/admin-overhaul/adr-foundation`                             |
| Chore/infra   | `chore/admin-overhaul/<area>`    | `chore/admin-overhaul/tooling`, `chore/admin-overhaul/ci-gates`                                 |
| Feature       | `feat/admin-overhaul/<slice>`    | `feat/admin-overhaul/auth`, `feat/admin-overhaul/domain-users`, `feat/admin-overhaul/ui-tokens` |
| Test          | `test/admin-overhaul/<area>`     | `test/admin-overhaul/policy-matrix`, `test/admin-overhaul/critical-journeys`                    |
| Security      | `security/admin-overhaul/<area>` | `security/admin-overhaul/hardening-pass`, `security/admin-overhaul/csrf-audit`                  |
| Fix           | `fix/admin-overhaul/<issue>`     | `fix/admin-overhaul/safe-action-null-actor`, `fix/admin-overhaul/audit-log-race`                |
| Spike         | `spike/admin-overhaul/<topic>`   | `spike/admin-overhaul/clerk-session-freshness`                                                  |

Spike branches are never merged. If a spike produces a decision, that decision is codified in an ADR and implemented in a proper `feat/` or `chore/` branch.

### Phase-to-Branch Mapping

Every phase maps to one or more branches. Phases 9 (testing) and 11 (documentation) are continuous — their work is embedded in every other phase's branch rather than having their own dedicated branches. When the test or documentation surface is substantial enough to warrant isolation, use `test/` or `docs/` prefixes.

| Phase                                           | Branch type | Example branch name                                                           |
| ----------------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| Phase 0 — Autopsy                               | `docs/`     | `docs/admin-overhaul/autopsy`                                                 |
| Phase 1 — ADR Foundation                        | `docs/`     | `docs/admin-overhaul/adr-foundation`                                          |
| Phase 2 — Tooling Infrastructure                | `chore/`    | `chore/admin-overhaul/tooling`                                                |
| Phase 3 — Auth Hardening                        | `feat/`     | `feat/admin-overhaul/auth-hardening`                                          |
| Phase 4 — Domain/Repository Layer (per domain)  | `feat/`     | `feat/admin-overhaul/domain-users`, `feat/admin-overhaul/domain-verification` |
| Phase 5 — Action Refactoring (per action slice) | `feat/`     | `feat/admin-overhaul/actions-users`, `feat/admin-overhaul/actions-finance`    |
| Phase 6 — UI Overhaul (per area)                | `feat/`     | `feat/admin-overhaul/ui-tokens`, `feat/admin-overhaul/ui-components`          |
| Phase 7 — Observability                         | `feat/`     | `feat/admin-overhaul/observability`                                           |
| Phase 8 — Audit Log                             | `feat/`     | `feat/admin-overhaul/audit-log`                                               |
| Phase 9 — Testing (standalone suites only)      | `test/`     | `test/admin-overhaul/policy-matrix`, `test/admin-overhaul/critical-journeys`  |
| Phase 10 — Strangler Fig / Feature Flags        | `feat/`     | `feat/admin-overhaul/feature-flags`                                           |
| Phase 11 — Docs (standalone only)               | `docs/`     | `docs/admin-overhaul/adr-amendments`                                          |
| Phase 12 — Security Hardening                   | `security/` | `security/admin-overhaul/hardening-pass`                                      |

### Parallel Work Tracks

The sequencing section specifies that Phases 5, 6, and 7 may run in parallel after Phase 4 closes. Parallelism is managed through the integration branch as the convergence point.

```text
Phase 4 closes (integration/admin-overhaul is the stable base)
     │
     ├── Track A  feat/admin-overhaul/actions-<slice>  (Phase 5, one branch per action slice)
     ├── Track B  feat/admin-overhaul/ui-<area>         (Phase 6, one branch per UI area)
     └── Track C  feat/admin-overhaul/observability     (Phase 7)
                  feat/admin-overhaul/audit-log         (Phase 8, follows Phase 7 in Track C)
```

All three tracks merge back to `integration/admin-overhaul` independently via PR. Track authors pull from `integration/admin-overhaul` (not from each other's branches) to pick up cross-track changes.

**Conflict protocol for parallel tracks:** If two tracks edit the same file, the second PR to merge must rebase onto the latest `integration/admin-overhaul` before its CI gate is reassessed. Do not merge conflict-containing branches.

### Merge Strategy

| Direction                                         | Strategy                 | Why                                                                                               |
| ------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| Short-lived branch → `integration/admin-overhaul` | Squash merge             | One clean logical commit per PR on the integration branch; easier to bisect and revert phase work |
| `integration/admin-overhaul` → `main`             | Merge commit (`--no-ff`) | Preserves the full phase history and makes phase boundaries visible in `git log`                  |

Never fast-forward the integration branch into `main`. The merge commit is the record that a phase shipped.

The squash commit title for short-lived PRs must follow the scoped conventional commit format described below.

### Commit Convention

All commits to `integration/admin-overhaul` (after squash merge from short-lived branches) and all direct commits on `integration/admin-overhaul` must use scoped conventional commits:

```text
<type>(admin-overhaul): <short imperative description>

<optional body: what changed and why>

Phase: <phase number and name>
Verification: <one-line summary of what passed>
```

Examples:

```text
docs(admin-overhaul): add Phase 0 autopsy report and findings register

Phase: 0 — Autopsy
Verification: read-only pass; no CI gate required

feat(admin-overhaul): harden safeAction with recentAuth and typed AdminActor

Phase: 3 — Authentication Hardening
Verification: admin:check-types ✓  admin:report-security-drift:strict ✓  policy suite 14/14 ✓

chore(admin-overhaul): introduce tooling infrastructure and CI gates

Phase: 2 — Tooling Infrastructure
Verification: admin:check-types ✓  admin:lint ✓  admin:check-env-contract ✓
```

Allowed types: `feat`, `fix`, `docs`, `chore`, `test`, `security`, `refactor`, `perf`.

### PR Lifecycle

Every short-lived branch must follow this lifecycle:

1. **Open as Draft immediately** on first push. This signals work in progress and invites early review comments without triggering a full review request.
2. **Fill in the PR description template** (see below) before any review is requested.
3. **Attach verification output** — paste actual terminal output for every verification command listed in the phase. Planned output ("will be green") is not acceptable.
4. **Promote to Ready for Review** only when all CI checks pass and all verification output is attached.
5. **Receive at least one approving review** before merging to `integration/admin-overhaul`.
6. **Squash merge** with a conventional commit title.

#### PR Description Template

Every PR to `integration/admin-overhaul` must include this template in the description:

````markdown
## Phase and Scope

**Phase:** <number and name>
**Branch:** <branch name>
**Track:** <A / B / C / standalone> (only relevant during parallel Phase 5-7 work)

## What This Changes

<one paragraph: what was implemented, refactored, or fixed>

## Files Changed

<comma-separated list of all touched files>

## Verification Output

```bash
# admin:check-types
<paste actual output and exit code>

# admin:report-security-drift:strict
<paste actual output — all categories must be 0>

# targeted test suite
<paste actual output — N tests passed>
```
````

## CHANGELOG Entry

```html
<paste the CHANGELOG excerpt that will be committed with this PR></paste>

## Open Questions

<any questions that should be resolved before merge; delete section if none>
</any>
```

PRs that omit the verification output section are not ready for review, regardless of CI status. CI proves the gate passed; the verification output proves the right commands were run.

### Phase Checkpoint Tags

After the integration branch is verified clean at the end of each phase, apply a tag:

```bash
git tag admin-overhaul/phase-<N>-complete <sha>
git push origin admin-overhaul/phase-<N>-complete
```

Tags are applied to the integration branch, not to `main`. They represent the verified clean state of the overhaul at each phase boundary.

Phase 0 and Phase 1 are documentation-only; their checkpoint tags are still applied even though no CI gate runs, because the tags serve as recovery anchors.

**Using tags for rollback:**

If a subsequent phase introduces a regression that cannot be easily fixed forward, roll back to the last clean phase tag:

```bash
# Inspect the state at the last clean phase
git checkout admin-overhaul/phase-<N>-complete

# Create a rollback branch from that tag
git checkout -b fix/admin-overhaul/rollback-phase-<M>

# ... fix forward from the clean phase state ...
```

Never reset or force-push `integration/admin-overhaul`. Roll forward from the tagged clean state.

### Branch Protection Rules

Apply these protection rules to `integration/admin-overhaul` in the repository settings:

- Require pull request before merging (no direct pushes, including from maintainers)
- Require at least 1 approving review
- Require all status checks to pass before merging — include the `admin-validate` and `admin-changelog-guard` CI jobs (added in Phase 2)
- Require branches to be up to date before merging
- Do not allow bypassing the above settings for administrators

### CI Integration

Add `integration/admin-overhaul` to the CI trigger list in `.github/workflows/ci.yml`:

```yaml
on:
  push:
    branches: [main, develop, integration/admin-overhaul]
  pull_request:
    branches: [main, develop, integration/admin-overhaul]
```

This ensures every PR to the integration branch and every direct push to it runs the full admin gate suite. The `admin-validate` and `admin-changelog-guard` jobs introduced in Phase 2 become the blocking gate for all PRs targeting `integration/admin-overhaul`.

### Cadence and Integration Branch Hygiene

- Rebase `integration/admin-overhaul` onto `main` at least once per week, or immediately whenever `main` receives a change that affects `apps/admin` (shared packages, Prisma migrations, ADR amendments from the client app).
- Do not let `integration/admin-overhaul` fall more than 14 days behind `main`. Stale integration branches accumulate merge conflicts and make phase verification unreliable.
- After rebasing, run the full verification suite before opening any new short-lived branches from the integration branch.

Rebase, not merge, when pulling `main` changes into `integration/admin-overhaul`. This keeps the phase commit history linear and readable.

### Promotion to main

The overhaul ships to `main` in one of two modes:

**Phased shipping (preferred for large phases):** After Phase 12 verification is complete and all completion criteria are met, create a single PR from `integration/admin-overhaul` to `main`. This PR is a merge commit that represents the full overhaul. Its description references all phase checkpoint tags.

**Incremental shipping (for self-contained phases):** If a phase is independently deployable (e.g., Phase 2 tooling, Phase 10 feature flags), it may be promoted to `main` before the full overhaul completes. This requires the integration branch to be clean and the phase to not have any uncommitted dependencies on future phases. Document the incremental promotion in `apps/admin/docs/PROGRESS-SUMMARY.md`.

Never promote a phase to `main` that depends on an unreleased downstream phase. The strangler fig system (Phase 10) is specifically designed to make phases independently promotable.

### Anti-Patterns

These are prohibited for the duration of the overhaul:

- **Branching from `main` for overhaul work.** Short-lived branches always come off `integration/admin-overhaul`. The only exception is the initial creation of `integration/admin-overhaul` itself.
- **Pushing directly to `integration/admin-overhaul`.** All changes go through PRs. Branch protection enforces this.
- **Merging a branch that does not pass all CI checks.** CI green is not optional, even for documentation-only PRs.
- **Omitting the verification output from PR descriptions.** The PR template is mandatory.
- **Merging a phase branch without a CHANGELOG entry.** The admin changelog guard CI job enforces this for code-changing branches; for documentation branches it is enforced by review discipline.
- **Using spike branches as staging for real work.** Spike branches are throwaway. If spike work is worth keeping, start a proper `feat/` branch.
- **Force-pushing to `integration/admin-overhaul`.** Never. If the integration branch needs to be corrected, roll forward from the last checkpoint tag.
- **Opening parallel track branches before Phase 4 closes.** Tracks A, B, and C exist only after the service/repository layer is verified. Building UI or observability on top of a moving domain foundation creates rework.

---

## Phase 0: Autopsy — Understand Before Touching

Before writing a single line of code, perform a full read-pass autopsy of `apps/admin`. Produce a structured finding report covering every dimension below. This report becomes the input to all subsequent phases.

**Branch for this phase:** `docs/admin-overhaul/autopsy`
**Merge type:** squash to `integration/admin-overhaul`
**Checkpoint tag:** `admin-overhaul/phase-0-complete`

### 0.1 Directory and Structure Audit

Read the full `apps/admin/src/` tree. Document:

- Top-level directory structure and what each folder owns
- Whether the current structure maps cleanly to presentation, action, domain, and infrastructure concerns
- Any folders or files that have unclear ownership or mixed responsibilities
- Routes, layouts, and page files — identify which are server components, which are client components, and which are improperly mixed
- Whether `src/` is used consistently (it should be; confirm no stray files outside `src/`)

### 0.2 Authentication and Authorization Audit

Read `src/lib/api/api-middleware.ts` (or equivalent) and every action file that calls `safeAction`, `assertAdmin`, or equivalent guards. Document:

- The current admin authentication mechanism — how Clerk identity is resolved
- How `AdminRole` is enforced today versus how it should be enforced per ADR-007
- Any routes or actions that perform role checks inline rather than through shared policy helpers
- Whether `SUPER_ADMIN` is the only full-bypass role, or if `SYSTEM_ADMIN` remnants exist
- Session freshness enforcement — is `recentAuth` or equivalent applied on high-risk admin mutations?
- Whether the admin auth model has its own ADR or borrows implicitly from the client ADR-001

### 0.3 Action Boundary Audit

Read every file under `src/actions/admin/`. For each action, document:

- Whether `safeAction` (or equivalent) is used consistently
- Whether input validation uses Zod `.safeParse()` or `.parse()` (the latter is a defect)
- Whether domain business logic lives in the action or is delegated to a service layer
- Whether actions return typed, serialization-safe result shapes
- Whether cache revalidation (`revalidatePath`, `revalidateTag`) is present where needed
- Whether any action performs a Prisma query directly (boundary violation — actions are adapters)

### 0.4 Service and Domain Layer Audit

Identify whether `apps/admin` has any service or domain layer. Document:

- Where business logic currently lives (inline in actions, in `src/lib/`, scattered)
- Whether authorization policy is reusable or duplicated across actions
- Whether there is a canonical `Result<T, E>` pattern or whether actions throw or use ad-hoc sentinels
- Whether Prisma is accessed directly in action files (should be in a dedicated persistence layer)

### 0.5 UI and Presentation Audit

Read the component tree under `src/components/` and the page files. Document:

- Whether all interactive components implement the required visual states (default, hover, focus-visible, active, disabled, loading, error, success)
- Whether design tokens (CSS custom properties) are used, or if hex values are hardcoded
- Whether accessibility invariants are met: semantic HTML, labels, ARIA error wiring, touch targets, focus management
- Whether there is a consistent design system or if components drift visually across the app
- Whether heavy client-only UI is dynamically imported or is bundled into the initial page load
- Whether route segments have `loading.tsx` and `error.tsx` boundaries

### 0.6 Type Safety and Tooling Audit

Run `pnpm run admin:check-types`. Document:

- Number and categories of type errors
- Whether `@ts-nocheck` or `as any` suppressions exist and where
- Whether `tsconfig.json` uses strict mode
- Whether ESLint config covers admin-specific boundary rules
- Whether there is a `.env` contract checker equivalent to `apps/client/scripts/check-env-contract.mjs`

### 0.7 Test Coverage Audit

Read `apps/admin/__tests__/` (or equivalent). Document:

- What is tested: actions, components, policy, integration
- Whether authorization policy matrix tests exist
- Whether mock shapes match production types (apply the same fidelity rule as client ADR instruction 7)
- Whether error assertions use static strings or domain message text (instruction 8 violation)
- Coverage gaps — particularly around admin role gating, sensitive mutations, and data export paths

### 0.8 Observability Audit

Read action files and any API route handlers in admin. Document:

- Whether structured logging is used or whether `console.log` is the primary mechanism
- Whether `correlationId` or equivalent is threaded through admin operations
- Whether PII appears in logs (userId, email, nationalId)
- Whether operation names are stable and documented

### 0.9 Environment and Configuration Audit

Read `src/` for `process.env` reads. Document:

- Whether a canonical env boundary module exists (`src/lib/infrastructure/env.ts` or equivalent)
- How many direct `process.env` reads exist outside a canonical module
- Whether all env variables used by admin are declared, validated, and typed
- Whether bootstrap-only exceptions are documented

### 0.10 Security Audit

Apply the OWASP ASVS L2 lens used in `apps/client`. Document specifically:

- CSRF exposure on admin mutations that carry session cookies
- Whether admin-specific sensitive operations (user deletion, role mutation, data export, finance override) enforce step-up authentication
- Whether `apiError()` equivalent leaks exception internals to clients
- Whether mass-assignment protection exists on admin form submissions
- Whether the audit log (if it exists) covers all high-risk admin operations

### 0.11 Dependency and Package Audit

Read `apps/admin/package.json`. Document:

- Unused or misaligned dependencies (referencing the `apps/client` cleanup as prior art)
- Whether `turbo` is version-aligned with the monorepo root
- Whether any deprecated peer dependencies exist
- Whether the build script is correct and produces a deployable artifact

### 0.12 Documentation Audit

Check whether `apps/admin/docs/` exists. Document:

- What architectural documentation exists today (if any)
- Whether there is a CHANGELOG and PROGRESS-SUMMARY
- Whether any ADRs exist for admin-specific decisions
- What documentation needs to be created from scratch

### 0.13 Autopsy Report Output

Produce a single structured report with the following sections:

1. **Critical defects** — items that are security risks, data integrity risks, or block correct production operation. These are phase-blocking.
2. **High-severity architectural gaps** — items that create meaningful technical debt or make the system fragile. These drive the ADR and implementation phases.
3. **Medium-severity quality gaps** — items that degrade maintainability, testability, or developer experience without being architectural.
4. **Low-severity improvements** — style, consistency, and polish items.
5. **Strengths to preserve** — existing patterns that are correct and should be carried forward.

Do not begin Phase 1 until this report is complete and surfaced.

---

## Phase 1: ADR Foundation

Before any implementation, establish the architectural decision record for `apps/admin`. These ADRs govern all subsequent implementation phases. Each ADR follows the canonical section order: Status, Context, Decision, Consequences, Verification, Related Documentation.

**Branch for this phase:** `docs/admin-overhaul/adr-foundation`
**Merge type:** squash to `integration/admin-overhaul`
**Checkpoint tag:** `admin-overhaul/phase-1-complete`

Create `apps/admin/docs/adr/` if it does not exist.

### ADR-ADMIN-001: Admin Authentication and Authorization Model

Define:

- How Clerk identity is resolved for admin requests (server-action path, not browser fetch path)
- The canonical admin actor type: `{ clerkId: string; dbUserId: string; adminRole: AdminRole }`
- `SUPER_ADMIN` as the only full-capability bypass role; all other `AdminRole` values have explicit capability maps
- That `adminRole` is resolved from the database `AdminProfile` record, never from Clerk session claims
- Session freshness requirements for high-risk admin operations (use the same `TIER1_RECENT_AUTH_MAX_AGE_SECONDS = 180` and `TIER2_RECENT_AUTH_MAX_AGE_SECONDS = 300` constants from the client, or derive admin-specific equivalents)
- The `assertAdmin()` and `safeAction` contracts: what they guarantee, when each is appropriate
- Fail-closed behavior: any authentication resolution failure returns an unauthorized result without executing the action body

### ADR-ADMIN-002: Admin Action Boundary and Layer Structure

Define:

- `src/actions/admin/` as the adapter layer: input validation, actor resolution, authorization check, domain call, cache revalidation
- `src/lib/domains/` (or `src/lib/services/`) as the canonical home for admin business logic
- `src/lib/repositories/` (or co-located repository files) as persistence-only Prisma access
- The canonical `Result<T, AdminDomainError>` pattern for expected control flow
- Import direction: actions depend on services; services depend on repositories; nothing depends on actions
- That `safeAction` must be used for all authenticated admin mutations; raw action functions without the wrapper are a boundary violation
- Zod `.safeParse()` is mandatory; `.parse()` which throws and escapes as a 500 is prohibited

### ADR-ADMIN-003: Admin Observability Contract

Define (aligned with but independent from client ADR-005):

- The minimum structured log field set for admin operations: `correlationId`, `operationName`, `adminRole`, `outcome`, `httpStatus` (where applicable), `durationMs`
- PII exclusion rules: never log `userId`, `clerkId`, `userEmail`, `nationalId`, or request/response body content
- That `operationName` is a stable join key; renaming requires coordinated dashboard updates
- `adminRole` is safe to log; it is a capability enum, not identity
- That service and repository layers do not log; only adapter layers emit structured events

### ADR-ADMIN-004: Admin Data Classification and Handling

Define (aligned with client ADR-006):

- Class A (Restricted): identity credentials, payment secrets — never log, never expose in UI beyond minimum-necessary surface
- Class B (Sensitive): email, phone, ID numbers, uploaded documents — never log field values, never persist in browser storage
- Class C (Internal): operation metadata, correlation IDs, UUID resource identifiers
- Class D (Public): public profile display data, listing titles
- That admin views of Class A and Class B data are minimum-necessary by default; admin bulk export paths require explicit audit log entries

### ADR-ADMIN-005: Admin HTTP and Security Surface

Define:

- CSRF controls for any admin route or action that carries session-cookie authentication
- Anti-caching headers (`Cache-Control: no-store, max-age=0`) for all admin responses that expose user data, financial data, or operational state
- Security header baseline in `next.config.ts` (same baseline as client, scoped to admin)
- Webhook and callback integrity (if admin has any inbound webhooks)
- Content Security Policy for the admin UI — admin is operator-only, which may permit a stricter CSP than the public-facing client

### ADR-ADMIN-006: Admin Environment Variable Access Boundary

Define (aligned with client ADR-004):

- `src/lib/infrastructure/env.ts` as the canonical env access module for `apps/admin`
- All `process.env` reads outside that module (except documented bootstrap exceptions) are boundary violations
- Bootstrap exceptions: `next.config.ts`, `instrumentation.ts`, and any edge-runtime callsites that execute before module initialization
- That bootstrap exceptions carry an inline `// bootstrap-only: <reason>` comment

### ADR-ADMIN-007: Admin UI Component Contract

Define:

- The eight required visual states for every interactive component: default, hover, focus-visible, active, disabled, loading, error, success
- Design token requirement: all color references use CSS custom properties from the admin design token file; no hardcoded hex values
- Accessibility invariants: semantic HTML, programmatic labels, ARIA error wiring, 44×44px touch targets
- That route segments with material UI surface require `loading.tsx` and `error.tsx` boundaries
- Admin-specific visual direction: the admin UI should communicate operational authority and clarity, not decorative polish; information density and hierarchy take precedence over animation

### ADR-ADMIN-008: Admin Audit Log Contract

Define (admin-specific, no client equivalent):

- Which operations require an audit log entry: role changes, user suspension/deletion, data export, manual payment operations, verification overrides, content moderation actions
- The audit log schema: `actorAdminRole`, `operationName`, `targetResourceType`, `targetResourceId`, `outcome`, `timestamp`, `correlationId`
- That audit log entries are append-only and written before the operation's success response is returned
- That audit log failures are non-blocking but emit structured error events (do not prevent the operation from completing)
- That audit log data is Class C by default; the `targetResourceId` may be Class B if the resource is a user record

### ADR-ADMIN-009: Admin Strangler Fig and Feature Flag Strategy

Define:

- The strangler fig pattern governing incremental admin overhaul: new behavior is introduced behind feature flags; old behavior is retired only after the new behavior is verified in production
- Feature flag architecture: a typed `AdminFeatureFlag` enum in `src/lib/config/feature-flags.ts` with a `isAdminFeatureEnabled(flag, actor)` helper; flags are environment-driven and overridable per admin role
- Parallel routing strategy: during migration, new admin route segments coexist under `/admin/v2/` prefixes or behind flag-gated layouts; old routes remain functional until explicitly retired
- Rollback contract: any phase of the overhaul can be rolled back by disabling its feature flag without a deployment; the flag system must not couple enabled and disabled states through shared database schema changes

---

## Phase 2: Tooling and Project Infrastructure

With ADRs established, establish the engineering foundation before any feature work.

**Branch for this phase:** `chore/admin-overhaul/tooling`
**Merge type:** squash to `integration/admin-overhaul`
**Checkpoint tag:** `admin-overhaul/phase-2-complete`

### 2.1 TypeScript Configuration

Rewrite `apps/admin/tsconfig.json` to:

- Enable strict mode: `"strict": true`
- Enable `"noUncheckedIndexedAccess": true`
- Enable `"exactOptionalPropertyTypes": true`
- Set `"moduleResolution": "bundler"` (aligned with Next.js 14+)
- Exclude `docs/` from compilation (prevents documentation snapshot files from entering the compilation graph — learned from client cleanup)
- Define path aliases for canonical import paths: `@/` maps to `src/`
- Ensure `target` and `lib` are appropriate for the Node.js and browser targets in use

Remove any `@ts-nocheck` suppressions found in the autopsy. Each suppression must either be fixed properly or documented with a tracked remediation issue in PROGRESS-SUMMARY.

### 2.2 ESLint Configuration

Create or rewrite `apps/admin/eslint.config.js` (flat config format) to enforce:

- `no-restricted-syntax` rule flagging direct `process.env` reads outside `src/lib/infrastructure/env.ts`, `next.config.ts`, and `instrumentation.ts`
- `no-restricted-imports` rule preventing action files from importing Prisma directly
- `no-restricted-imports` rule preventing component files from importing server-only modules
- `@typescript-eslint/no-explicit-any` as an error
- `@typescript-eslint/no-floating-promises` as an error (async operations in actions must be awaited)
- Import order enforcement aligned with the directory structure ADR
- Accessibility lint rules: `jsx-a11y` plugin at recommended level

### 2.3 Environment Variable Boundary

Create `src/lib/infrastructure/env.ts` with:

- Zod schema validation of all environment variables used by `apps/admin`
- Typed `adminEnvConfig` export (separate from client `envConfig` — admin may have additional or different variables)
- Build-phase deferral for server-only secrets (same pattern as client: deferred during `next build` static analysis, fail-fast at runtime)
- Startup validation that throws with a clear diagnostic message for missing required variables
- Inline comments documenting which variables are admin-specific versus shared with client infrastructure

Create or update all `.env` files:

- `apps/admin/.env.example` — comprehensive, annotated, with all required variables and their purpose
- `apps/admin/.env.test` — test stubs, with `BYPASS_AUTH` constraints documented
- `apps/admin/.env.development` — local development defaults

### 2.4 Package.json Cleanup and Script Alignment

Audit `apps/admin/package.json` and:

- Remove unused dependencies identified in the autopsy
- Align `turbo` version with monorepo root
- Resolve peer dependency warnings
- Add canonical script entries:
  - `admin:check-types` — `tsc --noEmit`
  - `admin:lint` — ESLint over `src/`
  - `admin:test` — Vitest test runner
  - `admin:test:all` — full test suite
  - `admin:check-env-contract` — env contract checker (to be created)
  - `admin:report-security-drift` — security drift report (to be created)
  - `admin:report-security-drift:strict` — blocking drift report

### 2.5 CI Gate Implementation

Update `.github/workflows/ci.yml` to:

1. Add `integration/admin-overhaul` to the trigger branches (per the branching strategy).
2. Add an `admin-validate` job:

```yaml
admin-validate:
  name: Admin Validate
  runs-on: ubuntu-latest
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "24.13.1"
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile
    - name: Admin type check
      run: pnpm run admin:check-types
    - name: Admin lint
      run: pnpm run admin:lint
    - name: Admin env contract check
      run: pnpm run admin:check-env-contract
    - name: Admin security drift check
      run: pnpm run admin:report-security-drift:strict
    - name: Admin tests
      run: pnpm run admin:test:all
```

1. Add an `admin-changelog-guard` job:

```yaml
admin-changelog-guard:
  name: Admin Changelog Guard
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  permissions:
    contents: read
    pull-requests: read
  steps:
    - name: Require admin changelog update for admin code changes
      uses: actions/github-script@v8
      with:
        script: |
          const files = await github.paginate(
            github.rest.pulls.listFiles,
            { owner: context.repo.owner, repo: context.repo.repo,
              pull_number: context.payload.pull_request.number, per_page: 100 }
          );
          const adminCodeChanged = files.some(f =>
            f.filename.startsWith("apps/admin/") &&
            !f.filename.startsWith("apps/admin/docs/")
          );
          const changelogUpdated = files.some(f =>
            f.filename === "apps/admin/docs/CHANGELOG.md" &&
            f.status !== "removed"
          );
          if (adminCodeChanged && !changelogUpdated) {
            core.setFailed(
              "apps/admin code changed but apps/admin/docs/CHANGELOG.md was not updated."
            );
          }
```

### 2.6 Security Drift Tooling

Create `apps/admin/scripts/report-security-drift.mjs` modeled on the client equivalent, with admin-specific checks:

- Direct `process.env` reads outside canonical boundary (`adminEnvBoundaryDrift`)
- Actions calling Prisma directly without a repository layer (`directPrismaInActions`)
- Actions without `safeAction` wrapper on authenticated mutations (`unsafeMutations`)
- Zod `.parse()` in action files (`zodParseDrift`) — must use `.safeParse()`
- `console.log` in action or service files (`unstructuredLogging`)
- PII field names in log calls (`logSafetyDrift`)
- Admin operations without audit log entries that are classified as requiring them (`missingAuditLog`)

Strict mode (`--strict` flag) makes all categories blocking. Wire `admin:report-security-drift:strict` into the CI gate.

### 2.7 Documentation Infrastructure

Create the following document scaffolds (to be filled as phases complete):

- `apps/admin/docs/CHANGELOG.md` — format aligned with client CHANGELOG; start with a `[OVERHAUL-INIT]` entry documenting Phase 0 autopsy findings
- `apps/admin/docs/PROGRESS-SUMMARY.md` — same structure as client equivalent; Active Phase section, Slice Status Registry, Open Defects, Verification Commands
- `apps/admin/docs/adr/` — all nine ADRs from Phase 1

---

## Phase 3: Authentication and Authorization Hardening

**Branch for this phase:** `feat/admin-overhaul/auth-hardening`
**Merge type:** squash to `integration/admin-overhaul`
**Checkpoint tag:** `admin-overhaul/phase-3-complete`

### 3.1 Canonical Admin Actor Type

Create `src/lib/security/admin-actor.ts`:

```typescript
import type { AdminRole } from "@build/db";

export type AdminActor = {
  clerkId: string;
  dbUserId: string;
  adminRole: AdminRole;
};

export type AdminActorContext = {
  actor: AdminActor;
  correlationId: string;
  requestStartedAt: number;
};
```

### 3.2 safeAction Hardening

Read the current `safeAction` implementation. Rewrite or extend it to:

- Resolve Clerk identity and fail closed (return typed unauthorized result, never throw) when resolution fails
- Resolve `AdminProfile.adminRole` from the database — not from Clerk claims
- Construct a typed `AdminActor` and forward it to the wrapped action body
- Accept `recentAuth: { maxAgeSeconds: number }` as an option and enforce session freshness
- Accept `rateLimit: { namespace: string; limit: number; windowMs: number }` as an option using actor-scoped Redis keys
- Accept `auditLog: { operation: string; resourceType?: string }` as an option to trigger automatic audit log entries
- Return a discriminated union result: `{ success: true; data: T }` or `{ success: false; error: AdminActionError }`

Align `AdminActionError` with the `DomainError` pattern used in the client app.

### 3.3 Authorization Policy Map

Create `src/lib/security/authorization-policy.ts` with:

- A typed `ADMIN_ACTION_POLICY_MAP` that enumerates every high-risk admin action with its required `AdminRole`, freshness tier, and rate-limit namespace
- A `requireAdminCapability(actor: AdminActor, capability: AdminCapability)` function that returns a typed `Result` — not a throw
- An `AdminCapability` enum covering: `MANAGE_USERS`, `VIEW_FINANCIALS`, `PROCESS_PAYOUTS`, `MANAGE_VERIFICATION`, `EXPORT_DATA`, `MANAGE_CONTENT`, `SYSTEM_ADMIN_ONLY`

### 3.4 High-Risk Admin Registry

Create `src/lib/security/high-risk-admin-registry.ts` modeled on the client's `high-risk-registry.ts`:

- Enumerate every admin action that requires step-up authentication, with the required `maxAgeSeconds` value
- Include: user deletion, role mutation, data export, manual payment processing, verification override, bulk content moderation
- Build a corresponding `scripts/high-risk-admin-registry.mjs` emitted at build time for use by the drift checker

### 3.5 Policy Test Suite

Create `__tests__/security/admin-authorization-policy.test.ts` covering:

- Every `AdminRole` variant for each capability-gated operation
- `SUPER_ADMIN` override paths
- Absence of override for non-SUPER_ADMIN elevated roles
- Freshness rejection behavior (with `BYPASS_AUTH` confirmed absent in the test environment)

---

## Phase 4: Service and Repository Layer Introduction

**Branch for this phase (per domain):** `feat/admin-overhaul/domain-<slice>`

Examples: `feat/admin-overhaul/domain-users`, `feat/admin-overhaul/domain-verification`, `feat/admin-overhaul/domain-finance`, `feat/admin-overhaul/domain-audit`

Each domain gets its own branch. They are sequenced, not parallel — merge each domain branch to `integration/admin-overhaul` and verify clean before opening the next. The full track-parallel model activates in Phase 5 once the domain foundation is stable.

**Checkpoint tag:** `admin-overhaul/phase-4-complete` (applied after the last domain branch merges and verifies clean)

### 4.1 Domain Structure

Create the following directory structure under `src/`:

```text
src/lib/
  domains/
    users/
      contracts.ts      # AdminUserActor, DTOs, domain errors
      service.ts        # business policy, orchestration
      repository.ts     # Prisma reads and writes only
      index.ts          # public surface
    verification/
      (same structure)
    content/
      (same structure)
    finance/
      (same structure)
    audit/
      contracts.ts
      service.ts        # audit log write path
      repository.ts
      index.ts
```

### 4.2 Migration Pattern for Each Domain

For each domain family, follow this order:

1. Define `contracts.ts` with actor type, input DTOs, output DTOs, and domain error union
2. Create `repository.ts` with Prisma access only — no authorization, no response shaping
3. Create `service.ts` with actor-aware authorization, business rules, orchestration, and `Result<T, DomainError>` returns
4. Refactor existing action files to call the service instead of performing inline Prisma or business logic
5. Add domain-level policy tests covering authorization matrix
6. Add repository contract tests covering `deletedAt: null` guards and correct `where` shapes

### 4.3 Canonical Result Type

Import and use the same `Result<T, E>` type as the client app. Do not redefine it locally. If the client app's canonical `Result` type is at `@/app/lib/errors/result`, create an admin-local re-export at `src/lib/errors/result.ts` that imports from the monorepo-shared location or defines it identically.

---

## Phase 5: Action Layer Refactoring

**Branch for this phase (per action slice):** `feat/admin-overhaul/actions-<slice>`

Examples: `feat/admin-overhaul/actions-users`, `feat/admin-overhaul/actions-verification`, `feat/admin-overhaul/actions-finance`

This is Track A in the parallel track model. Phase 5 branches may be opened and run concurrently with Phase 6 (Track B) and Phase 7 (Track C) after Phase 4's checkpoint tag is applied.

**Checkpoint tag:** `admin-overhaul/phase-5-complete` (applied after the last actions slice merges clean)

Systematically refactor every file under `src/actions/admin/` to conform to the canonical boundary defined in ADR-ADMIN-002.

For each action file:

1. Wrap every exported action in `safeAction` with the appropriate options from the high-risk admin registry
2. Replace inline Prisma calls with service method calls
3. Replace `schema.parse()` with `schema.safeParse()` and explicit failure mapping
4. Add structured log emission at the terminal outcome point
5. Add or verify audit log calls for operations classified as requiring them in ADR-ADMIN-008
6. Ensure cache revalidation (`revalidatePath` or `revalidateTag`) is present where data is mutated
7. Return typed, serialization-safe result shapes

After refactoring each action file, run:

```bash
pnpm run admin:check-types
pnpm run admin:report-security-drift:strict
pnpm -C apps/admin exec vitest run __tests__/actions/<file>.test.ts --maxWorkers=1
```

All three must pass before moving to the next action file.

---

## Phase 6: UI Component Overhaul

**Branch for this phase (per area):** `feat/admin-overhaul/ui-<area>`

Examples: `feat/admin-overhaul/ui-tokens`, `feat/admin-overhaul/ui-components`, `feat/admin-overhaul/ui-a11y`

This is Track B in the parallel track model. Phase 6 branches run concurrently with Phase 5 (Track A) and Phase 7 (Track C) after Phase 4's checkpoint tag is applied.

**Checkpoint tag:** `admin-overhaul/phase-6-complete`

### 6.1 Design Token System

Create `src/styles/tokens.css` (or extend `globals.css`) with CSS custom properties for:

- `--color-primary`, `--color-primary-hover`, `--color-primary-active`
- `--color-danger`, `--color-danger-hover`
- `--color-warning`, `--color-warning-hover`
- `--color-success`, `--color-success-hover`
- `--color-error`
- `--color-focus-ring`
- `--color-surface`, `--color-surface-elevated`, `--color-surface-recessed`
- `--color-border`, `--color-border-strong`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-disabled`
- `--color-background`
- Admin-specific tokens: `--color-admin-danger` (for destructive admin operations like user deletion), `--color-audit-accent` (for audit log UI surfaces)

Audit every component file for hardcoded hex values. Replace all with token references.

### 6.2 Component State Contract

For every interactive component (Button, Input, Select, Toggle, Checkbox, Modal trigger, Table row action), implement and visually distinguish all eight states: default, hover, focus-visible, active, disabled, loading, error, success.

The admin-specific interpretation:

- **loading** on admin mutations must disable the trigger and show a spinner; admin operations are often irreversible and double-submission is a data integrity risk
- **error** on admin forms must surface inline error text in an `aria-live="polite"` region; never rely on color alone (colorblind operators)
- **disabled** states must still meet 3:1 contrast for legibility; operators need to understand why an action is unavailable

### 6.3 Accessibility Hardening

Apply the same WCAG 2.1 AA invariants as the client app:

- Every input has a programmatic `<label>` with matching `for`/`id`
- Error text is wired to `aria-live="polite"`, `aria-invalid="true"`, and `aria-describedby`
- Touch targets are minimum 44×44 CSS pixels
- Focus moves programmatically on modal open/close and multi-step form transitions
- `outline: none` without a custom focus indicator is prohibited

### 6.4 Route Segment Resilience

Every page route under `src/app/` that has a material UI surface must have:

- `loading.tsx` — skeleton aligned to the actual page layout, not a generic spinner
- `error.tsx` — structured error surface with retry affordance, showing enough context for an operator to understand what failed
- Independent error boundaries for independently-failable data surfaces within a page (a failed verification queue widget should not blank the entire admin dashboard)

### 6.5 Admin Visual Direction

Admin UI has different visual priorities than the public-facing client:

- **Information density over decoration**: operators work in this UI all day; reduce motion, minimize animation, maximize data visibility
- **Status hierarchy**: approval states, risk levels, and queue depths should be visually hierarchical using semantic tokens, not decorative color
- **Destructive action ergonomics**: irreversible operations (user deletion, data export, role mutation) must have explicit confirmation patterns — not just a confirm dialog, but visual weight that communicates gravity
- **`prefers-reduced-motion` is mandatory**: admin operators may use accessibility tools; all transitions must respect the media query

---

## Phase 7: Observability Implementation

**Branch for this phase:** `feat/admin-overhaul/observability`

This is Track C in the parallel track model. Phase 7 runs concurrently with Phase 5 (Track A) and Phase 6 (Track B) after Phase 4's checkpoint tag is applied. Phase 8 follows Phase 7 within Track C — do not open Phase 8's branch until Phase 7 merges clean.

**Checkpoint tag:** `admin-overhaul/phase-7-complete`

### 7.1 Structured Logging Infrastructure

Create `src/lib/infrastructure/logger.ts` implementing the admin observability contract from ADR-ADMIN-003:

- `getAdminLogger()` function returning a structured logger instance
- Type-safe `AdminLogEvent` interface enforcing required fields
- PII exclusion enforced at the type level where possible (e.g., the type rejects keys like `userId`, `email`)
- Integration with the existing observability backend (Datadog, CloudWatch, or equivalent)

### 7.2 Correlation ID Threading

Create `src/lib/infrastructure/correlation.ts` with:

- `initializeAdminCorrelationId(request?: Request)` that reads from request headers or generates a new UUID
- `withAdminCorrelation(correlationId: string, fn: () => T)` for async context threading through action chains

Thread `correlationId` through every structured log event in the action and service layers.

### 7.3 Operation Name Registry

Create `src/lib/observability/operation-names.ts` with a typed enum or const map of all admin `operationName` values. Every operation name must be:

- In `<verb>_<resource>` format: `suspend_user`, `approve_verification`, `export_user_data`, `process_payout`
- Globally unique within `apps/admin`
- Stable — treat renames as breaking observability changes

Document the operation name inventory in `apps/admin/docs/adr/ADR-ADMIN-003.md` under a dedicated Operation Name Registry section.

---

## Phase 8: Audit Log Implementation

**Branch for this phase:** `feat/admin-overhaul/audit-log`

Phase 8 follows Phase 7 within Track C. Open this branch only after `admin-overhaul/phase-7-complete` is tagged.

**Checkpoint tag:** `admin-overhaul/phase-8-complete`

### 8.1 Audit Log Schema

Confirm or add to the Prisma schema:

```prisma
model AdminAuditLog {
  id               String    @id @default(uuid())
  correlationId    String
  operationName    String
  actorAdminRole   AdminRole
  targetResourceType String?
  targetResourceId   String?
  outcome          String    // "success" | "domain_error" | "internal_error"
  metadata         Json?     // Class C/D fields only per ADR-ADMIN-008
  createdAt        DateTime  @default(now())

  @@index([operationName, createdAt])
  @@index([targetResourceType, targetResourceId])
  @@map("admin_audit_logs")
}
```

Create a migration for this schema addition.

### 8.2 Audit Log Service

Create `src/lib/domains/audit/service.ts` implementing:

- `recordAdminAuditEvent(event: AdminAuditEvent): Promise<void>` — append-only, non-blocking, never throws (errors are logged but do not fail the operation)
- `queryAuditLog(filters: AuditLogFilters, actor: AdminActor): Promise<Result<AuditLogPage, AuditDomainError>>` — paginated, actor-gated (only SUPER_ADMIN and AUDITOR can query)

### 8.3 Automatic Audit Integration via safeAction

The `auditLog` option in `safeAction` (established in Phase 3.2) should call `auditService.recordAdminAuditEvent` automatically after the action body completes, using the operation result to determine `outcome`. This makes audit logging declarative rather than requiring every action author to remember to call it.

---

## Phase 9: Testing Overhaul

Phase 9 has no dedicated branch. Test work is embedded in every phase's branch. When test coverage for a specific concern grows large enough to warrant isolation — particularly policy matrix suites and critical journey tests — use `test/admin-overhaul/<area>` branches opened off `integration/admin-overhaul`.

**Checkpoint tag:** `admin-overhaul/phase-9-complete` (applied after critical-journey tests pass in CI)

Apply the same risk-centric testing philosophy as the client app. Testing is organized by risk, not by layer.

### 9.1 Policy Matrix Tests

For every domain in Phase 4, create `__tests__/policy/<domain>.policy.test.ts` covering:

- Every `AdminRole` for each capability-gated operation
- `SUPER_ADMIN` override and absence of override for other roles
- Resource ownership and delegation edge cases

Apply the same mock fidelity rule as the client: `AdminActor` mocks must match the production type exactly. No extra fields, no missing required fields.

### 9.2 Action Boundary Tests

For every refactored action in Phase 5, create or update `__tests__/actions/<domain>.test.ts` covering:

- Input validation rejection path (`.safeParse()` failure → structured error, not 500)
- Authentication failure path (unauthenticated actor → unauthorized result)
- Authorization failure path (wrong `AdminRole` → forbidden result)
- Domain error mapping (service returns `err("not_found")` → action returns appropriate error shape)
- Audit log call verification (for operations classified in ADR-ADMIN-008)

Error response assertions must use static strings, not domain message text (applying client testing instruction 8).

### 9.3 Repository Contract Tests

For each repository, create `__tests__/contracts/<domain>/repository-input.contract.test.ts` verifying:

- `deletedAt: null` is present in `where` clauses for soft-delete models
- Correct `where` shapes for filtered queries
- Version-increment behavior for optimistic-lock operations (if admin uses versioning)

### 9.4 Critical Journey Tests

Create `apps/admin/cypress/e2e/critical-journeys/` with:

- **Unauthenticated redirect**: navigating to any admin route without a Clerk session redirects to sign-in
- **Non-admin denial**: authenticated non-admin user cannot access admin routes
- **Wrong admin role denial**: a `CONTENT_MODERATOR` cannot access finance-gated routes
- **SUPER_ADMIN access**: a `SUPER_ADMIN` can access all admin routes
- **Destructive confirmation**: user deletion requires explicit confirmation and is logged

These journeys are a blocking CI surface. A failing journey blocks merge.

---

## Phase 10: Strangler Fig — Feature Flag and Parallel Routing System

**Branch for this phase:** `feat/admin-overhaul/feature-flags`

Phase 10 may begin after Phase 2 closes — the feature flag infrastructure depends only on the env boundary and tooling foundation, not on the domain or action layers. Flag-gated routes introduced in later phases depend on Phase 10 being merged first.

**Checkpoint tag:** `admin-overhaul/phase-10-complete`

### 10.1 Feature Flag Infrastructure

Create `src/lib/config/feature-flags.ts`:

```typescript
import { AdminRole } from "@build/db";

export const AdminFeatureFlag = {
  // Overhaul phases — disabled means "use old behavior"
  ADMIN_V2_USER_MANAGEMENT: "admin_v2_user_management",
  ADMIN_V2_VERIFICATION_QUEUE: "admin_v2_verification_queue",
  ADMIN_V2_FINANCE_DASHBOARD: "admin_v2_finance_dashboard",
  ADMIN_V2_AUDIT_LOG_UI: "admin_v2_audit_log_ui",
  ADMIN_V2_STRUCTURED_LOGGING: "admin_v2_structured_logging",
} as const;

export type AdminFeatureFlag =
  (typeof AdminFeatureFlag)[keyof typeof AdminFeatureFlag];

export function isAdminFeatureEnabled(
  flag: AdminFeatureFlag,
  actor?: { adminRole: AdminRole },
): boolean {
  // Read from adminEnvConfig; allow per-role overrides for staff testing
  // SUPER_ADMIN always sees new behavior in staging
  // ...
}
```

Flags are environment-variable driven (`NEXT_PUBLIC_ADMIN_FF_*`) with boolean coercion. No database-driven flags in Phase 10 — that adds operational complexity before the new surfaces are proven.

### 10.2 Parallel Route Layout

For each major admin section being overhauled, create a `/v2/` parallel route:

```text
src/app/
  (admin)/
    users/          # current behavior preserved
    users-v2/       # new behavior behind flag
    verification/
    verification-v2/
```

Route gating is implemented in the layout:

```typescript
// src/app/(admin)/users-v2/layout.tsx
import { isAdminFeatureEnabled } from "@/lib/config/feature-flags";
import { redirect } from "next/navigation";

export default function UsersV2Layout({ children }) {
  if (!isAdminFeatureEnabled("admin_v2_user_management")) {
    redirect("/admin/users");
  }
  return children;
}
```

Navigation items in the admin sidebar conditionally link to v2 routes when the flag is enabled.

### 10.3 Rollback Contract

Each feature flag must have a documented rollback procedure in `apps/admin/docs/PROGRESS-SUMMARY.md`:

- Which environment variable to set to `false`
- Whether a deployment is required or if the flag is read at runtime
- What data state changes (if any) are not reversible by flag toggle alone
- The CHANGELOG entry that should be created on rollback

Preference is runtime-readable flags (no deployment required for rollback). Any flag that requires a deployment to disable must be documented as such with justification.

---

## Phase 11: Documentation Completion

Phase 11 has no dedicated branch. Documentation work is embedded in every phase's branch. When an ADR amendment or a standalone documentation artifact warrants its own PR, use `docs/admin-overhaul/<area>` opened off `integration/admin-overhaul`.

After each implementation phase, update the following documents in the same commit:

### 11.1 CHANGELOG Format

```markdown
## [YYYY-MM-DD] Phase N — Short description

### Security

- ...

### Fixed

- ...

### Changed

- ...

### Added

- ...

### Docs

- ...

**Files changed:** comma-separated list  
**Verification:**

- `pnpm run admin:report-security-drift:strict` → all categories 0
- `pnpm run admin:check-types` → exit 0
- `pnpm -C apps/admin exec vitest run <suite> --maxWorkers=1` → N tests passed
```

Verification section records actual results, not planned results. Write the entry after running verification.

### 11.2 PROGRESS-SUMMARY Format

Mirror the client PROGRESS-SUMMARY structure:

- Active Phase with status and remaining steps
- Slice Status Registry (same A–G rubric adapted for admin layers)
- Open Defects from the autopsy (cleared as phases complete)
- Verification Command Reference
- Completed Phases (last 10)
- Next Priority with entry criteria

### 11.3 ADR Completeness

Each ADR must have its Status updated from `Proposed` to `Accepted` when the corresponding implementation phase closes. An ADR in `Proposed` state with completed implementation is a documentation defect.

---

## Phase 12: Security Hardening Pass

**Branch for this phase:** `security/admin-overhaul/hardening-pass`
**Merge type:** squash to `integration/admin-overhaul`
**Checkpoint tag:** `admin-overhaul/phase-12-complete`

After the architectural foundation is in place, perform a focused security hardening pass aligned with the admin OWASP ASVS surface.

### 12.1 Admin-Specific ASVS Controls

Apply these controls specific to admin surfaces:

- **Mass assignment protection**: every admin form submission Zod schema uses `.strict()` or explicit `.pick()`; no `.passthrough()` on mutation schemas
- **Admin CSRF**: confirm `safeAction` trusted-origin checks fire before any state-changing admin action that carries a session cookie
- **Sensitive response anti-caching**: admin pages displaying user PII, financial data, or audit logs must emit `Cache-Control: no-store, max-age=0`
- **Admin rate limiting**: all admin mutations are rate-limited with actor-scoped keys (admin actors are trusted but not immune to automation attacks)
- **Step-up for destructive operations**: user deletion, data export, and role mutation require `recentAuth: { maxAgeSeconds: 180 }` in `safeAction`

### 12.2 Admin Error Message Safety

The same `apiError(error.message, ...)` prohibition applies to admin server actions. Actions must not return raw exception strings to the client. All error messages are pre-approved static strings from `src/lib/security/admin-error-messages.ts`.

### 12.3 Security Drift Report Gate

The `admin:report-security-drift:strict` CI gate must reach zero findings before Phase 12 is marked complete. This is the proof that security hardening is systematic, not manual.

---

## Verification Commands Reference

These commands must all pass before any phase is marked complete:

```bash
# Type safety
pnpm run admin:check-types

# Lint
pnpm run admin:lint

# Environment contract
pnpm run admin:check-env-contract

# Security drift (blocking)
pnpm run admin:report-security-drift:strict

# Full test suite
pnpm run admin:test:all

# Targeted domain suite
pnpm -C apps/admin exec vitest run __tests__/<suite> --maxWorkers=1

# Critical journeys (Cypress, requires built app)
pnpm run cypress:run --spec "apps/admin/cypress/e2e/critical-journeys/**"
```

---

## Sequencing and Priority

Execute phases in this order. Each phase must reach a clean verification baseline before the next begins, with the exception of the parallel tracks noted below.

1. **Phase 0** — Autopsy (read-only; no code changes)
2. **Phase 1** — ADR Foundation (documentation only; no code changes)
3. **Phase 2** — Tooling Infrastructure (tooling and configuration; no business logic) → Phase 10 may begin in parallel after this closes
4. **Phase 3** — Authentication Hardening (security foundation; everything else depends on this)
5. **Phase 4** — Service and Repository Layer (architecture foundation; opens parallel tracks)
6. **[Parallel] Phase 5 (Track A)** — Action Layer Refactoring; may run concurrently with Phases 6 and 7 after Phase 4 closes
7. **[Parallel] Phase 6 (Track B)** — UI Component Overhaul; may run concurrently with Phases 5 and 7 after Phase 4 closes
8. **[Parallel] Phase 7 (Track C)** — Observability; may run concurrently with Phases 5 and 6 after Phase 4 closes
9. **Phase 8** — Audit Log (depends on Phase 4 repository layer and Phase 7 logging; follows Phase 7 in Track C)
10. **Phase 9** — Testing Overhaul (accompanies each previous phase; standalone branches only when test scope warrants isolation)
11. **Phase 10** — Strangler Fig System (can begin after Phase 2; flags gate subsequent phases)
12. **Phase 11** — Documentation Completion (accompanies every phase)
13. **Phase 12** — Security Hardening Pass (final gate before declaring overhaul complete)

---

## Completion Criteria

The overhaul is complete when all of the following are true:

1. All nine admin ADRs are in `Accepted` status with corresponding implementations
2. `pnpm run admin:check-types` exits 0 with no suppressions
3. `pnpm run admin:lint` exits 0
4. `pnpm run admin:report-security-drift:strict` reports zero findings in all categories
5. `pnpm run admin:test:all` passes with all critical-journey tests included
6. Every action file uses `safeAction` with appropriate options from the high-risk registry
7. No action file imports Prisma directly
8. No action file uses Zod `.parse()` (only `.safeParse()`)
9. The audit log records entries for all operations classified in ADR-ADMIN-008
10. `apps/admin/docs/CHANGELOG.md` and `apps/admin/docs/PROGRESS-SUMMARY.md` are current with all phases documented and verified
11. All phase checkpoint tags (`admin-overhaul/phase-0-complete` through `admin-overhaul/phase-12-complete`) are applied and pushed
12. A final PR from `integration/admin-overhaul` to `main` is open, reviewed, and approved — its description references all phase checkpoint tags as evidence
