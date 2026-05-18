# apps/admin Overhaul Progress Summary

> Read this document before continuing the admin overhaul. `apps/admin/docs/progress/REFACTOR-PROMPT.md` remains the source prompt; this file is the canonical execution surface for current phase state, open defects, and verification.

## Active Phase

**Phase:** Phase 4 - Domain Audit Slice
**Status:** Implemented on stacked branch `feat/admin-overhaul/domain-audit`, based on the full Phase 4 domain stack because PR creation is blocked by an invalid local `gh` token.

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

**Remaining steps:**

- Refresh GitHub CLI auth or open the users domain PR manually from the pushed branch, then merge it into `integration/admin-overhaul`.
- Retarget/rebase `feat/admin-overhaul/domain-verification` onto the users-integrated baseline, then open and merge the verification domain PR.
- Retarget/rebase `feat/admin-overhaul/domain-content` onto the verification-integrated baseline, then open and merge the content domain PR.
- Retarget/rebase `feat/admin-overhaul/domain-finance` onto the content-integrated baseline, then open and merge the finance domain PR.
- Retarget/rebase `feat/admin-overhaul/domain-audit` onto the finance-integrated baseline, then open and merge the audit domain PR.
- After all Phase 4 domain PRs merge, run the full gate set on `integration/admin-overhaul` and tag `admin-overhaul/phase-4-complete`.
- Tag `admin-overhaul/phase-4-complete` only after all Phase 4 domain slices are merged and verified.
- Continue reducing lint/security-drift warnings in the relevant domain/action/security phases.

## Slice Status Registry

Status codes: compliant, known defect, unaudited/in progress, N/A.

| Slice                        | Tier | Auth/Policy           | Actions      | Domain/Repo           | Tests                 | Observability | Overall               |
| ---------------------------- | ---- | --------------------- | ------------ | --------------------- | --------------------- | ------------- | --------------------- |
| users                        | T1   | known defect          | known defect | unaudited/in progress | compliant             | known defect  | unaudited/in progress |
| verification                 | T1   | known defect          | known defect | unaudited/in progress | compliant             | known defect  | unaudited/in progress |
| audit                        | T1   | known defect          | known defect | unaudited/in progress | compliant             | known defect  | unaudited/in progress |
| GDPR/export                  | T1   | unaudited/in progress | N/A          | known defect          | unaudited/in progress | known defect  | known defect          |
| finance/analytics            | T1   | known defect          | known defect | unaudited/in progress | compliant             | known defect  | unaudited/in progress |
| stores/properties/projects   | T2   | known defect          | known defect | unaudited/in progress | compliant             | known defect  | unaudited/in progress |
| leads/services/professionals | T2   | known defect          | known defect | unaudited/in progress | unaudited/in progress | known defect  | known defect          |
| UI shell/components          | T3   | N/A                   | N/A          | N/A                   | unaudited/in progress | N/A           | unaudited/in progress |

## Open Defects

1. `ADM-001` | Severity: Critical | Action boundary permits direct Prisma access in 18 action files according to `admin:report-security-drift`.
2. `ADM-002` | Severity: Critical | Action-layer `.parse()` remains in 23 call sites.
3. `ADM-003` | Severity: Critical | `safeAction` now resolves a canonical `AdminActor`, but existing action slices still need Phase 5 migration to consume actor/policy options consistently.
4. `ADM-004` | Severity: High | Direct env reads remain in 83 drift findings.
5. `ADM-005` | Severity: High | `@ts-nocheck` remains in 21 source files.
6. `ADM-006` | Severity: High | Unstructured logging remains in 104 action/lib findings; 4 log-safety findings need review.
7. `ADM-007` | Severity: High | Strict TypeScript gate was stabilized, but adjacent legacy files still need contract cleanup to avoid regressions.
8. `ADM-008` | Severity: Medium | Vitest aliasing and stale role expectations were fixed; keep the root admin suite green as verification flows evolve.
9. `ADM-009` | Severity: Medium | ESLint passes but still reports 211 warnings after the Phase 2 rule hardening.
10. `ADM-010` | Severity: Medium | High-risk verify route files are flagged as missing explicit audit-log integration.

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

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with known Phase 4-12 drift backlog.
- `pnpm run admin:test:all` -> pass; 26 files passed, 171 of 171 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/audit/__tests__/service.test.ts src/lib/domains/audit/__tests__/repository.test.ts --pool=threads --maxWorkers=1` -> pass; 2 files passed, 9 of 9 tests passed.

## Completed Phases

1. Phase 0 Autopsy - completed 2026-05-15.
2. Phase 1 ADR Foundation - completed 2026-05-15 with ADRs in Proposed status.
3. Phase 2 Tooling Scaffold - installed 2026-05-15; compile/test gates are green, lint/drift follow-up remains tracked above.
4. Phase 3 Auth Hardening - completed 2026-05-18; checkpoint tag `admin-overhaul/phase-3-complete`.
5. Phase 10 Feature Flags - completed 2026-05-18; checkpoint tag `admin-overhaul/phase-10-complete`.
6. Phase 4 Users Domain Slice - implemented 2026-05-18 on feature branch; pending PR merge. Phase 4 checkpoint tag waits for verification, content, finance, and audit domain slices.
7. Phase 4 Verification Domain Slice - implemented 2026-05-18 on stacked feature branch; pending users PR merge/retarget before verification PR.
8. Phase 4 Content Domain Slice - implemented 2026-05-18 on stacked feature branch; pending users and verification PR merge/retarget before content PR.
9. Phase 4 Finance Domain Slice - implemented 2026-05-18 on stacked feature branch; pending users, verification, and content PR merge/retarget before finance PR.
10. Phase 4 Audit Domain Slice - implemented 2026-05-18 on stacked feature branch; pending prior Phase 4 PR merge/retarget before audit PR. Phase 4 checkpoint tag waits for all domain PRs to land on `integration/admin-overhaul`.

## Rollback Contracts

Phase 10 flags are runtime-readable through `adminEnvConfig`; toggling them requires the platform environment to expose the new value to the Next.js runtime. In hosted environments that freeze env at process start, redeploy or restart after changing the variable.

| Flag | Disable with | Rollback effect | Data caveat | Changelog note |
| ---- | ------------ | --------------- | ----------- | -------------- |
| `admin_v2_user_management` | `NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT=false` | `/users-v2` redirects to `/users`; sidebar links return to `/users`. | No irreversible data state in Phase 10. | Add rollback entry under Phase 10 if disabled after release. |
| `admin_v2_verification_queue` | `NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE=false` | `/verifications-v2` redirects to `/verifications`; sidebar links return to `/verifications`. | No irreversible data state in Phase 10. | Add rollback entry under Phase 10 if disabled after release. |
| `admin_v2_finance_dashboard` | `NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD=false` | `/analytics-v2` redirects to `/analytics`; sidebar links return to `/analytics`. | No irreversible data state in Phase 10. | Add rollback entry under Phase 10 if disabled after release. |
| `admin_v2_audit_log_ui` | `NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI=false` | `/audit-v2` redirects to `/audit`; sidebar links return to `/audit`. | No irreversible data state in Phase 10. | Add rollback entry under Phase 10 if disabled after release. |
| `admin_v2_structured_logging` | `NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING=false` | Later structured logging UI/behavior remains disabled. | No irreversible data state in Phase 10. | Add rollback entry under Phase 10 if disabled after release. |

## Next Priority

Open and merge the stacked Phase 4 domain PRs in order: users, verification, content, finance, audit. Then run integration gates and tag `admin-overhaul/phase-4-complete`.
