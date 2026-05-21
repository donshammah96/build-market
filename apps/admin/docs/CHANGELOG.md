# apps/admin Changelog

## [2026-05-21] Phase 5 - Verification action bug fixes

### Fixed (Phase 5 - Verification action bug fixes)

- Fixed a privilege escalation risk in API routes (`verification-details`, `verification-stats`, `pending-verifications`, `verify-document`, `verify`) where missing `adminRole` context improperly defaulted to `SUPER_ADMIN`.
- Fixed a bug in `safeAction` definitions (`verifyEntity`, `verifyDocument`, `batchVerifyDocuments`, `batchVerifyEntities`) where `auditLog` parsing threw synchronous exceptions before execution.
- Fixed a bug in `updateDocumentVerification` in `repository.ts` that concatenated "d" to the action string, producing "rejectd" instead of "rejected".
- Fixed an audit gap in `verify-document/route.ts` where single and batch document verifications bypassed `safeAction` audit logging by explicitly invoking `logAdminAction`.
- Added missing `.min(1)` validation to `BatchVerifyDocumentsSchema`.

## [2026-05-18] Phase 5 - Verification action slice

### Security (Phase 5 - Verification action slice)

- Replaced verification action and route `.parse()` calls with `safeParse`-backed validation and strict payload handling.
- Moved verification entity and document mutations behind the admin verification domain/service boundary and removed direct Prisma from the migrated verification adapters.
- Added declarative `auditLog` coverage on verification server actions for entity verification, single-document verification, batch document verification, and batch entity verification.

### Changed (Phase 5 - Verification action slice)

- Refactored `apps/admin/src/actions/admin/verification.ts` to use `safeAction` plus the verification domain service instead of client API round-trips and manual audit writes.
- Rebuilt `pending-verifications`, `verification-stats`, `verification-details`, `verify`, and `verify-document` handlers as thin verification-service adapters.
- Normalized property document verification onto the `property_document` contract while preserving `property_attachment` request compatibility at the parser boundary.
- Updated verification detail mapping so property verification reads from `PropertyDocument` records instead of the stale attachment-only shape.

### Tests (Phase 5 - Verification action slice)

- Reworked verification action tests to assert domain-service delegation and declarative audit wiring instead of action-layer Prisma or client API behavior.
- Reworked verification route tests to mock the verification service boundary instead of legacy Prisma-heavy internals.
- Extended verification domain service tests to cover entity verification, document verification, normalized details loading, and batch failure aggregation.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 156 warnings; warnings remain tracked Phase 5-12 backlog.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 26 files passed, 177 of 177 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 13, unsafe mutations 12, action `.parse()` 16, `@ts-nocheck` 18, unstructured logging 103, log safety 3, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the remaining Phase 5-12 drift backlog.

## [2026-05-18] Phase 5 - Users action slice

### Security (Phase 5 - Users action slice)

- Added `safeParse`-backed input validation for admin user detail, delete, bulk delete, invite, reset-credentials, and role-assignment actions.
- Added declarative `auditLog` coverage in `safeAction` so high-risk user mutations can attach target IDs and non-PII details without manual audit calls.
- Blocked self-deletion for admin user mutations to align single-delete behavior with the existing bulk-delete guard.

### Changed (Phase 5 - Users action slice)

- Removed direct Prisma access from `apps/admin/src/actions/admin/users.ts`; the action slice now delegates persistence to `usersRepository` and business rules to `usersService`.
- Moved remaining users mutation preconditions into the users domain service, including target lookups, bulk-delete normalization, and reset/role-assignment preparation.
- Updated the admin security drift reporter so declarative `auditLog:` usage counts as audit coverage for high-risk action files.

### Tests (Phase 5 - Users action slice)

