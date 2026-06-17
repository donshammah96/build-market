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

| Flag                                  | Env Variable                                      | Disable with | Rollback Effect                                                                                          | Data Caveat                 | Status |
| ------------------------------------- | ------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- | --------------------------- | ------ |
| `admin_v2_user_management`            | `NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT`         | `=false`     | `/users-v2` redirects to `/users`; `NavigationSidebar` links return to `/users`.                         | No irreversible data state. | Active |
| `admin_v2_verification_queue`         | `NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE`      | `=false`     | `/verifications-v2` redirects to `/verifications`; `NavigationSidebar` links return to `/verifications`. | No irreversible data state. | Active |
| `admin_v2_finance_dashboard`          | `NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD`       | `=false`     | `/analytics-v2` redirects to `/analytics`; `NavigationSidebar` links return to `/analytics`.             | No irreversible data state. | Active |
| `admin_v2_audit_log_ui`               | `NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI`            | `=false`     | `/audit-v2` redirects to `/audit`; `NavigationSidebar` links return to `/audit`.                         | No irreversible data state. | Active |
| `admin_v2_structured_logging`         | `NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING`      | `=false`     | Structured logging disabled; falls back to `console.log`.                                                | No data state.              | Active |
| `admin_ff_license_verification_queue` | `NEXT_PUBLIC_ADMIN_FF_LICENSE_VERIFICATION_QUEUE` | `=false`     | Licenses tab hidden from verification queue; verifyLicense action disabled.                              | No irreversible data state. | Active |

---

## Irreversible State Tracking

If a flag phase creates an irreversible data or schema state (e.g., a migration that transforms existing records), document it here with the phase number and the exact state that cannot be rolled back.

### License Verification Flow (`admin_ff_license_verification_queue`)

- **License Expiry Transitions**: The daily `license-expiry` background job transitions `VERIFIED` past-due licenses to `EXPIRED` status in the database and records a `SYSTEM` actor audit log. If the license verification queue feature is subsequently disabled or rolled back, these transitioned records remain in the `EXPIRED` state. They cannot be automatically restored to `VERIFIED` and require manual admin re-verification or user resubmission.
- **Published Warning Events**: The `license.expiring_soon` warning events emitted to NATS 30 days prior to expiry are permanent event publications; they cannot be recalled or rolled back from the NATS stream or consumer message histories.

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
