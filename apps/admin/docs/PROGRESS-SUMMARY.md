# apps/admin Overhaul Progress Summary

> This document tracks the current phase, slice status, and next priority. For supporting detail, see:
>
> - **Open/resolved defects** -> [`DEFECTS.md`](DEFECTS.md)
> - **Verification commands & latest results** -> [`VERIFICATION.md`](VERIFICATION.md)
> - **Feature flag rollback contracts** -> [`ROLLBACK-CONTRACTS.md`](ROLLBACK-CONTRACTS.md)
> - **How to contribute** -> [`CONTRIBUTING.md`](CONTRIBUTING.md)
> - **Architecture autopsy findings** -> [`ARCHITECTURE-AUTOPSY.md`](ARCHITECTURE-AUTOPSY.md)

---

## Active Phase

**Phase:** Phase 4: Continuous Governance & Flag Retirement (Ongoing Operational Governance)

**Status:** Enforced feature flag lifecycle limits and continuous governance in CI (`ci.yml` validate job); automated `admin:check-governance` and `admin:check-all`; eliminated all static security drift logger spread warnings; added `__tests__/config/feature-flags-lifecycle.test.ts` and `__tests__/security/verify-gdpr-replay.test.ts`.

**Milestone Completed (2026-09-02):** ADR-ADMIN-009 Strangler-Fig v2 Feature Flag Retirement & Canonical Route Promotion

- Completed retirement checklist for 4 v2 feature flags (`admin_v2_user_management`, `admin_v2_verification_queue`, `admin_v2_finance_dashboard`, `admin_v2_audit_log_ui`).
- Promoted v2 UI enhancements (including capability-aware role indicator badge on verification queue) directly to canonical routes (`/users`, `/verifications`, `/analytics`, `/audit`).
- Permanently deleted obsolete `/users-v2`, `/verifications-v2`, `/analytics-v2`, and `/audit-v2` route trees.
- Removed deprecated environment variables from schemas, wrappers, and `.env.*` templates.
- Aligned `NavigationSidebar` links directly to canonical routes with zero feature-flag indirection.

**Milestone Completed (2026-08-02):** Standalone Verification Operations Workspace App & Admin Shadow Mode (`apps/verification-ops`, `@build/verification-domain`)

- Migrated verification operations out of `apps/admin` into a dedicated Next.js application in the `pnpm` workspace (`apps/verification-ops`).
- Created `@build/verification-domain` shared monorepo package exporting case DTOs, decision commands, `VerificationReasonCode` enum, audit event schemas, and NATS JetStream event definitions (`license.manual_decision_recorded`).
- Added Read-Only Shadow Mode notification banner in admin verifications dashboard (`apps/admin/src/app/(dashboard)/verifications/regulator/page.tsx`) linking operators to `apps/verification-ops`.
- Extended Prisma schema `AuditAction` enum with `EVIDENCE_VIEWED` and `AdminRole` enum with `OPS_ADMIN` and `VERIFICATION_ADMIN`.

**Milestone Completed (2026-08-01):** Regulator Verification Manual Operator Queue (`src/app/(dashboard)/verifications/regulator/page.tsx`)

- Implemented full manual verification operator queue & detail view (`RegulatorVerificationQueue`, `RegulatorVerificationDetailDialog`) for dead-letter and manual-review statutory regulator cases (`NCA`, `EPRA`, `BORAQS`, `EBK`, `EARB`, `VRB`, `ISK`).
- Built safe server actions (`listRegulatorVerificationCases`, `getRegulatorVerificationCaseDetail`, `recordRegulatorManualDecision`) adhering strictly to ADR-ADMIN-001/002/008.
- Enforced evidence payload redaction for non-SUPER_ADMIN operators, duplicate license warning banners across professionals, and mandatory two-approver policy enforcement for high-risk decisions.

---

## Slice Status Registry

Status codes: `compliant` | `known defect` | `unaudited/in progress` | `N/A`

| Slice                        | Tier | Auth/Policy | Actions   | Domain/Repo | Tests     | Observability | Overall   |
| ---------------------------- | ---- | ----------- | --------- | ----------- | --------- | ------------- | --------- |
| users                        | T1   | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| verification                 | T1   | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| audit                        | T1   | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| GDPR/export                  | T1   | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| finance/analytics            | T1   | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| stores/properties/projects   | T2   | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| leads/services/professionals | T2   | compliant   | compliant | compliant   | compliant | compliant     | compliant |
| UI shell/components          | T3   | compliant   | compliant | compliant   | compliant | compliant     | compliant |

