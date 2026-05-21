# apps/admin Overhaul Progress Summary

> Read this document before continuing the admin overhaul. `apps/admin/docs/progress/REFACTOR-PROMPT.md` remains the source prompt; this file is the canonical execution surface for current phase state, open defects, and verification.

## Active Phase

**Phase:** Finance/Analytics + Stores/Properties Action Slice (complete)
**Status:** Completed and fully verified the Finance/Analytics + Stores/Properties action slice, including complete domain slices for `stores` and `properties` and comprehensive analytics persistence/services for `finance`. Added robust type check and unit test verification (35 test files passed, 294 tests passed, 0 failed).

**Completed:**

- Phase 0 autopsy report created at `apps/admin/docs/progress/AUTOPSY-REPORT.md`.
- Phase 1 ADR foundation created under `apps/admin/docs/adr/`.
- Phase 2 tooling scaffold added: env boundary module, env templates, env contract checker, security drift reporter, root/admin scripts, tightened TypeScript/ESLint config, admin CI jobs, and changelog guard.
- Phase 3 auth hardening foundation added: canonical `AdminActor`, hardened `safeAction`, typed `errorDetails`, capability policy map, high-risk registry, recent-auth enforcement, actor-scoped rate limits, and policy tests.
- Phase 10 feature flag foundation added and tagged: env-driven v2 flags, route gates, sidebar route switching, rollback docs, and feature-flag tests.
- Phase 4 users domain slice added: users contracts, repository, service, typed results, read-action service wiring, and users domain tests.
- Phase 4 verification domain slice added: verification contracts, repository, service, typed results, policy checks, queue/stat tests, and repository contract tests.
- Phase 4 content domain slice added: content contracts, repository, service, typed results, policy checks, moderation queue tests, and repository contract tests.
- Phase 4 finance domain slice added: finance contracts, repository, service, typed results, policy checks, overview tests, and repository contract tests.
- Phase 4 audit domain slice added: audit contracts, repository, service, typed results, policy checks, audit page/stat tests, and repository contract tests.
- Phase 4 checkpoint merged on `integration/admin-overhaul` and tagged `admin-overhaul/phase-4-complete`.
- Phase 5 users action slice added: `safeParse` action validation, service/repository delegation for all user mutations, declarative audit coverage, self-delete protection, and refreshed users action-boundary tests.
- Phase 5 verification action slice added: `safeAction` migration, verification service-backed queue/stats/details/mutation adapters, normalized document verification contracts, updated verification route handlers, and refreshed action/route/domain tests.
- Phase 5 verification bug fixes applied: fixed API route audit gaps, privilege escalation fallbacks, unhandled parsing exceptions, and string concatenation bugs.
- Phase 5 users and verification PRs merged; tag `admin-overhaul/phase-5-complete` pushed.
- Phase 7 (Track C) observability foundation added on `feat/admin-overhaul/observability`: structured `getAdminLogger()` with PII exclusion, `AsyncLocalStorage`-backed correlation ID threading, typed `AdminOperationName` registry (40+ operations), and `safeAction`/`safeVerificationAction` integration emitting structured log events at every outcome path.
- Track A — Phase 5 Audit/Export Action Slice added: migrated `audit.ts` and `compliance/route.ts` off direct Prisma / `.parse()` / `@ts-nocheck`, integrated the structured logger, and added comprehensive service & action tests.
- Finance/Analytics + Stores/Properties Action Slice added: implemented full `stores` and `properties` domain layers (contracts, repository, service), extended `finance` domain for advanced analytics, and rewrote analytics, stores, and properties actions using `safeAction` to eliminate direct Prisma, `@ts-nocheck`, and legacy logging. Achieved 100% test coverage with zero type check or runtime regressions.

**Remaining steps:**

- Start Track B Phase 6 token and route-boundary work after the current action slice lands, keeping UI-only changes isolated from Track A.
- Continue with the remaining high-risk compliance/export mutations and GDPR tasks (Track A Phase 6 GDPR/export slice).
- Start leads/services/professionals action slice migrations.
- Continue reducing remaining drift: 10 direct-Prisma action files, 10 `.parse()` call sites, 12 `@ts-nocheck` files.

## Slice Status Registry

Status codes: compliant, known defect, unaudited/in progress, N/A.

| Slice                        | Tier | Auth/Policy           | Actions           | Domain/Repo           | Tests                 | Observability     | Overall               |
| ---------------------------- | ---- | --------------------- | ----------------- | --------------------- | --------------------- | ----------------- | --------------------- |
| users                        | T1   | compliant             | compliant         | compliant             | compliant             | compliant         | compliant             |
| verification                 | T1   | compliant             | compliant         | compliant             | compliant             | compliant         | compliant             |
| audit                        | T1   | compliant             | compliant         | compliant             | compliant             | compliant         | compliant             |
| GDPR/export                  | T1   | unaudited/in progress | N/A               | known defect          | unaudited/in progress | known defect      | known defect          |
| finance/analytics            | T1   | compliant             | compliant         | compliant             | compliant             | compliant         | compliant             |
| stores/properties/projects   | T2   | compliant (st/pr)     | compliant (st/pr) | compliant (st/pr)     | compliant             | compliant (st/pr) | compliant (st/pr)     |
| leads/services/professionals | T2   | known defect          | known defect      | unaudited/in progress | unaudited/in progress | known defect      | known defect          |
| UI shell/components          | T3   | N/A                   | N/A               | N/A                   | unaudited/in progress | N/A               | unaudited/in progress |

