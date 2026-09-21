# apps/admin Verification Command Reference

> This document contains the commands used to verify the health of `apps/admin` and the latest verification results. Update the **Latest Verification** section after each phase or significant change.

---

## Verification Commands

```bash
# TypeScript type check (must exit 0 before any merge)
pnpm run admin:check-types

# ESLint (must exit 0; known warnings are tracked in DEFECTS.md ADM-009)
pnpm run admin:lint

# Env contract check (must exit 0; verifies all env keys are in templates)
pnpm run admin:check-env-contract

# Security drift report (non-strict; shows findings without failing)
pnpm run admin:report-security-drift

# Security drift report (strict; must exit 0 before any merge)
pnpm run admin:report-security-drift:strict

# Run full test suite (must pass 100% before any merge)
pnpm run admin:test:all

# Alternative: run vitest directly with explicit worker constraint
pnpm -C apps/admin exec vitest run --pool=threads --maxWorkers=1
```

---

## What Each Command Checks

| Command                        | Checks                                                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `check-types`                  | All TypeScript files compile with strict mode enabled.                                                                                  |
| `lint`                         | ESLint rules including import direction, no-direct-prisma-in-actions, and no-ts-nocheck.                                                |
| `check-env-contract`           | Every key in `adminEnvSchema` appears in `.env.example`, `.env.test`, and `.env.development`.                                           |
| `report-security-drift`        | Detects direct `process.env` reads, action `.parse()` calls, direct Prisma in actions, `@ts-nocheck`, and unstructured console logging. |
| `report-security-drift:strict` | Same as above but exits non-zero on any finding.                                                                                        |
| `test:all`                     | Runs all 46 Vitest test files with thread pool and serial worker to avoid Prisma client conflicts.                                      |

---

## Latest Verification Results

> **Phase 4 Continuous Governance Pass (2026-07-23)**

| Check                                | Result | Notes                                                            |
| ------------------------------------ | ------ | ---------------------------------------------------------------- |
| `admin:check-types`                  | Pass   | Exit 0. Zero TypeScript errors across workspace.                 |
| `admin:build`                        | Pass   | Exit 0. Full Next.js production build cleanly compiled.          |
| `admin:lint`                         | Pass   | Exit 0. 79 known warnings remain, 0 errors.                      |
| `admin:check-env-contract`           | Pass   | Exit 0. All 75 environment boundary keys match across templates. |
| `admin:check-governance`             | Pass   | Exit 0. Zero flag expiry / patch SLO violations.                 |
| `admin:check-security-drift`         | Pass   | Exit 0. Zero violations across 309 files, zero warnings.         |
| `admin:report-security-drift:strict` | Pass   | Exit 0. Zero findings across 309 files.                          |
| `admin:check-all`                    | Pass   | Exit 0. All 5 static security and governance gates exit cleanly. |
| `admin:test:all`                     | Pass   | 69 test files. 508 of 508 tests passed.                          |

---

## Previous Verification Snapshots

### Phase 3 Structural Cleanup and Retirement (P2) Pass (2026-07-22)

| Check                                | Result | Notes                                                            |
| ------------------------------------ | ------ | ---------------------------------------------------------------- |
| `admin:check-types`                  | Pass   | Exit 0. Zero TypeScript errors across workspace.                 |
| `admin:build`                        | Pass   | Exit 0. Full Next.js production build cleanly compiled.          |
| `admin:lint`                         | Pass   | Exit 0. 79 known warnings remain, 0 errors.                      |
| `admin:check-env-contract`           | Pass   | Exit 0. All 75 environment boundary keys match across templates. |
| `admin:report-security-drift:strict` | Pass   | Exit 0. Zero findings across 307 files.                          |
| `admin:test:all`                     | Pass   | 67 test files. 501 of 501 tests passed.                          |

---

## Previous Verification Snapshots - Phase 1 & 2

### Phase 2 Operability and Compliance (P1) Pass (2026-07-22)

