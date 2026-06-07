# apps/admin Feature Flag Rollback Contracts

> This document is the authoritative rollback reference for all `apps/admin` feature flags. Update it when a flag is introduced, modified, or retired.

---

## How to Roll Back a Flag

Feature flags are environment-driven. Toggling a flag requires:

1. Update the relevant env variable in your hosting environment (Vercel, etc.)
2. In hosted environments that freeze env at process start, **redeploy or restart** after changing the variable.
3. Add a changelog entry referencing this document.

---

## Active Flags

The architecture autopsy implementation pass extracted sidebar route selection into `NavigationSidebar`. Rollback behavior is unchanged: disabling a v2 flag still redirects the v2 route to the v1 route and returns sidebar navigation to the v1 route.

| Flag                          | Env Variable                                 | Disable with | Rollback Effect                                                                                          | Data Caveat                 | Status |
| ----------------------------- | -------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- | --------------------------- | ------ |
| `admin_v2_user_management`    | `NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT`    | `=false`     | `/users-v2` redirects to `/users`; `NavigationSidebar` links return to `/users`.                         | No irreversible data state. | Active |
| `admin_v2_verification_queue` | `NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE` | `=false`     | `/verifications-v2` redirects to `/verifications`; `NavigationSidebar` links return to `/verifications`. | No irreversible data state. | Active |
| `admin_v2_finance_dashboard`  | `NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD`  | `=false`     | `/analytics-v2` redirects to `/analytics`; `NavigationSidebar` links return to `/analytics`.             | No irreversible data state. | Active |
| `admin_v2_audit_log_ui`       | `NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI`       | `=false`     | `/audit-v2` redirects to `/audit`; `NavigationSidebar` links return to `/audit`.                         | No irreversible data state. | Active |
| `admin_v2_structured_logging` | `NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING` | `=false`     | Structured logging disabled; falls back to `console.log`.                                                | No data state.              | Active |

---

## Irreversible State Tracking

If a flag phase creates an irreversible data or schema state (e.g., a migration that transforms existing records), document it here with the phase number and the exact state that cannot be rolled back.

_No irreversible states recorded as of the architecture autopsy implementation pass (2026-06-05)._

---

## Retirement Checklist

When retiring a flag (v2 is stable and has met the 30-day criteria from ADR-ADMIN-009):

- [ ] Remove the flag env variable from all environment configurations (Vercel, `.env.*` templates).
- [ ] Delete the v1 route segment directory (`src/app/(dashboard)/<route>/`).
- [ ] Remove the flag constant from `AdminFeatureFlag` in `src/lib/config/feature-flags.ts`.
- [ ] Remove the env key mapping from `FLAG_ENV_KEYS`.
- [ ] Remove the env variable from `adminEnvSchema` in `src/lib/infrastructure/env.ts`.
- [ ] Move this table entry to the **Retired Flags** section below.
- [ ] Update `ADR-ADMIN-009` Revision History.
- [ ] Add a changelog entry.

---

## Retired Flags

_No flags retired as of the architecture autopsy implementation pass (2026-06-05)._

---

## Related Documentation

- [`ADR-ADMIN-009`](adr/ADR-ADMIN-009-admin-strangler-fig-and-feature-flag-strategy.md) - Strangler Fig and Feature Flag Strategy
- [`VERIFICATION.md`](VERIFICATION.md) - Verification Commands
