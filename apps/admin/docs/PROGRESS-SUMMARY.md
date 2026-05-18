# apps/admin Overhaul Progress Summary

> Read this document before continuing the admin overhaul. `apps/admin/docs/progress/REFACTOR-PROMPT.md` remains the source prompt; this file is the canonical execution surface for current phase state, open defects, and verification.

## Active Phase

**Phase:** Phase 4 - Domain Users Slice
**Status:** Implemented on `feat/admin-overhaul/domain-users`; ready for PR review and merge to `integration/admin-overhaul`.

**Completed:**

- Phase 0 autopsy report created at `apps/admin/docs/progress/AUTOPSY-REPORT.md`.
- Phase 1 ADR foundation created under `apps/admin/docs/adr/`.
- Phase 2 tooling scaffold added: env boundary module, env templates, env contract checker, security drift reporter, root/admin scripts, tightened TypeScript/ESLint config, admin CI jobs, and changelog guard.
- Phase 3 auth hardening foundation added: canonical `AdminActor`, hardened `safeAction`, typed `errorDetails`, capability policy map, high-risk registry, recent-auth enforcement, actor-scoped rate limits, and policy tests.
- Phase 10 feature flag foundation added and tagged: env-driven v2 flags, route gates, sidebar route switching, rollback docs, and feature-flag tests.
- Phase 4 users domain slice added: users contracts, repository, service, typed results, read-action service wiring, and users domain tests.

**Remaining steps:**

- Merge the Phase 4 users domain branch through PR.
- Continue Phase 4 domain branches from the updated integration baseline in order: verification, content, finance, audit.
- Tag `admin-overhaul/phase-4-complete` only after all Phase 4 domain slices are merged and verified.
- Continue reducing lint/security-drift warnings in the relevant domain/action/security phases.

## Slice Status Registry

Status codes: compliant, known defect, unaudited/in progress, N/A.

| Slice                        | Tier | Auth/Policy           | Actions      | Domain/Repo           | Tests                 | Observability | Overall               |
| ---------------------------- | ---- | --------------------- | ------------ | --------------------- | --------------------- | ------------- | --------------------- |
| users                        | T1   | known defect          | known defect | unaudited/in progress | compliant             | known defect  | unaudited/in progress |
| verification                 | T1   | known defect          | known defect | unaudited/in progress | known defect          | known defect  | known defect          |
| audit                        | T1   | known defect          | known defect | unaudited/in progress | known defect          | known defect  | known defect          |
| GDPR/export                  | T1   | unaudited/in progress | N/A          | known defect          | unaudited/in progress | known defect  | known defect          |
| finance/analytics            | T1   | known defect          | known defect | unaudited/in progress | unaudited/in progress | known defect  | known defect          |
| stores/properties/projects   | T2   | known defect          | known defect | unaudited/in progress | unaudited/in progress | known defect  | known defect          |
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
- `pnpm run admin:test:all` -> pass; 18 files passed, 136 of 136 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/users/__tests__/service.test.ts src/lib/domains/users/__tests__/repository.test.ts src/actions/admin/__tests__/users-actions.test.ts --pool=threads --maxWorkers=1` -> pass; 3 files passed, 19 of 19 tests passed.

## Completed Phases

1. Phase 0 Autopsy - completed 2026-05-15.
2. Phase 1 ADR Foundation - completed 2026-05-15 with ADRs in Proposed status.
3. Phase 2 Tooling Scaffold - installed 2026-05-15; compile/test gates are green, lint/drift follow-up remains tracked above.
4. Phase 3 Auth Hardening - completed 2026-05-18; checkpoint tag `admin-overhaul/phase-3-complete`.
5. Phase 10 Feature Flags - completed 2026-05-18; checkpoint tag `admin-overhaul/phase-10-complete`.
6. Phase 4 Users Domain Slice - implemented 2026-05-18 on feature branch; pending PR merge. Phase 4 checkpoint tag waits for verification, content, finance, and audit domain slices.

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

Open and merge the Phase 4 users domain PR, then continue Phase 4 domain slices in order: verification, content, finance, audit.