- Reworked users action-boundary tests to assert service/repository delegation instead of action-layer Prisma calls.
- Extended users domain service tests for delete preparation, bulk-delete normalization, reset preparation, and role-assignment target loading.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 211 warnings; warnings remain tracked Phase 5-12 backlog.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 26 files passed, 174 of 174 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/users/__tests__/service.test.ts src/lib/domains/users/__tests__/repository.test.ts src/actions/admin/__tests__/users-actions.test.ts --pool=threads --maxWorkers=1` -> pass; 3 files passed, 22 of 22 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 17, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 103, log safety 3, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the remaining Phase 5-12 drift backlog.

## [2026-05-18] Phase 4 - Audit domain slice

### Added (Phase 4 - Audit domain slice)

- Added audit domain contracts, repository, and service under `apps/admin/src/lib/domains/audit`.
- Added a read-only audit log page contract and audit stats contract using existing `AdminAuditLog` snapshot fields.
- Added audit repository contract tests covering safe snapshot selects, caller filters, date bounds, group-by stats, and recent activity queries.
- Added audit service tests covering query normalization, `EXPORT_DATA` capability enforcement, invalid dates, pagination, and grouped stats.

### Changed (Phase 4 - Audit domain slice)

- Kept legacy audit actions behavior unchanged in this domain branch; Phase 5/8 will migrate readers and automatic audit writes onto the canonical audit service boundary.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain known Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 26 files passed, 171 of 171 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/audit/__tests__/service.test.ts src/lib/domains/audit/__tests__/repository.test.ts --pool=threads --maxWorkers=1` -> pass; 2 files passed, 9 of 9 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the same known Phase 4-12 drift backlog.

## [2026-05-18] Phase 4 - Finance domain slice

### Added (Phase 4 - Finance domain slice)

- Added finance domain contracts, repository, and service under `apps/admin/src/lib/domains/finance`.
- Added a read-only finance overview contract for revenue, paid/delivered orders, average order value, and pending payouts.
- Added finance repository contract tests covering successful payment sums, period ranges, paid-order metrics, and pending withdrawal payouts.
- Added finance service tests covering period normalization, `VIEW_FINANCIALS` capability enforcement, invalid filters, and overview assembly.

### Changed (Phase 4 - Finance domain slice)

- Kept legacy analytics actions behavior unchanged in this domain branch; Phase 5 will migrate finance and analytics callers onto the service boundary.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain known Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 24 files passed, 162 of 162 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/finance/__tests__/service.test.ts src/lib/domains/finance/__tests__/repository.test.ts --pool=threads --maxWorkers=1` -> pass; 2 files passed, 7 of 7 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the same known Phase 4-12 drift backlog.

## [2026-05-18] Phase 4 - Content domain slice

### Added (Phase 4 - Content domain slice)

- Added content domain contracts, repository, and service under `apps/admin/src/lib/domains/content`.
- Added a content moderation queue contract for stores, properties, and projects with result-based errors and `MANAGE_CONTENT` capability enforcement.
- Added content repository contract tests covering soft-delete guards, owner includes, caller filters, and model-specific sort mapping.
- Added content service tests covering policy denial, invalid filters, pagination, and all-entity sorting.

### Changed (Phase 4 - Content domain slice)

- Kept legacy content actions behavior unchanged in this domain branch; Phase 5 will migrate stores, properties, projects, and adjacent content actions onto the service boundary.
- Mapped admin-facing `title` sorting to the store `name` column while preserving `title` sorting for property and project records.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain known Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 22 files passed, 155 of 155 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/content/__tests__/service.test.ts src/lib/domains/content/__tests__/repository.test.ts --pool=threads --maxWorkers=1` -> pass; 2 files passed, 8 of 8 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the same known Phase 4-12 drift backlog.

## [2026-05-18] Phase 4 - Verification domain slice

### Added (Phase 4 - Verification domain slice)

- Added verification domain contracts, repository, and service under `apps/admin/src/lib/domains/verification`.
- Added verification queue query normalization, capability enforcement, result-based errors, and status/period validation.
- Added verification repository contract tests covering Prisma include shape, pending-submission predicates, soft-delete guards, and period-filtered status counts.
- Added verification service tests covering policy denial, invalid filters, single-entity pagination, all-entity sorting, and grouped stats.

### Changed (Phase 4 - Verification domain slice)

