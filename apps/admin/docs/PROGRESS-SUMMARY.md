# apps/admin Overhaul Progress Summary

> Read this document before continuing the admin overhaul. `apps/admin/docs/progress/REFACTOR-PROMPT.md` remains the source prompt; this file is the canonical execution surface for current phase state, open defects, and verification.

## Active Phase

**Phase:** Track A (complete) + Track B (complete) — open PRs for both; next is `finance/analytics` action slice
**Status:** Both Track A (`feat/admin-overhaul/actions-audit`) and Track B (`feat/admin-overhaul/ui-tokens`) committed and pushed. PRs ready to open. Next priority is `stores/properties/projects` or `finance/analytics` action slice.
**Phase:** Track C Phase 7 - Observability foundation (complete) / Track A Phase 5 - Audit/export action slice (next)
**Status:** Track C implemented on `feat/admin-overhaul/observability`, ready for PR to `integration/admin-overhaul`. Track B `feat/admin-overhaul/ui-tokens` (tokens + route boundaries) runs in parallel with Track A.

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
- Phase 5 users action slice added and merged; tag `admin-overhaul/phase-5-complete` pushed.
- Phase 5 verification action slice added, merged, and bug-fixed.
- Phase 7 (Track C) observability foundation: structured logger, correlation threading, typed `AdminOperationName` registry (40+ ops), `safeAction`/`safeVerificationAction` integration. Tag `admin-overhaul/phase-7-complete` pushed.
- Track A (Phase 5 continuation) audit/export action slice: migrated `audit.ts` and `compliance/route.ts`; extended audit domain contracts/repository/service with export and distinct-action support; 8 new action-boundary tests + 8 new service tests. Drift: −1 direct-Prisma action file, −2 `.parse()`, −1 `@ts-nocheck`, −3 unstructured logs.
- Track B UI token system: `tokens.css` with 100+ design tokens, dark mode overrides, skeleton animation; `globals.css` import; `loading.tsx` for 4 v2 route segments.

**Remaining steps:**

- Open PRs for Track A (`feat/admin-overhaul/actions-audit`) and Track B (`feat/admin-overhaul/ui-tokens`).
- Start next action slice: `finance/analytics` (direct Prisma + `.parse()` in `analytics.ts`) or `stores/properties` (next highest direct-Prisma count).
- Continue reducing drift: 12 direct-Prisma action files, 14 `.parse()` call sites, 12 unsafe mutations, 17 `@ts-nocheck` files.
- Phase 5 users action slice added: `safeParse` action validation, service/repository delegation for all user mutations, declarative audit coverage, self-delete protection, and refreshed users action-boundary tests.
- Phase 5 verification action slice added: `safeAction` migration, verification service-backed queue/stats/details/mutation adapters, normalized document verification contracts, updated verification route handlers, and refreshed action/route/domain tests.
- Phase 5 verification bug fixes applied: fixed API route audit gaps, privilege escalation fallbacks, unhandled parsing exceptions, and string concatenation bugs.
- Phase 5 users and verification PRs merged; tag `admin-overhaul/phase-5-complete` pushed.
- Phase 7 (Track C) observability foundation added on `feat/admin-overhaul/observability`: structured `getAdminLogger()` with PII exclusion, `AsyncLocalStorage`-backed correlation ID threading, typed `AdminOperationName` registry (40+ operations), and `safeAction`/`safeVerificationAction` integration emitting structured log events at every outcome path.

**Remaining steps:**

- Merge Track C `feat/admin-overhaul/observability` PR into `integration/admin-overhaul`; apply `admin-overhaul/phase-7-complete` tag.
- Start Track A `feat/admin-overhaul/actions-audit`: migrate `audit.ts` and `compliance/route.ts` off direct Prisma / `.parse()` / `@ts-nocheck`, consuming the Phase 7 structured logger. Fix `professionals.ts` log-safety drift.
- Start Track B `feat/admin-overhaul/ui-tokens` in parallel: create `tokens.css`, import in `globals.css`, add `loading.tsx`/`error.tsx` for 5 route segments, adopt tokens in `CardList.tsx`, `AppBarChart.tsx`, `AddUser.tsx`.
- Continue reducing remaining drift: 13 direct-Prisma action files, 16 `.parse()` call sites, 12 unsafe mutations, 18 `@ts-nocheck` files.

## Slice Status Registry

Status codes: compliant, known defect, unaudited/in progress, N/A.

