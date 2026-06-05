# apps/admin Open Defects

> This registry tracks open architectural and security defects for `apps/admin`. Each entry has a stable ID (`ADM-NNN`), a severity, a status, and an owner. Resolved entries are retained for traceability.

---

## Severity Definitions

| Severity | Meaning                                                                        |
| -------- | ------------------------------------------------------------------------------ |
| Critical | Active security or data-integrity risk. Block release until resolved.          |
| High     | Boundary violation or significant maintainability debt. Target current sprint. |
| Medium   | Correctness concern or ergonomic gap. Target next sprint.                      |
| Low      | Cosmetic or minor ergonomic issue. Resolved in housekeeping pass.              |

---

## Open Defects

_No open defects as of Phase 12 completion (2026-06-04). All critical, high, and medium defects from the original Phase 0 autopsy have been resolved._

---

## Resolved Defects

| ID      | Severity | Description                                                                                            | Resolution                                                                  | Resolved   |
| ------- | -------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ---------- |
| ADM-001 | Critical | Action boundary still permits direct Prisma access in remaining action files.                          | 0 direct Prisma files in actions. Full domain layer migration complete.     | 2026-06-04 |
| ADM-002 | Critical | Action-layer `.parse()` remains in 1 call site.                                                        | 0 `.parse()` call sites in actions. All migrated to `.safeParse()` + throw. | 2026-06-04 |
| ADM-003 | Critical | `safeAction` resolves a canonical `AdminActor`, but legacy action slices still need Phase 5 migration. | Phase 8 integration complete. All slices use `safeAction`.                  | 2026-06-04 |
| ADM-004 | High     | Direct env reads remain in 5 drift findings.                                                           | 0 drift findings. All env access migrated to `adminEnvConfig`.              | 2026-06-04 |
| ADM-005 | High     | `@ts-nocheck` remains in 7 source files.                                                               | 0 files containing `@ts-nocheck`.                                           | 2026-06-04 |
| ADM-006 | High     | Unstructured logging has 14 structured-logging drift findings.                                         | 0 drift findings. Structured logger fully deployed.                         | 2026-06-04 |
| ADM-007 | High     | Strict TypeScript gate unstable.                                                                       | Strict TypeScript gate fully stabilized; passes with 0 errors.              | 2026-06-04 |
| ADM-008 | Medium   | Vitest aliasing and stale role expectations causing test failures.                                     | Root admin suite solid with 368 green tests.                                | 2026-06-04 |
| ADM-009 | Medium   | ESLint passes but reports known warnings.                                                              | Known warnings backlog acknowledged; non-blocking.                          | 2026-06-04 |
| ADM-010 | Medium   | High-risk verify route files not completely audit-logged.                                              | 0 missing audit logs. All high-risk operations confirmed audit-logged.      | 2026-06-04 |

---

## Architecture Autopsy Defects (Post-Phase-12)

The `ARCHITECTURE-AUTOPSY.md` (2026-06-05) identified new defects from the structural autopsy. These are tracked here for resolution:

| ID      | Severity | Class | Description                                                                | Status | Owner |
| ------- | -------- | ----- | -------------------------------------------------------------------------- | ------ | ----- |
| ADM-011 | High     | A     | `safeVerificationAction` is a 160-line near-duplicate of `safeAction`.     | Open   | TBD   |
| ADM-012 | High     | A     | Legacy auth helpers still exported from `shared.ts` (footgun surface).     | Open   | TBD   |
| ADM-013 | High     | A     | `logAdminAction` is a parallel, schema-divergent audit path.               | Open   | TBD   |
| ADM-014 | Medium   | B     | `shared.ts` is a 952-line god-file serving four responsibility buckets.    | Open   | TBD   |
| ADM-015 | Medium   | A/B   | `parseActionInput` duplicated across 8 action files.                       | Open   | TBD   |
| ADM-016 | Medium   | C     | `Result<T, E>` discriminant inconsistency (`ok` vs `success`).             | Open   | TBD   |
| ADM-017 | Medium   | A     | Dashboard layout mixes shell, nav, and data-fetching in one 230-line file. | Open   | TBD   |
| ADM-018 | Low      | B     | `lib/gdpr/` and `domains/gdpr/` represent an ambiguous split.              | Open   | TBD   |
| ADM-019 | Low      | B     | `lib/services/verification/` not colocated with `domains/verification/`.   | Open   | TBD   |
| ADM-020 | Low      | C     | `entity: Record<string, any>` in `VerificationDetails`.                    | Open   | TBD   |