- Kept legacy verification actions/routes behavior unchanged in this domain branch; Phase 5 will migrate action/route callers onto the service boundary.
- Aligned the verification domain status contract with the Prisma `VerificationStatus` enum, including `IN_REVIEW`, `EXPIRED`, and `SUSPENDED`.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain known Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 20 files passed, 147 of 147 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/verification/__tests__/service.test.ts src/lib/domains/verification/__tests__/repository.test.ts --pool=threads --maxWorkers=1` -> pass; 2 files passed, 11 of 11 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the same known Phase 4-12 drift backlog.

## [2026-05-18] Phase 4 - Users domain slice

### Added (Phase 4 - Users domain slice)

- Added an admin-local `Result<T, E>` helper for domain/service boundaries.
- Added the users domain contracts, repository, and service under `apps/admin/src/lib/domains/users`.
- Added users repository contract tests covering Prisma query shape, soft-delete guards, and persistence-only mutation helpers.
- Added users service policy tests covering list/query normalization, typed not-found errors, invitation authorization, and self-demotion prevention.

### Changed (Phase 4 - Users domain slice)

- Routed read-only admin users actions through the users service/domain boundary while leaving destructive action migration for the Phase 5 users action branch.
- Preserved current UI response shapes for users list/detail actions while returning data from domain DTOs.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain known Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 18 files passed, 136 of 136 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/users/__tests__/service.test.ts src/lib/domains/users/__tests__/repository.test.ts src/actions/admin/__tests__/users-actions.test.ts --pool=threads --maxWorkers=1` -> pass; 3 files passed, 19 of 19 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the same known Phase 4-12 drift backlog.

## [2026-05-18] Phase 10 - Feature flag rollout foundation

### Added (Phase 10 - Feature flag rollout foundation)

- Added env-driven admin feature flags for v2 users, verification, finance dashboard, audit log UI, and structured logging rollout.
- Added `/users-v2`, `/verifications-v2`, `/analytics-v2`, and `/audit-v2` route gates that redirect to the current routes when flags are disabled.
- Added sidebar route switching so enabled v2 flags can steer navigation without removing current routes.
- Added feature-flag tests covering default-off behavior, enabled route switching, and disabled-flag rollback behavior.

### Docs (Phase 10 - Feature flag rollout foundation)

- Documented Phase 10 rollback behavior in `PROGRESS-SUMMARY.md`.
- Accepted ADR-ADMIN-009 for the env-driven strangler-fig feature flag foundation.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain legacy Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; env boundary count is now 59 and all templates match.
- `pnpm run admin:test:all` -> pass; 16 files passed, 125 of 125 tests passed.
- `pnpm -C apps/admin exec vitest run __tests__/config/feature-flags.test.ts --pool=threads --maxWorkers=1` -> pass; 3 of 3 tests passed.
- `pnpm run admin:report-security-drift:strict` -> fail with known Phase 4-12 drift backlog: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.

## [2026-05-18] Phase 3 - Auth hardening foundation

### Security (Phase 3 - Auth hardening foundation)

- Added canonical `AdminActor` / `AdminActorContext` types for admin action execution.
- Hardened `safeAction` and `safeVerificationAction` to resolve Clerk identity server-side, require an active database `AdminProfile`, authorize with `AdminRole`, enforce policy-provided recent-auth windows, and apply actor-scoped rate limits.
- Added typed admin action error details while preserving the existing string `error` response field for current UI compatibility.
- Added `AdminCapability`, capability-to-role policy mapping, high-risk action policy metadata, and `requireAdminCapability()` result-based authorization.
- Added the high-risk admin action registry and build-script mirror for later drift-check integration.

### Tests (Phase 3 - Auth hardening foundation)

- Added Phase 3 policy tests covering every `AdminRole` across every `AdminCapability`, `SUPER_ADMIN` bypass behavior, stale-session rejection, actor-scoped rate limiting, and canonical actor forwarding.
- Updated existing authorization policy tests for the database-backed `AdminRole` model.

### Docs (Phase 3 - Auth hardening foundation)

- Accepted ADR-ADMIN-001 and ADR-ADMIN-002 for the implemented admin actor, capability policy, and hardened action boundary foundation.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain legacy Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 54 boundary keys.
- `pnpm run admin:test:all` -> pass; 15 files passed, 122 of 122 tests passed.
- `pnpm -C apps/admin exec vitest run __tests__/security/admin-authorization-policy.test.ts src/lib/security/__tests__/authorization-policy.test.ts src/actions/admin/__tests__/users-actions.test.ts src/actions/admin/__tests__/verification-actions.test.ts --pool=threads --maxWorkers=1` -> pass; 4 files passed, 28 of 28 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the same known Phase 4-12 drift backlog.

## [2026-05-15] Phase 0-2 - Overhaul foundation

### Security (Phase 0-2 - Overhaul foundation)

- Added admin ADRs for authentication/authorization, action boundaries, observability, data handling, HTTP security, env access, UI contracts, audit logging, and strangler-fig rollout.
- Added an admin security drift report with strict categories for env boundary drift, direct Prisma in actions, unsafe mutations, action `.parse()`, `@ts-nocheck`, unstructured logging, log safety, and missing audit coverage.

