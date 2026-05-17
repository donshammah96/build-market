# apps/admin Overhaul Progress Summary

> Read this document before continuing the admin overhaul. `apps/admin/docs/progress/REFACTOR-PROMPT.md` remains the source prompt; this file is the canonical execution surface for current phase state, open defects, and verification.

## Active Phase

**Phase:** Admin Overhaul Phases 0-2 - Autopsy, ADRs, tooling infrastructure  
**Status:** In progress; foundation is installed and the TypeScript/test gates are now stabilized, while lint/drift remediation remains open.

**Completed:**

- Phase 0 autopsy report created at `apps/admin/docs/progress/AUTOPSY-REPORT.md`.
- Phase 1 ADR foundation created under `apps/admin/docs/adr/`.
- Phase 2 tooling scaffold added: env boundary module, env templates, env contract checker, security drift reporter, root/admin scripts, tightened TypeScript/ESLint config, admin CI jobs, and changelog guard.

**Remaining steps:**

- Reduce the remaining lint and security-drift warnings so Phase 2 can close with a tighter baseline.
- Migrate direct env reads to `adminEnvConfig`.
- Begin Phase 3 only after the admin actor/safeAction plan is ready and the current gate status is accepted.

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
3. `ADM-003` | Severity: Critical | `safeAction`/admin auth model is not yet the ADR-ADMIN-001 contract.
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
- `pnpm run admin:lint` -> pass with 211 warnings.
- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:report-security-drift:strict` -> fail with known Phase 0 drift counts.
- `pnpm -C apps/admin exec vitest run --pool=threads --maxWorkers=1` -> pass; 14 files passed, 116 of 116 tests passed.

## Completed Phases

1. Phase 0 Autopsy - completed 2026-05-15.
2. Phase 1 ADR Foundation - completed 2026-05-15 with ADRs in Proposed status.
3. Phase 2 Tooling Scaffold - installed 2026-05-15; compile/test gates are green, lint/drift follow-up remains tracked above.

## Next Priority

Stabilize the remaining Phase 2 quality gates before Phase 3: drive down lint warnings, migrate env-boundary drift, and start removing direct Prisma/action-layer policy violations called out by `admin:report-security-drift:strict`.
