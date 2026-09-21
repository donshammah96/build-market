# System Settings Implementation — Changelog

Changelog for the full SystemSettings model implementation across client, admin, and shared packages.

---

## Summary

Implemented end-to-end SystemSettings integration: shared service with caching, admin schema alignment, public API, middleware enforcement (maintenance mode, signup blocking), withdrawal limits, platform commission utilities, feature flags, and tests.

---

## File Changelog

### `packages/db/lib/system-settings.ts` _(new)_

| Change             | Description                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Added**          | System settings service with in-memory cache (TTL 60s)                                                                                    |
| **Exports**        | `getSystemSettings()`, `getPublicSettings()`, `getFinancialSettings()`, `isFeatureEnabled()`, `computePlatformFee()`, `invalidateCache()` |
| **Types**          | `PublicSettings`, `FinancialSettings`, `FeatureFlags`                                                                                     |
| **Implementation** | Fetches from `prisma.systemSettings.findUnique`; returns defaults when no row                                                             |

---

### `packages/db/package.json`

| Change    | Description                                              |
| --------- | -------------------------------------------------------- |
| **Added** | Export `"./system-settings": "./lib/system-settings.ts"` |

---

### `apps/admin/src/actions/admin/types.ts`

| Change      | Description                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| **Changed** | `commissionRate` -> `platformCommission`, `autoVerifyNCA` -> `enableAutoVerifyNCA` in `SystemSettingsSchema` |

---

### `apps/admin/src/actions/admin/settings.ts`

| Change      | Description                                                                            |
| ----------- | -------------------------------------------------------------------------------------- |
| **Added**   | Import `invalidateCache` from `@build/db/system-settings`                              |
| **Changed** | Use `platformCommission`, `enableAutoVerifyNCA`; call `invalidateCache()` after update |
| **Changed** | `SystemSettings` type and `DEFAULT_SETTINGS` to match Prisma schema                    |

---

### `apps/admin/src/app/(dashboard)/settings/settings-client.tsx`

| Change      | Description                                                            |
| ----------- | ---------------------------------------------------------------------- |
| **Changed** | `SettingsProps` and state: `platformCommission`, `enableAutoVerifyNCA` |
| **Changed** | Switch bindings and input handlers for new field names                 |

---

### `apps/admin/src/app/(dashboard)/settings/page.tsx`

| Change      | Description                                                             |
| ----------- | ----------------------------------------------------------------------- |
| **Changed** | `initialSettings` defaults: `platformCommission`, `enableAutoVerifyNCA` |

---

### `apps/client/app/api/settings/public/route.ts` _(new)_

| Change         | Description                                                         |
| -------------- | ------------------------------------------------------------------- |
| **Added**      | `GET /api/settings/public` — no auth, returns `getPublicSettings()` |
| **Headers**    | `Cache-Control: public, s-maxage=60, stale-while-revalidate=120`    |
| **Rate limit** | 100/min per IP                                                      |

---

### `apps/client/app/api/internal/system-settings/route.ts` _(new)_

| Change      | Description                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------- |
| **Added**   | `GET /api/internal/system-settings` — protected by `x-internal-secret`                       |
| **Returns** | `{ maintenanceMode, maintenanceMessage, publicSignup, allowProfessionalSignup, allowedIPs }` |
| **Used by** | Middleware for maintenance and signup checks                                                 |

---

### `apps/client/app/maintenance/page.tsx` _(new)_

| Change    | Description                                              |
| --------- | -------------------------------------------------------- |
| **Added** | Maintenance page shown when `maintenanceMode` is enabled |

---

### `apps/client/middleware.ts`

| Change    | Description                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------- |
| **Added** | `getSystemSettingsForMiddleware()` — fetches internal API, 60s cache                                |
| **Added** | Maintenance mode check: redirect to `/maintenance` if enabled (admins and `allowedIPs` bypass)      |
| **Added** | Signup blocking: redirect if `publicSignup` false or `allowProfessionalSignup` false on pro sign-up |
| **Added** | `isSignUpRoute`, `isSettingsExemptRoute` matchers                                                   |

