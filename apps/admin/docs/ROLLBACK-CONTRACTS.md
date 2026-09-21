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

The architecture autopsy implementation pass extracted sidebar route selection into `NavigationSidebar`. Active feature flags continue to govern behavioral and workflow integrations.

| Flag                                  | Env Variable                                      | Disable with | Rollback Effect                                                             | Data Caveat                 | Status |
| ------------------------------------- | ------------------------------------------------- | ------------ | --------------------------------------------------------------------------- | --------------------------- | ------ |
| `admin_v2_structured_logging`         | `NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING`      | `=false`     | Structured logging disabled; falls back to `console.log`.                   | No data state.              | Active |
| `admin_ff_license_verification_queue` | `NEXT_PUBLIC_ADMIN_FF_LICENSE_VERIFICATION_QUEUE` | `=false`     | Licenses tab hidden from verification queue; verifyLicense action disabled. | No irreversible data state. | Active |

---

## Irreversible State Tracking

If a flag phase creates an irreversible data or schema state (e.g., a migration that transforms existing records), document it here with the phase number and the exact state that cannot be rolled back.

### License Verification Flow (`admin_ff_license_verification_queue`)

- **License Expiry Transitions**: The daily `license-expiry` background job transitions `VERIFIED` past-due licenses to `EXPIRED` status in the database and records a `SYSTEM` actor audit log. If the license verification queue feature is subsequently disabled or rolled back, these transitioned records remain in the `EXPIRED` state. They cannot be automatically restored to `VERIFIED` and require manual admin re-verification or user resubmission.
- **Published Warning Events**: The `license.expiring_soon` warning events emitted to NATS 30 days prior to expiry are permanent event publications; they cannot be recalled or rolled back from the NATS stream or consumer message histories.

---

## Retirement Checklist

When retiring a flag (v2 is stable and has met the 30-day criteria from ADR-ADMIN-009):

- [x] Remove the flag env variable from all environment configurations (Vercel, `.env.*` templates).
- [x] Delete the v2 shadow route segment directories (`src/app/(dashboard)/<route>-v2/`) and promote canonical routes.
- [x] Remove the flag constant from `AdminFeatureFlag` in `src/lib/config/feature-flags.ts`.
- [x] Remove the env key mapping from `FLAG_ENV_KEYS`.
- [x] Remove the env variable from `adminEnvSchema` in `src/lib/infrastructure/env-schema.ts`.
- [x] Move this table entry to the **Retired Flags** section below.
- [x] Update `ADR-ADMIN-009` Revision History.
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

## Related Documentation

- [`ADR-ADMIN-009`](adr/ADR-ADMIN-009-admin-strangler-fig-and-feature-flag-strategy.md) - Strangler Fig and Feature Flag Strategy
- [`VERIFICATION.md`](VERIFICATION.md) - Verification Commands
