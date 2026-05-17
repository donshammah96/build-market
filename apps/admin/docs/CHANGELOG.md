# apps/admin Changelog

## [2026-05-15] Phase 0-2 - Overhaul foundation

### Security

- Added admin ADRs for authentication/authorization, action boundaries, observability, data handling, HTTP security, env access, UI contracts, audit logging, and strangler-fig rollout.
- Added an admin security drift report with strict categories for env boundary drift, direct Prisma in actions, unsafe mutations, action `.parse()`, `@ts-nocheck`, unstructured logging, log safety, and missing audit coverage.

### Fixed

- Established canonical admin env templates and an env contract checker. `admin:check-env-contract` currently passes with 54 declared keys in each template.

### Changed

- Tightened admin TypeScript configuration with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `docs` exclusion.
- Hardened admin ESLint configuration with env-boundary, action-persistence-boundary, server-only UI import, explicit-any, and floating-promise checks.
- Replaced the placeholder admin test script with Vitest-backed `test` and `test:all` scripts.
- Aligned `apps/admin` package manager metadata with the root `pnpm@11.1.2`.

### Added

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`.
- Canonical `apps/admin/docs/adr/ADR-ADMIN-001` through `ADR-ADMIN-009`.
- Canonical `apps/admin/docs/PROGRESS-SUMMARY.md`.
- Admin root scripts: `admin:lint`, `admin:test`, `admin:test:all`, `admin:check-env-contract`, `admin:report-security-drift`, and `admin:report-security-drift:strict`.
- CI jobs for admin validation and admin changelog guarding.

### Docs

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