| Slice                        | Tier | Auth/Policy           | Actions      | Domain/Repo           | Tests                 | Observability | Overall               |
| ---------------------------- | ---- | --------------------- | ------------ | --------------------- | --------------------- | ------------- | --------------------- |
| users                        | T1   | compliant             | compliant    | compliant             | compliant             | known defect  | unaudited/in progress |
| verification                 | T1   | compliant             | compliant    | compliant             | compliant             | known defect  | unaudited/in progress |
| audit                        | T1   | compliant             | compliant    | compliant             | compliant             | compliant     | compliant             |
| GDPR/export                  | T1   | unaudited/in progress | N/A          | known defect          | unaudited/in progress | known defect  | known defect          |
| finance/analytics            | T1   | known defect          | known defect | unaudited/in progress | compliant             | known defect  | unaudited/in progress |
| stores/properties/projects   | T2   | known defect          | known defect | unaudited/in progress | compliant             | known defect  | unaudited/in progress |
| leads/services/professionals | T2   | known defect          | known defect | unaudited/in progress | unaudited/in progress | known defect  | known defect          |
| UI shell/components          | T3   | N/A                   | N/A          | N/A                   | unaudited/in progress | N/A           | unaudited/in progress |

## Open Defects

1. `ADM-001` | Severity: Critical | Action boundary still permits direct Prisma access in **12** action files (reduced from 13 by Track A).
2. `ADM-002` | Severity: Critical | Action-layer `.parse()` remains in **14** call sites (reduced from 16 by Track A).
3. `ADM-003` | Severity: Critical | `safeAction` now resolves a canonical `AdminActor`, but remaining action slices still need Phase 5 migration to consume actor/policy options consistently.
4. `ADM-004` | Severity: High | Direct env reads remain in 69 drift findings.
5. `ADM-005` | Severity: High | `@ts-nocheck` remains in **17** source files (reduced from 18 by Track A).
6. `ADM-006` | Severity: High | Unstructured logging remains in ~100 action/lib findings; Track A reduced `compliance/route.ts` by 3 findings.
7. `ADM-007` | Severity: High | Strict TypeScript gate was stabilized, but adjacent legacy files still need contract cleanup to avoid regressions.
8. `ADM-008` | Severity: Medium | Vitest aliasing and stale role expectations were fixed; keep the root admin suite green as action/verification flows evolve.
9. `ADM-009` | Severity: Medium | ESLint passes but still reports 156 warnings after the verification slice cleanup.
10. `ADM-010` | Severity: Medium | High-risk verify route files are still flagged as missing explicit route-level audit integration by the drift reporter, even though the server actions now attach declarative audit metadata.

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
- `pnpm run admin:report-security-drift` → pass with known drift counts: env boundary 69, direct Prisma action files 13, unsafe mutations 12, action `.parse()` 16, `@ts-nocheck` 18, unstructured logging 103, log safety 3, missing audit log 2.
- `pnpm run admin:report-security-drift:strict` → fail with known Phase 4-12 drift backlog.
- `pnpm run admin:test:all` → pass; 29 files passed, 213 of 213 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/infrastructure/__tests__/logger.test.ts src/lib/infrastructure/__tests__/correlation.test.ts src/lib/observability/__tests__/operation-names.test.ts --pool=threads --maxWorkers=1` → 3 files, 36 tests passed.

## Completed Phases

1. Phase 0 Autopsy - completed 2026-05-15.
2. Phase 1 ADR Foundation - completed 2026-05-15 with ADRs in Proposed status.
3. Phase 2 Tooling Scaffold - installed 2026-05-15; compile/test gates are green, lint/drift follow-up remains tracked above.
4. Phase 3 Auth Hardening - completed 2026-05-18; checkpoint tag `admin-overhaul/phase-3-complete`.
5. Phase 10 Feature Flags - completed 2026-05-18; checkpoint tag `admin-overhaul/phase-10-complete`.
6. Phase 4 Domain/Repository Layer - completed 2026-05-18; checkpoint tag `admin-overhaul/phase-4-complete`.
7. Phase 5 Users Action Slice - merged 2026-05-21; checkpoint tag `admin-overhaul/phase-5-complete`.
8. Phase 5 Verification Action Slice - merged 2026-05-21; pending follow-on action slices for audit/export, finance, content, and leads/services/professionals.
9. Phase 7 (Track C) Observability Foundation - implemented 2026-05-21 on `feat/admin-overhaul/observability`; pending PR merge. Structured logger, correlation threading, operation name registry, `safeAction` integration.

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

Merge Track C `feat/admin-overhaul/observability` PR. Then open Track A `feat/admin-overhaul/actions-audit` to migrate `audit.ts` and `compliance/route.ts` off direct Prisma and `.parse()`, consuming the Phase 7 logger. Open Track B `feat/admin-overhaul/ui-tokens` in parallel for the token system and route-boundary work. After Track A merges, continue with `finance/analytics`, `stores/properties/projects`, and `leads/services/professionals` action slices.
