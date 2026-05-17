# apps/admin Overhaul Progress Summary

> Read this document before continuing the admin overhaul. `apps/admin/docs/progress/REFACTOR-PROMPT.md` remains the source prompt; this file is the canonical execution surface for current phase state, open defects, and verification.

## Active Phase

**Phase:** Phase 3 - Authentication and Authorization Hardening  
**Status:** Implemented on `feat/admin-overhaul/auth-hardening`; ready for PR review and merge to `integration/admin-overhaul`.

**Completed:**

- Phase 0 autopsy report created at `apps/admin/docs/progress/AUTOPSY-REPORT.md`.
- Phase 1 ADR foundation created under `apps/admin/docs/adr/`.
- Phase 2 tooling scaffold added: env boundary module, env templates, env contract checker, security drift reporter, root/admin scripts, tightened TypeScript/ESLint config, admin CI jobs, and changelog guard.
- Phase 3 auth hardening foundation added: canonical `AdminActor`, hardened `safeAction`, typed `errorDetails`, capability policy map, high-risk registry, recent-auth enforcement, actor-scoped rate limits, and policy tests.

**Remaining steps:**

- Merge Phase 3 through PR, then tag `admin-overhaul/phase-3-complete`.
- Begin Phase 10 feature flags from the Phase 3-integrated baseline, or continue Phase 4 domain branches if the review queue prefers strict phase order.
- Continue reducing lint/security-drift warnings in the relevant domain/action/security phases.

## Slice Status Registry

Status codes: compliant, known defect, unaudited/in progress, N/A.

| Slice                        | Tier | Auth/Policy           | Actions      | Domain/Repo           | Tests                 | Observability | Overall               |
| ---------------------------- | ---- | --------------------- | ------------ | --------------------- | --------------------- | ------------- | --------------------- |
| users                        | T1   | known defect          | known defect | unaudited/in progress | known defect          | known defect  | known defect          |
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

- `pnpm run admin:check-env-contract` -> pass; all env templates cover 54 boundary keys.
- `pnpm run admin:lint` -> pass with 213 warnings.
- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with known Phase 4-12 drift backlog.
- `pnpm run admin:test:all` -> pass; 15 files passed, 122 of 122 tests passed.
- `pnpm -C apps/admin exec vitest run __tests__/security/admin-authorization-policy.test.ts src/lib/security/__tests__/authorization-policy.test.ts src/actions/admin/__tests__/users-actions.test.ts src/actions/admin/__tests__/verification-actions.test.ts --pool=threads --maxWorkers=1` -> pass; 4 files passed, 28 of 28 tests passed.

## Completed Phases

1. Phase 0 Autopsy - completed 2026-05-15.
2. Phase 1 ADR Foundation - completed 2026-05-15 with ADRs in Proposed status.
3. Phase 2 Tooling Scaffold - installed 2026-05-15; compile/test gates are green, lint/drift follow-up remains tracked above.
4. Phase 3 Auth Hardening - implemented 2026-05-18 on feature branch; pending PR merge and checkpoint tag.

## Next Priority

Open and merge the Phase 3 PR, tag `admin-overhaul/phase-3-complete`, then start the next branch. Recommended order: Phase 10 feature flags can proceed immediately from the stabilized baseline, while Phase 4 domain slices should start with users and verification to unlock the Phase 5 action-boundary cleanup.