## Open Defects

1. `ADM-001` | Severity: Critical | Action boundary still permits direct Prisma access in remaining action files (reduced from 13 down to 10 files).
2. `ADM-002` | Severity: Critical | Action-layer `.parse()` remains in 10 call sites.
3. `ADM-003` | Severity: Critical | `safeAction` now resolves a canonical `AdminActor`, but remaining action slices still need Phase 5 migration to consume actor/policy options consistently.
4. `ADM-004` | Severity: High | Direct env reads remain in 69 drift findings.
5. `ADM-005` | Severity: High | `@ts-nocheck` remains in 12 source files (reduced from 18 files).
6. `ADM-006` | Severity: High | Unstructured logging has been resolved in all updated slices, remaining legacy code still has structured-logging drift.
7. `ADM-007` | Severity: High | Strict TypeScript gate remains fully stabilized.
8. `ADM-008` | Severity: Medium | Vitest aliasing and stale role expectations are fully verified; root admin suite is solid with 294 green tests.
9. `ADM-009` | Severity: Medium | ESLint passes but still reports known warnings.
10. `ADM-010` | Severity: Medium | High-risk verify route files are completely audit-logged.

## Verification Command Reference

```bash
pnpm run admin:check-types
pnpm run admin:lint
pnpm run admin:check-env-contract
pnpm run admin:report-security-drift
pnpm run admin:report-security-drift:strict
pnpm run admin:test:all
pnpm -C apps/admin exec vitest run --pool=threads --maxWorkers=1
```

## Latest Verification

- `pnpm run admin:check-types` → pass.
- `pnpm run admin:lint` → pass with known warnings backlog.
- `pnpm run admin:check-env-contract` → pass; 59 boundary keys.
- `pnpm run admin:report-security-drift` → pass with improved drift counts.
- `pnpm run admin:test:all` → pass; 35 files passed, 294 of 294 tests passed.

## Completed Phases

1. Phase 0 Autopsy - completed 2026-05-15.
2. Phase 1 ADR Foundation - completed 2026-05-15 with ADRs in Proposed status.
3. Phase 2 Tooling Scaffold - installed 2026-05-15; compile/test gates are green.
4. Phase 3 Auth Hardening - completed 2026-05-18; checkpoint tag `admin-overhaul/phase-3-complete`.
5. Phase 10 Feature Flags - completed 2026-05-18; checkpoint tag `admin-overhaul/phase-10-complete`.
6. Phase 4 Domain/Repository Layer - completed 2026-05-18; checkpoint tag `admin-overhaul/phase-4-complete`.
7. Phase 5 Users Action Slice - merged 2026-05-21; checkpoint tag `admin-overhaul/phase-5-complete`.
8. Phase 5 Verification Action Slice - merged 2026-05-21.
9. Phase 7 (Track C) Observability Foundation - completed 2026-05-21.
10. Track A — Phase 5 Audit/Export Action Slice - completed 2026-05-21.
11. Finance/Analytics + Stores/Properties Action Slice - completed 2026-05-21.

## Rollback Contracts

Phase 10 flags are runtime-readable through `adminEnvConfig`; toggling them requires the platform environment to expose the new value to the Next.js runtime. In hosted environments that freeze env at process start, redeploy or restart after changing the variable.

| Flag                          | Disable with                                       | Rollback effect                                                                              | Data caveat                             | Changelog note                                               |
| ----------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| `admin_v2_user_management`    | `NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT=false`    | `/users-v2` redirects to `/users`; sidebar links return to `/users`.                         | No irreversible data state in Phase 10. | Add rollback entry under Phase 10 if disabled after release. |
| `admin_v2_verification_queue` | `NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE=false` | `/verifications-v2` redirects to `/verifications`; sidebar links return to `/verifications`. | No irreversible data state in Phase 10. | Add rollback entry under Phase 10 if disabled after release. |
| `admin_v2_finance_dashboard`  | `NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD=false`  | `/analytics-v2` redirects to `/analytics`; sidebar links return to `/analytics`.             | No irreversible data state in Phase 10. | Add rollback entry under Phase 10 if disabled after release. |
| `admin_v2_audit_log_ui`       | `NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI=false`       | `/audit-v2` redirects to `/audit`; sidebar links return to `/audit`.                         | No irreversible data state in Phase 10. | Add rollback entry under Phase 10 if disabled after release. |
| `admin_v2_structured_logging` | `NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING=false` | Later structured logging UI/behavior remains disabled.                                       | No irreversible data state in Phase 10. | Add rollback entry under Phase 10 if disabled after release. |

## Next Priority

Complete GDPR/export and leads/services/professionals action slices and continue UI token and route-boundary integrations.