---

## Completed Phases

| Phase             | Description                                          | Completed  | Tag                                 |
| ----------------- | ---------------------------------------------------- | ---------- | ----------------------------------- |
| Phase 0           | Autopsy Report                                       | 2026-05-15 | -                                   |
| Phase 1           | ADR Foundation                                       | 2026-05-15 | -                                   |
| Phase 2           | Tooling Scaffold                                     | 2026-05-15 | -                                   |
| Phase 3           | Auth Hardening                                       | 2026-05-18 | `admin-overhaul/phase-3-complete`   |
| Phase 10          | Feature Flags                                        | 2026-05-18 | `admin-overhaul/phase-10-complete`  |
| Phase 4           | Domain/Repository Layer                              | 2026-05-18 | `admin-overhaul/phase-4-complete`   |
| Phase 5           | Users Action Slice                                   | 2026-05-21 | `admin-overhaul/phase-5-complete`   |
| Phase 5           | Verification Action Slice                            | 2026-05-21 | -                                   |
| Phase 7 (Track C) | Observability Foundation                             | 2026-05-21 | `admin-overhaul/phase-7-complete`   |
| Track A Phase 5   | Audit/Export Action Slice                            | 2026-05-21 | -                                   |
| -                 | Finance/Analytics + Stores/Properties Slice          | 2026-05-21 | -                                   |
| -                 | Leads/Services/Professionals Overhaul + UI Hardening | 2026-05-22 | -                                   |
| -                 | Refactoring & Drift Reduction                        | 2026-06-04 | -                                   |
| Track A Phase 6   | GDPR/Data Export Slice                               | 2026-06-04 | -                                   |
| Phase 8           | Audit Log Implementation                             | 2026-06-04 | `admin-overhaul/phase-8-complete`   |
| Phase 12          | Security Hardening Pass                              | 2026-06-04 | `admin-overhaul/phase-12-complete`  |
| -                 | Documentation Hardening (F-Doc1, F-Doc2, F-Doc3)     | 2026-06-05 | -                                   |
| -                 | Architecture Autopsy Implementation Pass             | 2026-06-05 | -                                   |
| -                 | Final Autopsy Completion Pass (I-13, I-14, I-23)     | 2026-06-07 | -                                   |
| Production Phase  | Production Readiness Audit & ADR-010..015 Framework  | 2026-07-22 | -                                   |
| Roadmap Phase 0   | Production Gate Stabilization (P0-1 through P0-5)    | 2026-07-22 | -                                   |
| Roadmap Phase 1   | Security & Configuration Hardening (P0/P1)           | 2026-07-22 | -                                   |
| Roadmap Phase 2   | Operability & Compliance (P1)                        | 2026-07-22 | -                                   |
| Roadmap Phase 3   | Structural Cleanup and Retirement (P2)               | 2026-07-22 | -                                   |
| Roadmap Phase 4   | Continuous Governance & Flag Retirement (Ongoing)    | 2026-07-22 | `admin-overhaul/phase-4-governance` |

---

## Latest Verification

| Check                                | Result | Notes                                        |
| ------------------------------------ | ------ | -------------------------------------------- |
| `admin:check-types`                  | Pass   | Exit 0. TypeScript build errors enforced.    |
| `admin:check-env-contract`           | Pass   | Exit 0. All 75 env keys match templates.     |
| `admin:check-governance`             | Pass   | Exit 0. Zero flag expiry / patch violations. |
| `admin:test:all`                     | Pass   | 68 test files passing cleanly (505 tests).   |
| `admin:report-security-drift:strict` | Pass   | Exit 0. Zero findings across 309 files.      |
| `admin:lint`                         | Pass   | 79 known warnings; 0 errors.                 |

---

## Next Priority

1. **Production Stability Window Monitoring:** Track 30-day stability window for active strangler-fig v2 feature flags (`NEXT_PUBLIC_ADMIN_FF_V2_*`) per [`RETIREMENT.md`](RETIREMENT.md).
2. **Flag Retirement Execution:** Retire v1 fallback routes once 30-day production stability window clears.
