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

There are currently no open architectural or security defects.

---

## Resolved Defects

| ID      | Severity | Description                                                                                            | Resolution                                                                     | Resolved   |
| ------- | -------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------- |
| ADM-001 | Critical | Action boundary still permits direct Prisma access in remaining action files.                          | 0 direct Prisma files in actions. Full domain layer migration complete.        | 2026-06-04 |
| ADM-002 | Critical | Action-layer `.parse()` remains in 1 call site.                                                        | 0 `.parse()` call sites in actions. All migrated to `.safeParse()` + throw.    | 2026-06-04 |
| ADM-003 | Critical | `safeAction` resolves a canonical `AdminActor`, but legacy action slices still need Phase 5 migration. | Phase 8 integration complete. All slices use `safeAction`.                     | 2026-06-04 |
| ADM-004 | High     | Direct env reads remain in 5 drift findings.                                                           | 0 drift findings. All env access migrated to `adminEnvConfig`.                 | 2026-06-04 |
| ADM-005 | High     | `@ts-nocheck` remains in 7 source files.                                                               | 0 files containing `@ts-nocheck`.                                              | 2026-06-04 |
| ADM-006 | High     | Unstructured logging has 14 structured-logging drift findings.                                         | 0 drift findings. Structured logger fully deployed.                            | 2026-06-04 |
| ADM-007 | High     | Strict TypeScript gate unstable.                                                                       | Strict TypeScript gate fully stabilized; passes with 0 errors.                 | 2026-06-04 |
| ADM-008 | Medium   | Vitest aliasing and stale role expectations causing test failures.                                     | Root admin suite solid with 368 green tests.                                   | 2026-06-04 |
| ADM-009 | Medium   | ESLint passes but reports known warnings.                                                              | Known warnings backlog acknowledged; non-blocking.                             | 2026-06-04 |
| ADM-010 | Medium   | High-risk verify route files not completely audit-logged.                                              | 0 missing audit logs. All high-risk operations confirmed audit-logged.         | 2026-06-04 |
| ADM-011 | High     | `safeVerificationAction` is a 160-line near-duplicate of `safeAction`.                                 | Removed `safeVerificationAction`; verification actions now use `safeAction`.   | 2026-06-05 |
| ADM-012 | High     | Legacy auth helpers still exported from `shared.ts` (footgun surface).                                 | Removed legacy helper exports from the public action surface.                  | 2026-06-05 |
| ADM-013 | High     | `logAdminAction` is a parallel, schema-divergent audit path.                                           | Migrated remaining route audit writes to `auditService.recordAdminAuditEvent`. | 2026-06-05 |
| ADM-014 | Medium   | `shared.ts` is a 952-line god-file serving four responsibility buckets.                                | Split action infrastructure into focused `_core` modules.                      | 2026-06-05 |
| ADM-015 | Medium   | `parseActionInput` duplicated across action files.                                                     | Centralized parser in `_core/validation.ts` and migrated action slices.        | 2026-06-05 |
| ADM-016 | Medium   | `Result<T, E>` discriminant inconsistency (`ok` vs `success`).                                         | Standardized security policy results on canonical `ok` discriminant.           | 2026-06-05 |
| ADM-017 | Medium   | Dashboard layout mixes shell, nav, and data-fetching in one 230-line file.                             | Extracted `NavigationSidebar`, Suspense badge, and DB-backed role display.     | 2026-06-05 |
| ADM-018 | Low      | `lib/gdpr/` and `domains/gdpr/` represent an ambiguous split.                                          | Consolidated GDPR encryption, anonymization, and export into canonical domain. | 2026-06-07 |
| ADM-019 | Low      | `lib/services/verification/` not colocated with `domains/verification/`.                               | Consolidated verification helper services into verification domain internal/.  | 2026-06-07 |
| ADM-020 | Low      | `entity: Record<string, any>` in `VerificationDetails`.                                                | Replaced with discriminated per-entity verification detail union.              | 2026-06-05 |

---

## Architecture Autopsy Defects (Post-Phase-12)

The `ARCHITECTURE-AUTOPSY.md` (2026-06-05) identified new defects from the structural autopsy. These are tracked here for resolution:

| ID      | Severity | Class | Description                                                                | Status              | Owner |
| ------- | -------- | ----- | -------------------------------------------------------------------------- | ------------------- | ----- |
| ADM-011 | High     | A     | `safeVerificationAction` is a 160-line near-duplicate of `safeAction`.     | Resolved 2026-06-05 | Codex |
| ADM-012 | High     | A     | Legacy auth helpers still exported from `shared.ts` (footgun surface).     | Resolved 2026-06-05 | Codex |
| ADM-013 | High     | A     | `logAdminAction` is a parallel, schema-divergent audit path.               | Resolved 2026-06-05 | Codex |
| ADM-014 | Medium   | B     | `shared.ts` is a 952-line god-file serving four responsibility buckets.    | Resolved 2026-06-05 | Codex |
| ADM-015 | Medium   | A/B   | `parseActionInput` duplicated across 8 action files.                       | Resolved 2026-06-05 | Codex |
| ADM-016 | Medium   | C     | `Result<T, E>` discriminant inconsistency (`ok` vs `success`).             | Resolved 2026-06-05 | Codex |
| ADM-017 | Medium   | A     | Dashboard layout mixes shell, nav, and data-fetching in one 230-line file. | Resolved 2026-06-05 | Codex |
| ADM-018 | Low      | B     | `lib/gdpr/` and `domains/gdpr/` represent an ambiguous split.              | Resolved 2026-06-07 | Codex |
| ADM-019 | Low      | B     | `lib/services/verification/` not colocated with `domains/verification/`.   | Resolved 2026-06-07 | Codex |
| ADM-020 | Low      | C     | `entity: Record<string, any>` in `VerificationDetails`.                    | Resolved 2026-06-05 | Codex |