---

### `apps/client/lib/services/finance.ts`

| Change    | Description                                                                       |
| --------- | --------------------------------------------------------------------------------- |
| **Added** | Import `getFinancialSettings` from `@build/db/system-settings`                    |
| **Added** | Withdrawal validation: `amount >= minWithdrawalKes`, `amount <= maxWithdrawalKes` |
| **Added** | Error types: `below_minimum`, `above_maximum`                                     |

---

### `apps/client/app/api/professional-portal/finance/withdraw/route.ts`

| Change    | Description                                                                      |
| --------- | -------------------------------------------------------------------------------- |
| **Added** | Handle `below_minimum`, `above_maximum` errors with 400 and descriptive messages |

---

### `apps/client/app/api/professional-portal/projects/[id]/escrow/README.md`

| Change    | Description                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| **Added** | Section "Platform Commission and Fees" — use `computePlatformFee`, `getFinancialSettings` when creating escrow |

---

### `apps/client/hooks/useFeatureFlag.ts` _(new)_

| Change    | Description                            |
| --------- | -------------------------------------- | ---------------------------------------------------------------- |
| **Added** | `useFeatureFlag(flag: string): boolean | undefined`— fetches`/api/settings/public`, supports nested flags |

---

### `apps/client/lib/services/feature-flags.ts` _(new)_

| Change    | Description                                                                         |
| --------- | ----------------------------------------------------------------------------------- |
| **Added** | `isFeatureEnabled(flag: string): Promise<boolean>` — server-side feature flag check |

---

### `apps/client/lib/settings-client.ts` _(new)_

| Change    | Description                                                          |
| --------- | -------------------------------------------------------------------- |
| **Added** | `settingsClient.getPublic()` — client-side fetch for public settings |

---

### `apps/client/components/layout/NavBar.tsx`

| Change    | Description                                                     |
| --------- | --------------------------------------------------------------- |
| **Added** | `useFeatureFlag("enableIdeaBooks")` — gates Idea Books nav item |
| **Added** | `visibleNavItems` filtered by feature flag                      |

---

### `apps/client/lib/links.ts`

| Change    | Description                                                      |
| --------- | ---------------------------------------------------------------- |
| **Added** | `API_ROUTES.settingsPublic`, `API_ROUTES.internalSystemSettings` |

---

### `apps/client/__tests__/api/settings/public.route.test.ts` _(new)_

| Change    | Description                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- |
| **Added** | Tests: 200 with expected shape, no auth required, Cache-Control header, 429 when rate limited |

---

### `apps/client/__tests__/lib/services/finance-withdrawal-limits.test.ts` _(new)_

| Change    | Description                                                                             |
| --------- | --------------------------------------------------------------------------------------- |
| **Added** | Tests: reject below min, reject above max, accept within range, accept at exact min/max |

---

### `apps/client/__tests__/lib/services/system-settings.test.ts` _(new)_

| Change    | Description                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------ |
| **Added** | Tests: getPublicSettings defaults, excludes secrets, getFinancialSettings defaults, computePlatformFee |
| **Note**  | Requires prisma mock; may need integration test setup for full coverage                                |

---

## API Surface

### `GET /api/settings/public`

- **Auth**: None
- **Response**: `PublicSettings` (maintenanceMode, maintenanceMessage, allowedIPs, publicSignup, allowProfessionalSignup, featureFlags, supportEmail, supportPhone, whatsappNumber)

### `GET /api/internal/system-settings`

- **Auth**: `x-internal-secret` header
- **Response**: `{ maintenanceMode, maintenanceMessage, publicSignup, allowProfessionalSignup, allowedIPs }`

---

## Environment Variables

- `INTERNAL_API_SECRET` — Required for middleware to fetch internal system-settings (same as user-status)

---

## Migration Notes

- Admin settings page: re-save settings once to migrate from `commissionRate`/`autoVerifyNCA` to `platformCommission`/`enableAutoVerifyNCA`
- Ensure `SystemSettings` row exists (seed creates `id: 'global'`)