| Check                                | Result | Notes                                                            |
| ------------------------------------ | ------ | ---------------------------------------------------------------- |
| `admin:check-types`                  | Pass   | Exit 0. Zero TypeScript errors across workspace.                 |
| `admin:build`                        | Pass   | Exit 0. Full Next.js production build cleanly compiled.          |
| `admin:lint`                         | Pass   | Exit 0. 79 known warnings remain, 0 errors.                      |
| `admin:check-env-contract`           | Pass   | Exit 0. All 75 environment boundary keys match across templates. |
| `admin:report-security-drift:strict` | Pass   | Exit 0. Zero findings across 309 files.                          |
| `admin:test:all`                     | Pass   | 66 test files. 497 of 497 tests passed.                          |

---

### Phase 1 Security & Configuration Hardening Pass (2026-07-22)

| Check                                | Result | Notes                                                                        |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------- |
| `admin:check-types`                  | Pass   | Exit 0. Zero TypeScript errors across workspace.                             |
| `admin:build`                        | Pass   | Exit 0. Full Next.js production build cleanly compiled with TS typechecking. |
| `admin:lint`                         | Pass   | Exit 0. 79 known warnings remain, 0 errors.                                  |
| `admin:check-env-contract`           | Pass   | Exit 0. All 75 environment boundary keys match across templates.             |
| `admin:report-security-drift:strict` | Pass   | Exit 0. Zero findings across 302 files.                                      |
| `admin:test:all`                     | Pass   | 63 test files. 484 of 484 tests passed.                                      |

---

### Phase 0 Production Gate Hardening Pass (2026-07-22)

| Check                                | Result | Notes                                                                        |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------- |
| `admin:check-types`                  | Pass   | Exit 0. TypeScript build errors enforced.                                    |
| `admin:build`                        | Pass   | Exit 0. Full Next.js production build cleanly compiled with TS typechecking. |
| `admin:lint`                         | Pass   | Exit 0. 79 known warnings remain, 0 errors.                                  |
| `admin:check-env-contract`           | Pass   | Exit 0. All env keys match templates.                                        |
| `admin:report-security-drift:strict` | Pass   | Exit 0. Zero findings across 300 files.                                      |
| `admin:test:all`                     | Pass   | 60 test files. 473 of 473 tests passed.                                      |

---

### P2 & P3 Autopsy Refactoring Pass (2026-06-07)

| Check                                | Result | Notes                                        |
| ------------------------------------ | ------ | -------------------------------------------- |
| `admin:check-types`                  | Pass   | Exit 0. All files compiled cleanly.          |
| `admin:lint`                         | Pass   | Exit 0. 79 known warnings remain, 0 errors.  |
| `admin:check-env-contract`           | N/A    | Not rerun in this pass; no env keys changed. |
| `admin:report-security-drift:strict` | Pass   | Exit 0. Zero findings in all categories.     |
| `admin:test:all`                     | Pass   | 49 files. 378 of 378 tests passed.           |

---

### Architecture Autopsy Implementation Pass (2026-06-05)

| Check                                | Result | Notes                                        |
| ------------------------------------ | ------ | -------------------------------------------- |
| `admin:check-types`                  | Pass   | Exit 0. All files compiled cleanly.          |
| `admin:lint`                         | Pass   | Exit 0. 79 known warnings remain, 0 errors.  |
| `admin:check-env-contract`           | N/A    | Not rerun in this pass; no env keys changed. |
| `admin:report-security-drift:strict` | Pass   | Exit 0. Zero findings in all categories.     |
| `admin:test:all`                     | Pass   | 46 files. 369 of 369 tests passed.           |

---

## Verification Gate Policy

| Gate                    | Merge requirement                                                       |
| ----------------------- | ----------------------------------------------------------------------- |
| TypeScript check        | Must exit 0. No exceptions.                                             |
| Security drift (strict) | Must exit 0. No exceptions.                                             |
| Test suite              | 100% pass. No test may be skipped to achieve this.                      |
| Lint                    | Must exit 0. Known warnings tracked in `DEFECTS.md` do not block merge. |
| Env contract            | Must exit 0 when env variables were added or removed.                   |

> If any gate fails, the PR is blocked until the root cause is fixed, not suppressed.
