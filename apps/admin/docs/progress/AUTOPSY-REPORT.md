# Admin Overhaul Phase 0 Autopsy Report

Date: 2026-05-15

This report is the Phase 0 read-only autopsy for the staff-level `apps/admin` overhaul. It is based on inspection of `apps/admin/src`, `apps/admin/__tests__`, admin package/tooling files, existing admin documentation, and the root CI/package scripts. Client documentation was used only as reference prior art.

## Critical Defects

- Admin action boundaries are not fail-closed enough for high-risk operations. `src/actions/admin/shared.ts` resolves access through Clerk/session metadata plus `User.role`, returns raw exception messages in the `ActionResponse.error` field, and does not enforce recent authentication, actor-scoped rate limiting, or declarative audit logging.
- Direct Prisma access is widespread in action adapters. `rg -l "prisma\\." apps/admin/src/actions/admin` found 20 action-layer files with direct persistence calls, including users, verification, properties, stores, services, leads, analytics, and audit surfaces.
- Throwing Zod validation remains in action routes. `rg -n "\\.parse\\s*\\(" apps/admin/src/actions/admin` found 23 action-layer `.parse()` calls. These can escape as 500s instead of returning structured validation errors.
- Type safety suppressions hide production risk. `rg -n "@ts-nocheck" apps/admin/src apps/admin/__tests__` found 21 suppressions, including action files, dashboard pages, GDPR services, and infrastructure code.
- Sensitive logging risk exists. `src/lib/api/api-middleware.ts` logs `clerkId`, `userId`, and role context through the client logger; action/shared audit code stores admin email in audit rows; action/lib surfaces contain 104 `console.*` calls.
- Environment access is not centralized. `rg -n "process\\.env(?:\\.|\\[)" apps/admin/src apps/admin/scripts` found 81 direct env reads across workers, jobs, components, actions, scripts, notification services, and encryption code.

## High-Severity Architectural Gaps

- Admin does not yet have canonical admin ADRs. Existing docs are under `apps/admin/docs/progress` and `apps/admin/docs/archive`, while the prompt requires canonical `apps/admin/docs/adr`, `CHANGELOG.md`, and `PROGRESS-SUMMARY.md`.
- Authorization policy is split between middleware role strings (`admin`, `verification_admin`) and Prisma `AdminRole` values. `SUPER_ADMIN` exists in shared action code as a string bypass, but policy maps do not enumerate typed capabilities per `AdminRole`.
- There is no consistent domain/repository boundary. Some business logic lives inline in actions, some in `src/lib/services`, and some in GDPR/job modules that call Prisma directly.
- Audit logging exists but is not governed by a canonical contract. `logAdminAction()` writes audit data after manually fetching the admin user and does not expose declarative action integration, non-blocking failure behavior, or a stable operation-name registry.
- Observability is inherited from client-oriented helpers such as `getClientLogger()` rather than admin-specific structured event contracts.
- Package scripts are incomplete. `apps/admin/package.json` has `lint`, `check-types`, and a placeholder `test`, but no admin env contract, security drift, full test, or root-exposed admin lint/test commands.

## Medium-Severity Quality Gaps

- Vitest is not configured as a reliable admin test surface. `pnpm -C apps/admin exec vitest run --pool=threads --maxWorkers=1` currently fails because root `__tests__/admin-verification/*` cannot resolve `@/` imports, and `src/lib/users/__tests__/user-roles.test.ts` expects a stale `SUPPORT` role.
- ESLint currently disables `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars`, and does not enforce the admin env boundary or action persistence boundary.
- `tsconfig.json` is strict but does not enable `noUncheckedIndexedAccess` or `exactOptionalPropertyTypes`, and it does not exclude `docs/` from the compilation graph.
- Several material route segments have `loading.tsx` and `error.tsx`, which is good, but detailed pages and independently failable widgets need a fuller resilience pass.
- UI components use shadcn/Radix primitives and have a useful foundation, but hardcoded color/design-token drift and the eight-state interaction contract have not been systematically audited.

## Low-Severity Improvements

- `src/docs/api.md` and `src/docs/architecture.md` live under `src/`, which blurs compiled source and documentation ownership.
- `apps/admin/package.json` pins `packageManager` to `pnpm@11.1.1` while the root uses `pnpm@11.1.2`.
- Admin documentation exists, but the canonical docs are empty/missing at the root `apps/admin/docs` level.
- Some comments contain historical compatibility notes that should be revisited after Prisma generation and strict policy work are completed.

## Strengths To Preserve

- `src/` is consistently used for runtime app code, with recognizable `actions`, `app`, `components`, `hooks`, `lib`, and `scripts` areas.
- Admin has a working strict typecheck baseline: `pnpm run admin:check-types` exited 0 when run outside the filesystem sandbox.
- Route-level `loading.tsx` and `error.tsx` files already exist for many dashboard sections.
- Verification, GDPR, queue, and idempotency services provide useful seams for later domain extraction.
- Existing tests cover some verification, user role, encryption, security claims, action, and GDPR service behavior, even though the suite is not currently green.

## Verification Baseline

- `pnpm run admin:check-types` -> exit 0 after rerunning outside the sandbox. The first sandboxed attempt failed with `EPERM` reading the pnpm TypeScript binary.
- `pnpm -C apps/admin exec vitest run --pool=threads --maxWorkers=1` -> exit 1. Results: 14 files discovered, 8 passed, 6 failed; 80 tests ran, 78 passed, 2 failed. Failures: five root `__tests__/admin-verification/*` suites cannot resolve `@/` imports, and `user-roles.test.ts` expects `SUPPORT` in assignable roles.
- Drift scans:
  - `@ts-nocheck`: 21 matches.
  - action-layer `.parse()`: 23 matches.
  - action files with direct `prisma.`: 20 files.
  - direct `process.env`: 81 matches.
  - `console.*` in action/lib surfaces: 104 matches.