### Fixed (Phase 0-2 - Overhaul foundation)

- Established canonical admin env templates and an env contract checker. `admin:check-env-contract` currently passes with 54 declared keys in each template.

### Changed (Phase 0-2 - Overhaul foundation)

- Tightened admin TypeScript configuration with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `docs` exclusion.
- Hardened admin ESLint configuration with env-boundary, action-persistence-boundary, server-only UI import, explicit-any, and floating-promise checks.
- Replaced the placeholder admin test script with Vitest-backed `test` and `test:all` scripts.
- Aligned `apps/admin` package manager metadata with the root `pnpm@11.1.2`.

### Added (Phase 0-2 - Overhaul foundation)

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`.
- Canonical `apps/admin/docs/adr/ADR-ADMIN-001` through `ADR-ADMIN-009`.
- Canonical `apps/admin/docs/PROGRESS-SUMMARY.md`.
- Admin root scripts: `admin:lint`, `admin:test`, `admin:test:all`, `admin:check-env-contract`, `admin:report-security-drift`, and `admin:report-security-drift:strict`.
- CI jobs for admin validation and admin changelog guarding.

### Docs (Phase 0-2 - Overhaul foundation)

- Documented Phase 0 critical and high-severity findings with evidence and command output.

**Files changed:** `.github/workflows/ci.yml`, `package.json`, `apps/admin/package.json`, `apps/admin/tsconfig.json`, `apps/admin/eslint.config.mjs`, `apps/admin/.env.example`, `apps/admin/.env.test`, `apps/admin/.env.development`, `apps/admin/scripts/check-env-contract.mjs`, `apps/admin/scripts/report-security-drift.mjs`, `apps/admin/src/lib/infrastructure/env.ts`, `apps/admin/docs/CHANGELOG.md`, `apps/admin/docs/PROGRESS-SUMMARY.md`, `apps/admin/docs/progress/AUTOPSY-REPORT.md`, `apps/admin/docs/adr/*`

**Verification:**

- `pnpm run admin:check-env-contract` -> pass; 54 boundary keys present in `.env.example`, `.env.test`, and `.env.development`.
- `pnpm run admin:lint` -> pass with 215 warnings. Warnings are tracked Phase 2/3 defects, mostly env-boundary reads, direct Prisma action imports, `@ts-nocheck`, and `any`.
- `pnpm run admin:check-types` -> fail after strict option tightening. Main categories: `exactOptionalPropertyTypes` violations in actions, API response/log contexts, verification services, GDPR consent, notification templates, and `src/scripts/set-admin.ts`.
- `pnpm run admin:report-security-drift:strict` -> fail by design with current drift counts: env boundary 83, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm -C apps/admin exec vitest run --pool=threads --maxWorkers=1` -> fail. 14 files discovered, 8 passed, 6 failed; 80 tests ran, 78 passed, 2 failed. Failures: root `__tests__/admin-verification/*` `@/` alias resolution and stale `SUPPORT` role expectations.

## [2026-05-15] Phase 2 Gate Stabilization

### Fixed (Phase 2 Gate Stabilization)

- Stabilized `admin:check-types` after the stricter compiler flags exposed optional-property propagation issues across admin actions, verification services, consent/audit flows, mailer paths, and helper contracts.
- Added `apps/admin/vitest.config.ts` so root admin tests resolve the `@/` alias consistently.
- Updated admin verification tests to match the current role model and verification/document contracts.

### Changed (Phase 2 Gate Stabilization)

- Switched several admin verification and infrastructure paths to `adminEnvConfig` and conditional object construction instead of passing `undefined` through typed contracts.
- Tightened shared helpers with `omitUndefined()` so exact optional properties stay explicit at API, logging, and Prisma boundaries.

**Verification:**

- `pnpm run admin:check-env-contract` -> pass; 54 boundary keys present in `.env.example`, `.env.test`, and `.env.development`.
- `pnpm run admin:check-types` -> pass.
- `pnpm -C apps/admin exec vitest run --pool=threads --maxWorkers=1` -> pass; 14 files passed, 116 of 116 tests passed.
- `pnpm run admin:lint` -> pass with 211 warnings; most remaining warnings are legacy action-boundary, env-boundary, `@ts-nocheck`, and `any` debt outside this stabilization slice.
- `pnpm run admin:report-security-drift:strict` -> fail with current drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
