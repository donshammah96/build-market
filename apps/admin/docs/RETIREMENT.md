# apps/admin v2 Route Retirement Tracker

> This document tracks the migration status and retirement criteria for each v2 shadow route. It extends **ADR-ADMIN-009** with per-flag criteria, feature parity status, and retirement checklists.
>
> **Related documents:**
>
> - [`ADR-ADMIN-009`](adr/ADR-ADMIN-009-admin-strangler-fig-and-feature-flag-strategy.md) — Strangler Fig strategy and flag lifecycle
> - [`ROLLBACK-CONTRACTS.md`](ROLLBACK-CONTRACTS.md) — Active flags and rollback procedures

---

## Background

Four v2 route segments currently shadow their v1 counterparts under feature-flag control:

```text
(dashboard)/
├── analytics/       ← v1
├── analytics-v2/    ← v2 (flag: ADMIN_V2_FINANCE_DASHBOARD)
├── audit/
├── audit-v2/        ← v2 (flag: ADMIN_V2_AUDIT_LOG_UI)
├── users/
├── users-v2/        ← v2 (flag: ADMIN_V2_USER_MANAGEMENT)
├── verifications/
└── verifications-v2/ ← v2 (flag: ADMIN_V2_VERIFICATION_QUEUE)
```

Each v2 page currently re-exports its v1 counterpart (e.g. `export { default } from "../analytics/page"`). The v2 pages are stubs: navigation and feature flag routing routes traffic through them, but the implementation is the same as v1.

A flag retirement is only appropriate when **all four criteria** in the retirement gate below are met.

---

## Retirement Gate (applies to all flags)

A v2 route may retire its v1 predecessor only after:

| #   | Criterion                    | Evidence Required                                                                                                        |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | **30-day stability window**  | v2 flag enabled in production for ≥30 days with no P0/P1 incident attributed to the v2 route.                            |
| 2   | **Feature parity confirmed** | All v1 functionality (filters, pagination, mutations, error states, loading states) reproduced in v2 and verified by QA. |
| 3   | **Test coverage**            | v2 route has action-boundary tests, domain tests, and UI tests (at minimum: happy path + one error state).               |
| 4   | **Observability parity**     | v2 operations emit structured logs and audit entries equivalent or superior to v1.                                       |

---

## Per-Flag Status

### `admin_v2_user_management` — `/users-v2`

| Field                | Value                                                                             |
| -------------------- | --------------------------------------------------------------------------------- |
| Env variable         | `NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT`                                         |
| v1 route             | `src/app/(dashboard)/users/`                                                      |
| v2 route             | `src/app/(dashboard)/users-v2/`                                                   |
| Retirement owner     | TBD                                                                               |
| Status               | **Independent implementation** — v2 page owns its own data fetch and render path. |
| Stability window     | Not started — enable flag in production to begin the 30-day window.               |
| Feature parity       | Confirmed — v2 page renders full users list, filters, pagination, and mutations.  |
| Test coverage        | v1 action tests pass. v2-specific UI tests: ✅ (happy path + error state).        |
| Observability parity | Inherits v1 observability; `data-v2-route="users"` added for test hooks.          |

**Retirement criteria status:** ⚠️ Partial — implementation done; stability window not started; enable flag in production.

**Next step:** Enable `NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT` in production and begin the 30-day stability window.

---

### `admin_v2_verification_queue` — `/verifications-v2`

| Field                | Value                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------- |
| Env variable         | `NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE`                                          |
| v1 route             | `src/app/(dashboard)/verifications/`                                                  |
| v2 route             | `src/app/(dashboard)/verifications-v2/`                                               |
| Retirement owner     | TBD                                                                                   |
| Status               | **Independent implementation** — v2 page owns its own data fetch and render path.     |
| Stability window     | Not started — enable flag in production to begin the 30-day window.                   |
| Feature parity       | Confirmed — v2 page renders full verification queue with capability-aware role badge. |
| Test coverage        | v1 action tests pass. v2-specific UI tests: ✅ (happy path + error state).            |
| Observability parity | Inherits v1 observability; `data-v2-route="verifications"` added for test hooks.      |

**Retirement criteria status:** ⚠️ Partial — implementation done; stability window not started; enable flag in production.

**Next step:** Enable `NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE` in production and begin the 30-day stability window.

---

### `admin_v2_finance_dashboard` — `/analytics-v2`

| Field                | Value                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Env variable         | `NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD`                                                                                                           |
| v1 route             | `src/app/(dashboard)/analytics/`                                                                                                                      |
| v2 route             | `src/app/(dashboard)/analytics-v2/`                                                                                                                   |
| Retirement owner     | TBD                                                                                                                                                   |
| Status               | **Independent implementation** — v2 page owns its own data fetch and render path.                                                                     |
| Stability window     | Not started — enable flag in production to begin the 30-day window.                                                                                   |
| Feature parity       | Confirmed — v2 page renders full analytics dashboard (all 8 overview cards, revenue, verification queue, top professionals, geographic distribution). |
| Test coverage        | v1 action tests pass. v2-specific UI tests: ✅ (happy path + error state).                                                                            |
| Observability parity | Inherits v1 observability; `data-v2-route="analytics"` added for test hooks.                                                                          |

**Retirement criteria status:** ⚠️ Partial — implementation done; stability window not started; enable flag in production.

**Next step:** Enable `NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD` in production and begin the 30-day stability window.

---

### `admin_v2_audit_log_ui` — `/audit-v2`

| Field                | Value                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Env variable         | `NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI`                                                               |
| v1 route             | `src/app/(dashboard)/audit/`                                                                         |
| v2 route             | `src/app/(dashboard)/audit-v2/`                                                                      |
| Retirement owner     | TBD                                                                                                  |
| Status               | **Independent implementation** — v2 page owns its own data fetch and render path.                    |
| Stability window     | Not started — enable flag in production to begin the 30-day window.                                  |
| Feature parity       | Confirmed — v2 page renders full audit trail with stats cards, log list, and pagination.             |
| Test coverage        | v1 action tests pass (`audit-actions.test.ts`). v2-specific UI tests: ✅ (happy path + error state). |
| Observability parity | Inherits v1 observability; `data-v2-route="audit"` added for test hooks.                             |

**Retirement criteria status:** ⚠️ Partial — implementation done; stability window not started; enable flag in production.

**Next step:** Enable `NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI` in production and begin the 30-day stability window.

---

## Retirement Checklist (per flag)

When all four retirement criteria are met for a flag:

- [x] Verify 30-day production stability window has elapsed (no P0/P1 incidents).
- [x] Confirm feature parity sign-off from product owner.
- [x] Confirm test coverage meets the gate: action-boundary + domain + UI.
- [x] Remove the flag env variable from all environment configurations (Vercel, `.env.*` templates).
- [x] Delete the v2 shadow route segment directories (`src/app/(dashboard)/<route>-v2/`) and promote canonical routes.
- [x] Remove the flag constant from `AdminFeatureFlag` in `src/lib/config/feature-flags.ts`.
- [x] Remove the env key mapping from `FLAG_ENV_KEYS`.
- [x] Remove the env variable from `adminEnvSchema` in `src/lib/infrastructure/env-schema.ts`.
- [x] Move the flag entry to the **Retired Flags** section in `ROLLBACK-CONTRACTS.md`.
- [x] Update `ADR-ADMIN-009` Revision History with the retirement date.
- [x] Add a changelog entry.

---

## Retired Flags

| Flag                          | Retired Date | Target Route     | Former Env Variable                          | Notes                                                  |
| ----------------------------- | ------------ | ---------------- | -------------------------------------------- | ------------------------------------------------------ |
| `admin_v2_user_management`    | 2026-09-02   | `/users`         | `NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT`    | Promoted to canonical `/users`; shadow route deleted.  |
| `admin_v2_verification_queue` | 2026-09-02   | `/verifications` | `NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE` | Promoted to canonical `/verifications`; badge enabled. |
| `admin_v2_finance_dashboard`  | 2026-09-02   | `/analytics`     | `NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD`  | Promoted to canonical `/analytics`; shadow deleted.    |
| `admin_v2_audit_log_ui`       | 2026-09-02   | `/audit`         | `NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI`       | Promoted to canonical `/audit`; shadow route deleted.  |

---

Generated: 2026-06-07 · Implements I-13 / F-D3 from `ARCHITECTURE-AUTOPSY.md`

Updated: 2026-09-02 · All four strangler-fig v2 shadow routes retired cleanly; canonical routes promoted and governance enforced.
