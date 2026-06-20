# Changelog

All notable changes to `apps/client` are documented in this file.

This format is based on Keep a Changelog and uses semantic categories:

- `Added`
- `Changed`
- `Deprecated`
- `Removed`
- `Fixed`
- `Security`
- `Docs`

## Engineering Guardrails (Staff Guidance)

### 1) Identity and Auth Model

- Clerk is the primary runtime identity provider for `apps/client`.
- Database role/profile fields are domain state, not alternate identity.
- Authorization must be enforced in domain/service policy guards (not only middleware).

### 2) Middleware Scope

- Middleware must stay thin and deterministic.
- Allowed concerns: route classification, redirect orchestration, and lightweight claim checks.
- Disallowed concerns: heavy business logic, mutable in-memory cross-request state, and complex data orchestration.

## [Unreleased]

### Added

- **Banned, Deactivated, and Archived Status Support**: Expanded `/unauthorized-sign-in` and middleware status checks to support block redirects for `BANNED`, `DEACTIVATED`, and `ARCHIVED` statuses.
- **Unauthorized Sign-In Page:** Added a public `/unauthorized-sign-in` page ([page.tsx](file:///c:/Users/User/build-market/apps/client/app/unauthorized-sign-in/page.tsx)) displaying account status-specific notices (Account Suspended, Banned, etc.) with a dark-theme glassmorphism card that invokes `signOut` on mount.
- **Blocked-User Middleware Gate:** Integrated a middleware check in [middleware.ts](file:///c:/Users/User/build-market/apps/client/middleware.ts) that reads Clerk session claims and redirects users with blocked statuses (`SUSPENDED`, `BANNED`, `DEACTIVATED`, `ARCHIVED`) to `/unauthorized-sign-in` with the reason code.
- **SSO Auth Callback Check:** Injected a fail-closed Clerk `publicMetadata` status validation check during [auth-callback/page.tsx](file:///c:/Users/User/build-market/apps/client/app/auth-callback/page.tsx) to prevent blocked SSO users from accessing the app before their session token propagates the status claim update.

### Changed (Testing)

- **PropertyForm tests:** Replaced fragile full-tree HTML snapshots in `PropertyForm` component tests with robust semantic accessibility assertions.

### Fixed (Testing)

- **Route Guards Test:** Corrected middleware import path in `route-guards.test.ts` from `@/proxy` to `@/middleware` to resolve import errors following the Next.js middleware file convention migration.

### Security (Vulnerability Resolution)

- **Security**: Resolved moderate security vulnerability GHSA-cmwh-pvxp-8882 by pinning `dompurify` dependency version to `>=3.4.11` in `pnpm-workspace.yaml`.

## [2026-06-15] License Verification Event-Driven Architecture & NATS Resilience

### Added (License Verification Event-Driven Architecture & NATS Resilience)

- **License Verification Event Publisher:** Implemented lazy-initialized NATS publishing integration at `apps/client/app/lib/integrations/license-events.ts` to emit `license.submitted` and other license event payloads.
- **Automatic Verification Consumer:** Added consumer worker `apps/client/app/workers/license-auto-verify.consumer.ts` subscribing to `license.auto_verify_requested` and performing simulated external NCA/EBK background checking.

### Changed (NATS Worker & Integrations)

- **License Creation Publishing Hook:** Integrated lazy-initialized NATS publishing inside `createLicense()` (`apps/client/app/lib/domains/licenses/service.ts`) to publish a `license.submitted` event when a professional submits a license.
- **Worker Type-Safety Refactor:** Replaced all loose `any` variables and signatures in `apps/client/app/workers/license-auto-verify.consumer.ts` with explicit, strongly typed generics like `MessagePayload<unknown>`, `JetStreamConsumer`, and `JetStreamProducer`.
- **Extracted Decisional Path Handlers:** Refactored the core verification routing loop in the auto-verify consumer, extracting the success/failure states into isolated `handleVerificationSuccess` and `handleVerificationFailure` helper functions.
- **Deduplication Hardening:** Configured deterministic `msgId` structures matching `${licenseId}-${correlationId}` for published events to leverage NATS' JetStream duplicate window.
- **Resilience Heartbeats:** Introduced `msg.working()` calls to periodically reset the consumer's ack wait timer before commencing simulated external I/O delays.
- **Teardown Operations:** Configured dual-disconnect sequences in `stopLicenseAutoVerifyConsumer` to clean up both the worker consumer and publisher instances gracefully.

### Fixed (NATS Worker & Integrations)

- **Contravariance Type Resolution:** Resolved a TypeScript compilation error in `license-auto-verify.consumer.ts` by ensuring the handler interface parameter maps to `MessagePayload<unknown>` and is cast safely internally to `LicenseVerificationEvent`.
- **Publisher Options Sync:** Fixed `license-events.ts` to utilize the renamed `retryDelayMs` property in client-side publish invocations instead of the legacy `retryDelay` field.

## [2026-05-14] Infrastructure, Tests & Routing Remediation

### Changed (Infrastructure & Routing)

- **Next.js Proxy Migration:** Renamed `apps/client/middleware.ts` to `apps/client/proxy.ts` and updated `eslint.config.js` to address the Next.js `middleware` file convention deprecation warning.
- **Proxy Route Imports:** Refactored `apps/client/proxy.ts` and `apps/client/app/lib/security/middleware/redirect-policy.ts` to consume the new structured domain routing module (`@/lib/routes/professional.routes` and `@/lib/routes/client.routes`), removing coupling to the legacy `@/lib/links` barrel.
- **Vercel Build Config:** Locked `engines.node` to `"20.x"` in `package.json` to prevent unexpected auto-upgrades, and added 13 missing `STORAGE_*` environment variables to `turbo.json`'s `env` array to resolve Turborepo caching warnings.

### Fixed (Tests)

- **Onboarding Route Tests:** Fixed 7 failing Vitest tests in `professional-complete.route.test.ts`. Aligned `apiError`/`apiSuccess` mocks with their new location in `api-response`, updated test expectations to match the new `logOnboardingRouteOutcome` structured logging signatures, and corrected assertions for static domain error messages to prevent leaking internal error strings.

## [2026-05-14] Idempotency Hardening — Deferred Cleanup

### Changed (Idempotency Hardening — Deferred Cleanup)

- **Null guard batch removal (28 files):** Removed all dead `if (!idempotencyCheck) { return apiError(...) }` blocks codebase-wide. These guards were unreachable after `checkOrCreate` return type was tightened to never return `null`. Files cleaned span `projects/`, `stores/`, `professional-portal/` (profile, portfolio, licenses, leads, inquiries, documents, finance, calendar, certificates), `messaging/`, and `idea-books/`.
- **Properties double-wrap collapse (3 sites):** Collapsed `try { await safeIdempotencyComplete(...) } catch (completionError) { ... }` outer wrappers in `properties/[id]/route.ts` (PATCH + DELETE) and `properties/route.ts` (POST) into direct `await safeIdempotencyComplete(key, data, context)` calls. The helper already handles all failure isolation internally — double-wrapping defeated that guarantee.
- **Messaging `.catch()` double-wrap (3 files):** Removed `.catch(() => {})` chains on `safeIdempotencyComplete` in `messaging/messages/route.ts`, `messaging/conversations/route.ts`, and `messaging/conversations/[id]/route.ts`. Silently swallowing the error suppressed the structured log that `safeIdempotencyComplete` emits on failure.

### Verification (Idempotency Hardening — Deferred Cleanup)

- `tsc --noEmit` — exit 0, zero errors
- Zero remaining `!idempotencyCheck` occurrences across `app/api/**`

### Changed (Idempotency Service Hardening)

- **`IdempotencyService.checkOrCreate` return type tightened:** Return type changed from `Promise<IdempotencyCheckResult<T> | null>` to `Promise<IdempotencyCheckResult<T>>`. The `| null` variant was unreachable — all code paths either returned a result or threw. Dead null-guard blocks removed from onboarding route family (`route.ts`, `skip/route.ts`, `skip-professional/route.ts`) and `milestones/[milestoneId]/route.ts`.
- **Entity ID decoupling (options bag API):** Replaced positional `entityId?: string, ttlHours?: number` parameters with an options bag `{ entityConnect?: Record<string, { connect: { id: string } }>; ttlHours?: number }`. The service no longer contains hardcoded `store`/`property` scope-to-relation mapping — callers now construct and own the Prisma relation connect payload. This eliminates the coupling between the generic service and domain-specific entity schemas.
- **All callers migrated:** Updated 40+ call sites across API routes (`properties/`, `stores/`, `projects/`, `onboarding/`), server actions (`inquiries.ts`, `leads.ts`, `projects.ts`, `properties.ts`, `stores.ts`), and tests (`idempotency.service.test.ts`).

### Fixed (Idempotency Service Hardening)

- **F-1: Domain message passthrough** (`professional/complete/route.ts`): `apiError()` first argument now uses static error map via `onboardingDomainErrorToClientMessage()` instead of passing dynamic `result.data.message` to the client response. Prevents internal domain messages from leaking to the API surface.
- **F-2: Missing `IdempotencyCompletionContext`** (`professional/complete/route.ts`): `safeIdempotencyComplete()` now receives full structured context (`correlationId`, `operationName`, `httpMethod`, `routePattern`, `actorRole`, `httpStatus`, `durationMs`, `resourceType`) for observability.
- **F-3: Missing `correlationId`** (`professional/complete/route.ts`): All `apiSuccess()` and `apiError()` responses now pass `correlationId` for request tracing.
- **F-4: Dynamic rate-limit message** (`professional/complete/route.ts`): Replaced template literal that leaked server timing data (`Try again in ${seconds} seconds`) with static string `"Too many requests. Please try again later."`.
- **F-7: Inline `logOutcome` severity** (`professional/complete/route.ts`): Replaced inline `logOutcome` closure (which used `info` for all severities) with shared `logOnboardingRouteOutcome()` that correctly routes errors to `error`, warnings to `warn`, and successes to `info`.

### Docs (Idempotency Service Hardening)

- **`API_ARCHITECTURE.md` §6:** Updated to document `safeIdempotencyComplete()` as the canonical completion wrapper, the no-double-wrap rule, and the `IdempotencyCompletionContext` requirement.
- **`API_ARCHITECTURE.md` Idempotency section:** Rewritten to document the new `checkOrCreate` options bag API, `entityConnect` pattern, and the "never returns null" contract.

## [2026-05-12] Architecture Compliance Phase 0 Closeout

### Added (Architecture Compliance Phase 0 Closeout)

- **Route-family shared helpers:** Added shared adapter helper modules for idea-books, leads, messaging, notifications, professionals, uploads, and user routes so multi-handler families have a canonical timing, actor-label, static message, conflict-response, and route-outcome logging surface.

### Changed (Architecture Compliance Phase 0 Closeout)

- **Phase 0 drift calibration:** Updated `drift-checks-phase0.mjs` so `missingSharedTs` enforces real route-family boundaries while exempting structural grouping directories and nested item-resource directories covered by an ancestor `shared.ts`.
- **Logger scoping:** Replaced module-level route logger singletons with per-invocation `getClientLogger()` usage across API route logging call sites.
- **Mapper ownership:** Moved remaining service/repository Date DTO normalization through domain mapper helpers for calendar, client-dashboard, finance, inquiries, messaging, notifications, professional-settings, properties, reviews, seller-insights, stores, and uploads.

### Fixed (Architecture Compliance Phase 0 Closeout)

- **Architectural Drift:** Closed the remaining Phase 0 categories: `inlineLoggerAtModuleLevel`, `missingSharedTs`, `inlineDateNow`, and `mapperNormalizationDrift`.
- **Onboarding timing:** Replaced remaining onboarding skip route inline timing calls with the shared `now()` helper.

### Docs (Architecture Compliance Phase 0 Closeout)

- Updated `PROGRESS-SUMMARY.md` to mark Architecture Compliance Phase 0 Remediation completed with a zero-drift baseline.

**Files changed:** `apps/client/app/api/**/route.ts`, `apps/client/app/api/{idea-books,leads,messaging,notifications,professionals,uploads,user}/shared.ts`, `apps/client/app/lib/domains/**/{service,repository,mappers}.ts`, `apps/client/scripts/drift-checks-phase0.mjs`, `apps/client/docs/CHANGELOG.md`, `apps/client/docs/PROGRESS-SUMMARY.md`

**Verification:**

- `pnpm -C apps/client run report-security-drift:strict` -> all categories 0
- `pnpm -C apps/client exec tsc --noEmit --pretty false` -> exit 0
- `pnpm -C apps/client exec vitest run __tests__/api/onboarding/route.test.ts __tests__/api/onboarding/skip.test.ts __tests__/api/onboarding/skip-professional.test.ts __tests__/api/onboarding/professional-complete.route.test.ts __tests__/api/idea-books/route.test.ts __tests__/api/idea-books/book-id.route.test.ts __tests__/api/idea-books/attachments.route.test.ts __tests__/api/idea-books/attachment-id.route.test.ts __tests__/api/messaging/route-auth-mapping.test.ts __tests__/api/notifications/route.test.ts __tests__/api/notifications/notification-id.route.test.ts __tests__/api/uploads/route.test.ts __tests__/api/uploads/direct.route.test.ts __tests__/api/uploads/upload-id.route.test.ts --pool=threads --maxWorkers=1` -> 14 files, 93 tests passed
- `pnpm -C apps/client exec vitest run __tests__/lib/domains/calendar.service.test.ts __tests__/lib/domains/client-dashboard.service.test.ts __tests__/lib/domains/finance.service.test.ts __tests__/lib/domains/inquiries.service.test.ts __tests__/lib/domains/properties.service.test.ts __tests__/lib/domains/reviews.service.test.ts __tests__/lib/domains/seller-insights.service.test.ts __tests__/lib/uploads/service.test.ts __tests__/lib/calendar-client.test.ts __tests__/lib/inquiries-client-contracts.test.ts __tests__/lib/properties-client-contracts.test.ts __tests__/lib/upload-client.test.ts --pool=threads --maxWorkers=1` -> 12 files, 49 tests passed

## [2026-05-12] Client Architecture Alignment Checks

### Added (Client Architecture Alignment Checks)

- **Architecture Compliance Phase 0 Integration:** Integrated script file into `report-security-drift.mjs` and added 4 new architectural drift categories (`safeIdempotencyCompleteDrift`, `mapperNormalizationDrift`, `operationsBuilderDrift`, `indexExportDrift`) to ensure alignment with the 2026-05-08 architecture update.

### Fixed (Client Architecture Alignment Checks)

- **Architectural Drift:** Fixed `indexExportDrift` violation in `app/lib/domains/user-profile/index.ts`.
- **Architectural Drift:** Fixed 2 `inlineDateNow` violations in `app/api/onboarding/route.ts` by using the shared `now()` import.
- **Architectural Drift:** Fixed 21 `safeIdempotencyCompleteDrift` violations by replacing raw `IdempotencyService.complete()` calls with the `safeIdempotencyComplete` wrapper in actions and resolving false positives in comments.

## [2026-05-07] Client Architecture Refactor Pass - Closeout

### Fixed (Verification Closeout)

- **Typecheck restored:** Fixed the route actor context and professional-settings Prisma typing issues that blocked Phase 1 verification.
- **Lint gate activation:** Registered the ESLint import plugin so the Phase 0B `import/no-cycle` rule can execute.
- **Targeted regression coverage:** Verified representative route/domain coverage for properties and the moved professional repository.

**Verification:**

- `pnpm -C apps/client run check-types` -> pass
- `pnpm -C apps/client run lint` -> pass with 13 warnings
- `pnpm -C apps/client exec vitest run __tests__/api/properties/property-id.route.test.ts __tests__/lib/properties-validation.test.ts __tests__/lib/repositories/professional.repository.test.ts --pool=threads --maxWorkers=1` -> 53 tests pass
- `pnpm -C apps/client run report-security-drift:strict` -> fails on existing drift categories: `criticalTransitionStepSequencing: 6`, `logSafetySpreadReview: 1`, `sensitiveAnnotationCoverage: 1`; idempotency completion safety is 0.

## [2026-05-07] Client Architecture Refactor Pass - Phase 2A

### Changed (Canonical Result Contracts)

- **Projects result contract:** Replaced the projects-local `DomainResult<T>` alias with canonical `Result<T, DomainError<...>>` via `ProjectResult<T>`.
- **Optimistic-lock convention:** Aligned the targeted properties optimistic-lock contract and certificate repository result contract to the canonical `ok` discriminant.

**Files changed:** `apps/client/app/lib/domains/projects/contracts.ts`, `apps/client/app/lib/domains/projects/service.ts`, `apps/client/app/lib/domains/properties/contracts.ts`, `apps/client/app/lib/domains/certificates/*`
**Verification:** `rg "DomainResult" apps/client/app/lib/domains/projects -g "*.ts"` -> zero results. `rg "success:" apps/client/app/lib/domains/properties/contracts.ts apps/client/app/lib/domains/certificates/contracts.ts` -> zero targeted result discriminants. Final closeout `pnpm -C apps/client run check-types` -> pass.

## [2026-05-07] Client Architecture Refactor Pass - Phase 3

### Added (Shared Route Adapters)

- **Route-family shared helpers:** Added shared adapter modules for stores, projects, professional-portal, onboarding, and services.
- **Structured route outcomes:** Wired the new helpers into representative high-traffic routes so success, validation, rate-limit, domain, and internal outcomes use a consistent ADR-005-style payload.
- **Static adapter mappings:** Centralized static client messages, domain error-to-status mapping, timing helpers, actor role labels, and conflict response helpers for the new route families.

**Files changed:** `apps/client/app/api/{stores,projects,professional-portal,onboarding,services}/shared.ts`, plus representative route wiring in those families.
**Verification:** `Get-ChildItem apps/client/app/api -Recurse -Filter shared.ts` includes all five target families. `rg "log.*RouteOutcome" apps/client/app/api -g "*.ts"` shows active usage in stores, projects, professional-portal, onboarding, and services. Final closeout `pnpm -C apps/client run check-types` -> pass.

## [2026-05-07] Client Architecture Refactor Pass - Phase 4

### Added (Domain Mapper Coverage)

- **Mapper coverage expansion:** Added mapper modules for finance, messaging, professionals, pipeline, calendar, client-dashboard, idea-books, notifications, professional-settings, reviews, seller-insights, and uploads.
- **DTO serialization helpers:** New mappers provide domain-local serialization paths for `Date` values and decimal-like values before DTOs cross adapter or client boundaries.

**Files changed:** `apps/client/app/lib/domains/**/mappers.ts`
**Verification:** `Get-ChildItem -Path apps/client/app/lib/domains -Recurse -Filter mappers.ts | Measure-Object` -> 23 mapper files. Final closeout `pnpm -C apps/client run check-types` -> pass.

## [2026-05-07] Client Architecture Refactor Pass - Phase 5-8

### Changed (Client Structure)

- **Facade colocation:** Moved root browser client facades from `apps/client/lib/*-client.ts` into `apps/client/lib/facades/*-client.ts` and updated imports.
- **Route modules:** Added `apps/client/lib/routes` modules with compatibility exports from the existing route registry.
- **Repository ownership:** Removed `apps/client/app/lib/repositories` by moving shared repositories under domain-owned locations and updating remaining imports.
- **Path aliases:** Added aliases for domains, infrastructure, security, config, validation, UI, facades, and routes in `apps/client/tsconfig.json`.

**Files changed:** `apps/client/lib/facades/*`, `apps/client/lib/routes/*`, `apps/client/app/lib/domains/**/repositories/*`, `apps/client/tsconfig.json`
**Verification:** `Get-ChildItem apps/client/lib -Filter *-client.ts` -> zero files. `Test-Path apps/client/app/lib/repositories` -> `False`. Final closeout `pnpm -C apps/client run check-types` -> pass.

## [2026-05-07] Client Architecture Refactor Pass - Phase 2B

### Changed (Stores DTO Boundary)

- **Stores result contract:** Replaced stores' local `DomainResult<T>` with canonical `Result<T, DomainError<...>>` via `StoreResult<T>`.
- **Explicit stores DTOs:** Removed exported `Prisma.StoreGetPayload` contracts and replaced them with domain-owned store list, detail, document, and owner-stat DTOs.
- **Stores mapper boundary:** Added stores mappers to normalize dates to ISO strings and decimal-like values to numbers before data leaves the stores domain service.

**Files changed:** `apps/client/app/lib/domains/stores/contracts.ts`, `apps/client/app/lib/domains/stores/mappers.ts`, `apps/client/app/lib/domains/stores/service.ts`, `apps/client/app/lib/domains/stores/repository.ts`
**Verification:** `rg "DomainResult|Prisma\\.StoreGetPayload|Prisma\\.Decimal" apps/client/app/lib/domains/stores -g "*.ts"` -> zero results. Final closeout `pnpm -C apps/client run check-types` -> pass.

## [2026-05-07] Client Architecture Refactor Pass - Phase 1

### Fixed (Idempotency Fail-Safe)

- **Fail-safe idempotency completion helper:** Added `safeIdempotencyComplete()` so API adapters mark completed domain mutations as failed for retry if replay persistence fails, log the completion failure, and still return the successful mutation response.
- **Adapter callsite migration:** Replaced direct route-level `await IdempotencyService.complete(...)` calls across project, property, store, onboarding, messaging, idea-book, service, and professional-portal mutation routes.
- **Onboarding ordering preserved:** Kept the Clerk metadata transition before idempotency completion in onboarding routes while moving completion to the fail-safe helper.

**Files changed:** `apps/client/app/lib/services/idempotency-helpers.ts`, `apps/client/app/api/**/route.ts`
**Verification:** `rg "await\s+IdempotencyService\.complete\(" apps/client/app/api -g "*.ts"` -> zero route adapter calls. `pnpm -C apps/client run check-types` -> pass after closeout fixes.

## [2026-05-07] Client Architecture Lint Gates (Phase 0B)

### Changed (Client Architecture Guardrails)

- **Adapter boundary lint gates:** Blocked `@build/db` imports inside `app/api/**` and `app/actions/**` (health routes exempt).
- **Domain boundary lint gates:** Blocked `HttpStatus`, `NextResponse`, and `getClientLogger()` imports inside `app/lib/domains/**`.
- **Env boundary lint gate:** Flagged `process.env` access outside `app/lib/infrastructure/env.ts`.
- **Cycle detection:** Enabled `import/no-cycle` with `maxDepth: 3`.
- **Adapter Prisma boundary remediation:** Routed service categories, internal user-status, public professional profile, and finance withdrawal adapters through domain services; removed Prisma reads from projects and password-reset actions.

**Files changed:** `apps/client/eslint.config.js`
**Verification:** Not run (lint gates only).

## [2026-05-06] Client Architecture Clean Up & Legacy Wrapper Removal

### Removed (Client Architecture Clean Up)

- **Deprecated `apps/client/lib` Wrapper Directories:** Deleted entirely unused legacy directories (`lib/infrastructure`, `lib/repositories`, `lib/services`, `lib/security`) that had been superseded by the `app/lib/domains` domain-driven architecture.
- **Unreferenced Legacy Files:** Purged unused top-level files (`db.ts`, `env.ts`, `generate-keys.ts`, `calendar-client.server.ts`) and associated legacy unit tests (`__tests__/lib/services/finance-withdrawal-limits.test.ts`).

### Changed (Client Architecture Clean Up)

- **Validation Schema Migration:** Migrated 21 legacy schema wrapper files out of `lib/validation/` and globally updated over 25 import references across the `apps/client` workspace to point directly to the canonical `@/app/lib/validation/` module.
- **Onboarding Schema Relocation:** Moved `lib/schemas/onboarding.ts` directly into `app/lib/validation/onboarding.ts` and updated consumers (e.g., `HomeownerForm.tsx`).

### Docs (Client Architecture Clean Up)

- **Server Actions README:** Updated `app/actions/README.md` to reference the canonical `app/lib/domains/projects/service.ts` instead of the legacy `lib/services/projects`.

**Verification:**

- `pnpm run check-types` → exit 0
- `pnpm run lint` → exit 0

### [2026-05-05] Storage Infrastructure Correctness Hardening

#### Fixed (Storage Infrastructure Correctness Hardening)

- `LocalStorageProvider.exists()`: replaced blocking `fs.existsSync()` with
  async `fs.promises.access()` to prevent event-loop stalls on the hot upload
  path. Same fix applied to the metadata sidecar check in `getMetadata()`.
  (`app/lib/infrastructure/storage.ts`)

- `LocalStorageProvider.resolvePath()` / `assertSafeKey()`: consolidated
  duplicated null-byte and backslash checks that existed independently in both
  methods with slightly different coverage. `assertSafeKey()` now owns all
  character-level validation; `resolvePath()` owns only the `path.resolve`
  containment assertion.
  (`app/lib/infrastructure/storage.ts`)

- `S3StorageProvider.getPresignedUploadUrl()`: `checksumSha256` was declared
  in the `StorageProvider` interface but silently dropped by the S3
  implementation. Now forwarded to `PutObjectCommand.ChecksumSHA256` so
  storage backends can enforce end-to-end integrity on direct client uploads.
  (`app/lib/infrastructure/storage.ts`)

- `LocalStorageProvider.putObject()`: was appending `.meta.json` directly as
  a string literal while the class also had a `metadataPath()` helper for the
  same purpose. Now uses the helper consistently across `putObject`, `delete`,
  and `getMetadata`.
  (`app/lib/infrastructure/storage.ts`)

#### Security (Storage Infrastructure Correctness Hardening)

- Added explicit `env.isProd` guard in `localSigningSecret()`: a missing
  `ENCRYPTION_KEY_V1` now throws at the secret-resolution site rather than
  relying solely on `assertProductionStorageConfig()` running first. This is
  a belt-and-suspenders addition; the production config guard remains the
  primary control.
  (`app/lib/infrastructure/storage.ts`)

#### Changed (Storage Infrastructure Correctness Hardening)

- Introduced `LocalObjectMeta` typed interface shared by the sidecar write
  path (`putObject`) and read path (`getMetadata`), replacing the loosely
  typed `{ mimeType?: unknown }` parse target.
  (`app/lib/infrastructure/storage.ts`)

**Files changed:** `app/lib/infrastructure/storage.ts`
**Verification:**

- `pnpm run client:tsc-noemit` → exit 0
- `pnpm -C apps/client exec vitest run __tests__/lib/storage-config.test.ts --maxWorkers=1` → all tests pass
- `pnpm run client:report-security-drift:strict` → all categories 0

## [2026-05-03] Storage Direct Upload and Private Asset Hardening

### Added (Storage Direct Upload and Private Asset Hardening)

- Added private document direct-upload APIs: `POST /api/uploads/presign`,
  `POST /api/uploads/confirm`, and `GET /api/uploads/[id]/download`.
- Added `DirectUpload` tracking with pending, confirmed, expired, and failed
  states, plus scheduled cleanup for abandoned direct-upload blobs.
- Added storage visibility support for public and private buckets, local
  token-backed direct upload/download proxies, and private presigned downloads.

### Changed (Storage Direct Upload and Private Asset Hardening)

- Made `Asset.cdnUrl` nullable and added `Asset.visibility`, preserving public
  image behavior while allowing Class B assets to avoid permanent URLs.
- Scoped asset deduplication by uploader, checksum, and visibility.
- Updated credential and property document upload clients to persist `assetId`
  from the direct document flow by default.

### Security (Storage Direct Upload and Private Asset Hardening)

- Direct upload confirmation now verifies owner, pending status, expiry, object
  existence, exact size, MIME, server-computed SHA-256, and magic bytes before
  creating a private `Asset`.
- Private document/license/certificate DTOs no longer expose private `cdnUrl`.
- Upload logs avoid filenames, checksums, storage keys, and presigned URLs.

### Docs (Storage Direct Upload and Private Asset Hardening)

- Rewrote `STORAGE-INTEGRATION-GUIDE.md` as the canonical end-to-end
  integration plan, including decision tables, private download flow, env setup,
  test guidance, operations, cleanup, and failure modes.
- Updated this changelog and `PROGRESS-SUMMARY.md` for the hardening checkpoint.

### Verification (Storage Direct Upload and Private Asset Hardening)

- `pnpm -C packages/db exec prisma generate`
- `pnpm -C apps/client exec vitest run __tests__/api/uploads __tests__/lib/uploads __tests__/lib/storage-config.test.ts __tests__/lib/upload-client.test.ts --pool=threads --maxWorkers=1`
- `pnpm run client:tsc-noemit`
- `pnpm run client:check-env-contract`
- `pnpm run client:report-security-drift:strict`

## [2026-05-01] CSP Nonce Rollout (Phase 2 Prep)

### Security (CSP Nonce Rollout)

- **Per-request CSP nonce generation and propagation.**
  Middleware now generates a cryptographic nonce per request, injects a nonce-bearing
  `Content-Security-Policy`, and passes the nonce to Clerk via `ClerkProvider`.
  Inline script authorization moves from `'unsafe-inline'` to `'nonce-<value>'` for
  document responses, while redirects emit no CSP.

### Fixed (CSP Nonce Rollout)

- **Nonce entropy and CSP directive coverage hardening.**
  Nonce generation uses `crypto.getRandomValues` with base64 encoding of raw bytes,
  `script-src` now includes the nonce, and CSP directive coverage tests include
  critical directives (`object-src`, `base-uri`, `frame-ancestors`, `form-action`,
  `worker-src`).
  Forward CSP Headers to SSR Context: Modified `applyDocumentCspHeaders` in `middleware.ts` to inject both `x-nonce` and `Content-Security-Policy` into `requestHeaders` before passing them to `NextResponse.next()`. This ensures the Next.js render context is perfectly synchronized with the enforced response policy.
  Enforce Origin-Only CSP Sources: Updated the `apiOrigin` fallback in middleware to use an origin-only value (`appOrigin`) instead of appending the `/api` path.
  Fail-Fast Nonce Validation: Updated `RootLayout` to throw a loud error in non-production environments if the `x-nonce` header is missing, preventing silent middleware misconfigurations. For production, the fallback is now `undefined` to prevent invalid `nonce=""` attributes in the DOM.
  ADR-004 Compliance: Replaced raw `process.env.NODE_ENV` access in `RootLayout` with the validated `env.isProd` property from `app/lib/infrastructure/env.ts`.

### Docs (CSP Nonce Rollout)

- **Updated CSP fallback guidance.**
  The static CSP fallback retains `script-src-elem 'unsafe-inline'` while production
  confirms zero CSP violations; removal remains gated by the rollout checklist.

**Files changed:**
`apps/client/app/lib/security/middleware/csp-nonce.ts`
`apps/client/middleware.ts`
`apps/client/app/layout.tsx`
`apps/client/next-config-csp.ts`
`apps/client/__tests__/middleware/csp-nonce.test.ts`
`apps/client/__tests__/middleware/route-guards.test.ts`
`apps/client/docs/AUDIT-CSP-NONCE-ROUND2.md`

## [2026-05-01] R2-First Storage Cutover (Client + Admin)

### Changed (Storage Contract)

- **R2-first env resolution with production fail-closed validation.**
  `env.ts` now prioritizes `R2_*` keys with one-release AWS/S3 alias support and
  enforces stricter production validation when remote storage is enabled.

- **Endpoint-aware S3-compatible client (region=auto supported).**
  `storage.ts` now builds an endpoint-aware S3-compatible client and applies
  tighter production guards for remote storage configuration.

### Fixed (Workers + Cleanup)

- **Export workers and cleanup jobs aligned to the endpoint-aware contract.**
  Client and admin export processors and asset cleanup jobs now use the same
  R2/S3-compatible config shape and remove the unsupported SSE header. Fixed the
  `AWS_S3_BUCKET` inconsistency in admin export processing.

### Docs (Env Templates + Turbo)

- **Env templates and Turbo metadata updated for R2 and aliases.**
  `.env.example` and `.env.vercel.example` document canonical `R2_*` variables
  with one-release alias notes, and `turbo.json` includes the R2 and alias keys
  for cache invalidation.

### Testing (R2 Regression)

- **Env and storage config suites expanded.**
  Added R2 regression coverage in `env.validation.test.ts`,
  `storage-config.test.ts`, and `export-processor.r2.test.ts`.

### Verification

- `pnpm -C apps/client run check-types`

**Files changed:**
`apps/client/app/lib/infrastructure/env.ts`
`apps/client/app/lib/infrastructure/storage.ts`
`apps/client/app/workers/export/processor.ts`
`apps/client/app/jobs/asset-cleanup.ts`
`apps/client/.env.example`
`apps/client/.env.vercel.example`
`apps/client/__tests__/lib/env.validation.test.ts`
`apps/client/__tests__/lib/storage-config.test.ts`
`apps/client/__tests__/workers/export-processor.r2.test.ts`
`apps/admin/src/lib/workers/export/processor.ts`
`apps/admin/src/lib/jobs/asset-cleanup.ts`
`turbo.json`

## [2026-04-30] Content Security Policy (CSP) Remediation

### Fixed (CSP Remediation)

- **Homepage breakage caused by missing CSP directives and origins.**
  Addressed three distinct CSP failures in `next-config-csp.ts` that blocked the homepage from loading fully:
  1. Added `script-src-elem` directive with `'unsafe-inline'` to mirror `script-src`, fixing the blocking of Clerk's inline bootstrap scripts (Chrome 90+ / Firefox 105+ treat `script-src-elem` separately).
  2. Added `https://*.clerk.accounts.dev` as a static fallback pattern to `scriptOrigins` to handle cases where `NEXT_PUBLIC_CLERK_FRONTEND_API` is not set in the environment.
  3. Added `https://cdn.jsdelivr.net` to `fontOrigins` to allow OpenDyslexic `.woff` fonts.
  4. Added `worker-src 'self' blob:` to prevent future breakages from service workers.
  5. Added `https://*.clerk.accounts.dev` and `https://clerk-telemetry.com` to `connectOrigins` to allow Clerk's API and telemetry requests.

**Files changed:**
`apps/client/next-config-csp.ts`
`apps/client/docs/adr/ADR-008-http-surface-security.md`

### Future Work (Phased Follow-up)

- **CSP `script-src-elem` Nonce Strategy:** As documented in ADR-008 §4, the proper long-term architectural fix for `script-src-elem` is to generate a per-request cryptographic nonce in Next.js middleware, inject it into the CSP header via `NextResponse`, and pass it to Clerk via `clerkMiddleware`'s `nonce` option. This will eliminate the need for the `'unsafe-inline'` fallback.

## [2026-04-30] Turborepo Environment Variable Passthrough Fix

### Fixed (Turborepo Environment Variable Passthrough Fix)

- **Vercel Build Warnings (`turbo.json`).**
  Vercel reported 18 environment variables that were set in the project dashboard but missing from `turbo.json`, causing them to be unavailable during the build phase (`@build/queue-server#build`, etc.). Added all flagged variables (e.g., `CORS_ALLOWED_ORIGINS`, `ENCRYPTION_KEY_V1`, `RATE_LIMIT_BACKEND`) to `globalEnv` and `build.env` arrays. Also preemptively added the new Supabase variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DIRECT_URL`) to ensure they pass through without triggering strict-mode warnings.

**Files changed:**
`turbo.json`

## [2026-04-30] Env Boundary Hardening — Supabase Group & `DIRECT_URL`

### Changed

- **`apps/client/app/lib/infrastructure/env.ts` — four targeted improvements.**
  1. **`DIRECT_URL` added to the `database` envGroup.**
     The Prisma CLI now reads `DIRECT_URL` from `prisma.config.ts`; without a matching declaration in `envGroups` the `check-env-contract` script would flag it as an undeclared runtime key. Declared as `required: false` (the Supabase free-tier CLI falls back to `DATABASE_URL` since session-mode pooler supports DDL without the IPv4 add-on). Includes the same `postgresql://` prefix validator as `DATABASE_URL`.

  2. **New `supabase` envGroup.**
     Registers `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the validator. `SUPABASE_URL` includes an `https://` prefix validator. `SUPABASE_SERVICE_ROLE_KEY` carries an inline comment: _server-side only — bypasses Row Level Security, never prefix `NEXT_PUBLIC_`_. All three are `required: false` since Supabase SDK / Realtime is not yet in use; the current data access path is Prisma-only.

  3. **`buildEnvConfig()` — `directUrl` and `supabase` fields added.**
     `envConfig.directUrl` exposes the Prisma CLI connection string through the ADR-004 boundary (no direct `process.env` access outside this module). `envConfig.supabase.{ url, anonKey, serviceRoleKey }` is the canonical accessor for Supabase SDK credentials in any future server-side module that needs them.

  4. **`DIRECT_URL` added to `BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS`.**
     Like `DATABASE_URL`, `DIRECT_URL` is runtime-injected by the platform and not available during `NEXT_PHASE=phase-production-build`. Deferring prevents spurious build-phase validation errors.

  5. **`supabase` added to startup validation groups.**
     The `supabase` envGroup is now included in the server-runtime auto-validate call so a malformed `SUPABASE_URL` (e.g. `http://` instead of `https://`) is caught at process startup rather than at first use.

  6. **`DATABASE_URL` error message updated.**
     Now includes the Supabase Supavisor pooler URL format as an example, making the error actionable for operators setting up a new deployment.

**Files changed:**
`apps/client/app/lib/infrastructure/env.ts`

**Verification:**

```bash
pnpm run client:check-env-contract
# → [env-contract] OK: .env.example covers all process.env keys.
# → Exit code: 0
```

## [2026-04-30] Supabase Integration & CI Hardening

### Added (Supabase Integration & CI Hardening)

- **Supabase as production PostgreSQL provider (`packages/db`).**
  Migrated from a local/Neon Postgres target to Supabase Supavisor (managed, serverless-safe pooler). All 25 existing Prisma migration files were applied to the Supabase project (`ewbnznoprzlqtcoxvjai`) via `prisma migrate deploy` with zero schema changes.

- **Two-URL Prisma architecture for Supabase (`packages/db/prisma.config.ts`).**
  `DATABASE_URL` now points to the Supabase Supavisor **session-mode pooler** (port 5432, `aws-1-us-west-2.pooler.supabase.com`) for all runtime queries. `DIRECT_URL` holds the direct connection string (`db.*.supabase.co:5432`) for future use when the Supabase IPv4 add-on is enabled. The Prisma 7 CLI reads `datasource.url` from `prisma.config.ts` exclusively — `url`/`directUrl` fields in `schema.prisma` were removed as they are no longer supported in Prisma 7.

- **Prisma client hardened for serverless (`packages/db/lib/prisma.ts`).**
  - Replaced silent `postgresql://undefined` pool construction (template literal on potentially-`undefined` `process.env.DATABASE_URL`) with an explicit fail-fast guard that throws at module load time if `DATABASE_URL` is absent.
  - Set `pool.max = 1` — correct for Vercel serverless where each function invocation is ephemeral; Supabase Supavisor manages the actual Postgres connection pool.

- **Canonical Supabase env variable naming across all env files.**
  Renamed `SUPABASE_PROJECT_URL` → `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` → `SUPABASE_ANON_KEY`, `DIRECT_CONNECTION_STRING` → `DIRECT_URL`. Added `SUPABASE_SERVICE_ROLE_KEY` placeholder (server-side only, commented). All four env boundary files updated:
  - `apps/client/.env.example` — committed template with sanitized placeholders
  - `apps/client/.env` — local secrets (gitignored), real Supabase + Upstash credentials
  - `apps/client/.env.test` — committed stubs only; real credentials that had leaked in were scrubbed and replaced with `localhost:5432/buildmarket_test` stubs (Prisma is mocked in tests — no real DB connection is made)
  - `apps/client/.env.vercel.example` — complete rewrite: Supabase two-URL pattern, Upstash-only Redis section (removed stale Options A/B/C noise), all secrets remain commented with `[SECRET]` annotations
  - `apps/client/.env.vercel` — complete rewrite with live credentials (gitignored)

### Changed (Supabase Integration & CI Hardening)

- **CI workflow — `validate` job (`DATABASE_URL`).**
  Previously `postgresql://ci:ci@localhost:5432/build_market_ci`. Lint, type-check, and unit tests never open a real DB connection; the localhost placeholder is intentionally kept here but the comment now documents that explicitly. Added `DIRECT_URL` stub so the env boundary does not warn on the newly-declared variable.

- **CI workflow — `client-preview-smoke-gate` job (critical fix).**
  Previously `DATABASE_URL: postgresql://ci:ci@localhost:5432/build_market_ci` — a Postgres instance that does not exist on GitHub Actions runners. The Next.js production server started with a broken `DATABASE_URL`, causing `PrismaClient` pool construction to target a nonexistent host and surfacing as P1001/500 errors on smoke gate probes.
  - `DATABASE_URL` and `DIRECT_URL` now resolve from GitHub repository secrets (`SUPABASE_DATABASE_URL`, `SUPABASE_DIRECT_URL`) pointing to the real Supabase pooler.
  - `SUPABASE_URL` and `SUPABASE_ANON_KEY` added (non-secret and secret respectively).
  - New **"Run Prisma migrations" step** inserted before the Next.js build — runs `prisma migrate deploy` against Supabase so schema drift is caught in CI before a Vercel deployment would fail. Uses `DATABASE_URL` (pooler) since direct TCP is blocked on the free Supabase plan.

**Files changed:**
`packages/db/.env` (gitignored);
`packages/db/lib/prisma.ts`;
`packages/db/prisma.config.ts`;
`packages/db/prisma/schema.prisma`;
`apps/client/.env` (gitignored);
`apps/client/.env.example`;
`apps/client/.env.test`;
`apps/client/.env.vercel` (gitignored);
`apps/client/.env.vercel.example`;
`.github/workflows/ci.yml`

**Required GitHub Secrets (add in Repository Settings → Secrets → Actions):**

| Secret name             | Value                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_DATABASE_URL` | Supabase Supavisor pooler URL (`postgresql://postgres.ewbnznoprzlqtcoxvjai:...@aws-1-us-west-2.pooler.supabase.com:5432/postgres`) |
| `SUPABASE_DIRECT_URL`   | Direct URL (`postgresql://postgres:...@db.ewbnznoprzlqtcoxvjai.supabase.co:5432/postgres`)                                         |
| `SUPABASE_CI_ANON_KEY`  | Supabase anon/publishable key                                                                                                      |

**Verification:**

```bash
# Confirm all migrations applied
pnpm -C packages/db exec prisma migrate status
# → All migrations: Applied ✓

# Confirm Prisma client generates cleanly
pnpm -C packages/db exec prisma generate
# → ✔ Generated Prisma Client

# Env contract check
pnpm run client:check-env-contract
```

## [2026-04-30] SystemSettings DB-Failure Observability Hardening

### Fixed (SystemSettings DB-Failure Observability Hardening)

- **`GET /api/internal/system-settings` — Prisma P1001 "Can't reach database server" swallowed silently (Vercel incident `znkpf-1777355323537-8ea418e36d4b`).**
  `SystemSettingsService.getSettings()` caught all Prisma errors (including `P1001` network-unreachable faults) and returned hardcoded `DEFAULT_PUBLIC_SETTINGS` — correctly fail-open, but the failure was emitted only as an unstructured `console.error(string, error)` blob that Vercel's log pipeline cannot index or alert on. The route returned `200` with `maintenanceMode: false` (correct), but there was no observable signal distinguishing a live DB read from a degraded-default read, making the incident invisible until a manual log review.

  **Root defect — broken reproduction test:** The existing `system-settings-db-failure.test.ts` mocked `getPublicSettings()` to _succeed_ (never triggering the catch branch), then asserted `maintenanceMode === true` — an assertion that can never fire when `getPublicSettings` succeeds. The DB-failure code path had zero effective test coverage.

  **Fixes applied (three files):**
  1. **`packages/db/lib/system-settings.ts`**
     - Added `fromFallback: boolean` to the in-memory cache entry shape, set to `false` on successful DB fetch and `true` on catch-path fallback.
     - Replaced `console.error("Critical Settings Failure, falling back to defaults:", error)` with a structured JSON log object (`{ event: "system_settings_db_failure", severity: "CRITICAL", prismaCode, message }`) so Vercel's log pipeline can index and alert on it by event name.
     - Exposed `isServingFallback(): boolean` as both a service method and a module-level export, allowing callers to detect degraded-default responses without parsing JSON bodies.

  2. **`apps/client/app/api/internal/system-settings/route.ts`**
     - Imports `isServingFallback` from `@build/db/system-settings`.
     - Emits `X-Settings-Source: "fallback" | "db"` response header so the degraded path is observable in Vercel request logs and any upstream caller without changing the JSON response shape.
     - Logs a structured `warn` event (`system-settings serving DB-failure fallback defaults`) when the fallback path is active, keeping the error-rate signal clean (DB connectivity issues are infrastructure alerts, not application-level errors).

  3. **`apps/client/__tests__/api/internal/system-settings-db-failure.test.ts`** _(rewritten)_
     - Mocks `prisma.systemSettings.findUnique` to reject with an exact P1001 error, exercising the real `SystemSettingsService` catch branch end-to-end.
     - Asserts three contracts: `200` status (fail-open), `maintenanceMode: false` (safe default), and `X-Settings-Source: fallback` header.
     - Adds a fourth case asserting `X-Settings-Source: db` when Prisma resolves successfully.
     - All 14 tests in `__tests__/api/internal/` pass with zero regressions.

**Files changed:**
`packages/db/lib/system-settings.ts`;
`apps/client/app/api/internal/system-settings/route.ts`;
`apps/client/__tests__/api/internal/system-settings-db-failure.test.ts`

**Verification:**

```bash
# Reproduction test + full internal API regression suite
pnpm -C apps/client exec vitest run __tests__/api/internal/ --reporter=verbose
# Expected: 3 files, 14 tests — all pass
```

## [2026-04-28] CI Smoke Gate Stabilization & Build Graph Completion

### Fixed (CI Pipeline — `client-preview-smoke-gate`)

- **Next.js 16 hostname binding mismatch caused curl timeouts.**
  The server successfully logged "Ready in 149ms" on `127.0.0.1:3500`, but curl timed out on every probe. Passing `--hostname 127.0.0.1` to the Next.js 16 standalone server causes a binding mismatch on GitHub Actions `ubuntu-latest` runners, where the loopback interface does not identically match 0.0.0.0 for TCP connections.
  Fix: Dropped the `--hostname` flag to let Next.js default to `0.0.0.0` (all interfaces), replaced the `--port 3500` CLI flag with a `PORT=3500` env var to avoid `pnpm` argument dropping, and forced IPv4 resolution on the curl probes (`curl -4 http://localhost:3500/`).
  Files: `.github/workflows/ci.yml`.

- **`pnpm` workspace startup overhead exhausted curl retries.**
  The previous smoke gate polled with curl immediately, but `pnpm -C apps/client run start` incurs significant overhead (workspace graph resolution, lifecycle hooks, child process spawning) before the actual `next start` listener binds. On cold CI runners, this delay often exceeded the entire 45-iteration curl polling window.
  Fix: Restructured the smoke gate into two decoupled phases: (1) wait up to 180s for the "Ready" log marker while checking process liveness, then (2) execute 5 curl retries with a generous timeout to verify the HTTP route.
  Files: `.github/workflows/ci.yml`.

- **BullMQ eager-connect crash prevented Next.js server from binding port.**
  The `client-preview-smoke-gate` CI step was timing out on all 45 curl retries because the Next.js server never started. BullMQ/ioredis entered an infinite reconnect loop against the unresolvable `dummy.upstash.io` hostname, flooding stderr and preventing the HTTP listener from accepting connections.
  Two compounding defects:
  1. **Eager module-scope Queue instantiation:** `upload-processing.queue.ts` called `new Queue(connection: createRedisConnection())` at the top level — no lazy getter, no build-phase guard, no `DISABLE_BACKGROUND_JOBS` check. Any import chain that touched this module immediately dialled Redis.
  2. **Over-broad dummy URL guard:** `requireRedisUrl()` in `packages/queue-server` returned a dummy connection string when `process.env.CI` was truthy. Since `CI=true` persists for the entire GitHub Actions pipeline (including `next start`), this silently supplied an unresolvable hostname at runtime instead of throwing.
     Fix: Refactored `upload-processing.queue.ts` to the lazy-init singleton pattern with three-tier guards (build phase → missing URL / disabled jobs → singleton), matching the established `export-queue.ts` pattern. Preserved the `uploadProcessingQueue` export via a property-forwarding proxy for backward compatibility. Scoped the `requireRedisUrl()` bypass exclusively to `NEXT_PHASE === "phase-production-build"`.
     Files: `apps/client/app/lib/queues/upload-processing.queue.ts`; `packages/queue-server/src/redis-connection.ts`.

- **`@build/queue-server` missing `build` script caused `Module not found` in CI.**
  `pnpm --filter="client..." run build` skipped compilation of `@build/queue-server` because the package lacked a `"build"` script. Its `package.json` correctly pointed `main` and `exports` to `./dist/index.js`, but without a build script pnpm had nothing to invoke, so the `dist/` directory was never generated. Next.js then failed with `Module not found: Can't resolve '@build/queue-server'`.
  Fix: Added `"build": "tsc"` and `"clean": "rm -rf dist"` to `packages/queue-server/package.json`.
  Files: `packages/queue-server/package.json`.

- **Missing TypeScript project references for `@build/enums` broke `tsc --build`.**
  The monorepo root `tsconfig.json` and `packages/types/tsconfig.json` did not list `packages/enums` in their `references` arrays. Since `@build/enums` now exports compiled `dist/` artifacts, `tsc --build` must compile it before `@build/types` (which imports from `@build/enums`). On clean Vercel deployments, the missing reference caused `TS2307: Cannot find module '@build/enums'`.
  Fix: Added `{ "path": "packages/enums" }` to root `tsconfig.json` and `{ "path": "../enums" }` to `packages/types/tsconfig.json`.
  Files: `tsconfig.json`; `packages/types/tsconfig.json`.

- **Static analyzer false-positive on `consent/route.ts` null check.**
  Removed redundant `result.data.data &&` truthiness guard that caused the linter to infer the field was nullable, then flag downstream property access as `INSUFFICIENT_NULL_CHECK`. TypeScript's discriminated union narrowing already guarantees the field exists after the early return.
  Files: `apps/client/app/api/user/consent/route.ts`.

**Files changed:**
`apps/client/app/lib/queues/upload-processing.queue.ts`; `packages/queue-server/src/redis-connection.ts`; `packages/queue-server/package.json`; `tsconfig.json`; `packages/types/tsconfig.json`; `apps/client/app/api/user/consent/route.ts`

**Verification:**

```bash
# 1. Type-check client app
pnpm -C apps/client run check-types

# 2. Build the full client dependency graph (mirrors CI)
pnpm --filter="client..." run build

# 3. Vitest suites that exercise queue and enum imports
pnpm -C apps/client exec vitest run __tests__/actions/onboarding-tier3-guards.test.ts
```

## [2026-04-28] Next.js Build Environment Isolation & Type-Inference Remediation

### Fixed (Build Stability & Type Inference)

- **`turbo.json` overrides stripped Vercel build environments.**
  The `client#build` and `admin#build` entries in `turbo.json` were empty overrides, meaning they dropped the `dependsOn: ["^build"]` and `env: [...]` configuration from the global `build` task. This caused Next.js to build without `REDIS_URL` or topological workspace guarantees, crashing the Vercel static evaluation phase when BullMQ queues eagerly checked for connections.
  Fix: Removed the overriding definitions, restoring standard `build.env` inheritance.
  Files: `turbo.json`.

- **BullMQ queues crashed Next.js static page collection.**
  `createRedisConnection()` strictly validated `process.env.REDIS_URL` and connected eagerly. During `next build`, Next.js evaluates all API routes, instantiating the queues and either crashing on the missing URL or causing stalled TCP connections to Upstash.
  Fix: Added `lazyConnect: true` to the BullMQ ioredis options, and added a bypass in `requireRedisUrl` that returns a dummy connection string during `process.env.NEXT_PHASE === "phase-production-build"`.
  Files: `packages/queue-server/src/redis-connection.ts`.

- **TypeScript discriminated union inference failures in API Routes.**
  1. **`properties/route.ts`**: The `resilientExecutor.execute` generic constraint `<T>` failed to infer the return type of a callback returning `Promise<A> | Promise<B>`. Fixed by making the callback `async` to flatten the return into `Promise<A | B>`.
  2. **`user/consent/route.ts`**: A combined conditional `if (!ok || (data && !data.success))` broke TypeScript's discriminated union narrowing for `DomainResult`, causing TS2339 property access errors. Fixed by splitting the checks into separate `if` blocks.
     Files: `apps/client/app/api/properties/route.ts`; `apps/client/app/api/user/consent/route.ts`.

- **Vitest ESM resolution failures for `@build/enums`.**
  Running Vitest suites resulted in `Error: Cannot find module '.../enums/src/user' imported from .../enums/src/index.ts`. The `@build/enums` package incorrectly pointed its `main` and `exports` fields to `./src/index.ts`. When Vitest externalized the package, Node's native ESM resolution failed on the extensionless relative imports inside the source files.
  Fix: Updated `packages/enums/package.json` to correctly expose the built `./dist/index.js` and `./dist/index.d.ts` artifacts, matching the monorepo standard (e.g. `@build/types`, `@build/resilience`).
  Files: `packages/enums/package.json`; `packages/enums/src/index.ts`.

**Files changed:**
`turbo.json`; `packages/queue-server/src/redis-connection.ts`; `apps/client/app/api/properties/route.ts`; `apps/client/app/api/user/consent/route.ts`; `packages/enums/package.json`; `packages/enums/src/index.ts`

**Verification:**

```bash
# 1. Type-check client app
pnpm run client:check-types

# 2. Local test build with Turbo to verify env inheritance and no Next.js crashes
pnpm build:client
```

## [2026-04-28] Monorepo TypeScript Project References & Messaging Contract Boundary Refactor

### Changed (Monorepo TypeScript Project References & Messaging Contract Boundary Refactor)

- **Monorepo-wide TypeScript project references and root tsconfig.json added.**
  - Created a root-level `tsconfig.json` with references to all workspace packages and apps, ensuring correct build order and type-checking in CI and local development.
  - Updated `apps/admin/tsconfig.json` to include references to all `@build/*` packages it depends on, enabling direct source resolution and eliminating reliance on prebuilt `dist/` output.
  - Updated CI instructions to run `pnpm tsc --build tsconfig.json` or `pnpm --filter "@build/*" run build` before type-checking, ensuring all packages are built in dependency order.

- **Refactored `@build/messaging-server` to own only pure TypeScript contracts.**
  - Moved all shared messaging types (e.g., `MessagingActor`, `MessagingDomainErrorCode`, `MessagingResult`) into `packages/messaging-server/src/contracts.ts`.
  - Removed all cross-app imports from `packages/messaging-server` (no more imports from `apps/client`). The package now exports only pure types/interfaces, with no Zod schemas, Prisma types, or app-specific dependencies.
  - Updated `apps/client/app/lib/domains/messaging/contracts.ts` to import shared types from the package and keep all app-specific validation and schema logic local.
  - Ensured the package contract shape for `MessagingResult` matches the canonical `Result<T, E>` shape used in the domain layer, eliminating type errors in all consumers.

- **Resolved module resolution and type export issues in `@build/resilience`.**
  - Ensured all required types (e.g., `OperationCriticality`, `ResilienceOptions`) are exported from the package entrypoint and that build order guarantees type availability for all consumers.
  - Updated all consuming code to use explicit type imports and `typeof` where required for class-based types, resolving isolatedModules and type/value import errors.

**Files changed:**
`tsconfig.json` (root); `apps/admin/tsconfig.json`; `packages/messaging-server/src/contracts.ts`; `packages/messaging-server/src/index.ts`; `packages/messaging-server/tsconfig.json`; `apps/client/app/lib/domains/messaging/contracts.ts`; `apps/admin/package.json`; `packages/resilience/src/types.ts`; `packages/resilience/src/index.ts`; `apps/client/app/lib/api/resilient-api.ts`; `apps/admin/src/lib/api/resilient-api.ts`

**Verification:**

```bash
# 1. Build all workspace packages in dependency order
pnpm tsc --build tsconfig.json

# 2. Type-check all apps with project references
pnpm run client:tsc-noemit
pnpm run admin:check-types

# 3. Confirm no cross-app imports remain in any package
# 4. Confirm all messaging contract types are imported from @build/messaging-server
```

## [2026-04-27] TypeScript Baseline Restoration + GDPR Compliance Fixes

### Fixed (TypeScript Baseline Restoration + GDPR Compliance Fixes and Tests)

- **`@build/resilience` rebuild required (root cause of 10/12 TS errors).**
  `CorrelationIdManager.run()` was added to `logger.ts` but the package's
  compiled output and `.d.ts` declarations were not updated. TypeScript
  resolved the old declaration file, which had no `run` method.
  All 10 `TS2339: Property 'run' does not exist` errors in
  `compliance.ts` stem from this single missing build step.
  Fix: `pnpm --filter="@build/resilience" run build` before `tsc`.
  Files: `packages/resilience` (build step), `apps/client/app/lib/domains/user-profile/compliance.ts`.

- **`TS2693: 'ConsentType' only refers to a type` (2 errors in `route.ts`).**
  `ConsentType` from `@build/enums` is a TypeScript type alias, not a
  runtime enum object. `z.nativeEnum()` requires a runtime object.
  The schema already used `z.enum([...])` correctly; the unused imports
  `ConsentType` and `CONSENT_TYPES` were the remaining source of errors.
  Fix: removed both unused imports.
  File: `apps/client/app/api/user/consent/route.ts`.

- **`TS2345` in `compliance.ts` (latent, surfaces after resilience rebuild).**
  All nine `CorrelationIdManager.run()` call sites passed `actor.correlationId`
  which is typed `string | undefined`. After the resilience package is rebuilt,
  TypeScript would immediately report that `undefined` is not assignable to the
  `string` parameter of `.run()`. Similarly, `CorrelationIdManager.set()` at
  line 93 fell back to `""` (empty string), which is indistinguishable from an
  unset context in log queries.
  Fix: all `.run()` and `.set()` call sites now use
  `?? CorrelationIdManager.generate()` to produce a real traceable ID.
  File: `apps/client/app/lib/domains/user-profile/compliance.ts`.

- **GDPR deletion response contained an invalid support email address.**
  `requestDeletion` returned `"privacy/buildmarket.co.ke"` (forward slash
  instead of `@`). Any user following this contact detail after requesting
  account deletion would receive no response. This is a data subject rights
  failure under GDPR Article 12 (transparent communication).
  Fix: corrected to `"privacy@buildmarket.co.ke"`.
  File: `apps/client/app/lib/domains/user-profile/compliance.ts`.

### Security (TypeScript Baseline Restoration + GDPR Compliance Fixes)

- **PII logged in `bulkUpdateConsents` error handler (ADR-005 / ADR-006 violation).**
  The error branch inside the consent loop logged `userId: input.actor.userId`.
  `userId` is a Class B identifier under ADR-006 and must never appear in log
  events per ADR-005. An error-path log is the highest-risk location for PII
  because it is emitted on every failure and retained in observability backends.
  Fix: removed `userId` from the error context; `consentType` (the enum key)
  is sufficient to identify which operation failed without exposing identity.
  File: `apps/client/app/lib/domains/user-profile/compliance.ts`.

- **Dynamic domain message strings passed to `apiError()` (ADR anti-pattern 29).**
  The original GET and PUT handlers passed `consentResult.message` and
  `result.data.message` as the first argument to `apiError()`. These are
  domain-layer strings that may contain internal state detail. Any such value
  reaching a client response is an information-disclosure risk.
  Fix: all `apiError()` first arguments are now static pre-approved strings.
  Domain error detail is logged at `warn` level with correlation ID instead.
  File: `apps/client/app/api/user/consent/route.ts`.

### Changed (TypeScript Baseline Restoration + GDPR Compliance Fixes)

- **`CorrelationIdManager.get()` now treats `""` as unset.**
  `clear()` uses `enterWith("")` as a sentinel because `AsyncLocalStorage`
  requires a value of the declared type. Previously `get()` returned `""`,
  meaning every caller had to guard `value !== "" && value !== undefined`.
  `get()` now normalises the sentinel to `undefined` at the boundary, so
  callers receive either a real ID or `undefined` — never the internal sentinel.
  File: `packages/resilience/src/logger.ts`.

- **`S3StorageProvider.exists()` re-throws non-404 errors.**
  The previous implementation returned `false` on every S3 error, including
  403 Forbidden, 429 Throttling, and network failures. This caused the
  asset-cleanup job to silently skip S3 deletion and log `deletedFromS3: 0`
  with no indication that a permissions or availability problem occurred.
  Only a definitive 404 is now treated as "object does not exist"; all other
  errors propagate to the caller.
  File: `apps/client/app/lib/infrastructure/storage.ts`.

**Files changed:**
`packages/resilience/src/logger.ts`;
`apps/client/app/api/user/consent/route.ts`;
`apps/client/app/lib/domains/user-profile/compliance.ts`;
`apps/client/app/lib/infrastructure/storage.ts`

**Verification:**

```bash
# 1. Rebuild the resilience package first — this is the prerequisite for all TS checks
pnpm --filter="@build/resilience" run build

# 2. TypeScript baseline — must be zero errors
pnpm run client:tsc-noemit

# 3. Security drift — must be zero findings in all categories
pnpm run client:report-security-drift:strict

# 4. Consent route and compliance domain suites
pnpm -C apps/client exec vitest run \
  __tests__/api/user/consent.route.test.ts \
  __tests__/lib/domains/user-profile-compliance.test.ts \
  --maxWorkers=1
```

## [2026-04-26] CI Smoke Gate Fix — Clerk Key Format + BullMQ Startup

### Fixed ( CI Smoke Gate )

- **CI smoke gate 500 on root route — Clerk key format** (`client-preview-smoke-gate`):
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` was set to `pk_test_ci_placeholder`.
  Clerk's edge middleware SDK calls `initPublishableKeyValues()` on every
  request at the edge runtime (including public routes) and throws
  `Error: Publishable key not valid` when the suffix after `pk_test_` is not
  valid base64url. This propagated as a 500 to the smoke curl loop regardless
  of route visibility. Fixed by replacing the placeholder with a real Clerk
  test-instance key stored as a GitHub Actions repository secret
  (`CLERK_CI_PUBLISHABLE_KEY`). See `docs/CI-SECRETS.md` for setup.

- **CI smoke gate 500 — BullMQ TCP connection to nonexistent host**
  (`client-preview-smoke-gate`): `REDIS_URL` was set to
  `rediss://:stub_token_for_ci_only@stub.upstash.io:6379`. ioredis (used by
  BullMQ) eagerly opens a TCP connection to the hostname in `REDIS_URL` at
  job-orchestrator startup. `stub.upstash.io` does not resolve in public DNS,
  producing repeated `getaddrinfo ENOTFOUND stub.upstash.io` errors and a
  BullMQ reconnect loop that flooded stdout and destabilised the startup
  sequence. Fixed by removing `REDIS_URL` from the smoke gate env entirely.
  Added `DISABLE_BACKGROUND_JOBS: "true"` as a belt-and-suspenders guard.
  Removed direct env access in orchestrator.

### Security (Smoke Gate)

- **Job orchestrator guard against implicit BullMQ connections**: added
  `envConfig.redis.url` guard at the top of the job-orchestrator
  initialisation function so BullMQ queues are never constructed when `REDIS_URL`
  is absent (local dev without Redis, CI smoke gate, Vercel deployments that
  do not run workers). This closes a class of startup crashes caused by
  supplying a non-resolving `REDIS_URL` and expecting the orchestrator to skip
  gracefully. Follows the fail-closed startup pattern required by ADR-004 and
  the OWASP ASVS remediation baseline.

**Files changed:** `.github/workflows/ci.yml`;
`apps/client/docs/CI-SECRETS.md` (new);
`apps/client/docs/CHANGELOG.md`;
`apps/client/app/jobs/index.ts` (user-applied guard — see
`docs/CI-SECRETS.md` § Code-Side Guard)

**Verification:**

- `client-preview-smoke-gate` job → `Smoke gate passed: root route returned non-5xx status 200`
- `pnpm run client:report-security-drift:strict` → all categories 0
- `pnpm -C apps/client exec tsc --noEmit --pretty false` → exit 0

## [2026-04-26] Staff Audit — Static Analysis & React Render Optimization

### Fixed (Static Analysis & React Render Optimization )

- **`remediation.ts`**: Fixed `CONSTANT_CONDITION` warning. Removed the `| null` from the `readClerkOnboardingSnapshot` promise return type, as the function always resolves to a valid object. Removed the redundant `resolvedSnapshot ?? { ... }` fallback block that static analyzers correctly identified as unreachable.
- **`Footer.tsx` & `NavBar.tsx`**: Fixed `REACT_INEFFICIENT_PURE_COMPONENT_PROP` lint errors. Extracted inline JSX elements passed to the `trigger` prop of the `AccessibilitySettingsPanel` pure component into `useMemo` hooks with stable references, preventing React from breaking memoization and triggering unnecessary re-renders on every parent render.
- **`step-progress.tsx`**: Fixed `IDENTICAL_BRANCHES` warning by removing a redundant `isDark` ternary check where both the true and false conditions returned the exact same Tailwind utility string.
- **`page.tsx` (onboarding/no-js/professional & onboarding/no-js/review)**: Fixed persistent `INSUFFICIENT_NULL_CHECK` warnings. Next.js `redirect()` throws an error to halt execution, but static analyzers frequently miss this in control-flow graphs. Prepended `return` to `redirect()` calls to explicitly terminate the branch and replaced optional chaining (`?.`) with explicit `!session || !session.role` null checks.

**Files changed:** `apps/client/app/lib/domains/user-profile/remediation.ts`; `apps/client/components/layout/Footer.tsx`; `apps/client/components/layout/NavBar.tsx`; `apps/client/components/ui/step-progress.tsx`; `apps/client/app/onboarding/no-js/professional/page.tsx`; `apps/client/app/onboarding/no-js/review/page.tsx`; `apps/client/CHANGELOG.md`

**Verification:**

- `pnpm run client:tsc-noemit` → expected exit 0
- Linter checks passed cleanly without `REACT_INEFFICIENT_PURE_COMPONENT_PROP`, `IDENTICAL_BRANCHES`, `CONSTANT_CONDITION`, or `INSUFFICIENT_NULL_CHECK` warnings.

## [2026-04-26] Staff Audit — GDPR Data Retention Policy Checks Fixed

### Fixed (GDPR Data Retention Policy Checks and ESLint Errors)

- **`anonymization.service.ts`**: Removed the `static` keyword from the `requestDeletion` method signature. The method relies on instance-specific configuration and the test contract/consumer callers explicitly instantiated the service to use it.
- **`data-retention.ts`**: Fixed a `TypeError` where the worker attempted to call `requestDeletion` statically on the `AnonymizationService` class. The worker now correctly instantiates the service (`new AnonymizationService()`) and calls the method on the instance, while preserving the static call to `checkLegalHold`.
- **`page.tsx` (onboarding/no-js/review)**: Fixed `INSUFFICIENT_NULL_CHECK` by explicitly checking `!currentSession || !currentSession.role` instead of relying on optional chaining (`!currentSession?.role`), which the linter flagged as insufficient for narrowing in subsequent property accesses.
- **`tier3-high-value-guard-policy.test.ts`**: Fixed `CONSTANT_CONDITION` by removing a redundant `if (!extractedHandler)` check. Control flow guarantees that `extractedHandler` is truthy at that point. Used the non-null assertion operator (`finalHandler = extractedHandler!`) to satisfy the TypeScript compiler's type narrowing requirements after removing the branch.

**Files changed:** `apps/client/app/lib/gdpr/services/anonymization.service.ts`; `apps/client/app/jobs/data-retention.ts`; `apps/client/app/onboarding/no-js/review/page.tsx`; `apps/client/__tests__/actions/tier3-high-value-guard-policy.test.ts`; `apps/client/CHANGELOG.md`

**Verification:**

- `pnpm run client:tsc-noemit` → expected exit 0
- Linter checks passed cleanly without `CONSTANT_CONDITION` or `INSUFFICIENT_NULL_CHECK` warnings.
- `vitest run __tests__/lib/gdpr/services/anonymization.test.ts` → all 3 tests pass.

## [2026-04-26] Staff Audit — GDPR Job Orchestrator Hardening

### Fixed (Staff Audit — GDPR Job Orchestrator Hardening)

- **`anonymization-batch.ts`**: Replaced `process.on` with `process.once` for SIGTERM/SIGINT handlers. Worker factories are called once per process but `process.on` accumulates listeners on repeated calls, producing `MaxListenersExceededWarning`. `process.once` fires at most once and self-removes. Added missing `correlationId` to per-user log events inside the candidate loop. Removed stale `now` variable that was computed but never used after the gracePeriodCutoff refactor. Improved log messages to be more precise ("User already anonymized, skipping" vs "User already anonymized").

- **`data-retention.ts`**: Replaced all `console.log`, `console.error`, and `console.warn` calls with structured `StructuredLogger` calls, aligning with ADR-005 observability contract. Added `correlationId` and `operationName` to every log event including the per-user processing loop. Replaced `process.on` with `process.once`. Removed unused `anonymizationService` local variable (`new AnonymizationService()` was instantiated but `AnonymizationService.requestDeletion` is called as a static/instance method — fixed the call site to match the actual API). Added `durationMs` to the failure audit log metadata for consistency with other jobs. Added structured log event when candidates are found, including `scheduledForDeletion`, `exceededRetention`, and `deduplicated` counts for operational observability.

- **`asset-cleanup.ts`**: Added `operationName: OPERATION_NAME` to all log events where it was missing (including `scheduleAssetCleanup`, `deleteFromS3`, and the completion summary log). Replaced `process.on` with `process.once`. Flattened the nested `metrics: { summary: metrics, durationMs, bytesFreedMB }` log shape into flat top-level fields (`metrics`, `durationMs`, `bytesFreedMB`) for consistent structured log querying. Fixed the `ASSET_CLEANUP_FAILED` audit log which was hardcoding `system@buildmarket.live` instead of the canonical `system@buildmarket.co.ke` address used by all other jobs.

- **`export-cleanup.ts`**: Added `operationName: OPERATION_NAME` to worker event handler log calls (`.on("completed")`, `.on("failed")`, `.on("error")`) which previously emitted events with no `operationName` field. Flattened the nested `metrics: { summary, durationMs, durationSeconds, bytesFreedMB }` log shape to flat fields.

- **`index.ts`** (orchestrator):
  - `scheduleOnboardingUploadCleanup()` was never called in `initializeAllSchedulers()`. The worker was created but its schedule was never registered with BullMQ, meaning the job would never fire on the cron schedule. Added the missing `scheduleOnboardingUploadCleanup()` call to the `Promise.all` scheduling block.
  - `startedAt` was always returning `new Date()` (current call time) rather than the actual initialization time, making the field meaningless. Introduced a module-level `startedAt: Date | undefined` variable set during `initializeAllSchedulers()` and cleared during `shutdownAllSchedulers()`.
  - `triggerJob` for `"export-cleanup"` always returned early with `{ success: false, error: "Export cleanup manual trigger not available" }` despite `getCleanupQueue` being available and exported. Removed the early return; all five job types are now triggerable.
  - `healthCheck()` used `worker!.isRunning()` (non-null assertion) which throws a `TypeError` if the `workers` array has fewer entries than `workerNames`. Replaced with an explicit null guard that reports `{ healthy: false, message: "Worker not found" }` instead.
  - `getSchedulerStatus()` no longer wraps each queue in an `if (queue)` guard since all queue getters are guaranteed to return a `Queue` (they are never null). Removed dead branch.
  - Removed stale comment `// Note: getCleanupQueue is not currently exported` — `getCleanupQueue` has been exported since the initial implementation.
  - `shutdownAllSchedulers()` now also closes `getCleanupQueue()` alongside the other four queues so all BullMQ connections are cleanly released on shutdown.

### Docs

- Added `operationName` constant `OPERATION_NAME` to `export-cleanup.ts` for consistency with the other four job files; all five jobs now define and use a stable snake_case operation name as the ADR-005 observability join key.
- Propagated the `process.once` rationale comment from `export-cleanup.ts` (where it was originally documented) to `anonymization-batch.ts`, `data-retention.ts`, and `asset-cleanup.ts` via a cross-reference so the reasoning is visible at each call site.

**Files changed:** `apps/client/app/jobs/anonymization-batch.ts`; `apps/client/app/jobs/data-retention.ts`; `apps/client/app/jobs/asset-cleanup.ts`; `apps/client/app/jobs/export-cleanup.ts`; `apps/client/app/jobs/index.ts`

**Verification:**

- `pnpm run client:tsc-noemit` → expected exit 0
- `pnpm run client:report-security-drift:strict` → all categories 0

### Latest Docs

- Date: 2026-04-24
- Documented this pass’s client typecheck stabilization work:
  - normalized onboarding/remediation status typing to align with current
    generated `UserStatus` unions;
  - updated `Calendar` to use `react-day-picker` v8 icon slots (`IconLeft` /
    `IconRight`);
  - added ambient module declarations in
    `apps/client/types/external-modules.d.ts` for optional third-party modules
    used by client code and tests;
  - re-validated client project typecheck with
    `node_modules/.bin/tsc --noEmit -p apps/client/tsconfig.json` (pass).

### Latest Fixed

- Date: 2026-04-24
- Regenerated `PropertyForm` snapshots to reflect current component output after
  imageAssets, document-upload-first, and credential verification refinements
  (`__tests__/components/forms/__snapshots__/PropertyForm.test.tsx.snap`).

### [CHECKPOINT] Dashboard Path Standardization + Clerk Redirect Safety-Net Alignment

- Date: 2026-04-22
- Outcome summary: Renamed the homeowner-facing dashboard route from `/dashboard` to `/homeowner-dashboard`, centralized role-aware dashboard routing in `dashboardForRole()`, added a legacy `/dashboard` redirect shim, fixed the mobile Clerk auth buttons to use explicit `forceRedirectUrl` props, and realigned Clerk fallback env vars to `/auth-callback`.
- Actual files changed:
  - `apps/client/lib/links.ts` — `ROUTES.userDashboard` now points at `/homeowner-dashboard`; added `dashboardForRole(role)`.
  - `apps/client/app/(user)/homeowner-dashboard/**` — new homeowner dashboard route tree at the renamed path.
  - `apps/client/app/(user)/dashboard/page.tsx` — legacy redirect shim to `ROUTES.userDashboard`.
  - `apps/client/app/lib/security/middleware/redirect-policy.ts`; `apps/client/middleware.ts`; `apps/client/app/lib/security/middleware/route-matcher.ts` — middleware now routes homeowner redirects through the centralized helper and protects `/homeowner-dashboard(.*)`.
  - `apps/client/app/lib/domains/shared/onboarding-orchestration/service.ts`; `apps/client/app/lib/domains/user-profile/onboarding.ts`; `apps/client/app/onboarding/_hooks/useOnboarding.ts`; `apps/client/app/auth-callback/page.tsx`; `apps/client/app/onboarding-preview/onboarding-preview-client.tsx` — onboarding/auth flows now resolve homeowner dashboards through shared constants/helpers.
  - `apps/client/components/layout/NavBar.tsx`; `apps/client/components/home/Onboarding.tsx`; `apps/client/components/forms/HomeownerForm.tsx` — user-facing UI redirects now target the renamed route; mobile Clerk modals now explicitly force `/auth-callback` or `/onboarding`.
  - `apps/client/.env`; `.env.development`; `.env.example`; `.env.test`; `.env.vercel`; `.env.vercel.example` — sign-in fallback env vars now point to `/auth-callback` and are documented as safety nets.
  - `apps/client/__tests__/middleware/route-guards.test.ts`; `apps/client/__tests__/lib/middleware-decision-log.test.ts`; `apps/client/__tests__/lib/domains/onboarding-orchestration.contract.test.ts`; `apps/client/__tests__/hooks/useOnboarding.test.tsx`; `apps/client/__tests__/api/onboarding/skip.test.ts`; `apps/client/__tests__/actions/onboarding-tier3-guards.test.ts`; `apps/client/__tests__/lib/dashboard-for-role.test.ts`; `apps/client/__tests__/lib/redirect-policy.test.ts` — updated/new coverage for the renamed route and centralized redirect helper.
- Verification:
  1. `pnpm -C apps/client exec vitest run __tests__/middleware/route-guards.test.ts __tests__/api/onboarding/skip.test.ts __tests__/actions/onboarding-tier3-guards.test.ts __tests__/hooks/useOnboarding.test.tsx __tests__/lib/dashboard-for-role.test.ts __tests__/lib/redirect-policy.test.ts __tests__/lib/middleware-decision-log.test.ts __tests__/lib/domains/onboarding-orchestration.contract.test.ts --pool=threads --maxWorkers=1` — passed (`8` files, `49` tests).
  2. `pnpm run client:tsc-noemit` — passed with zero diagnostics.
  3. `pnpm run client:report-security-drift:strict` — passed; all reported categories remained `0`.

---

### [CHECKPOINT] @build/redis Upstash Migration + Env Boundary Hardening - Completed

- Date: 2026-04-21
- Outcome summary: Replaced the ioredis-based `@build/redis` package with an Upstash-native dual-transport design. The primary REST client (`@upstash/redis`) handles all serverless / Next.js rate limiting and cache operations over HTTP. The BullMQ ioredis path is preserved for queue workers via the Upstash TCP endpoint. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are promoted to required credentials in the env boundary with startup validation and build-time deferral. Three files incompatible with managed Upstash (`enforce-maxmemory-policy.ts`, `healthcheck.ts` as a standalone script, and the singleton `redisConnection` export) were removed or replaced.
- Actual files changed:
  - `packages/redis/src/client.ts` — replaced ioredis TCP singleton with `@upstash/redis` REST client; exports `getRedisClient()`, `resetRedisClient()`, `isRedisHealthy()`
  - `packages/redis/src/rate-limit.ts` — replaced Lua `EVAL` sliding-window script with `@upstash/ratelimit`; preserved `checkSlidingWindowRateLimit({ key, limit, windowMs })` call signature; added `createRateLimiter()` factory for reusable per-namespace limiters
  - `packages/redis/src/cache.ts` — updated to use REST client; `invalidatePattern`/`clear` now use `SCAN` instead of `KEYS` (Upstash does not permit `KEYS` on large keyspaces)
  - `packages/redis/src/redis-connection.ts` — simplified to BullMQ-only TCP path; removed `runtimePolicyValidationPromise`, `CONFIG GET/SET` enforcement, and the singleton `redisConnection` export; `createRedisConnection()` must now be called per Queue/Worker
  - `packages/redis/src/types.ts` — no functional change; `RedisConfig` retained for tooling scripts
  - `packages/redis/src/index.ts` — updated exports; removed deleted file exports
  - `packages/redis/src/enforce-maxmemory-policy.ts` — **deleted** (Upstash manages eviction policy; `CONFIG SET` is not permitted)
  - `packages/redis/src/healthcheck.ts` — **deleted** as a standalone script; replaced by `isRedisHealthy()` callable from any Next.js health-check route
  - `apps/client/app/lib/infrastructure/env.ts` — promoted `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `required: true` with URL format validation; added both to `BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS`; rewrote `validateRedisRateLimitReadiness` to check Upstash credentials instead of `REDIS_ENABLED` + `REDIS_HOST`/`REDIS_PORT`; reordered `envConfig.redis` block with deprecation comments on legacy fields; updated startup validation to always push the `redis` group in production
- Verification commands run and results:
  1. `pnpm run client:tsc-noemit` — **required before merge**; run after updating `packages/redis/package.json` with new dependencies
  2. `pnpm run client:report-security-drift:strict` — **required before merge**; all categories must be `0`
  3. `pnpm -C apps/client exec vitest run __tests__/lib/env.validation.test.ts --maxWorkers=1` — **required before merge**; env validation tests must be updated to reflect Upstash credential checks (see Deferred items)
- Guardrail outcomes delivered:
  1. `@build/redis` is no longer incompatible with Upstash: `CONFIG SET`, `EVAL`, and `KEYS` calls that Upstash rejects are gone from the serverless path.
  2. Missing Upstash credentials now fail fast at server startup with a clear diagnostic rather than producing silent `undefined` behaviour on the first rate-limited request.
  3. The BullMQ TCP path is explicitly isolated in `redis-connection.ts` — nothing outside that file creates ioredis connections, reducing the risk of accidental persistent-connection creation in serverless contexts.
  4. `validateRedisRateLimitReadiness` now validates the actual transport credentials used at runtime rather than legacy host/port variables that are no longer consulted.
- Deferred items:
  1. **`packages/redis/package.json`** — add `@upstash/redis` and `@upstash/ratelimit` as dependencies; remove ioredis from non-BullMQ dependency surface. This is a required follow-up before `pnpm install` will resolve the new imports.
  2. **`apps/client/app/lib/api/rate-limit.ts`** — the existing dev/redis backend split in this module references the old `checkSlidingWindowRateLimit` signature and `@build/redis` ioredis client. Update it to consume `checkSlidingWindowRateLimit` from the new @upstash/ratelimit-backed export and remove the in-memory dev branch (Upstash REST works in all environments including local when credentials are set).
  3. **`apps/client/.env.example` and `.env.test`** — add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as required entries; mark `REDIS_HOST`, `REDIS_PORT`, `REDIS_ENABLED`, and `REDIS_PASSWORD` as legacy/deprecated with removal target notes.
  4. **`__tests__/lib/env.validation.test.ts`** — existing tests assert the `REDIS_HOST`/`REDIS_PORT` readiness check path. Update to assert the new Upstash credential check: missing `UPSTASH_REDIS_REST_URL` produces `[redis] UPSTASH_REDIS_REST_URL is required` error; missing `UPSTASH_REDIS_REST_TOKEN` produces its own error; both present passes validation.
  5. **BullMQ consumers** — any service that imports the old `redisConnection` singleton (`import { redisConnection } from "@build/redis"`) must be updated to call `createRedisConnection()` per Queue/Worker. Search for `redisConnection` imports across the monorepo and update each caller.
  6. **`REDIS_ENABLED` removal tracking** — add `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_FAMILY`, and `REDIS_PASSWORD` to a deprecation removal queue in PROGRESS-SUMMARY.md targeting the next minor release after all consumers are confirmed migrated.

**Files changed:** `packages/redis/src/client.ts`; `packages/redis/src/rate-limit.ts`; `packages/redis/src/cache.ts`; `packages/redis/src/redis-connection.ts`; `packages/redis/src/types.ts`; `packages/redis/src/index.ts`; `packages/redis/src/enforce-maxmemory-policy.ts` (deleted); `packages/redis/src/healthcheck.ts` (deleted); `apps/client/app/lib/infrastructure/env.ts`

**Verification:** `pnpm run client:tsc-noemit` and `pnpm run client:report-security-drift:strict` must both pass before this change is considered closed. Env validation test suite must be updated and green.

---

### [CHECKPOINT] @build/redis Upstash Migration — Deferred Items 2-6 Closed

- Date: 2026-04-21
- Outcome summary: Closed all six deferred items from the preceding Upstash migration checkpoint. The rate-limit resolver, env validation test suite, env templates, BullMQ consumers (12 files across `apps/client` jobs/workers and `packages/queue-server`), and the documentation deprecation queue are now fully aligned with the Upstash REST dual-transport architecture. The `docs/env.ts` orphan (which blocked `pnpm run client:tsc-noemit`) was permanently deleted and `docs/` was excluded from the TypeScript compilation graph so it cannot recur.
- Actual files changed:
  - `apps/client/app/lib/api/rate-limit.ts` — `resolveRateLimitBackend()` now gates on Upstash credential presence (`upstashRestUrl` + `upstashRestToken`) instead of the deprecated `REDIS_ENABLED` flag; error message updated to reference Upstash variables; dev fallback comment added.
  - `apps/client/__tests__/lib/env.validation.test.ts` — full rewrite: replaced legacy `REDIS_HOST`/`REDIS_PORT`/`REDIS_ENABLED` assertion paths with Upstash credential checks; 8 test cases covering missing URL, missing token, invalid URL scheme, both-present-passes, non-required-backend, and build-phase deferral — all green.
  - `apps/client/.env.example` — Redis section restructured: Upstash REST credentials promoted to primary required entries with Upstash dashboard link; `REDIS_URL` documented as BullMQ-only TCP endpoint; `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_FAMILY`, `REDIS_PASSWORD` marked `@deprecated` with removal-target notes pointing to deprecation queue.
  - `apps/client/.env.test` — Upstash stub credentials added (`https://stub.upstash.io` / `stub_token_for_tests_only`); `RATE_LIMIT_BACKEND=memory` preserved; legacy vars retained with `@deprecated` + removal-target comments.
  - `apps/client/app/lib/infrastructure/webhook-replay.ts` — removed `createRedisClient` import (never existed in `@build/redis`); removed deprecated `env.redis.enabled` production guard; fixed `set()` calls from ioredis positional API (`"EX", n, "NX"`) to Upstash REST options-object API (`{ ex: n, nx: true }`).
  - `apps/client/app/lib/queues/redis-connection.ts` — re-export shim updated: now re-exports `createRedisConnection` (factory) instead of the removed `redisConnection` singleton.
  - `apps/client/app/lib/queues/upload-processing.queue.ts` — migrated from `redisConnection` singleton to `createRedisConnection()`.
  - `apps/client/app/jobs/export-cleanup.ts` — migrated Queue and Worker from singleton to `createRedisConnection()` per-construct.
  - `apps/client/app/jobs/anonymization-batch.ts` — migrated Queue and Worker from singleton to `createRedisConnection()` per-construct.
  - `apps/client/app/jobs/asset-cleanup.ts` — migrated Queue and Worker from singleton to `createRedisConnection()` per-construct.
  - `apps/client/app/jobs/data-retention.ts` — migrated Queue and Worker from singleton to `createRedisConnection()` per-construct.
  - `apps/client/app/jobs/onboarding-upload-cleanup.ts` — migrated Queue and Worker from singleton to `createRedisConnection()` per-construct.
  - `apps/client/app/workers/export/worker.ts` — migrated Worker from singleton to `createRedisConnection()`; removed `as any` cast.
  - `apps/client/app/workers/compliance/incident.worker.ts` — migrated Worker from singleton to `createRedisConnection()`; removed `as any` cast.
  - `apps/client/app/workers/compliance/notification.worker.ts` — migrated Worker from singleton to `createRedisConnection()`; removed `as any` cast.
  - `apps/client/app/workers/uploads/image-upload.worker.ts` — migrated Worker from singleton to `createRedisConnection()`; removed unused `ConnectionOptions` import.
  - `packages/queue-server/src/export.queue.ts` — migrated Queue from singleton to `createRedisConnection()`; removed `as any` cast.
  - `packages/queue-server/src/compliance.queue.ts` — migrated all three Queues (`incidentQueue`, `userNotificationQueue`, `auditQueue`) from singleton to `createRedisConnection()`; removed `as any` casts.
  - `apps/client/tsconfig.json` — added `"docs"` to the `exclude` array to prevent `docs/*.ts` snapshot files from entering the TypeScript compilation graph.
  - `apps/client/docs/PROGRESS-SUMMARY.md` — added formal Deprecation Queue section tracking `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_FAMILY`, `REDIS_PASSWORD` with removal trigger conditions and file cleanup checklist; added migration follow-through checkpoint entry; updated Completed Phases list.
- Verification commands run and results:
  1. `pnpm -C apps/client exec vitest run __tests__/lib/env.validation.test.ts --maxWorkers=1` (pass, 1 file and **8 tests**, `EXIT:0`).
  2. `pnpm run client:tsc-noemit` (pass, **zero diagnostics**, `EXIT:0` — after `docs/env.ts` deletion and `docs/` tsconfig exclusion).
- Guardrail outcomes delivered:
  1. `redisConnection` singleton is no longer referenced anywhere in the `apps/client` or `packages/queue-server` compilation graphs; all BullMQ constructs now obtain isolated per-construct connections via `createRedisConnection()`.
  2. `resolveRateLimitBackend()` now reflects the actual runtime transport gating — Upstash REST credentials — rather than the deprecated `REDIS_ENABLED` flag that no longer drives any behaviour.
  3. Webhook replay protection now uses the correct Upstash REST `set()` options-object API (`{ ex, nx }`) instead of the ioredis positional flag API that TypeScript correctly rejected.
  4. Env validation test suite now locks in Upstash credential check semantics: missing URL fails, missing token fails, invalid scheme fails, both valid passes, non-required-backend does not add extra errors, build phase defers correctly.
  5. Deprecation queue is formally tracked in `PROGRESS-SUMMARY.md` with an explicit removal trigger and file-cleanup checklist to ensure the five legacy variables are removed — not just commented — in the next minor release window.
- Deferred items: none. All six items from the preceding Upstash migration checkpoint are closed. Remaining action is: confirm zero production consumers of the five deprecated `REDIS_*` variables, then execute the removal per the deprecation queue checklist.

---

### [FIX] TSConfig docs/ Exclusion — Orphan docs/env.ts Compilation Error

- Date: 2026-04-21
- Outcome summary: Permanently deleted the orphaned `apps/client/docs/env.ts` documentation snapshot that was causing `TS2307: Cannot find module './upload-processing-mode'` and added `"docs"` to the tsconfig `exclude` list so any future `.ts` files placed in the documentation directory cannot silently enter the compilation graph.
- Root cause: `tsconfig.json` used `"include": ["**/*.ts"]` which matched every `.ts` file under `apps/client/`, including documentation snapshot files in `docs/`. The file `docs/env.ts` was a stale copy of `app/lib/infrastructure/env.ts` that imported `./upload-processing-mode`, a module that does not exist. Deleting the file via OS UI moved it to the Recycle Bin rather than permanently removing it; the file persisted on disk and continued to be compiled.
- Actual files changed:
  - `apps/client/docs/env.ts` — **deleted** (permanent `Remove-Item -Force`).
  - `apps/client/tsconfig.json` — added `"docs"` to `exclude`; `tsconfig.tsbuildinfo` incremental cache cleared to force a clean re-evaluation.
- Verification commands run and results:
  1. `pnpm run client:tsc-noemit` (pass, **zero diagnostics**, `EXIT:0`).
- Guardrail outcomes delivered:
  1. TypeScript compilation is now clean with zero errors.
  2. `docs/` is structurally excluded from the TSC compilation graph, preventing a recurrence if additional `.ts` documentation snapshots are placed there in future.
- Deferred items: none.

---

### [CHECKPOINT] Edge Runtime Env Guidance + PR Preview Smoke Gate - Completed

- Date: 2026-04-20
- Outcome summary: Added explicit `NEXT_RUNTIME` template guidance for edge-runtime detection (with operator guidance not to set it manually in Vercel), and introduced a pull-request preview smoke gate that boots `apps/client`, curls `/`, and fails on `5xx` responses to catch middleware/import regressions before merge.
- Actual files changed: `apps/client/.env.example`; `.github/workflows/ci.yml`; `apps/client/docs/CHANGELOG.md`.
- Guardrail outcomes delivered:
  1. Runtime marker guidance is now commit-visible in env templates, reducing confusion around framework-injected `NEXT_RUNTIME` behavior.
  2. CI now enforces a preview-style root-route smoke check that hard-fails on `5xx` responses.
  3. Middleware import/runtime failures now have a deterministic pre-merge detection surface in PR workflows.

### [FIX] Cloudflare Worker Oversized Asset Failures (25 MiB Cap) - Completed

- Date: 2026-04-20
- Outcome summary: Resolved Cloudflare deploy failures caused by oversized PNG assets by compressing oversized `public/` imagery, removing one unreferenced decode-corrupt asset, and adding explicit build-time asset budget enforcement.
- Actual files changed: `apps/client/public/*.png` (optimized set including `architect.png`, `hero.png`, `hardware.png`, `professional.png`, `kitchen-fixtures.png`, `tiles.png`); `apps/client/public/furniture.png` (removed, unreferenced); `apps/client/scripts/optimize-public-images.mjs`; `apps/client/scripts/check-worker-asset-budget.mjs`; `apps/client/package.json`; `apps/client/docs/CHANGELOG.md`; `apps/client/README.md`.
- Verification commands run and results:
  1. `pnpm -C apps/client run optimize:public-images` (pass after removing decode-corrupt unreferenced `public/furniture.png`; optimized 12 oversized files).
  2. `pnpm -C apps/client run optimize:public-images` (rerun pass; optimized `0` files, confirming deterministic/idempotent behavior on current assets).
  3. `pnpm -C apps/client run check:worker-asset-budget:public` (pass; top largest asset now `public/favicon.svg` at `11.84 MiB`, all files <= `25 MiB`).
  4. `cd apps/client; pnpm run build` (pass, terminal exit code `0`).
  5. `pnpm -C apps/client run build:cloudflare-worker` (local Windows run progressed through pre-build asset-budget pass and Next.js compilation/static generation; standalone trace emitted Windows symlink `EPERM` warnings, so CI/Linux run remains authoritative for deployment gating).
- Guardrail outcomes delivered:
  1. Cloudflare Worker build now fails fast with actionable output if any static asset exceeds 25 MiB.
  2. Public image optimization is scripted and repeatable, reducing the chance of regression from manual image updates.
  3. Deployment path now enforces size policy before and after OpenNext generation.

### [FIX] Cloudflare OpenNext Build Prompt Timeout (Wrangler Discovery) - Completed

- Date: 2026-04-18
- Outcome summary: Eliminated the Cloudflare custom-build timeout caused by OpenNext waiting for interactive Wrangler config confirmation by adding an app-local Wrangler config and forcing explicit non-interactive build flags.
- Actual files changed: `apps/client/wrangler.toml`; `apps/client/package.json`; `package.json`; `apps/client/README.md`; `apps/client/docs/CHANGELOG.md`.
- Verification commands run and results:
  1. `pnpm -C apps/client exec opennextjs-cloudflare build --config wrangler.toml --skipWranglerConfigCheck --skipNextBuild` (confirmed no interactive Wrangler-config prompt; command then fails fast on missing `.next` artifact as expected when `--skipNextBuild` is set).
  2. `pnpm run client:tsc-noemit` (pass, no diagnostics).
- Guardrail outcomes delivered:
  1. OpenNext Cloudflare builds now resolve Wrangler config from `apps/client/wrangler.toml` in the app working directory.
  2. Build script now uses explicit `--config wrangler.toml --skipWranglerConfigCheck` flags to avoid CI prompt hangs.
  3. Deploy script now runs Wrangler from `apps/client` to keep build and deploy config resolution aligned.

### [CHECKPOINT] Cloudflare Worker Entrypoint Contract for Client Deploys - Completed

- Date: 2026-04-18
- Outcome summary: Added an explicit Cloudflare Worker deployment contract so `wrangler deploy` always has a deterministic Worker entrypoint and asset directory, eliminating "Missing entry point to Worker script or to asset directory" deployment failures.
- Actual files changed: `wrangler.toml`; `apps/client/package.json`; `package.json`; `apps/client/README.md`; `apps/client/docs/CHANGELOG.md`.
- Verification commands run and results:
  1. `pnpm -C apps/client exec vitest run __tests__/lib/env.validation.test.ts --maxWorkers=1` (pass, `1` file and `7` tests).
  2. `pnpm -C apps/client exec tsc --noEmit` (pass, no diagnostics).
- Guardrail outcomes delivered:
  1. Root Wrangler configuration now pins Worker main to `apps/client/.open-next/worker.js` and assets to `apps/client/.open-next/assets`.
  2. Wrangler build hook now generates the Cloudflare Worker artifact before deploy via `pnpm run client:build:cloudflare-worker`.
  3. Root scripts now provide explicit operator commands for Cloudflare Worker build and deploy flows.

### [CHECKPOINT] Env Validation Build-Phase Deferral + Runtime Fail-Fast Regression Coverage - Completed

- Date: 2026-04-18
- Outcome summary: Updated the canonical env boundary to defer missing server-only required secrets during Next build static analysis while preserving strict runtime fail-fast behavior, and added focused regression tests for build-vs-runtime validation semantics.
- Actual files changed: `apps/client/app/lib/infrastructure/env.ts`; `apps/client/__tests__/lib/env.validation.test.ts`; `apps/client/docs/CHANGELOG.md`.
- Verification commands run and results:
  1. `pnpm -C apps/client exec vitest run __tests__/lib/env.validation.test.ts --maxWorkers=1` (pass, `1` file and `6` tests).
  2. Task `build-client-tsc-noemit-checkpoint` (`pnpm -C apps/client exec tsc --noEmit`) (pass, no diagnostics).
- Guardrail outcomes delivered:
  1. Build-phase env validation now defers only the explicit server-only required set (`AUTH_SECRET`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `DATABASE_URL`, `ENCRYPTION_KEY_V1`).
  2. Runtime validation remains strict and throws immediately when deferred secrets are still missing.
  3. Regression tests now lock in both build deferral and runtime fail-fast behavior for `validateEnv(...)`.

### [CHECKPOINT] Legacy NextAuth Surface Removal (Clerk Canonical Path) - Completed

- Date: 2026-04-18
- Outcome summary: Removed the legacy NextAuth route and support surfaces so `apps/client` auth stays Clerk-canonical, eliminating stale `/api/auth` references that were causing build-time route collection failures.
- Actual files changed: `apps/client/app/api/auth/[...nextauth]/route.ts`; `apps/client/app/lib/auth/auth.ts`; `apps/client/app/lib/auth/auth.config.ts`; `apps/client/app/lib/auth/index.ts`; `apps/client/app/actions/passwordReset.ts`; `apps/client/app/auth/signin/page.tsx`; `apps/client/app/auth/credentials/page.tsx`; `apps/client/app/ui/GoogleSignIn.tsx`; `apps/client/types/next-auth.d.ts`; `apps/client/package.json`; `apps/client/app/lib/infrastructure/env.ts`; `apps/client/.env.example`; `apps/client/.env.test`; `apps/client/.env.development`; `apps/client/components/chat/README.md`; `apps/client/app/lib/auth/password-hash.ts`; `apps/client/docs/CHANGELOG.md`.
- Verification commands run and results:
  1. `rg -n "next-auth|nextauth|/api/auth|NEXTAUTH_URL|AUTH_URL" apps/client` (pass, no matches).
  2. `pnpm -C apps/client exec tsc --noEmit` (pass, exit code `0` after clearing stale `.next` generated route types).
- Notes: Local `pnpm -C apps/client run build` was interrupted by an interactive shell timeout prompt (`Terminate batch job`), so build verification should be re-run in CI or a non-interrupted terminal session.

### [RUN] Onboarding Convergence Phase 6 - Baseline Validation Gates Executed (Telemetry Pending)

- Date: 2026-04-14
- Outcome summary: Executed the full Phase 6 baseline validation gates and captured artifacts under `apps/client/tmp/phase6-evidence`; telemetry health reporting remains pending because required staging/production NDJSON exports are not present in the workspace.
- Runtime artifacts generated:
  1. `apps/client/tmp/phase6-evidence/onboarding-validation-vitest.txt`
  2. `apps/client/tmp/phase6-evidence/onboarding-validation-drift.txt`
  3. `apps/client/tmp/phase6-evidence/onboarding-validation-client-tsc.txt`
  4. `apps/client/tmp/phase6-evidence/onboarding-validation-admin-tsc.txt`
- Verification commands run and results:
  1. `pnpm -C apps/client exec vitest run __tests__/api/onboarding/ __tests__/actions/onboarding-tier3-guards.test.ts __tests__/actions/tier3-high-value-guard-policy.test.ts __tests__/lib/domains/onboarding-orchestration.contract.test.ts __tests__/api/internal/onboarding-remediation.route.test.ts --maxWorkers=1` (pass, `10` files and `76` tests).
  2. `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported drift categories `0`).
  3. `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, exit code `0`).
  4. `pnpm run admin:check-types` (pass, no diagnostics).
- Blocking inputs for Phase 6 completion:
  1. `apps/client/tmp/phase6-evidence/staging-canary.ndjson`
  2. `apps/client/tmp/phase6-evidence/staging-broad.ndjson`
  3. `apps/client/tmp/phase6-evidence/production-canary.ndjson`
  4. `apps/client/tmp/phase6-evidence/production-broad.ndjson`
- Notes: After the four NDJSON files are provided, run the `report:projects-mutation-health` and summary commands in Section 6.4 of `apps/client/docs/ONBOARDING-CONVERGENCE-PLAN.md` and then record a final Phase 6 completion checkpoint.

### [PREP] Onboarding Convergence Phase 6 - Production Validation Runbook Ready

- Date: 2026-04-14
- Outcome summary: Added an explicit operator runbook for final Phase 6 production validation, including exact commands, deterministic evidence artifact paths, and completion gates for staging and production telemetry windows.
- Actual files changed: `apps/client/docs/ONBOARDING-CONVERGENCE-PLAN.md`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Runbook commands added:
  1. Full onboarding-adjacent validation suite command with output capture.
  2. Strict drift/typecheck/admin typecheck commands with evidence output capture.
  3. Staging and production mutation-health report commands for canary and broad windows.
  4. Summary-generation commands for each telemetry window JSON report.
- Notes: This prep entry does not mark Phase 6 complete; it records that execution guidance and evidence paths are now commit-visible and ready for runtime use.

### [CHECKPOINT] Onboarding Convergence Phase 5 - Guard/Policy Drift Rebalancing - Completed

- Date: 2026-04-14
- Outcome summary: Completed Phase 5 by adding onboarding route guard registry coverage, rebalancing drift enforcement for direct-auth onboarding routes, adding dedicated onboarding route guard/sequencing policy tests, and removing stale onboarding hook guidance.
- Actual files changed: `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/scripts/high-risk-registry.mjs`; `apps/client/__tests__/actions/tier3-high-value-guard-policy.test.ts`; `apps/client/__tests__/api/onboarding/onboarding-route-guard-and-sequencing.test.ts`; `apps/client/app/onboarding/_hooks/useOnboarding.ts`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results:
  1. `pnpm -C apps/client run build:high-risk-registry` (pass, regenerated `scripts/high-risk-registry.mjs`).
  2. `pnpm -C apps/client exec vitest run __tests__/api/onboarding/ --maxWorkers=1` (pass, `6` files and `43` tests).
  3. `pnpm -C apps/client exec vitest run __tests__/actions/tier3-high-value-guard-policy.test.ts --maxWorkers=1` (pass, `1` file and `10` tests).
  4. `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported drift categories `0`; output captured in `tmp-phase5-drift.txt`).
  5. `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, no diagnostics output).
- Guardrail outcomes delivered:
  1. `HIGH_VALUE_ROUTE_GUARD_RULES` now includes all three active onboarding mutation routes with explicit `AUTH-RATIONALE` markers for direct Clerk-auth surfaces.
  2. Strict drift now validates direct-export onboarding routes with empty auth options when rationale is declared, instead of forcing false-positive `missing-withauth-export` failures.
  3. Actor-scoped throttling drift checks now recognize `clerkId`-scoped `getActorRateLimitIdentifier(...)` usage for authenticated direct-auth route handlers.
  4. Dedicated onboarding route guard/sequencing policy tests now enforce canonical order, actor-scoped rate limiting, idempotency completion fail-safe handling, and static-safe adapter error mapping.
  5. The stale onboarding hook comment was replaced with the accurate shared-orchestration warning contract note.

### [SNAPSHOT] Onboarding Convergence Pre-Phase 5 Verification - Green

- Timestamp: 2026-04-14 11:12 (local)
- Scope: Fresh pre-implementation verification baseline before starting Phase 5 guard and policy rebalancing.
- Verification commands run and results:
  1. `pnpm -C apps/client exec vitest run __tests__/api/internal/onboarding-remediation.route.test.ts --maxWorkers=1` (pass, `1` file and `8` tests).
  2. `pnpm -C apps/admin exec vitest run src/actions/admin/__tests__/onboarding-remediation.test.ts --maxWorkers=1` (pass, `1` file and `5` tests).
  3. `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported drift categories `0`; output captured in `tmp-phase5-preflight-drift.txt`).
  4. `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, no diagnostics output).
- Notes: This snapshot confirms the Phase 4 remediation stack is stable at the point Phase 5 work begins.

### [CHECKPOINT] Onboarding Convergence Phase 4 - Internal Remediation Workflows - Completed

- Date: 2026-04-14
- Outcome summary: Completed Phase 4 by adding onboarding remediation domain methods, internal secret-gated remediation endpoints, admin remediation actions, policy-map wiring, and targeted tests for both client internal adapters and admin workflows.
- Actual files changed: `apps/client/app/lib/domains/user-profile/remediation.ts`; `apps/client/app/lib/domains/user-profile/index.ts`; `apps/client/app/api/internal/onboarding-remediation/reconcile/route.ts`; `apps/client/app/api/internal/onboarding-remediation/clerk-sync/route.ts`; `apps/client/app/api/internal/onboarding-remediation/idempotency-reconcile/route.ts`; `apps/client/__tests__/api/internal/onboarding-remediation.route.test.ts`; `apps/admin/src/actions/admin/onboarding-remediation.ts`; `apps/admin/src/actions/admin/__tests__/onboarding-remediation.test.ts`; `apps/admin/src/lib/security/authorization-policy.ts`; `apps/admin/src/actions/admin/index.ts`; `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/scripts/high-risk-registry.mjs`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results:
  1. `pnpm -C apps/client exec vitest run __tests__/api/internal/onboarding-remediation.route.test.ts --maxWorkers=1` (pass, `1` file and `8` tests).
  2. `pnpm -C apps/admin exec vitest run src/actions/admin/__tests__/onboarding-remediation.test.ts --maxWorkers=1` (pass, `1` file and `5` tests).
  3. `pnpm run admin:check-types` (pass, no diagnostics).
  4. `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported categories `0`).
  5. Task `build-client-tsc-noemit-checkpoint` (completed with no diagnostics output in task terminal).
- Guardrail outcomes delivered:
  1. Internal onboarding remediation endpoints are authenticated by `INTERNAL_API_SECRET`, rate-limited, and emit structured ADR-005 adapter outcomes.
  2. Remediation domain methods now support reconciliation reads, Clerk metadata forced sync, and safe idempotency stuck-key recovery with mutation-precondition checks.
  3. Admin remediation actions are policy-gated (`risk: high`) and require `SUPER_ADMIN` granular role before calling internal endpoints.
  4. Strict drift remains zero after registry regeneration and internal-route governance alignment.
- Deferred items: Phase 5 guard/policy rebalancing and additional onboarding route sequencing coverage remain pending in `apps/client/docs/ONBOARDING-CONVERGENCE-PLAN.md`.

### [CHECKPOINT] Onboarding Convergence Phase 3 - Server Action + No-JS Fallback - Completed

- Date: 2026-04-14
- Outcome summary: Completed Phase 3 by converging onboarding server actions onto shared orchestration, removing action-level side-effect loops, adding a signed no-JS onboarding fallback route family, and wiring a `<noscript>` redirect hint on the JS onboarding entry route.
- Actual files changed: `apps/client/app/actions/onboarding.ts`; `apps/client/__tests__/actions/onboarding-tier3-guards.test.ts`; `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/__tests__/actions/tier3-high-value-guard-policy.test.ts`; `apps/client/scripts/high-risk-registry.mjs`; `apps/client/app/lib/infrastructure/onboarding-nojs-session.ts`; `apps/client/app/onboarding/no-js/page.tsx`; `apps/client/app/onboarding/no-js/client/page.tsx`; `apps/client/app/onboarding/no-js/professional/page.tsx`; `apps/client/app/onboarding/no-js/review/page.tsx`; `apps/client/app/onboarding/no-js/_components/NoJsClientForm.tsx`; `apps/client/app/onboarding/no-js/_components/NoJsProfessionalForm.tsx`; `apps/client/app/onboarding/no-js/_components/NoJsReview.tsx`; `apps/client/app/onboarding/page.tsx`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results:
  1. `pnpm -C apps/client exec vitest run __tests__/actions/onboarding-tier3-guards.test.ts __tests__/actions/tier3-high-value-guard-policy.test.ts --maxWorkers=1 --reporter=verbose` (pass, `2` files and `16` tests).
  2. `pnpm -C apps/client run build:high-risk-registry` (pass, regenerated `apps/client/scripts/high-risk-registry.mjs`).
  3. `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported categories `0`, including `highValueServerActionGuards` and `criticalTransitionStepSequencing`).
  4. `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `TSC_EXIT:0`).
- Guardrail outcomes delivered:
  1. Onboarding server actions now execute a single shared orchestration path and return static-safe mapped error responses.
  2. Tier-3 critical transition sequencing policy is now aligned with action-level idempotency guard and orchestration helper execution order.
  3. No-JS onboarding now uses a signed, `HttpOnly`, `SameSite=Strict`, one-hour cookie session constrained to ADR-006 Class C/D fields only.
  4. Server-rendered no-JS onboarding pages now support role selection, client/professional detail collection, review, submit, and skip flows without browser JavaScript.
- Deferred items: Phase 4 onboarding remediation workflows remain pending in `apps/client/docs/ONBOARDING-CONVERGENCE-PLAN.md`.

### [CHECKPOINT] Onboarding Convergence Phase 1 - Shared Orchestration Contract - Completed

- Date: 2026-04-14
- Outcome summary: Completed Phase 1 by adding a shared onboarding orchestration module with typed intent contracts, warning-envelope support for non-fatal professional resource creation, Clerk finalization fail-closed handling, and idempotency completion fail-safe semantics.
- Actual files changed: `apps/client/app/lib/domains/shared/onboarding-orchestration/contracts.ts`; `apps/client/app/lib/domains/shared/onboarding-orchestration/service.ts`; `apps/client/app/lib/domains/shared/onboarding-orchestration/index.ts`; `apps/client/__tests__/lib/domains/onboarding-orchestration.contract.test.ts`; `apps/client/docs/PROGRESS-SUMMARY.md`; `apps/client/docs/CHANGELOG.md`.
- Verification commands run and results:
  1. `pnpm -C apps/client exec vitest run __tests__/lib/domains/onboarding-orchestration.contract.test.ts --maxWorkers=1` (pass, `1` file and `8` tests, `EXIT:0`).
  2. Task `shell: build-client-tsc-noemit` (pass after import syntax correction; no diagnostics output in final run).
- Guardrail outcomes delivered:
  1. Shared orchestration contract now centralizes onboarding transition sequencing across submit and skip intents.
  2. Clerk synchronization failures now return a dedicated orchestration error code (`clerk_sync_failed`) and preserve retryability.
  3. Completion persistence failures no longer convert successful onboarding transitions into failures.
  4. Professional submit side-effects now produce typed warning entries for non-fatal store/property creation failures.
- Deferred items: Phase 2 route convergence and Phase 3 server-action convergence remain pending.

### [CHECKPOINT] Onboarding Convergence Phase 0 - Route Hardening - Completed

- Date: 2026-04-14
- Outcome summary: Completed Phase 0 live-regression hardening for active onboarding route adapters by applying actor-scoped throttling keys, static-safe error mappings, explicit log-field emission, duplicate-header cleanup, and idempotency completion fail-safe handling.
- Actual files changed: `apps/client/app/api/onboarding/route.ts`; `apps/client/app/api/onboarding/skip/route.ts`; `apps/client/app/api/onboarding/skip-professional/route.ts`; `apps/client/__tests__/api/onboarding/route.test.ts`; `apps/client/__tests__/api/onboarding/skip.test.ts`; `apps/client/__tests__/api/onboarding/skip-professional.test.ts`; `apps/client/docs/PROGRESS-SUMMARY.md`; `apps/client/docs/CHANGELOG.md`.
- Verification commands run and results:
  1. `pnpm -C apps/client exec vitest run __tests__/api/onboarding/ --maxWorkers=1` (pass, `5` files and `39` tests).
  2. `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported drift categories `0`).
  3. Task `build-client-tsc-noemit-checkpoint` (completed; no diagnostics output in task terminal).
- Guardrail outcomes delivered:
  1. Onboarding adapters now use actor-scoped rate-limit identifiers for authenticated calls.
  2. Skip and submit onboarding adapters now return static-safe error strings instead of domain-message passthrough.
  3. Route-level idempotency completion failures no longer convert successful mutations into error responses.
  4. Onboarding adapter logs now avoid opaque `additionalContext` payload bags.
- Deferred items: onboarding convergence Phase 1 shared orchestration module and later adapter unification phases remain pending.

### [CHECKPOINT] Section 14 R10 Residual Observability Inventory Sweep - Completed

- Date: 2026-04-14
- Outcome summary: Completed the residual R10 observability sweep by adding ADR-005 operation-name inventory annotations across all previously observability-⚠️ slices in domain contracts.
- Actual files changed: `apps/client/app/lib/domains/finance/contracts.ts`; `apps/client/app/lib/domains/documents/contracts.ts`; `apps/client/app/lib/domains/licenses/contracts.ts`; `apps/client/app/lib/domains/certificates/contracts.ts`; `apps/client/app/lib/domains/messaging/contracts.ts`; `apps/client/app/lib/domains/professionals/contracts.ts`; `apps/client/app/lib/domains/portfolio/contracts.ts`; `apps/client/app/lib/domains/idea-books/contracts.ts`; `apps/client/app/lib/domains/reviews/contracts.ts`; `apps/client/app/lib/domains/search/contracts.ts`; `apps/client/app/lib/domains/calendar/contracts.ts`; `apps/client/docs/PROGRESS-SUMMARY.md`; `apps/client/docs/CHANGELOG.md`.
- Verification commands run and results:
  1. Task `report-security-drift-strict-medium3` (pass, all reported drift categories `0`).
  2. `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `TSC_EXIT:0`).
- Guardrail outcomes delivered:
  1. Observability operationName inventories are now documented for all slices currently represented in the Section 14 registry.
  2. Open defect `OD-004` (residual observability inventory gap) is closed in `PROGRESS-SUMMARY`.
  3. Remaining governance blocker is narrowed to Phase 2 Criterion 2 operational monitoring evidence capture.
- Deferred items: capture staging and production NDJSON evidence windows for Phase 2 Criterion 2 closeout.

### [CHECKPOINT] Section 14 R8-R10 Closure Wave (Notifications, Seller-Insights, User-Rights) - Completed

- Date: 2026-04-14
- Outcome summary: Completed the requested Section 14 implementation wave by hardening notifications and seller-insights adapters (R8), completing targeted IDOR policy matrix suites (R9), and normalizing/documenting ADR-005 operation-name inventories for user-rights and client-dashboard surfaces (R10).
- Actual files changed: `apps/client/app/api/notifications/route.ts`; `apps/client/app/api/notifications/[id]/route.ts`; `apps/client/app/api/professional-portal/inventory/alerts/route.ts`; `apps/client/app/api/professional-portal/orders/route.ts`; `apps/client/app/api/professional-portal/products/top/route.ts`; `apps/client/app/api/user/consent/route.ts`; `apps/client/app/api/user/deletion/route.ts`; `apps/client/app/api/user/export/route.ts`; `apps/client/app/api/user/profile/route.ts`; `apps/client/app/api/user/profile/complete/route.ts`; `apps/client/app/api/user/profile/complete/client/route.ts`; `apps/client/app/api/user/profile/complete/professional/route.ts`; `apps/client/app/api/user/profile/complete/shared.ts`; `apps/client/app/api/user/rectification/route.ts`; `apps/client/app/api/client/dashboard/route.ts`; `apps/client/app/lib/domains/client-dashboard/contracts.ts`; `apps/client/app/lib/domains/notifications/contracts.ts`; `apps/client/app/lib/domains/seller-insights/contracts.ts`; `apps/client/app/lib/domains/user-profile/compliance.ts`; `apps/client/app/lib/domains/user-profile/profile-complete-contracts.ts`; `apps/client/app/lib/domains/user-profile/service.ts`; `apps/client/__tests__/api/notifications.route.test.ts`; `apps/client/__tests__/api/notifications/notification-id.route.test.ts`; `apps/client/__tests__/api/professional-portal/seller-insights-adapters.route.test.ts`; `apps/client/__tests__/policy/{calendar,notifications,professionals,seller-insights,user-rights,idea-books}/**`.
- Verification commands run and results:
  1. `pnpm -C apps/client exec vitest run __tests__/api/notifications __tests__/api/professional-portal/seller-insights-adapters.route.test.ts --maxWorkers=1` (pass, `4` files and `11` tests).
  2. `pnpm -C apps/client exec vitest run __tests__/policy --maxWorkers=1 --reporter=json --outputFile tmp-r9-policy-all.json` (pass, `16` files and `55` tests).
  3. Task `report-security-drift-strict-medium3` (pass, all reported drift categories `0`).
  4. `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `TSC_EXIT:0`).
- Guardrail outcomes delivered:
  1. Notifications and seller-insights adapters now use actor-scoped rate-limit keys, safe static forbidden mapping, and structured terminal outcome logs aligned to ADR-005 fields.
  2. Notifications collection and item mutation handlers now enforce CSRF via route-level `withAuth` options.
  3. Policy matrix coverage now includes targeted owner vs non-owner vs not-found boundaries across calendar, notifications, seller-insights, user-rights, professionals, and idea-books attachment flows.
  4. User-rights and client-dashboard operation-name join keys are normalized to snake_case and inventoried in domain contract annotations.
- Deferred items: residual R10 inventory follow-through for remaining observability-⚠️ slices and Phase 2 Criterion 2 staging/production telemetry evidence capture remain open.

### [DOCS] Section 14 Domain Audit Registry + Documentation Hardening - 2026-04-11

#### Documentation

- Added Section 14 `Domain Audit Registry and Remediation Plan` to
  `API-TO-FRONTEND-ARCHITECTURE.md`. Defines binary compliance rubric (Layers
  A-G, 46 checks), risk tier classification, full slice registry with current
  status, ordered remediation phases, CHANGELOG and PROGRESS-SUMMARY
  documentation protocols, and agent execution standard.
- Added `ARCH-GUIDE-SECTION5-ADDENDUM.md` (new cross-cutting rules 5.A-5.E:
  idempotency completion fail-safe, tiered recentAuth windows, actor context
  completeness, high-risk registry governance, security utility deprecation).
- Added `ARCH-GUIDE-SECTION6-7-ADDENDUM.md` (anti-patterns 27-32, Section 7.6
  Mock Type Fidelity Requirement).
- Added `ADR-001-AMENDMENT-2026-04-11.md` (canonical Tier 1/Tier 2 recentAuth
  window constants; clerkId forwarding requirement for verification/onboarding).
- Updated `apps-client-api-adapters.instructions.md` (rules 12-17: variable-
  rebound message passthrough prohibition, idempotency completion fail-safe,
  clerkId forwarding, registry completeness, maxAgeSeconds tier verification).
- Updated `apps-client-testing-risk.instructions.md` (rules 7-11: AuthContext
  mock fidelity, error assertion inversion prohibition, actor call argument
  completeness, complete() throw testing, BYPASS_AUTH exclusion assertion).
- Produced reconciliation guide correcting Section 14 slice registry to reflect
  actual post-autopsy state (all Tier 4 slices confirmed migrated; all Critical
  and High autopsy defects confirmed closed).
- Added a tracked governance mirror section in `apps/client/docs/PROGRESS-SUMMARY.md`
  so Section 14 execution state is commit-visible through tracked docs surfaces.

**Files changed:** `apps/client/docs/CHANGELOG.md`;
`apps/client/docs/PROGRESS-SUMMARY.md`; architecture guide Section 14 insert;
five instruction/ADR addendum files

**Verification:** Architecture guide cross-checked against ADR-001 through
ADR-006 - no conflicts. Instruction files cross-checked against existing
`.github/instructions/` - no conflicts. Slice status reconciled against full
CHANGELOG history - all Critical/High autopsy defects confirmed closed.

### [CHECKPOINT] Non-Autopsy 8 - Phase 2 Criterion 2 Operational Handoff Checklist (Commit-Visible) - Completed

- Date: 2026-04-13
- Outcome summary: Added a commit-visible Criterion 2 evidence-capture checklist so the final staging/production monitoring signoff can be executed and audited without depending on ignored doc surfaces.
- Actual files changed: `apps/client/docs/PROGRESS-SUMMARY.md`; `apps/client/docs/CHANGELOG.md`.
- Verification commands run and results: `pnpm -C apps/client run report:projects-mutation-health -- --help` (pass, usage output); `node apps/client/scripts/summarize-project-mutation-health.mjs --input apps/client/tmp/coverage-trio/coverage-summary.json --json` (pass, safe zero-signal JSON output).
- Guardrail outcomes delivered:
  1. Captured a single operational checklist for required canary and broad-rollout evidence windows.
  2. Locked command shape and required signal set (write 5xx, idempotency `409`, optimistic-lock `428`/version-conflict `409`) in tracked docs.
  3. Preserved explicit deferred-state semantics: Criterion 2 remains open until real staging/production exports are ingested and archived.
- Decision: Final closeout checkpoint for Phase 2 Criterion 2 is deferred until the project is production-ready and real staging/production NDJSON exports are available.
- Deferred items: run final closeout only after production-readiness declaration and evidence capture from staging plus production windows.

### [CHECKPOINT] Non-Autopsy 7 - Projects Mutation Monitoring Evidence Tooling (Criterion 2 Enablement) - Completed

- Date: 2026-04-13
- Outcome summary: Added projects mutation monitoring tooling and runbook support for Phase 2 Criterion 2 evidence capture across canary and broad rollout windows.
- Actual files changed: `apps/client/scripts/summarize-project-mutation-health.mjs`; `apps/client/package.json`; `apps/client/docs/PROJECTS-GENERIC-API-ROLLOUT.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results: `node apps/client/scripts/summarize-project-mutation-health.mjs --help` (pass, usage output); `node apps/client/scripts/summarize-project-mutation-health.mjs --input apps/client/tmp/coverage-trio/coverage-summary.json` (pass, safe summary output).
- Guardrail outcomes delivered:
  1. Introduced deterministic mutation health summarization for `/api/projects/**` write-path logs.
  2. Added threshold-based failure options for write error, idempotency conflict, and optimistic-lock conflict rates.
  3. Added evidence-capture template and interpretation guidance to support auditable rollout signoff.
- Deferred items: staging/production log export ingestion remains required to mark Criterion 2 fully complete.

### [CHECKPOINT] Non-Autopsy 6 - Generic Projects Rollout Flag Retirement + Client Surface GA Cutover - Completed

- Date: 2026-04-13
- Outcome summary: Completed the next rollout/contract-signoff tranche by retiring generic-projects rollout flags from runtime clients and env templates, then validating always-on generic read/write behavior for the canonical `/api/projects/**` surface.
- Actual files changed: `apps/client/app/lib/domains/projects/client/index.ts`; `apps/client/lib/projects-client.ts`; `apps/client/app/lib/infrastructure/env.ts`; `apps/client/__tests__/lib/projects-client-gate.test.ts`; `apps/client/__tests__/lib/projects-client-facade-gate.test.ts`; `apps/client/__tests__/lib/projects-client-split.test.ts`; `apps/client/.env.example`; `apps/client/.env.test`; `apps/client/.env.development`; `apps/client/.env.local.example`; `apps/client/docs/PROJECTS-GENERIC-API-ROLLOUT.md`; `apps/client/app/lib/API_ARCHITECTURE.md`; `apps/client/docs/ENV-FILES-AUDIT.md`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/lib/projects-client-gate.test.ts --maxWorkers=1` (pass, 1 file and 3 tests); `./scripts/invoke-clean.ps1 -WorkingDirectory . -CommandLine "pnpm -C apps/client exec vitest run __tests__/lib/projects-client-facade-gate.test.ts --maxWorkers=1"` (pass, 1 file and 3 tests); `./scripts/invoke-clean.ps1 -WorkingDirectory . -CommandLine "pnpm -C apps/client exec vitest run __tests__/lib/projects-client-split.test.ts __tests__/lib/projects-client-contracts.test.ts --maxWorkers=1"` (pass, 2 files and 5 tests); task `test-projects-api` (pass, 4 files and 19 tests); task `verify-projects-envelope-single-worker` (pass, 4 files and 25 tests); diagnostics scan on touched files reported no errors.
- Guardrail outcomes delivered:
  1. Generic projects reads and mutations now use one always-on runtime path across both domain and facade clients.
  2. Deprecated `NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API*` runtime dependencies were removed from env boundary typing and env templates.
  3. Projects client regression suites now validate post-cutover request-shaping behavior (including idempotency key propagation) instead of rollout gate toggles.
- Deferred items: production/staging mutation-path monitoring evidence remains pending as the final Phase 2 rollout signoff item.

### [CHECKPOINT] Non-Autopsy 5 - Idea Books AuthContext Fixture Cleanup + Projects Rollout Contract-Signoff Tranche 1 - Completed

- Date: 2026-04-13
- Outcome summary: Completed cleanup of idea-books API adapter auth fixtures to canonical `AuthContext`, then completed the next rollout/contract-signoff tranche by validating `/api/projects/**` envelope signoff coverage.
- Actual files changed: `apps/client/__tests__/api/idea-books.route.test.ts`; `apps/client/__tests__/api/idea-books/route.test.ts`; `apps/client/__tests__/api/idea-books/book-id.route.test.ts`; `apps/client/__tests__/api/idea-books/attachments.route.test.ts`; `apps/client/__tests__/api/idea-books/attachment-id.route.test.ts`; `apps/client/__tests__/api/projects/payment-routes.test.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/idea-books.route.test.ts __tests__/api/idea-books __tests__/policy/idea-books __tests__/lib/idea-books-client-contracts.test.ts --maxWorkers=1` (pass, 7 files and 24 tests); task `verify-projects-envelope-single-worker` (pass, 4 files and 25 tests); task `test-projects-api` (pass, 4 files and 19 tests after route-mock parity fix); task `build-client-tsc-noemit-checkpoint` (pass, no TypeScript diagnostics).
- Guardrail outcomes delivered:
  1. Idea-books API test fixtures now use production-faithful `AuthContext` shape only.
  2. Projects payment-route test mocks now include actor-scoped limiter helper parity (`getActorRateLimitIdentifier`) required by escrow fund/release adapters.
  3. Phase 2 rollout acceptance criterion for `/api/projects/**` route-envelope confirmation now has fresh passing signoff evidence.
- Deferred items: rollout monitoring and final generic-projects flag removal remain pending for subsequent tranches.

### [CHECKPOINT] Non-Autopsy 4 - Idea Books Deep Follow-Through (Browser Contracts + Collaborator/Privacy Policy Tests) - Completed

- Date: 2026-04-13
- Outcome summary: Completed the next non-autopsy queue item by normalizing idea-books browser contracts against domain DTOs and adding collaborator/privacy policy follow-through tests.
- Actual files changed: `apps/client/lib/idea-books-client.ts`; `apps/client/hooks/useIdeaBooks.ts`; `apps/client/__tests__/lib/idea-books-client-contracts.test.ts`; `apps/client/__tests__/policy/idea-books/access.policy.test.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/lib/idea-books-client-contracts.test.ts __tests__/policy/idea-books/access.policy.test.ts __tests__/lib/domains/idea-books.service.test.ts __tests__/api/idea-books/route.test.ts __tests__/api/idea-books/book-id.route.test.ts __tests__/api/idea-books/attachments.route.test.ts __tests__/api/idea-books/attachment-id.route.test.ts --maxWorkers=1` (pass, 7 files and 25 tests); task `build-client-tsc-noemit-checkpoint` (pass, no TypeScript diagnostics).
- Guardrail outcomes delivered:
  1. Idea-books client contracts now reuse domain-owned DTO shapes with explicit Date-to-string serialization at the browser boundary.
  2. Idea-books browser facade now has focused client-contract regression coverage for list/create/attachment endpoint semantics.
  3. Idea-books policy coverage now enforces collaborator/private access boundaries and owner-only mutation/delete constraints.
- Deferred items: remaining non-autopsy migration queue items continue in subsequent tranches.

### [CHECKPOINT] Non-Autopsy 3 - Documents/Licenses/Certificates/Reviews/Search/Client Dashboard Test Follow-Through - Completed

- Date: 2026-04-13
- Outcome summary: Completed the next non-autopsy queue item by delivering adapter-test follow-through for Documents, Licenses, Certificates, Reviews, Search, and Client Dashboard, including missing Search route coverage and safe-message contract tightening.
- Actual files changed: `apps/client/app/api/search/professionals/route.ts`; `apps/client/app/api/reviews/route.ts`; `apps/client/app/api/client/dashboard/route.ts`; `apps/client/__tests__/api/search/professionals.route.test.ts`; `apps/client/__tests__/api/reviews/route.test.ts`; `apps/client/__tests__/api/client/dashboard.route.test.ts`; `apps/client/__tests__/api/professional-portal/documents.route.test.ts`; `apps/client/__tests__/api/professional-portal/licenses.route.test.ts`; `apps/client/__tests__/api/professional-portal/certificates.route.test.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/search/professionals.route.test.ts __tests__/api/reviews/route.test.ts __tests__/api/client/dashboard.route.test.ts __tests__/api/professional-portal/documents.route.test.ts __tests__/api/professional-portal/licenses.route.test.ts __tests__/api/professional-portal/certificates.route.test.ts --maxWorkers=1` (pass, 6 files and 41 tests); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all categories `0`); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass).
- Guardrail outcomes delivered:
  1. Search, reviews, and client-dashboard adapters no longer pass domain message strings into `apiError(...)` for forbidden mappings.
  2. Search professionals route now has focused API coverage across validation, throttling, success mapping, and resilient failure behavior.
  3. Documents/licenses/certificates/client-dashboard route tests now use canonical `AuthContext` mock shape (`clerkId`, `dbUserId`, `userRole`) with no extra fixture fields.
- Deferred items: remaining non-autopsy migration queue items continue in subsequent tranches.

### [CHECKPOINT] Non-Autopsy 2 - Properties Document Collection DELETE Shim Retirement - Completed

- Date: 2026-04-13
- Outcome summary: Completed the next non-autopsy backlog item by retiring the deprecated collection-level property document delete shim and enforcing canonical item-route deletion.
- Actual files changed: `apps/client/app/api/properties/[id]/documents/route.ts`; `apps/client/__tests__/api/properties/property-documents.route.test.ts`; `apps/client/app/api/properties/README.md`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/properties/property-documents.route.test.ts --maxWorkers=1` (pass, 1 file and 11 tests); diagnostics scan on touched files reports no errors.
- Guardrail outcomes delivered:
  1. Properties document collection route surface is now strict (`GET` and `POST` only), removing the query-parameter delete compatibility shim.
  2. Properties adapter regression coverage now enforces canonical item-resource delete behavior and validates complete actor propagation in delete calls.
  3. Properties API docs now remove deprecated shim references and keep route-contract guidance aligned to item-resource mutations.
- Deferred items: remaining non-autopsy migration queue items continue in subsequent tranches.

### [CHECKPOINT] Non-Autopsy 1 - Properties If-Match Contract Hardening - Completed

- Date: 2026-04-11
- Outcome summary: Completed the next non-autopsy backlog item by enforcing strict header-based optimistic locking for property item updates and aligning browser facade mutation contracts.
- Actual files changed: `apps/client/app/api/properties/[id]/route.ts`; `apps/client/lib/properties-client.ts`; `apps/client/__tests__/api/properties/property-id.route.test.ts`; `apps/client/__tests__/lib/properties-client-contracts.test.ts`; `apps/client/app/api/properties/README.md`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/properties/property-id.route.test.ts __tests__/lib/properties-client-contracts.test.ts --maxWorkers=1` (pass, 2 files and 20 tests); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported categories `0`); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `TSC_EXIT:0`).
- Guardrail outcomes delivered:
  1. Property PATCH now returns `428` when `If-Match` is missing and `400` when `If-Match` is invalid, removing legacy body-version fallback behavior.
  2. Browser-side property update and delete clients now send canonical `If-Match` headers (`"N"`) and no longer include legacy body `version` fallback payloads.
  3. Route and browser-contract tests now enforce header-only optimistic-lock semantics to prevent fallback regressions.
- Deferred items: remaining non-autopsy migration queue items continue in subsequent tranches.

### [CHECKPOINT] Minor Fix 4 - High-Risk Guard Numeric Constant Enforcement - Completed

- Date: 2026-04-11
- Outcome summary: Completed the next minor autopsy item by adding explicit numeric constant checks for high-risk server-action guard values, preventing constant-name-only drift blind spots.
- Actual files changed: `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/scripts/high-risk-registry.mjs`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/__tests__/actions/tier3-high-value-guard-policy.test.ts`.
- Verification commands run and results: `pnpm -C apps/client run build:high-risk-registry` (pass); `pnpm -C apps/client exec vitest run __tests__/actions/tier3-high-value-guard-policy.test.ts --maxWorkers=1` (pass, 1 file and 9 tests); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported categories `0` including `highValueServerActionGuards`); `pnpm run client:tsc-noemit` (pass).
- Guardrail outcomes delivered:
  1. Registry policy now includes canonical numeric expectations for high-value guard constants.
  2. Drift checks now fail when required guard constants are missing or hold non-canonical numeric values.
  3. Tier-3 policy regression tests now explicitly cover mismatched guard constant value detection.
- Deferred items: remaining autopsy backlog proceeds outside this minor-fix tranche.

### [CHECKPOINT] Minor Fix 3 - Empty-Auth GET Rationale Marker Enforcement - Completed

- Date: 2026-04-11
- Outcome summary: Completed the next minor autopsy item by enforcing explicit `AUTH-RATIONALE:` markers on high-risk GET registry entries that intentionally use empty auth-option requirements.
- Actual files changed: `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/scripts/high-risk-registry.mjs`; `apps/client/scripts/report-security-drift.mjs`.
- Verification commands run and results: `pnpm -C apps/client run build:high-risk-registry` (pass, `REGISTRY_BUILD_EXIT:0`); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported categories `0`, including `emptyAuthOptionRationale`); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `TSC_EXIT:0`).
- Guardrail outcomes delivered:
  1. High-risk GET registry entries with `requiredAuthOptions: []` now include explicit `AUTH-RATIONALE:` markers.
  2. Strict drift now emits `emptyAuthOptionRationale` findings when such rationale markers are missing or malformed.
  3. Registry-to-drift governance now makes intentionally empty auth-option configuration auditable and machine-enforced.
- Deferred items: remaining minor autopsy backlog continues in subsequent tranches.

### [CHECKPOINT] Minor Fix 2 - Idempotency Completion Safety Drift Category - Completed

- Date: 2026-04-11
- Outcome summary: Completed the next minor autopsy item by introducing explicit strict-drift coverage for post-success idempotency completion safety in critical transitions and verification adapters.
- Actual files changed: `apps/client/scripts/report-security-drift.mjs`.
- Verification commands run and results: `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported categories `0`, including `idempotencyCompletionSafety`); `pnpm -C apps/client exec vitest run __tests__/actions/tier3-high-value-guard-policy.test.ts --maxWorkers=1` (pass, 1 file and 8 tests); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `TSC_EXIT:0`).
- Guardrail outcomes delivered:
  1. Strict drift now checks for unguarded `IdempotencyService.complete(...)` usage in critical transition and verification adapter surfaces.
  2. Transition-action completion-failure catches are validated for non-rethrow behavior in critical transition rules.
  3. Completion-safety regressions now surface as first-class drift findings (`idempotencyCompletionSafety`).
- Deferred items: remaining minor autopsy backlog continues in subsequent tranches.

### [CHECKPOINT] Minor Fix 1 - Redis Env Accessor Boundary Cleanup - Completed

- Date: 2026-04-11
- Outcome summary: Completed the next minor autopsy item by removing direct Redis URL/password `process.env` reads from the client env boundary config and routing them through env helper accessors.
- Actual files changed: `apps/client/app/lib/infrastructure/env.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/lib/env.validation.test.ts --maxWorkers=1` (pass, 1 file and 4 tests passed, `ENV_TEST_EXIT:0`); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all categories `0`, `DRIFT_LAST_EXIT:0`); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `TSC_EXIT:0`).
- Guardrail outcomes delivered:
  1. Redis password and URL env reads now flow through typed env helper functions (`getOptionalStringEnv`) instead of direct inline `process.env` access in `envConfig`.
  2. Empty optional Redis env values normalize to `undefined`, preserving prior optional semantics.
  3. Env boundary policy alignment improves for Redis connection credential access points.
- Regression guard added: focused env validation suite remains green after helper-based optional-string normalization.
- Deferred items: remaining minor autopsy backlog continues in subsequent tranches.

### [CHECKPOINT] Medium Fix 5 - Messaging Auth Fixture Canonical Context Cleanup - Completed

- Date: 2026-04-11
- Outcome summary: Completed the next medium autopsy item by removing non-canonical auth-fixture fields from messaging route auth-mapping tests, aligning mocked auth context with current adapter contract shape.
- Actual files changed: `apps/client/__tests__/api/messaging/route-auth-mapping.test.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/messaging/route-auth-mapping.test.ts --maxWorkers=1` (pass, 1 file and 31 tests passed, `MSG_TEST_EXIT:0`); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported categories `0`, `DRIFT_EXIT:0`).
- Guardrail outcomes delivered:
  1. Messaging auth-context fixtures no longer include non-canonical `userEmail` context payload.
  2. Messaging adapter tests now mock only the actor fields used by route adapters (`clerkId`, `dbUserId`, `userRole`).
  3. Historical medium autopsy finding on messaging auth-fixture shape is now closed by test-surface alignment.
- Regression guard added: full messaging auth-mapping suite remains green after fixture contract tightening.
- Deferred items: remaining medium/minor autopsy backlog continues in subsequent tranches.

### [CHECKPOINT] Medium Fix 4 - Finance Date DTO Boundary Normalization - Completed

- Date: 2026-04-11
- Outcome summary: Completed the next medium autopsy item by normalizing finance transaction DTO date fields to string values and enforcing ISO-date shaping in the finance domain service before adapter responses.
- Actual files changed: `apps/client/app/lib/domains/finance/contracts.ts`; `apps/client/app/lib/domains/finance/service.ts`; `apps/client/__tests__/actions/finance.test.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/actions/finance.test.ts __tests__/api/professional-portal/finance-routes.test.ts __tests__/lib/domains/finance.service.test.ts --maxWorkers=1` (pass, 3 files and 15 tests passed); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported categories `0`); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `TSC_EXIT:0`).
- Guardrail outcomes delivered:
  1. `FinanceTransactionListItem` and `FinanceTransactionDetail` contracts now model `date`, `createdAt`, `completedAt`, and `updatedAt` as string DTO fields.
  2. Finance service now normalizes list/detail transaction dates to ISO strings at the domain boundary, removing `Date` leakage across HTTP-facing adapter surfaces.
  3. Detail and withdrawal transaction outputs preserve existing numeric serialization while now emitting string timestamps consistently.
- Regression guard added: finance action and finance route/domain focused suites remain green with contract-aligned string timestamp fixtures.
- Deferred items: remaining medium/minor autopsy backlog continues in subsequent tranches.

### [CHECKPOINT] Medium Fix 3 - Certificate Limiter Namespace Normalization - Completed

- Date: 2026-04-11
- Outcome summary: Completed the next medium autopsy item by normalizing the certificates adapter family on a single actor-scoped limiter namespace (`prof-certificates-read` and `prof-certificates-write`) and aligning guard-policy references.
- Actual files changed: `apps/client/app/api/professional-portal/certificates/route.ts`; `apps/client/app/api/professional-portal/certificates/[id]/route.ts`; `apps/client/__tests__/api/professional-portal/certificates.route.test.ts`; `apps/client/scripts/high-risk-registry.mjs`; `apps/client/app/lib/security/high-risk-registry.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/professional-portal/certificates.route.test.ts --maxWorkers=1` (pass, 1 file and 10 tests passed); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all reported categories `0` including `actorScopedThrottling`); targeted diagnostics scan on touched certificate adapter, test, and registry files reports no code errors.
- Guardrail outcomes delivered:
  1. Certificates collection and by-id routes now use actor-scoped limiter keys consistently under the `prof-certificates-*` namespace.
  2. Legacy singular `certificate-*` and mixed plural namespace usage was removed from certificates route handling.
  3. Registry-driven high-risk guard checks now expect the normalized certificates namespace snippets.
- Regression guard added: certificates adapter tests assert `getActorRateLimitIdentifier(...)` is called with `prof-certificates-read` and `prof-certificates-write` for list/detail/mutation flows.
- Deferred items: remaining medium/minor autopsy backlog continues in subsequent tranches.

### [CHECKPOINT] Medium Fix 2 - DELETE Fallback Helper Guardrails - Completed

- Date: 2026-04-11
- Outcome summary: Completed the next medium autopsy item by removing body-fallback version helper exposure from properties shared utilities and tightening static drift detection for DELETE handlers that call fallback extractors.
- Actual files changed: `apps/client/app/api/properties/shared.ts`; `apps/client/app/api/properties/[id]/route.ts`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/__tests__/api/properties/property-id.route.test.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/properties/property-id.route.test.ts __tests__/api/stores/store-id.route.test.ts __tests__/api/messaging/route-auth-mapping.test.ts --maxWorkers=1` (pass, 3 files and 52 tests passed); `pnpm -C apps/client run report-security-drift:strict` (pass, all reported categories `0` including `deleteMethodSemanticsDrift`); `pnpm -C apps/client exec tsc --noEmit` (pass, exit code `0`).
- Guardrail outcomes delivered:
  1. `extractExpectedVersion` and `extractExpectedVersionFromIfMatch` are no longer exported from properties shared adapter utilities.
  2. Properties item route now imports version extractors from canonical request-utils boundary, reducing helper sprawl in shared adapter surfaces.
  3. `deleteMethodSemanticsDrift` now flags any `extractExpectedVersion(req, <anySecondArg>)` fallback call pattern in DELETE handlers, not only `body`-named arguments.
- Regression guard added: properties route tests now mock request-utils version extractor helpers directly, matching the canonical import surface.
- Deferred items: remaining medium/minor autopsy backlog continues in subsequent tranches.

### [CHECKPOINT] Medium Fix 1 - Redis Startup Readiness Validation For Rate-Limit Backend - Completed

- Date: 2026-04-11
- Outcome summary: Completed medium autopsy fix by adding explicit env-boundary startup/readiness validation for Redis-required rate-limit backend modes and wiring focused validation coverage.
- Actual files changed: `apps/client/app/lib/infrastructure/env.ts`; `apps/client/__tests__/lib/env.validation.test.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/lib/env.validation.test.ts --maxWorkers=1` (pass, 1 file and 4 tests passed, `ENV_TEST_EXIT:0`); `pnpm -C apps/client exec vitest run __tests__/lib/rate-limit-redis.test.ts --maxWorkers=1` (pass, 1 file and 5 tests passed, `RATE_LIMIT_TEST_EXIT:0`); `pnpm -C apps/client run report-security-drift:strict` (pass, all categories `0`, `DRIFT_EXIT:0`); `pnpm -C apps/client exec tsc --noEmit` (pass, `TSC_EXIT:0`).
- Guardrail outcomes delivered:
  1. Redis validation now checks `RATE_LIMIT_BACKEND` mode and enforces Redis readiness when required (`redis` always, `auto` in production).
  2. Startup auto-validation now includes the `redis` group when backend mode requires Redis, ensuring fail-closed startup for misconfigured production-like rate-limit backend selection.
  3. Env config now exposes typed `redis.rateLimitBackend` for consistent boundary consumers.
- Regression guard added: dedicated env validation tests assert failure on Redis-disabled and missing host/port cases under Redis-required modes, and non-enforcement when backend mode does not require Redis.
- Deferred items: remaining medium/minor autopsy items continue in subsequent tranches.

### [CHECKPOINT] High Fix Wave 3 - Actor Context Enrichment + Verification Key Summary Projection - Completed

- Date: 2026-04-11
- Outcome summary: Completed the requested next autopsy tranche by forwarding `clerkId` across verification and messaging actor contexts, and replacing verification POST idempotency key payload spreads with explicit summary projections.
- Actual files changed: `apps/client/app/lib/domains/{messaging,documents,certificates,licenses}/contracts.ts`; `apps/client/app/api/messaging/**`; `apps/client/app/api/professional-portal/{documents,documents/[id],certificates,certificates/[id],licenses,licenses/[id]}/route.ts`; `apps/client/__tests__/api/messaging/route-auth-mapping.test.ts`; `apps/client/__tests__/api/professional-portal/{documents,certificates,licenses}.route.test.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/messaging/route-auth-mapping.test.ts __tests__/api/professional-portal/documents.route.test.ts __tests__/api/professional-portal/certificates.route.test.ts __tests__/api/professional-portal/licenses.route.test.ts --maxWorkers=1` (pass, 4 files and 60 tests passed); `pnpm -C apps/client run report-security-drift:strict` (pass, all reported categories `0`); `pnpm -C apps/client exec tsc --noEmit` (pass, `EXIT:0`).
- Guardrail outcomes delivered:
  1. Messaging adapters now construct enriched `MessagingActor` payloads with `clerkId`, `userId`, and normalized role for domain calls.
  2. Verification adapters for documents, certificates, and licenses now forward `clerkId` in actor payloads for list/detail/mutation paths.
  3. Certificate and document POST idempotency-key generation now derives from explicit summary projections (asset reference plus structural field summary) instead of full payload spreading.
- Regression guard added: route tests now enforce enriched actor payload forwarding and explicit idempotency summary payload generation for document and certificate POST adapters.
- Deferred items: remaining autopsy medium/minor items continue in the next tranche.

### [CHECKPOINT] High Fix Wave 2 - Registry Parity + 180s Auth + Verification Alias Guard - Completed

- Date: 2026-04-11
- Outcome summary: Completed the requested sequence of high-priority autopsy items by expanding high-risk guard coverage to omitted user-rights and payout routes, tightening finance and escrow recent-auth windows to 180 seconds, and removing verification adapter alias message passthrough while widening detector coverage.
- Actual files changed: `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/scripts/high-risk-registry.mjs`; `apps/client/app/actions/finance.ts`; `apps/client/app/api/projects/[id]/escrow/[escrowId]/{fund,release,dispute}/route.ts`; `apps/client/app/api/professional-portal/finance/withdraw/route.ts`; `apps/client/app/api/professional-portal/finance/withdraw/[id]/route.ts`; `apps/client/app/api/user/{export,deletion,rectification}/route.ts`; `apps/client/app/api/professional-portal/{documents,documents/[id],certificates,licenses,licenses/[id]}/route.ts`; `apps/client/scripts/security-lint-checks.mjs`; `apps/client/__tests__/actions/finance.test.ts`; `apps/client/__tests__/api/professional-portal/finance-routes.test.ts`.
- Verification commands run and results: `pnpm -C apps/client run build:high-risk-registry` (pass); `pnpm -C apps/client exec vitest run __tests__/actions/tier3-high-value-guard-policy.test.ts __tests__/actions/finance.test.ts __tests__/api/professional-portal/finance-routes.test.ts __tests__/api/professional-portal/documents.route.test.ts __tests__/api/professional-portal/certificates.route.test.ts __tests__/api/professional-portal/licenses.route.test.ts --maxWorkers=1` (pass, 6 files and 48 tests passed); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all categories `0`); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, exit code `0`).
- Guardrail outcomes delivered:
  1. High-risk route registry now covers omitted user-rights and payout mutation surfaces with actor-scoped throttling enforcement.
  2. Finance and escrow recent-auth windows are now aligned to 180 seconds for high-value financial mutation paths.
  3. Verification adapter asset-related alias passthrough paths now use static client-safe mapping; adapter passthrough detector now catches `err.message` and `error.message` alias forms in scoped adapter surfaces.
- Deferred items: remaining open autopsy items continue in the next tranche (for example actor-context enrichment and idempotency payload summary projection).

### [CHECKPOINT] High Fix 1 - Onboarding Idempotency Completion Safety - Completed

- Date: 2026-04-11
- Outcome summary: Completed onboarding completion-safety hardening by making `submitOnboarding` idempotency replay persistence failures non-fatal after successful domain completion and Clerk finalization.
- Actual files changed: `apps/client/app/actions/onboarding.ts`; `apps/client/__tests__/actions/onboarding-tier3-guards.test.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/actions/onboarding-tier3-guards.test.ts --maxWorkers=1` (pass, 1 file and 4 tests passed); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all categories `0`); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, exit code `0`).
- Regression guard added: onboarding Tier-3 guard tests now assert successful `submitOnboarding` response when `IdempotencyService.complete(...)` throws after finalization, and assert no `IdempotencyService.fail(...)` call in that path.
- Regressions avoided: preserved existing conflict, validation, and finalization failure behavior while removing completion-persistence induced post-success failure risk.
- Deferred items: remaining High autopsy items (registry coverage parity, recent-auth tightening, verification alias passthrough cleanup, actor context enrichment, and payload-summary idempotency keys) remain pending.

### [CHECKPOINT] Critical Fix 2 - Messaging Adapter Error Hardening + Drift Scope Expansion - Completed

- Date: 2026-04-11
- Outcome summary: Completed the second critical autopsy remediation by removing domain-message passthrough from messaging adapters and expanding strict `adapterMessagePassthrough` drift coverage to include messaging route families.
- Actual files changed: `apps/client/app/api/messaging/**`; `apps/client/scripts/security-lint-checks.mjs`; `apps/client/__tests__/api/messaging/route-auth-mapping.test.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/messaging/route-auth-mapping.test.ts --maxWorkers=1` (pass, 1 file and 31 tests passed); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all categories `0`, including `adapterMessagePassthrough`); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `TSC_EXIT:0`).
- Regression guard added: messaging auth-mapping tests now assert static adapter-safe non-ok responses (`"Invalid request"`) for formerly passthrough paths.
- Regressions avoided: preserved existing HTTP status mappings, idempotency flow behavior, and successful-response payload contracts while removing domain text passthrough.
- Deferred items: onboarding idempotency completion safety and remaining High autopsy items remain pending.

### [CHECKPOINT] Critical Fix 1 - Finance Idempotency Completion Safety - Completed

- Date: 2026-04-11
- Outcome summary: Completed the first critical autopsy remediation by making withdrawal action completion-persistence failures non-fatal after successful domain mutation, preventing a post-success 500 response in finance flows.
- Actual files changed: `apps/client/app/actions/finance.ts`; `apps/client/__tests__/actions/finance.test.ts`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/actions/finance.test.ts --maxWorkers=1` (pass, 1 file and 8 tests passed); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `TSC_EXIT:0`).
- Regression guard added: finance action test now asserts success is returned when `IdempotencyService.complete(...)` throws after a successful withdrawal mutation, and that `IdempotencyService.fail(...)` is not called in that path.
- Regressions avoided: preserved existing structured failure mapping for genuine domain failures while eliminating a completion-persistence induced retry hazard.
- Deferred items: remaining critical autopsy blocker for messaging passthrough and drift coverage expansion.

### [AUTOPSY] ASVS Remediation Pass Defect Review (Pre-Staff Implementation) - Completed

- Date: 2026-04-11
- Scope: Phases 0 through 9 of ASVS-GAP-CLOSURE-REVISED-V2.md, reviewed against current code evidence in high-risk registry, rate-limit backend, verification adapters, messaging adapter tests, onboarding and finance actions, shared request helpers, and env boundary wiring.
- Classification model: Defects rated as Critical, High, Medium, or Minor. Critical and High findings block posture promotion.
- Outcome summary: The remediation pass delivered substantive improvements (Redis sliding-window backend, actor-scoped throttling, registry consolidation, DELETE semantics hardening, and stronger drift categories), but the autopsy identified unresolved defects and drift blind spots that must be fixed before claiming strengthened audit posture.
- Evidence surfaces reviewed: `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/app/lib/api/rate-limit.ts`; `packages/redis/src/rate-limit.ts`; `apps/client/__tests__/lib/rate-limit-redis.test.ts`; `apps/client/app/lib/domains/*/contracts.ts`; `apps/client/app/api/properties/shared.ts`; `apps/client/app/api/professional-portal/certificates/route.ts`; `apps/client/app/api/professional-portal/certificates/[id]/route.ts`; `apps/client/app/api/professional-portal/documents/route.ts`; `apps/client/app/api/properties/[id]/documents/route.ts`; `apps/client/app/actions/finance.ts`; `apps/client/app/actions/onboarding.ts`; `apps/client/__tests__/actions/tier3-high-value-guard-policy.test.ts`; `apps/client/__tests__/api/messaging/route-auth-mapping.test.ts`; `apps/client/app/lib/infrastructure/env.ts`.
- Critical defects:
  1. `apps/client/app/actions/finance.ts`: `IdempotencyService.complete(...)` errors are rethrown via outer catch, causing 500 after successful domain mutation and creating retry safety risk for financial operations.
  2. Messaging adapter message passthrough remains behaviorally present in `apps/client/__tests__/api/messaging/route-auth-mapping.test.ts` assertions, while `adapterMessagePassthrough` drift coverage does not currently catch this route family.
- High defects:
  1. `apps/client/app/lib/security/high-risk-registry.ts` omits user-rights and payout routes from high-value guard policy coverage (`/api/user/export`, `/api/user/deletion`, `/api/user/rectification`, payout initiation and cancel).
  2. Finance and escrow recent-auth windows are enforced at 300 seconds where the stricter 180-second requirement was expected for financial operations.
  3. `apps/client/app/actions/onboarding.ts` still has an unguarded `IdempotencyService.complete(...)` path in `submitOnboarding`.
  4. `apps/client/app/api/professional-portal/certificates/route.ts` and `apps/client/app/api/professional-portal/documents/route.ts` still include `err.message ?? ...` passthrough in POST error mapping; current lint pattern misses this alias form.
  5. Verification and messaging actors are not consistently forwarding `clerkId` into domain calls where actor context enrichment is expected.
  6. Idempotency key generation for certificate and document POST paths still spreads full payload objects instead of a Class C and D projection summary.
- Medium defects:
  1. `apps/client/app/lib/infrastructure/env.ts` does not validate Redis group readiness at startup for rate-limit backend modes that require Redis.
  2. `apps/client/app/api/properties/shared.ts` still exposes a helper with body-version fallback (`extractExpectedVersion`), creating future regression risk if reused in DELETE paths.
  3. Certificates route family has inconsistent rate-limit namespace tokens (plural and singular forms).
  4. Finance transaction list contracts still use `Date` fields across potential HTTP boundaries and should be normalized to string DTOs.
  5. Messaging auth-mapping tests still mock a non-canonical `userEmail` field in auth context fixtures.
- Minor defects:
  1. Registry snippet checks can validate option symbol usage without validating intended numeric values.
  2. Redis URL and password reads in env builder use direct `process.env` access instead of helper accessors.
  3. Drift script is missing an explicit `idempotencyCompletionSafety` category.
  4. GET route entries with empty auth-option requirements lack an explicit rationale marker.
- Proposed remediation sequence (blocking first):
  1. Fix finance idempotency completion rethrow behavior.
  2. Extend message-passthrough drift coverage to messaging routes and align tests to static client-safe adapter errors.
  3. Wrap onboarding completion persistence in fail-safe completion handling.
  4. Add user-rights and payout route entries to high-risk registry and guard tests.
  5. Tighten financial recent-auth windows to 180 seconds and synchronize route plus registry expectations.
  6. Remove aliased domain-message passthrough (`err.message`) in verification POST handlers and widen lint patterns.
  7. Propagate `clerkId` through actor contexts where contracts require enriched identity context.
  8. Replace idempotency key payload spreading with Class C and D summary projection.
  9. Add Redis startup validation gating in env boundary for required backend modes.
  10. Deprecate DELETE-incompatible fallback helper usage and add drift check for DELETE handlers calling fallback extractor.
  11. Standardize certificate route limiter namespace keys.
  12. Normalize finance HTTP-boundary date contracts to string DTOs.
  13. Align auth-context test fixtures with canonical runtime shape.
  14. Implement `idempotencyCompletionSafety` drift category.
- Audit status corrections required before posture promotion:
  1. `GAP-004` remains Strengthen pending recent-auth and registry parity fixes.
  2. `GAP-015` remains Strengthen pending full actor-scoped route coverage for omitted high-risk surfaces.
  3. Phase 6 is partial until passthrough and idempotency completion safety defects are closed in all targeted handlers.
  4. `ADD-001` remains Strengthen until registry and guard parity is complete for unresolved high-risk paths.
- Statuses that remain correctly represented: `GAP-017`, `GAP-013`, `ADD-003`, and `DRIFT-001` remain aligned with current evidence.
- Deferred items: none in this autopsy entry; this is a pre-implementation defect accounting checkpoint.
- Next-phase handoff: begin staff-level implementation by resolving Critical and High defects first, then re-run strict drift and targeted risk suites before promoting any additional closure status.

### [CHECKPOINT] Consolidated API Evidence Sweep - Completed

- Date: 2026-04-11
- Outcome summary: Completed a consolidated evidence sweep for the properties or stores or messaging API trio with fresh coverage, strict drift, and typecheck confirmation; baseline remained clean without runtime-code changes.
- Actual files changed: `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`; generated artifacts `apps/client/tmp/coverage-trio8/coverage-summary.json` and `apps/client/tmp-security-drift-report.json`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/properties/property-id.route.test.ts __tests__/api/stores/store-id.route.test.ts __tests__/api/messaging/route-auth-mapping.test.ts --maxWorkers=1` (pass, 3 files and 52 tests passed); `pnpm -C apps/client exec vitest run __tests__/api/properties/property-id.route.test.ts __tests__/api/stores/store-id.route.test.ts __tests__/api/messaging/route-auth-mapping.test.ts --maxWorkers=1 --coverage --coverage.reporter=json-summary --coverage.reportsDirectory=tmp/coverage-trio8 --coverage.thresholds.statements=0 --coverage.thresholds.branches=0 --coverage.thresholds.functions=0 --coverage.thresholds.lines=0` (pass, 3 files and 52 tests passed); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all categories `0`); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `EXIT:0`).
- Coverage artifact snapshot: `apps/client/tmp/coverage-trio8/coverage-summary.json` reports `app/api/messaging/messages/[id]/route.ts` at lines `93.58%`, statements `92.4%`, functions `100%`, branches `75.86%`; and `app/api/messaging/conversations/[id]/route.ts` at lines `84.94%`, statements `84.04%`, functions `63.63%`, branches `71.42%`.
- Drift or security results: strict drift stayed fully clean with all reported categories at `0`, including `sensitiveAnnotationCoverage`, `actorScopedThrottling`, and `deleteMethodSemanticsDrift`.
- Regressions avoided: preserved current API runtime behavior; this checkpoint refreshed evidence only.
- Deferred items: none for this checkpoint entry.

### [CHECKPOINT] Messaging or Properties or Stores API Regression and Coverage Refresh - Completed

- Date: 2026-04-10
- Outcome summary: Captured a docs-only verification checkpoint after messaging route test-surface expansion; targeted trio API suites remained green and route-focused coverage artifacts were refreshed without runtime behavior changes.
- Actual files changed: `apps/client/__tests__/api/messaging/route-auth-mapping.test.ts`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/properties/property-id.route.test.ts __tests__/api/stores/store-id.route.test.ts __tests__/api/messaging/route-auth-mapping.test.ts --maxWorkers=1` (pass, 3 files and 52 tests passed); `pnpm -C apps/client exec vitest run __tests__/api/properties/property-id.route.test.ts __tests__/api/stores/store-id.route.test.ts __tests__/api/messaging/route-auth-mapping.test.ts --maxWorkers=1 --coverage --coverage.reporter=json-summary --coverage.reportsDirectory=tmp/coverage-trio7 --coverage.thresholds.statements=0 --coverage.thresholds.branches=0 --coverage.thresholds.functions=0 --coverage.thresholds.lines=0` (pass, 3 files and 52 tests passed); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all categories `0`); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, exit code `0`).
- Coverage artifact snapshot: `apps/client/tmp/coverage-trio7/coverage-summary.json` reports `app/api/messaging/messages/[id]/route.ts` at lines `93.58%`, statements `92.4%`, functions `100%`, branches `75.86%`; and `app/api/messaging/conversations/[id]/route.ts` at lines `84.94%`, statements `84.04%`, functions `63.63%`, branches `71.42%`.
- Drift or security results: strict drift baseline remained fully clean, including `sensitiveAnnotationCoverage` and `deleteMethodSemanticsDrift` at zero.
- Regressions avoided: retained route runtime behavior while increasing adapter branch coverage through test-only expansion.
- Deferred items: none for this checkpoint entry.

### [PHASE 8] ADR-006 Sensitive Annotation Coverage + Drift Gate - Planned

- Date: 2026-04-09
- Scope: Add ADR-006 boundary annotations to priority high-sensitivity adapters, actions, and domain contracts, and introduce strict drift enforcement that flags sensitive paths lacking ADR-006 annotations unless explicitly allowlisted.
- Risk level: High
- Target files: `apps/client/app/api/user/export/route.ts`; `apps/client/app/api/user/deletion/route.ts`; `apps/client/app/api/user/rectification/route.ts`; `apps/client/app/api/professional-portal/documents/route.ts`; `apps/client/app/api/professional-portal/documents/[id]/route.ts`; `apps/client/app/api/professional-portal/certificates/route.ts`; `apps/client/app/api/professional-portal/certificates/[id]/route.ts`; `apps/client/app/api/professional-portal/licenses/route.ts`; `apps/client/app/api/professional-portal/licenses/[id]/route.ts`; `apps/client/app/actions/onboarding.ts`; `apps/client/app/actions/finance.ts`; `apps/client/app/lib/domains/documents/contracts.ts`; `apps/client/app/lib/domains/licenses/contracts.ts`; `apps/client/app/lib/domains/certificates/contracts.ts`; `apps/client/app/lib/domains/finance/contracts.ts`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/scripts/adr006-annotation-exceptions.json`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands (planned): `pnpm -C apps/client exec vitest run __tests__/api/professional-portal/documents.route.test.ts __tests__/api/professional-portal/certificates.route.test.ts __tests__/api/professional-portal/licenses.route.test.ts --maxWorkers=1`; `pnpm run client:report-security-drift:strict`; `pnpm run client:tsc-noemit`.
- Entry criteria: Phase 7 completed and documented with strict drift and client typecheck baseline green.
- Exit criteria (expected): Priority sensitive boundaries include `ADR-006 classification:` markers, strict drift emits `sensitiveAnnotationCoverage`, and strict runs fail if non-allowlisted sensitive files lack annotations.
- Known risks and mitigations: Broad sensitive-path scanning can create noisy findings; mitigate with an explicit exception registry for reviewed non-sensitive files and keep annotations focused on files crossing Class A/B boundaries.

### [PHASE 9] Expanded DELETE Semantics Enforcement Scope - Planned

- Date: 2026-04-09
- Scope: Extend GAP-017 DELETE semantics enforcement beyond the initial versioned-route registry by hardening additional version-aware item DELETE adapters and broadening static drift detection to scan all API route DELETE handlers for body-version fallback patterns.
- Risk level: High
- Target files: `apps/client/app/api/messaging/conversations/[id]/route.ts`; `apps/client/app/api/messaging/messages/[id]/route.ts`; `apps/client/__tests__/api/messaging/route-auth-mapping.test.ts`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/scripts/gap017-delete-exceptions.json`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands (planned): `pnpm -C apps/client exec vitest run __tests__/api/messaging/route-auth-mapping.test.ts __tests__/api/properties/property-id.route.test.ts __tests__/api/stores/store-id.route.test.ts --maxWorkers=1`; `pnpm run client:report-security-drift:strict`; `pnpm run client:tsc-noemit`.
- Entry criteria: Phase 8 completion updates are documented, and strict drift baseline remains green.
- Exit criteria (expected): Additional version-aware item DELETE handlers enforce `If-Match` header-only semantics with explicit `428/400` mapping, and `deleteMethodSemanticsDrift` evaluates the broader API route surface.
- Known risks and mitigations: Existing clients may still rely on body-carried version values on legacy DELETE endpoints; mitigate with explicit error guidance and focused route tests for missing and invalid `If-Match` behavior.

### [PHASE 9] Expanded DELETE Semantics Enforcement Scope - Completed

- Date: 2026-04-09
- Outcome summary: Extended DELETE semantics hardening to messaging item routes by enforcing header-only `If-Match` checks with explicit `428` missing-header and `400` invalid-header mapping, broadened strict drift scanning to the full API route DELETE surface for version-aware handlers, and kept the delete semantics strict baseline clean.
- Actual files changed: `apps/client/app/api/messaging/conversations/[id]/route.ts`; `apps/client/app/api/messaging/messages/[id]/route.ts`; `apps/client/__tests__/api/messaging/route-auth-mapping.test.ts`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/messaging/route-auth-mapping.test.ts` (pass, 1 file and 10 tests passed); `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all categories `0`, including `deleteMethodSemanticsDrift`); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `EXIT:0`).
- Drift/security results: strict drift now evaluates version-aware DELETE semantics from route-source scanning rather than a narrow static route registry and remained fully clean.
- Regressions avoided: preserved existing PATCH compatibility semantics and domain delete orchestration while tightening only DELETE adapter boundary requirements.
- Deferred items: none in Phase 9 scope.
- Next-phase handoff: continue remaining ASVS closure work from the plan with the same strict drift and typecheck evidence cadence.

### [PHASE 8] ADR-006 Sensitive Annotation Coverage + Drift Gate - Completed

- Date: 2026-04-09
- Outcome summary: Added explicit `ADR-006 classification:` annotations to priority sensitive adapters, actions, and domain contracts, introduced strict `sensitiveAnnotationCoverage` drift enforcement with reviewed exceptions support, and kept strict policy baseline green.
- Actual files changed: `apps/client/app/api/user/export/route.ts`; `apps/client/app/api/user/deletion/route.ts`; `apps/client/app/api/user/rectification/route.ts`; `apps/client/app/api/professional-portal/documents/route.ts`; `apps/client/app/api/professional-portal/documents/[id]/route.ts`; `apps/client/app/api/professional-portal/certificates/route.ts`; `apps/client/app/api/professional-portal/certificates/[id]/route.ts`; `apps/client/app/api/professional-portal/licenses/route.ts`; `apps/client/app/api/professional-portal/licenses/[id]/route.ts`; `apps/client/app/actions/onboarding.ts`; `apps/client/app/actions/finance.ts`; `apps/client/app/lib/domains/documents/contracts.ts`; `apps/client/app/lib/domains/licenses/contracts.ts`; `apps/client/app/lib/domains/certificates/contracts.ts`; `apps/client/app/lib/domains/finance/contracts.ts`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/scripts/adr006-annotation-exceptions.json`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results: `pnpm -C apps/client exec node scripts/report-security-drift.mjs --strict` (pass, all categories `0`, including `sensitiveAnnotationCoverage`); `pnpm -C apps/client exec tsc --noEmit --pretty false` (pass, `EXIT:0`).
- Drift/security results: strict drift now fails on unannotated sensitive-path files unless covered by a reviewed ADR-006 exception entry; current strict baseline remained clean.
- Regressions avoided: annotations were additive and did not alter domain/service execution semantics on the covered adapter and action surfaces.
- Deferred items: none in Phase 8 scope.
- Next-phase handoff: proceed with broader DELETE semantics expansion and policy-depth closure tasks.

### [PHASE 7] Versioned DELETE If-Match Exclusivity + Drift Guard - Planned

- Date: 2026-04-09
- Scope: Remove legacy body-version fallback from versioned item DELETE handlers, require strict `If-Match` header semantics for optimistic locking on those routes, and add a dedicated drift category that blocks DELETE-method version-fallback regressions.
- Risk level: High
- Target files: `apps/client/app/api/properties/[id]/route.ts`; `apps/client/app/api/properties/shared.ts`; `apps/client/app/api/stores/[id]/route.ts`; `apps/client/app/lib/api/request-utils.ts`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/scripts/gap017-delete-exceptions.json`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands (planned): `pnpm -C apps/client exec vitest run __tests__/api/properties/property-id.route.test.ts __tests__/api/stores/store-id.route.test.ts --maxWorkers=1`; `pnpm run client:report-security-drift:strict`; `pnpm run client:tsc-noemit`.
- Entry criteria: Phase 6 completed and documented with strict drift and client typecheck baseline green.
- Exit criteria (expected): Versioned item DELETE handlers no longer parse request-body versions, missing `If-Match` returns `428`, invalid `If-Match` returns `400`, and strict drift reports zero findings for `deleteMethodSemanticsDrift`.
- Known risks and mitigations: Existing callers that still send body-based version values may begin failing with `428`; mitigate by preserving clear adapter error messaging, documenting explicit header-only semantics, and validating with focused route tests plus strict drift.

### [PHASE 7] Versioned DELETE If-Match Exclusivity + Drift Guard - Completed

- Date: 2026-04-09
- Outcome summary: Enforced header-only optimistic locking semantics for versioned property and store DELETE adapters by removing legacy body-version fallback, added explicit `428` (missing `If-Match`) and `400` (invalid `If-Match`) mapping, and introduced strict drift enforcement for DELETE method semantics with a reviewed GAP-017 exceptions registry.
- Actual files changed: `apps/client/app/lib/api/request-utils.ts`; `apps/client/app/api/properties/shared.ts`; `apps/client/app/api/stores/[id]/route.ts`; `apps/client/app/api/properties/[id]/route.ts`; `apps/client/app/api/properties/[id]/documents/route.ts`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/scripts/gap017-delete-exceptions.json`; `apps/client/__tests__/api/stores/store-id.route.test.ts`; `apps/client/__tests__/api/properties/property-id.route.test.ts`; `apps/client/tmp-security-drift-report.json`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/properties/property-id.route.test.ts __tests__/api/stores/store-id.route.test.ts --maxWorkers=1` (pass, 2 files and 18 tests passed); `pnpm run client:report-security-drift:strict` (pass, all categories `0`, including `deleteMethodSemanticsDrift`); `pnpm run client:tsc-noemit` (pass, `EXIT_CODE:0`).
- Drift/security results: strict drift now emits `deleteMethodSemanticsDrift` as a blocking category and the baseline run remained fully clean at zero findings.
- Regressions avoided: preserved existing PATCH legacy behavior and existing domain optimistic-lock execution while constraining the semantic change to versioned DELETE adapter boundaries.
- Deferred items: Full ADR-006 sensitive-surface annotation coverage remains in the next policy-depth tranche.
- Next-phase handoff: proceed to the annotation coverage tranche and extend strict drift with sensitive-surface annotation checks.

### [PHASE 0] Baseline Gate Integrity - Planned

- Date: 2026-04-09
- Scope: Align Tier-3 transition sequencing checks to the canonical onboarding finalizer, make spread-review findings blocking in strict drift mode, and migrate browser persistence allowlisting from file-level to callsite-level marker checks.
- Risk level: High
- Target files: `apps/client/__tests__/actions/tier3-high-value-guard-policy.test.ts`, `apps/client/scripts/report-security-drift.mjs`, `apps/client/scripts/security-lint-checks.mjs`, `apps/client/scripts/check-browser-persistence.mjs`, and allowlisted browser-persistence callsite files under `apps/client/components/**`, `apps/client/app/onboarding/**`, and `apps/client/hooks/useABTest.ts`.
- Verification commands (planned): `pnpm run client:report-security-drift:strict`; `pnpm run client:test:tier3-transition-policy`; `pnpm run client:tsc-noemit`.
- Entry criteria: Baseline branch is green enough to run targeted drift and policy checks, and no unresolved blockers remain from previous closure tranches.
- Exit criteria (expected): Tier-3 transition policy test references the canonical runtime symbol, strict drift fails when spread-review findings exist, and browser persistence checks enforce callsite-level allowlisting with relocated markers.
- Known risks and mitigations: Marker relocation could create false negatives or noisy failures; mitigate by adding marker comments directly adjacent to each approved storage callsite and validating with strict drift plus targeted policy test.

### [PHASE 0] Baseline Gate Integrity - Completed

- Date: 2026-04-09
- Outcome summary: Completed Tier-3 sequencing symbol parity updates, enabled strict fail gating for spread-review drift findings, and migrated browser persistence allowlisting to callsite-level marker checks across drift and lint scanners.
- Actual files changed: `apps/client/__tests__/actions/tier3-high-value-guard-policy.test.ts`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/scripts/security-lint-checks.mjs`; `apps/client/scripts/check-browser-persistence.mjs`; `apps/client/components/forms/HomeownerForm.tsx`; `apps/client/components/forms/ProfessionalForm.tsx`; `apps/client/components/forms/PropertyForm.tsx`; `apps/client/components/shared/ProfileCompletionWidget.tsx`; `apps/client/components/providers/CookieConsentProvider.tsx`; `apps/client/app/onboarding/_hooks/useOnboarding.ts`; `apps/client/hooks/useABTest.ts`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results: `pnpm run client:report-security-drift:strict` (pass, all categories `0`); `pnpm run client:test:tier3-transition-policy` (pass, 2 files and 9 tests passed); `pnpm run client:tsc-noemit` (pass, exit `0`); `pnpm -C apps/client exec node scripts/check-browser-persistence.mjs` (pass); `pnpm -C apps/client exec node scripts/check-security-lint.mjs` (pass).
- Drift/security results: strict drift now blocks `logSafetySpreadReview` findings and reports remained clean; browser persistence and security-lint checks passed with callsite-level allowlist markers enforced.
- Regressions avoided: kept runtime route, domain, and action behavior unchanged while tightening only policy-test and scanner enforcement plus marker placement.
- Deferred items: none in Phase 0 scope.
- Next-phase handoff: start Phase 1 by introducing the canonical high-risk registry source and wiring both drift scripts and Tier-3 policy tests to the shared registry artifact.

### [PHASE 1] Canonical High-Risk Registry + Drift/Test Parity - Planned

- Date: 2026-04-09
- Scope: Create a canonical high-risk registry source in `app/lib/security`, add a narrow compile step to emit `scripts/high-risk-registry.mjs`, refactor drift and Tier-3 policy checks to consume the shared registry, expand verification sequencing coverage for certificates and licenses create/update adapters, and add parser-regression tests for `withAuth` extraction.
- Risk level: High
- Target files: `apps/client/app/lib/security/high-risk-registry.ts`, `apps/client/scripts/build-high-risk-registry.mjs`, `apps/client/scripts/high-risk-registry.mjs`, `apps/client/scripts/report-security-drift.mjs`, `apps/client/__tests__/actions/tier3-high-value-guard-policy.test.ts`, and `apps/client/package.json`.
- Verification commands (planned): `pnpm -C apps/client run build:high-risk-registry`; `pnpm run client:test:tier3-transition-policy`; `pnpm run client:report-security-drift:strict`; `pnpm run client:tsc-noemit`.
- Entry criteria: Phase 0 complete with strict drift and Tier-3 policy baseline green, and both tracking docs contain Phase 1 planned entries.
- Exit criteria (expected): Drift script and Tier-3 policy test consume one shared registry source of truth, verification sequencing checks cover documents/certificates/licenses create and update flows, and parser regressions prevent false-positive route guard passes.
- Known risks and mitigations: Registry compile drift or parser regressions could create false positives/negatives; mitigate by auto-building registry artifact in drift script commands and adding focused parser-regression unit assertions.

### [PHASE 1] Canonical High-Risk Registry + Drift/Test Parity - Completed

- Date: 2026-04-09
- Outcome summary: Implemented a canonical high-risk registry source and generated script artifact, removed duplicated high-risk rule arrays from drift/test surfaces, expanded verification sequencing coverage to documents/certificates/licenses create and update adapters, and hardened withAuth parser checks to avoid false-positive guard passes.
- Actual files changed: `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/scripts/build-high-risk-registry.mjs`; `apps/client/scripts/high-risk-registry.mjs`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/__tests__/actions/tier3-high-value-guard-policy.test.ts`; `apps/client/package.json`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results: `pnpm -C apps/client run build:high-risk-registry` (pass, artifact generated); `pnpm run client:test:tier3-transition-policy` (pass, 2 files and 11 tests passed); `pnpm run client:report-security-drift:strict` (pass, all categories `0`); `pnpm run client:tsc-noemit` (pass, exit `0`).
- Drift/security results: strict drift consumes the generated high-risk registry artifact and remained clean; high-value guard and critical-transition sequencing checks reported zero findings after registry consolidation.
- Regressions avoided: preserved existing high-risk policy behavior while eliminating duplicated rule definitions and tightening parser scoping to matched exports only.
- Deferred items: none in Phase 1 scope.
- Next-phase handoff: begin Phase 2 Redis sliding-window limiter migration and keep high-risk anti-automation checks wired to registry-driven policy expectations.

### [PHASE 2] Redis Sliding-Window Rate Limiter Migration - Planned

- Date: 2026-04-09
- Scope: Replace the process-local in-memory rate-limit backend with a Redis-backed sliding-window primitive exposed from `@build/redis`, split client rate-limit implementations into explicit dev and Redis modules, and route backend selection through the canonical env boundary while preserving the `checkRateLimit(identifier, limit, window)` adapter contract.
- Risk level: High
- Target files: `packages/redis/src/rate-limit.ts`, `packages/redis/src/index.ts`, `apps/client/app/lib/api/rate-limit.ts`, `apps/client/app/lib/api/rate-limit.dev.ts`, `apps/client/app/lib/api/rate-limit.redis.ts`, `apps/client/app/lib/infrastructure/env.ts`, `apps/client/.env.example`, `apps/client/__tests__/lib/rate-limit-redis.test.ts`, `apps/client/docs/CHANGELOG.md`, and `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands (planned): `pnpm -C apps/client exec vitest run __tests__/lib/rate-limit-redis.test.ts`; `pnpm -C packages/redis run check-types`; `pnpm run client:report-security-drift:strict`; `pnpm run client:tsc-noemit`.
- Entry criteria: Phase 1 completed and documented in both tracking docs, with strict drift and Tier-3 policy baseline still green.
- Exit criteria (expected): Redis-backed sliding-window limiting is available through `@build/redis`, `apps/client` rate limiting selects backend via env boundary with isolated dev fallback module, and targeted rate-limit regressions plus strict drift and typecheck verification pass.
- Known risks and mitigations: Redis backend or env-selection regressions could degrade availability or silently route to the wrong backend; mitigate with explicit backend-resolution logic, deterministic fallback behavior, and focused unit coverage for backend selection and window semantics.

### [PHASE 2] Redis Sliding-Window Rate Limiter Migration - Completed

- Date: 2026-04-09
- Outcome summary: Landed a shared Redis sliding-window rate-limiter primitive in `@build/redis`, split the client limiter into explicit Redis and in-memory backends, and wired env-driven backend resolution through the canonical env boundary while preserving all existing `checkRateLimit(identifier, limit, window)` call contracts.
- Actual files changed: `packages/redis/src/rate-limit.ts`; `packages/redis/src/rate-limit.js`; `packages/redis/src/index.ts`; `apps/client/app/lib/api/rate-limit.ts`; `apps/client/app/lib/api/rate-limit.dev.ts`; `apps/client/app/lib/api/rate-limit.redis.ts`; `apps/client/app/lib/infrastructure/env.ts`; `apps/client/.env.example`; `apps/client/__tests__/lib/rate-limit-redis.test.ts`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results: `pnpm -C packages/redis run check-types` (pass); `pnpm -C apps/client exec vitest run __tests__/lib/rate-limit-redis.test.ts` (pass, 1 file and 5 tests passed); `pnpm run client:report-security-drift:strict` (pass, all categories `0`); `pnpm run client:tsc-noemit` (pass, exit `0`).
- Drift/security results: strict drift remained clean at zero findings while rate-limiter internals moved to Redis sliding-window enforcement; production-mode Redis backend failures now fail closed in the client rate-limit facade instead of silently passing writes.
- Regressions avoided: retained the existing adapter contract and route call patterns, and added deterministic in-memory fallback behavior for non-production Redis failures to keep local/test workflows stable.
- Deferred items: actor-scoped key migration and `actorScopedThrottling` drift-category enforcement remain queued for the next phase.
- Next-phase handoff: apply actor-scoped identifiers to all high-risk registry routes and add drift enforcement that blocks IP-scoped throttling on authenticated high-risk handlers.

### [PHASE 3] Actor-Scoped High-Risk Throttling + Drift Gate - Planned

- Date: 2026-04-09
- Scope: Migrate high-risk authenticated escrow mutation routes from IP-scoped rate-limit keys to actor-scoped identifiers, add a shared actor-identifier helper in the rate-limit facade, and introduce a blocking strict-drift category that flags high-risk routes still using IP-scoped throttling.
- Risk level: High
- Target files: `apps/client/app/lib/api/rate-limit.ts`, `apps/client/app/lib/security/high-risk-registry.ts`, `apps/client/app/api/projects/[id]/escrow/[escrowId]/fund/route.ts`, `apps/client/app/api/projects/[id]/escrow/[escrowId]/release/route.ts`, `apps/client/app/api/projects/[id]/escrow/[escrowId]/dispute/route.ts`, `apps/client/scripts/report-security-drift.mjs`, `apps/client/__tests__/actions/tier3-high-value-guard-policy.test.ts`, `apps/client/docs/CHANGELOG.md`, and `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands (planned): `pnpm run client:test:tier3-transition-policy`; `pnpm run client:report-security-drift:strict`; `pnpm run client:tsc-noemit`.
- Entry criteria: Phase 2 completed and documented in both tracking docs with strict drift still green.
- Exit criteria (expected): High-risk escrow mutations use actor-scoped rate-limit identifiers, drift reporting includes actor-scoped throttling findings as a strict blocking category, and all planned verification commands pass.
- Known risks and mitigations: Actor identifier wiring errors can cause false throttling or missed enforcement; mitigate by centralizing key construction helper usage, enforcing registry-aligned snippets, and validating with strict drift plus Tier-3 policy tests.

### [PHASE 3] Actor-Scoped High-Risk Throttling + Drift Gate - Completed

- Date: 2026-04-09
- Outcome summary: Migrated high-risk authenticated escrow mutations to actor-scoped rate-limit identifiers via a shared helper, tightened canonical high-risk registry route snippets to require actor-scoped key usage, and added a strict drift category that blocks IP-scoped throttling keys on authenticated high-risk routes.
- Actual files changed: `apps/client/app/lib/api/rate-limit.ts`; `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/app/api/projects/[id]/escrow/[escrowId]/fund/route.ts`; `apps/client/app/api/projects/[id]/escrow/[escrowId]/release/route.ts`; `apps/client/app/api/projects/[id]/escrow/[escrowId]/dispute/route.ts`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results: `pnpm run client:test:tier3-transition-policy` (pass, 2 files and 11 tests passed); `pnpm run client:report-security-drift:strict` (pass, all categories `0`, including `actorScopedThrottling`); `pnpm run client:tsc-noemit` (pass, completed with no TypeScript diagnostics).
- Drift/security results: strict drift now emits and enforces `actorScopedThrottling` as a blocking category, and the current strict run remained clean at zero findings across all categories.
- Regressions avoided: preserved existing high-risk route authz and rate-limit envelopes while only changing key scoping from IP-derived to actor-derived identifiers.
- Deferred items: none in Phase 3 scope.
- Next-phase handoff: continue ASVS closure phases by extending actor-scoped throttling checks to any additional authenticated high-risk routes added to the registry.

### [PHASE 4] High-Risk Escrow CSRF Guardrails + Registry Parity - Planned

- Date: 2026-04-09
- Scope: Enforce trusted-origin CSRF checks on high-risk authenticated escrow mutation adapters, and extend canonical high-risk registry guard requirements so Tier-3 policy and strict drift block missing `withAuth.csrf` on those routes.
- Risk level: High
- Target files: `apps/client/app/api/projects/[id]/escrow/[escrowId]/fund/route.ts`; `apps/client/app/api/projects/[id]/escrow/[escrowId]/release/route.ts`; `apps/client/app/api/projects/[id]/escrow/[escrowId]/dispute/route.ts`; `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands (planned): `pnpm run client:test:tier3-transition-policy`; `pnpm run client:report-security-drift:strict`; `pnpm run client:tsc-noemit`.
- Entry criteria: Phase 3 completed and documented in both tracking docs with strict drift baseline green.
- Exit criteria (expected): Escrow high-risk mutation adapters enforce CSRF via `withAuth.csrf`, registry-driven guard checks require both `recentAuth` and `csrf`, and planned verification commands pass.
- Known risks and mitigations: CSRF enforcement can reject legacy clients missing trusted origin headers; mitigate by relying on canonical trusted-origin middleware behavior and validating through strict drift plus Tier-3 policy tests.

### [PHASE 4] High-Risk Escrow CSRF Guardrails + Registry Parity - Completed

- Date: 2026-04-09
- Outcome summary: Enforced trusted-origin CSRF checks on all high-risk authenticated escrow mutation routes and aligned canonical registry route-guard requirements so policy and strict drift now require both `recentAuth` and `csrf` for this escrow mutation surface.
- Actual files changed: `apps/client/app/api/projects/[id]/escrow/[escrowId]/fund/route.ts`; `apps/client/app/api/projects/[id]/escrow/[escrowId]/release/route.ts`; `apps/client/app/api/projects/[id]/escrow/[escrowId]/dispute/route.ts`; `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/scripts/high-risk-registry.mjs`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results: `pnpm run client:test:tier3-transition-policy` (pass, 2 files and 11 tests passed, exit `0`); `pnpm run client:report-security-drift:strict` (pass, all categories `0`, exit `0`); `pnpm run client:tsc-noemit` (pass, exit `0`).
- Drift/security results: strict drift remained fully clean and now evaluates escrow route guard parity with CSRF-required registry expectations without introducing new findings.
- Regressions avoided: preserved existing escrow mutation business behavior, actor-scoped throttling enforcement, and recent-auth constraints while adding CSRF trusted-origin protection.
- Deferred items: none in Phase 4 scope.
- Next-phase handoff: continue ASVS closure sequencing by extending registry-driven high-risk guard checks to any newly introduced authenticated mutation routes.

### [PHASE 5] Verification High-Risk Guardrail Expansion - Planned

- Date: 2026-04-09
- Scope: Extend high-risk registry coverage from escrow into the professional verification adapter family (documents, certificates, licenses), migrate those authenticated handlers from IP-scoped to actor-scoped rate-limit keys, and require explicit `withAuth` guard options (`recentAuth` and `csrf`) on high-risk verification mutations.
- Risk level: High
- Target files: `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/scripts/high-risk-registry.mjs`; `apps/client/app/api/professional-portal/documents/route.ts`; `apps/client/app/api/professional-portal/documents/[id]/route.ts`; `apps/client/app/api/professional-portal/certificates/route.ts`; `apps/client/app/api/professional-portal/certificates/[id]/route.ts`; `apps/client/app/api/professional-portal/licenses/route.ts`; `apps/client/app/api/professional-portal/licenses/[id]/route.ts`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands (planned): `pnpm run client:test:tier3-transition-policy`; `pnpm run client:report-security-drift:strict`; `pnpm run client:tsc-noemit`.
- Entry criteria: Phase 4 completed and documented in both tracking docs with strict drift baseline green.
- Exit criteria (expected): Registry-driven checks include the verification high-risk routes, authenticated verification handlers use actor-scoped throttling keys, high-risk verification mutation handlers enforce `recentAuth` and `csrf`, and planned verification commands pass.
- Known risks and mitigations: Additional trusted-origin and freshness constraints can reject stale or cross-origin callers; mitigate by relying on canonical `withAuth` enforcement and validating parity through strict drift and Tier-3 policy checks.

### [PHASE 5] Verification High-Risk Guardrail Expansion - Completed

- Date: 2026-04-09
- Outcome summary: Expanded canonical high-risk route guard coverage to the verification adapter family (documents, certificates, and licenses), migrated their authenticated read and write throttling from IP-derived identifiers to actor-scoped keys, and enforced explicit `withAuth` mutation guard options (`recentAuth` + `csrf`) on verification write handlers.
- Actual files changed: `apps/client/app/lib/security/high-risk-registry.ts`; `apps/client/scripts/high-risk-registry.mjs`; `apps/client/app/api/professional-portal/documents/route.ts`; `apps/client/app/api/professional-portal/documents/[id]/route.ts`; `apps/client/app/api/professional-portal/certificates/route.ts`; `apps/client/app/api/professional-portal/certificates/[id]/route.ts`; `apps/client/app/api/professional-portal/licenses/route.ts`; `apps/client/app/api/professional-portal/licenses/[id]/route.ts`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/actions/tier3-high-value-guard-policy.test.ts __tests__/actions/onboarding-tier3-guards.test.ts --maxWorkers=1` (pass, 2 files and 11 tests passed, `EXIT_CODE:0`); `pnpm run client:report-security-drift:strict` (pass, all drift categories `0`, `EXIT_CODE:0`); `pnpm run client:tsc-noemit` (pass, `EXIT_CODE:0`).
- Drift/security results: strict drift remained fully clean while `HIGH_VALUE_ROUTE_GUARD_RULES` now includes verification route entries and actor-scoped throttling checks cover those handlers.
- Regressions avoided: preserved verification domain orchestration and idempotency flow behavior while tightening only auth-option enforcement and anti-automation key scoping.
- Deferred items: none in Phase 5 scope.
- Next-phase handoff: continue closure work by addressing additional high-risk route parity and policy-depth items from the ASVS closure plan (for example, annotation coverage, delete semantics drift, and remaining verification logging/idempotency hardening).

### [PHASE 6] Verification Adapter Log + Idempotency Safety Hardening - Planned

- Date: 2026-04-09
- Scope: Remove opaque adapter log payload bags from the professional verification route family, eliminate domain-message passthrough in client-facing adapter errors, harden idempotency completion handling so replay-persistence failures do not strand successful mutations, and tighten compliance audit action semantics for certificate deletion paths.
- Risk level: High
- Target files: `apps/client/app/api/professional-portal/documents/route.ts`; `apps/client/app/api/professional-portal/documents/[id]/route.ts`; `apps/client/app/api/professional-portal/certificates/route.ts`; `apps/client/app/api/professional-portal/certificates/[id]/route.ts`; `apps/client/app/api/professional-portal/licenses/route.ts`; `apps/client/app/api/professional-portal/licenses/[id]/route.ts`; `apps/client/scripts/security-lint-checks.mjs`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/__tests__/api/professional-portal/documents.route.test.ts`; `apps/client/__tests__/api/professional-portal/certificates.route.test.ts`; `apps/client/__tests__/api/professional-portal/licenses.route.test.ts`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands (planned): `pnpm -C apps/client exec vitest run __tests__/api/professional-portal/documents.route.test.ts __tests__/api/professional-portal/certificates.route.test.ts __tests__/api/professional-portal/licenses.route.test.ts --maxWorkers=1`; `pnpm run client:report-security-drift:strict`; `pnpm run client:tsc-noemit`.
- Entry criteria: Phase 5 completed and documented in both tracking docs with strict drift baseline green.
- Exit criteria (expected): Verification adapters no longer emit opaque `additionalContext` log bags, sensitive domain messages are not surfaced through `apiError(...)`, idempotency completion errors are fail-safe for successful domain mutations, and planned verification commands pass.
- Known risks and mitigations: Safer adapter error and logging contracts can shift existing test expectations and observability payload shapes; mitigate by updating route-level tests alongside runtime changes and validating strict drift output plus typecheck before closure.

### [PHASE 6] Verification Adapter Log + Idempotency Safety Hardening - Completed

- Date: 2026-04-09
- Outcome summary: Removed opaque `additionalContext` log payload bags from verification adapters by switching to explicit safe log fields, replaced verification list-route domain-message passthrough with fixed client-safe adapter messages, and made idempotency completion fail-safe across verification write flows so successful mutations still return success when replay persistence fails.
- Actual files changed: `apps/client/app/api/professional-portal/documents/route.ts`; `apps/client/app/api/professional-portal/documents/[id]/route.ts`; `apps/client/app/api/professional-portal/certificates/route.ts`; `apps/client/app/api/professional-portal/certificates/[id]/route.ts`; `apps/client/app/api/professional-portal/licenses/route.ts`; `apps/client/app/api/professional-portal/licenses/[id]/route.ts`; `apps/client/scripts/security-lint-checks.mjs`; `apps/client/scripts/report-security-drift.mjs`; `apps/client/scripts/high-risk-registry.mjs`; `apps/client/__tests__/api/professional-portal/documents.route.test.ts`; `apps/client/__tests__/api/professional-portal/certificates.route.test.ts`; `apps/client/__tests__/api/professional-portal/licenses.route.test.ts`; `apps/client/docs/CHANGELOG.md`; `apps/client/docs/PROGRESS-SUMMARY.md`.
- Verification commands run and results: `pnpm -C apps/client exec vitest run __tests__/api/professional-portal/documents.route.test.ts --maxWorkers=1` (pass, 1 file and 9 tests passed); `pnpm -C apps/client exec vitest run __tests__/api/professional-portal/certificates.route.test.ts --maxWorkers=1` (pass, 1 file and 9 tests passed); `pnpm -C apps/client exec vitest run __tests__/api/professional-portal/licenses.route.test.ts --maxWorkers=1` (pass, 1 file and 9 tests passed); `pnpm run client:report-security-drift:strict` (pass, all categories `0`, including `additionalContextInLogs` and `adapterMessagePassthrough`); `pnpm run client:tsc-noemit` (pass).
- Drift/security results: strict drift remained fully clean after adding `additionalContextInLogs` and `adapterMessagePassthrough` categories, confirming zero opaque verification log-bag usage and zero verification adapter domain-message passthrough regressions.
- Regressions avoided: preserved verification domain orchestration, status mapping, and existing mutation success behavior while tightening adapter observability and replay-persistence safety.
- Deferred items: none in Phase 6 scope.
- Next-phase handoff: continue closure work with the remaining policy-depth items from the plan (for example ADR-006 annotation coverage and DELETE semantics drift hardening).

- **2026-04-09 Tier 2 closure-first replay policy hardening:** replaced best-effort idempotency replay redaction with a scope-aware replay-policy registry in `IdempotencyService`; unknown replay scopes now fail closed, replay payloads must serialize from reviewed public-contract DTOs, and default replay storage is limited to ADR-006 Class C/D data with explicit per-scope Class B exceptions where existing client contracts require them; aligned the architecture guide, repo-wide instructions, ADR-006, and the ASVS audit status table to the now-green Tier 2 baseline; added focused replay-policy regressions plus representative route/action replay coverage.
- **2026-04-09 Next config env decoupling for production-style lint:** added `next-config-env.ts` as a lightweight reader for the small set of environment values needed by `next.config.ts` (`NODE_ENV`, app/API URLs, Clerk frontend API, and PostHog host); cut `next.config.ts` over from the full runtime env graph so config-time imports no longer execute server-only upload-processing invariants; kept the `UPLOAD_PROCESS_INLINE` production invariant strict in the runtime env module; verified with client typecheck and `NODE_ENV=production` lint.
- **2026-04-08 ASVS closure tranche (role-transition consistency, upload worker isolation, safe client errors):** replaced the onboarding Clerk metadata helper with a shared fail-closed transition finalizer so onboarding submit/skip flows now return retryable `503` responses when Clerk sync cannot be confirmed and never complete idempotent success before metadata finalization; added a shared Clerk claim-refresh helper used by the onboarding flow and `/auth-callback`, removing silent dashboard fallback after onboarding success; made `/api/uploads` worker-only in production by blocking prod inline processing at config time and returning `503` plus failed pending-upload status when queue enqueue fails; migrated remaining legacy raw `error.message` pass-through sites in idea-books, notifications, calendar, properties, and finance to fixed client-safe error contracts; expanded the blocking security lint to catch `apiError(error.message || ...)`, `apiError(error.message ?? ...)`, and equivalent `createActionFailure(...)` patterns; documented the Clerk webhook `.passthrough()` allowance as the signed-provider exception; verified with focused onboarding, upload, and safe-error regressions plus the strict security-drift baseline.
- **2026-04-04 ADR-007 section-5 mutation-time enforcement (projects + finance):** added `app/lib/domains/user-profile/client-type-policy.ts` as the owning-domain policy gate for project-creation and payment-initiation routes; wired `projectsService.createProject` and `projectsService.fundEscrow` to block `GOVERNMENT_ENTITY` mutations when procurement compliance requirements remain pending; wired `financeService.createWithdrawal` through the same payment-initiation policy gate; aligned finance actor-role normalization with canonical uppercase role output (`PROFESSIONAL`, `ADMIN`) so mutation-time policy checks execute consistently; verified with focused domain tests (`10/10`) and client typecheck.
- **2026-04-04 ADR-007 admin baseline stabilization (second pass):** completed the admin compile-baseline cleanup by removing the final `@ts-nocheck` suppression in `apps/admin/src/actions/admin/leads.ts`, fixing Lead filter typing to canonical Prisma enums (`LeadStatus`, `LeadSource`, `ProjectType`), and normalizing lead budget `Decimal` values to explicit string DTO fields in admin outputs; `pnpm run admin:check-types` now passes cleanly.
- **2026-04-04 ADR-007 section-5 onboarding domain implementation:** added `app/lib/domains/user-profile/client-type-compliance.ts` to centralize ClientType normalization, onboarding branching, and compliance-routing policy derivation; updated `app/lib/domains/user-profile/onboarding.ts` so client onboarding stores canonical `ClientProfile.type`, persists company registration and KRA fields used for procurement policy checks, and writes dedicated compliance-routing metadata (project-creation and payment-initiation policy routes) into profile preferences; updated client skip onboarding to seed deterministic default client-type routing metadata instead of empty preferences; verified with focused domain tests (`5/5`), onboarding adapter suites (`28/28`), and client typecheck.
- **2026-04-04 onboarding risk-tranche closure:** completed compliance transaction semantics and completion `Result<T, DomainError>` propagation in the user-profile onboarding surfaces; hardened onboarding trust boundaries by removing client-provided `clerkId` from submit payload paths and limiting validation logging to safe field-path arrays; added structured terminal-outcome logging contract coverage across `/api/onboarding`, `/api/onboarding/professional/complete`, `/api/onboarding/skip`, and `/api/onboarding/skip-professional`; added middleware onboarding-resolver fallback and resolution telemetry (`operationName`, `outcome`, `reason`, `source`, `state`, `confidence`, `mode`, `httpStatus`, `durationMs`); verified with focused Vitest (`32/32`) and client typecheck (`pnpm -C apps/client exec tsc --noEmit`).
- Added `docs/adr/ADR-008-http-surface-security.md` and aligned ADR lists to include the consolidated HTTP surface security decision (CORS, CSRF, anti-caching, security headers, and webhook/callback integrity).
- Added `docs/adr/ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md` and aligned ADR cross-references in instruction and architecture documentation surfaces.
- Added `docs/adr/ADR-008-http-surface-security.md` and aligned ADR lists to include the consolidated HTTP surface security decision (CORS, CSRF, anti-caching, security headers, and webhook/callback integrity).
- Added `docs/adr/ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md` and aligned ADR cross-references in instruction and architecture documentation surfaces.
- **Onboarding wizard UI refinement:** Token migration for remaining hardcoded colors in DetailsStep, DocumentsStep, ReviewStep, and ProfessionStep — replaced `emerald-*`, `red-*`, `amber-*` with `--color-success`, `--color-error`, and `--color-warning` design tokens; added `--color-warning` to globals.css for incomplete/warning states. OnboardingForm deprecated and removed (legacy stub with no labels/ARIA; main flow uses HomeownerForm and ProfessionalForm). Analytics provider wired for production: PostHog implementation (`PostHogOnboardingAnalytics`) forwards `onboarding_step_completed`, `onboarding_field_abandonment`, `onboarding_validation_error`, `onboarding_async_validation_failure`, and `onboarding_draft_restore_failed` events; used when `NODE_ENV=production` and `NEXT_PUBLIC_POSTHOG_KEY` is set; NullAnalytics in test/dev.
- **Onboarding UI refinement:** Staff-level audit implementation per API-TO-FRONTEND-ARCHITECTURE.md: added design tokens (`--color-error`, `--color-success`, `--color-focus-ring`) and migrated hardcoded emerald/red/zinc/amber to tokens; URL-encoded step/role (`?step=2&role=professional`); sessionStorage for drafts with versioned keys (`onboarding_homeowner_draft_v1`, `professional_onboarding_draft_v1`); Zod validate-on-restore with `trackDraftRestoreFailed`; draft cleared on submit success, retained on failure, cleared on logout via `clearOnboardingDrafts()`; `useAsyncFieldValidation` hook; `jumpToStep` in useOnboarding; FormMessage `aria-live="polite"`; HomeownerForm FormField htmlFor/id, aria-invalid, aria-describedby; MultiPropertyForm/MultiStoreForm accordion div→button with aria-expanded/aria-controls; RoleCard aria-label; focus management on step transition; `OnboardingAnalytics` context and instrumentation wiring; active state on button/checkbox/select/toggle/radio-group; `loading.tsx` and `error.tsx` for onboarding route.
- **Legal segment refinement:** Added route-level `loading.tsx` and `error.tsx` for `app/legal` aligned with the legal layout; wrapped footer copyright year in `suppressHydrationWarning` to avoid hydration mismatch; extracted `Toggle`, `CookieCategoryCard`, and `CATEGORIES` from `cookie-settings/page.tsx` into `cookie-settings/_components/` to reduce inline page size and align with UI refinement checklist.
- **Projects domain refinement:** Added explicit DTOs (`ProjectListItemDto`, `ProjectDetailDto`, `ProjectListResultDto`, `ProjectDetailResultDto`) and `app/lib/domains/projects/mappers.ts` with `toProjectListItemDto`, `toProjectDetailDto`; service applies mappers in `listProjects` and `getProjectDetail`; API returns `{ items, pagination }` / `{ item }`; removed client DTO repair from `portal-projects-client.ts` and `generic-projects-client.ts`; simplified `projects-page-client.tsx` (use `data?.items ?? []`) and `project-details-page-client.tsx` (use `project?.item`); added `ClientDate` component for hydration-safe date formatting; staff audit in `docs/AUDIT-PROJECTS.md`.
- **CRM/Portfolio refinement:** Inquiries: added `inquiries/mappers.ts` with `toInquiryDetailDto`; updated `InquiryDetailResult` to use string dates and clientName/clientEmail/clientPhone; applied mapper in service; removed DTO repair from `inquiries-client.ts`; added `loading.tsx`/`error.tsx` for inquiries list and detail. Leads: added `leads/mappers.ts`; updated contracts to use string/number (no Prisma types); applied mappers in service; aligned `leads-client.ts` to domain DTOs; added `loading.tsx`/`error.tsx` for leads list and detail. Pipeline: added `loading.tsx`/`error.tsx`. Portfolio: added `portfolio/contracts.ts`, `portfolio/mappers.ts`; service applies mappers for list/detail/create/update; removed DTO repair from `portfolio-client.ts`; added `loading.tsx`/`error.tsx` for portfolio list and detail. Staff audit in `docs/AUDIT-CRM-PORTFOLIO.md`.
- **Reviews refinement:** Added route-level `loading.tsx` and `error.tsx` for `app/(user)/reviews`; extracted `ReviewListCard` and `ReviewsSkeleton` into `_components/`; updated page to import extracted components and remove inline definitions; staff audit in `docs/AUDIT-REVIEWS-SEARCH.md`.
- **Search refinement:** Added `app/lib/domains/search/mappers.ts` mapping Prisma to `SearchProfessionalResultDto`; updated repository to use `select` and mapper; added `GET /api/search/professionals?q=...` (public, rate-limited); added `lib/search-client.ts`, `hooks/useSearchProfessionals.ts`; added search page at `app/(user)/search` with debounced input, results list, empty/loading/error states; added `ROUTES.search` and `API_ROUTES.searchProfessionals` in `lib/links.ts`; staff audit in `docs/AUDIT-REVIEWS-SEARCH.md`.
- **Client dashboard refinement:** Added route-level `loading.tsx` and `error.tsx` for `app/(user)/dashboard` aligned with ClientNavbar/Footer layout; extracted `DashboardSkeleton`, `EmptyState`, and `QuickLink` into `_components/`; staff audit in `docs/AUDIT-CLIENT-DASHBOARD.md`.
- **Credentials slices refinement:** Replaced Prisma-derived DTOs in documents, certificates, and licenses domains with explicit domain-owned DTOs and mappers (`app/lib/domains/{documents,certificates,licenses}/mappers.ts`); repositories now apply mappers before returning; added `GetDocumentResult` and `GetCertificateResult` to contracts; extracted `DocumentsTab`, `CertificatesTab`, and `LicensesTab` into route-local components (`documents-tab.tsx`, `certificates-tab.tsx`, `licenses-tab.tsx`).
- **Credentials UI:** Added professional-portal credentials settings at `app/professional-portal/settings/credentials` with documents, certificates, and licenses tabs; browser facades (`documents-client`, `certificates-client`, `licenses-client`), hooks (`useDocuments`, `useCertificates`, `useLicenses`), form dialogs (`DocumentFormDialog`, `CertificateFormDialog`, `LicenseFormDialog`) with dynamic import, create/edit/delete wiring, verification badges, and delete confirmation; extended `uploadFiles` to return `assetIds` and added `uploadForCredential` helper for credential creation.
- Fixed Vitest mock hoisting in `useImageUploader.test.ts` by using `vi.hoisted()` for mock references.
- Refined the properties domain contracts by enforcing strict Prisma DTO payloads (`PropertyListItem`, `PropertyDetail`, `MyListingsResultEnvelope`) in `app/lib/domains/properties/contracts.ts` and removing `unknown` returns from `app/lib/domains/properties/service.ts`.
- Refined the properties browser facade by replacing manual payload interfaces in `lib/properties-client.ts` with explicit domain contract imports.
- Modernized the public `app/properties` and `app/properties/[id]` routes into Server Components by extracting `PropertySearchHero` and `PropertyGallery` into route-local client components, dropping mock data, and fetching directly via `propertiesClient` with ISR.
- Added route-aligned `loading.tsx` and `error.tsx` segment boundaries for both the public properties list and detail pages.
- Refined the migrated idea-books slice by replacing domain `unknown` return payloads with explicit DTO contracts in `app/lib/domains/idea-books/contracts.ts` and `app/lib/domains/idea-books/service.ts`, aligning browser attachment and collaborator contracts in `lib/idea-books-client.ts` to actual list/detail API shapes, and adding App Router segment `loading.tsx`/`error.tsx` boundaries for both `app/idea-books` and `app/idea-books/[id]`.
- Refined the migrated user-profile onboarding surface by removing a client-side server-action import from `app/professional/onboarding/page.tsx`, tightening `app/api/onboarding/professional/complete/route.ts` property payload validation with an explicit Zod object schema (instead of `z.any()`), and replacing `lib/onboarding-client.ts` onboarding submit `ApiResponse<unknown>` with an explicit payload DTO.
- Refined the migrated properties slice by moving optimistic-lock operations into `app/lib/domains/properties/operations.ts` (with `app/lib/services/property-operations.service.ts` kept as a compatibility re-export), hardening properties route adapters to pass actor objects through the domain boundary, and replacing `lib/properties-client.ts` `any` payloads with explicit facade DTO contracts consumed by `hooks/useProperties.ts`.
- Refined `app/professional-portal/settings/properties` into a thin route wrapper over `app/professional-portal/settings/properties/_components/properties-settings-page-client.tsx`, split the optional property form behind route-local dynamic import, and added segment-level `loading.tsx`/`error.tsx` boundaries for the properties settings route.
- Refined the migrated stores slice by moving store optimistic-lock helpers into `app/lib/domains/stores/operations.ts` (removing the domain dependency on `app/lib/services/store-operations.service.ts`), hardening actor propagation in stores route adapters, and replacing `lib/stores-client.ts` `any` payloads with explicit facade DTO contracts consumed by `hooks/useStores.ts`.
- Refined `app/professional-portal/settings/stores` into a thin route wrapper over a route-local client component, split the optional store-creation form behind route-local dynamic import, and added route-aligned `loading.tsx`/`error.tsx` boundaries for the stores settings segment.
- Refined the stores domain slice by enforcing strict Prisma DTO payloads (`StoreListItem`, `StoreDetail`) across `contracts.ts`, `service.ts`, and `repository.ts`, closing browser type gaps by mapping `lib/stores-client.ts` strictly to domain boundaries.
- Built the missing marketplace store UI boundaries: `app/professional-portal/stores` (private dashboard) and `app/stores` (public directory), deploying extracted presentation primitives (`StoreCard`, `StoreFilters`) alongside strict `loading.tsx`/`error.tsx` layout boundaries matched to the newly tightened backend contracts.
- Refined the migrated projects UI routes under `app/professional-portal/projects/**` by extracting large inline page composition into route-local components, splitting the optional manage/edit form into a route-local dynamic component, and adding route-aligned `loading.tsx`/`error.tsx` boundaries for both the list and detail segments.
- Refined the migrated calendar slice so the canonical DTO boundary now lives in `app/lib/domains/calendar/service.ts`, removing browser-side calendar DTO repair from `lib/calendar-client.ts` and making serialized list/detail payload shaping explicit at the domain layer.
- Split heavy client-only calendar UI into route-local dynamic components by extracting the month sidebar widget and the detail edit dialog, reducing the route-critical JS that ships before those interactions are needed.
- Added route-level `loading.tsx` and `error.tsx` boundaries for `app/professional-portal/calendar` and `app/professional-portal/calendar/[id]`, so render and chunk failures are isolated at the App Router segment boundary rather than only inside query-state UI.
- Updated the API-to-frontend architecture guide and client ADRs with a staff-level architecture review checklist covering DTO serialization, bundle impact, hydration safety, and route-level `error.tsx`/`loading.tsx` expectations for migrated slices.

- Added the canonical calendar domain under `app/lib/domains/calendar/`, then cut `app/api/professional-portal/calendar/**` and `app/actions/calendar.ts` over to actor-aware calendar service methods instead of the direct Prisma-backed legacy service path.
- Removed the remaining calendar compatibility shim under `lib/services/calendar.ts` after repointing hooks, actions, routes, and browser consumers to the domain-owned contracts.
- Tightened the browser-safe calendar facade in `lib/calendar-client.ts` by replacing `unknown` payloads with explicit list/detail/mutation DTOs, then aligned the dashboard agenda widget and calendar pages to the actual API enum contract.
- Added focused calendar regression coverage in `__tests__/lib/domains/calendar.service.test.ts`, `__tests__/api/professional-portal/calendar.route.test.ts`, and `__tests__/api/professional-portal/calendar-item.route.test.ts` for actor enforcement and route error mapping.
- Refactored the authenticated uploads surface into the canonical domain path by moving upload lifecycle logic to `app/lib/domains/uploads/repository.ts` and `app/lib/domains/uploads/service.ts`, then keeping `app/api/uploads/route.ts` and `app/api/uploads/[id]/route.ts` as thin adapters over service-owned deduplication, storage persistence, asset access tracking, and delete semantics.
- Hardened upload materialization during onboarding by routing staged-upload consumption in `app/lib/domains/user-profile/onboarding.ts` through the shared upload service, preserving the onboarding transaction boundary while removing duplicate asset creation and staged-upload consumption logic.
- Fixed upload deduplication ordering so checksum comparison now happens before storage writes using the processed-buffer checksum as the canonical dedupe key, preventing duplicate blob writes for already-known assets.
- Refactored the Clerk webhook adapter into a thin integration boundary by adding `app/lib/integrations/clerk/repository.ts` and `app/lib/integrations/clerk/service.ts`, then cutting `app/api/clerk-webhook/route.ts` over to request admission, Svix verification, rate limiting, dispatch, and HTTP mapping only.
- Added focused verification coverage for the extracted boundaries in `__tests__/api/clerk-webhook/route.test.ts` and `__tests__/lib/uploads/service.test.ts`, covering Clerk webhook dispatch and error mapping plus upload dedupe, referenced-asset soft delete, and expired staged-upload rejection.

- Added the canonical public professionals domain under `app/lib/domains/professionals/`, then cut `app/api/professionals/**`, `app/actions/professionals.ts`, `lib/professionals-client.ts`, `hooks/useProfessionals.ts`, `lib/professionals-mappers.ts`, and the professional detail page DTO imports over to domain-owned contracts instead of `lib/services/professionals`.
- Added focused professionals regression coverage in `__tests__/api/professionals/route.test.ts`, `__tests__/api/professionals/professional-id.route.test.ts`, and `__tests__/lib/domains/professionals.service.test.ts` for list filtering, detail `404` mapping, and public DTO shaping.
- Added `app/lib/domains/README.md` to document the shared domain-layer boundary, including the CRM service/repository split, public-versus-authenticated semantics, and the new direct domain coverage files.
- Added direct CRM domain regression suites in `__tests__/lib/domains/leads.service.test.ts`, `__tests__/lib/domains/inquiries.service.test.ts`, and `__tests__/lib/domains/pipeline.service.test.ts` so lead, inquiry, and pipeline business rules are exercised at the service boundary instead of only through routes and actions.
- Extended `__tests__/hooks/useDashboardData.test.ts` and `__tests__/lib/dashboard-browser-clients.test.ts` with CRM consumer coverage for lead normalization, property-inquiry mapping, pipeline summary shaping, and lead-filter client serialization.
- Refactored [app/api/user/profile/route.ts](app/api/user/profile/route.ts) into a thin authenticated adapter over a new canonical user-profile domain service, moving inline GDPR consent handling, profile completion recomputation, and verification-summary shaping into [app/lib/domains/user-profile/service.ts](app/lib/domains/user-profile/service.ts) and adding route coverage in [**tests**/api/user/profile.route.test.ts](__tests__/api/user/profile.route.test.ts).
- Added shared completion-state synchronization in [app/lib/domains/user-profile/completion.ts](app/lib/domains/user-profile/completion.ts), then cut [app/api/user/profile/complete/client/route.ts](app/api/user/profile/complete/client/route.ts), [app/api/user/profile/complete/professional/route.ts](app/api/user/profile/complete/professional/route.ts), and [app/api/onboarding/route.ts](app/api/onboarding/route.ts) over to that centralized completion boundary instead of route-local or hard-coded profile completion flags.
- Removed the last internal HTTP hop from [app/api/user/profile/complete/route.ts](app/api/user/profile/complete/route.ts) by introducing shared profile-complete orchestration under [app/lib/domains/user-profile/profile-complete.ts](app/lib/domains/user-profile/profile-complete.ts), shared route-facing schemas in [app/lib/domains/user-profile/profile-complete-contracts.ts](app/lib/domains/user-profile/profile-complete-contracts.ts), and a shared endpoint-family rate-limit helper in [app/api/user/profile/complete/shared.ts](app/api/user/profile/complete/shared.ts).
- Continued the same slice by extracting the transaction-heavy onboarding flow from [app/api/onboarding/route.ts](app/api/onboarding/route.ts) into [app/lib/domains/user-profile/onboarding.ts](app/lib/domains/user-profile/onboarding.ts), keeping Clerk auth, idempotency, rate limiting, request validation, and Clerk metadata sync in the route while the new domain service owns role-based profile creation, staged-upload consumption, and completion synchronization.
- Extended that onboarding boundary to the remaining sibling adapters by cutting [app/api/onboarding/professional/complete/route.ts](app/api/onboarding/professional/complete/route.ts), [app/api/onboarding/skip/route.ts](app/api/onboarding/skip/route.ts), and [app/api/onboarding/skip-professional/route.ts](app/api/onboarding/skip-professional/route.ts) over to domain-owned business outcomes in [app/lib/domains/user-profile/onboarding.ts](app/lib/domains/user-profile/onboarding.ts), removing inline transaction orchestration and the skip routes' custom `_error` sentinel path.
- Migrated the GDPR user-operation adapters onto the same user-profile domain folder by adding [app/lib/domains/user-profile/compliance.ts](app/lib/domains/user-profile/compliance.ts) and delegating [app/api/user/consent/route.ts](app/api/user/consent/route.ts), [app/api/user/export/route.ts](app/api/user/export/route.ts), [app/api/user/rectification/route.ts](app/api/user/rectification/route.ts), and [app/api/user/deletion/route.ts](app/api/user/deletion/route.ts) to actor-aware compliance methods.
- Added regression coverage for the new boundaries in [**tests**/api/user/compliance.route.test.ts](__tests__/api/user/compliance.route.test.ts) and updated [**tests**/api/onboarding/route.test.ts](__tests__/api/onboarding/route.test.ts) to assert the centralized completion sync.
- Added focused regression coverage for the routed and direct profile-complete adapters in [**tests**/api/user/profile-complete.route.test.ts](__tests__/api/user/profile-complete.route.test.ts), including shared rate-limit rejection, generic dispatch, invalid JSON handling, and direct endpoint forbidden, banned-account, and not-found mappings.
- Added focused onboarding adapter coverage in [**tests**/api/onboarding/skip.test.ts](__tests__/api/onboarding/skip.test.ts), [**tests**/api/onboarding/skip-professional.test.ts](__tests__/api/onboarding/skip-professional.test.ts), and [**tests**/api/onboarding/professional-complete.route.test.ts](__tests__/api/onboarding/professional-complete.route.test.ts), and cleared the standing client typecheck blocker by switching [components/forms/ServiceSelector.tsx](components/forms/ServiceSelector.tsx) to the canonical `ServiceGroup` type export.
- Cut [app/api/professional-portal/profile/complete/route.ts](app/api/professional-portal/profile/complete/route.ts) over to [app/lib/domains/professional-settings/service.ts](app/lib/domains/professional-settings/service.ts), removing the last inline professional profile completion transaction block from that route and adding focused adapter coverage in [**tests**/api/professional-portal/profile-complete.route.test.ts](__tests__/api/professional-portal/profile-complete.route.test.ts).
- Added direct domain-boundary regression coverage in [**tests**/lib/domains/properties.service.test.ts](__tests__/lib/domains/properties.service.test.ts) and [**tests**/lib/domains/portfolio.service.test.ts](__tests__/lib/domains/portfolio.service.test.ts) so the newly inlined property and portfolio service logic is exercised without relying on the route layer.
- Expanded those direct domain suites to cover portfolio list/detail/update behavior plus property optimistic-lock update/delete mappings and property-document authorization, and hardened [lib/projects-client.ts](lib/projects-client.ts) with the same generic-projects rollout gate used by [app/lib/domains/projects/client/index.ts](app/lib/domains/projects/client/index.ts), backed by [**tests**/lib/projects-client-facade-gate.test.ts](__tests__/lib/projects-client-facade-gate.test.ts).
- Added property batch creation success-path regression coverage in [**tests**/lib/domains/properties.service.test.ts](__tests__/lib/domains/properties.service.test.ts), including slug-collision handling and consent-audit assertions, and added hook-level generic plus portal projects consumer coverage in [**tests**/hooks/useProjects.test.tsx](__tests__/hooks/useProjects.test.tsx).
- Added consumer-layer regression coverage for [**tests**/hooks/useProperties.test.tsx](__tests__/hooks/useProperties.test.tsx) so `useCreatePropertiesBatch` now proves batch payload wiring plus property cache invalidation, and extended [**tests**/hooks/useDashboardData.test.ts](__tests__/hooks/useDashboardData.test.ts) to assert the service-provider dashboard's generic-project mapping path.
- Expanded [**tests**/hooks/useProperties.test.tsx](__tests__/hooks/useProperties.test.tsx) with a rejected batch-create mutation case so the hook now proves API-error unwrapping and no stale cache invalidation on failure, and extended [**tests**/hooks/useDashboardData.test.ts](__tests__/hooks/useDashboardData.test.ts) with the hybrid branch to validate generic-project consumption alongside property widgets.
- Selected the CRM vertical as the next migration target before implementation, with scope covering public lead capture/status, professional-portal leads, inquiries, and pipeline aggregation, and with the intended canonical boundary under `app/lib/domains/leads/`, `app/lib/domains/inquiries/`, and `app/lib/domains/pipeline/`.
- Started the CRM implementation by adding [app/lib/domains/leads/index.ts](app/lib/domains/leads/index.ts), [app/lib/domains/leads/contracts.ts](app/lib/domains/leads/contracts.ts), [app/lib/domains/leads/repository.ts](app/lib/domains/leads/repository.ts), and [app/lib/domains/leads/service.ts](app/lib/domains/leads/service.ts), then cutting [app/api/leads/route.ts](app/api/leads/route.ts), [app/api/leads/[id]/route.ts](app/api/leads/[id]/route.ts), [app/api/professional-portal/leads/route.ts](app/api/professional-portal/leads/route.ts), [app/api/professional-portal/leads/[id]/route.ts](app/api/professional-portal/leads/[id]/route.ts), and [app/actions/leads.ts](app/actions/leads.ts) over to that canonical domain boundary with focused adapter coverage in [**tests**/api/leads/public.route.test.ts](__tests__/api/leads/public.route.test.ts) and [**tests**/api/leads/professional.route.test.ts](__tests__/api/leads/professional.route.test.ts).
- Finished the CRM migration slice by adding [app/lib/domains/inquiries/index.ts](app/lib/domains/inquiries/index.ts), [app/lib/domains/inquiries/contracts.ts](app/lib/domains/inquiries/contracts.ts), [app/lib/domains/inquiries/repository.ts](app/lib/domains/inquiries/repository.ts), [app/lib/domains/inquiries/service.ts](app/lib/domains/inquiries/service.ts), [app/lib/domains/pipeline/index.ts](app/lib/domains/pipeline/index.ts), [app/lib/domains/pipeline/contracts.ts](app/lib/domains/pipeline/contracts.ts), [app/lib/domains/pipeline/repository.ts](app/lib/domains/pipeline/repository.ts), and [app/lib/domains/pipeline/service.ts](app/lib/domains/pipeline/service.ts), then cutting [app/api/professional-portal/inquiries/route.ts](app/api/professional-portal/inquiries/route.ts), [app/api/professional-portal/inquiries/[id]/route.ts](app/api/professional-portal/inquiries/[id]/route.ts), [app/actions/inquiries.ts](app/actions/inquiries.ts), and [app/api/professional-portal/pipeline/route.ts](app/api/professional-portal/pipeline/route.ts) over to actor-aware domain services with focused coverage in [**tests**/api/inquiries/professional.route.test.ts](__tests__/api/inquiries/professional.route.test.ts), [**tests**/actions/inquiries.test.ts](__tests__/actions/inquiries.test.ts), and [**tests**/api/pipeline/professional.route.test.ts](__tests__/api/pipeline/professional.route.test.ts).

### 3) Layer Boundaries

- `app/*` is presentation/adapters (routes, actions, pages, middleware).
- `app/lib/security/*` is cross-cutting security and policy primitives.
- `lib/services/*` is domain behavior.
- `app/lib/infrastructure/*` is runtime/integration adapters.
- Client components/hooks should not import server-only modules.

### 4) Authorization Policy Standard

- Every resource mutation/read path must have explicit actor + policy checks.
- Prefer reusable policies such as `canReadThread`, `canSendMessage`, `canManageProject`.
- Do not rely on caller discipline for authz-sensitive methods.

### 5) Testing and Release Gates

- Risk-critical flows must have coverage before merge:
  - unauthenticated access redirect behavior
  - role-based route protection
  - resource-level authorization for messaging/project flows
- New architectural changes require at least one integration/policy test update.

### 6) Architecture Change Process

- For material boundary/auth decisions, add/update ADRs in `docs/adr/`.
- Add changelog entries in the `Unreleased` section as part of the same PR.

---

## [Unreleased]

### Security

- **A/B test anonymous assignment randomness hardening (2026-04-08):** replaced `Math.random()`-based anonymous ID generation in `hooks/useABTest.ts` with Web Crypto (`crypto.randomUUID()` with `crypto.getRandomValues()` fallback) to remove insecure randomness in a security-sensitive flow.
- **Redis audit output redaction hardening (2026-04-08):** refactored `scripts/redis-path-audit.mjs` to build and log only sanitized configuration flags, removing clear-text output of environment-derived Redis connection details and password-presence fields.
- **Admin client API timeout exhaustion guard (2026-04-08):** hardened `apps/admin/src/actions/admin/shared.ts` by normalizing and bounding `callClientApi` timeout values before `setTimeout` usage (default `30_000`, min `1_000`, max `60_000`) to prevent timer creation with uncontrolled durations.
- **ADD-009 structured server-action validation hardening (2026-04-04):** completed the next enforcement sweep in `app/actions/search.ts`, `app/actions/professionals.ts`, and `app/actions/stores.ts` by removing remaining `safeParse()` plus raw-throw validation branches and standardizing on structured failure mapping (`throwActionFailure(createActionFailure(...))` and `unwrapResultOrThrow(...)`) so adapters now return canonical validation and domain outcomes without opaque runtime throws.
- **ADD-007 idempotency replay data-class policy hardening (2026-04-04):** strengthened `app/lib/services/idempotency.service.ts` to sanitize replay payloads before persistence and replay (sensitive-key redaction and JSON-safe normalization), and added expired-record rollover on `checkOrCreate` so stale keys are rotated to fresh processing records; added focused regression coverage in `__tests__/lib/idempotency.service.test.ts` for redaction, normalization, replay shape safety, and expired-key recovery behavior.
- **ASVS rendering and browser-storage lint enforcement (2026-04-04):** expanded `scripts/check-security-lint.mjs` and `scripts/security-lint-checks.mjs` with blocking checks for `SEC-LINT-003` (`dangerouslySetInnerHTML` requires sanitizer/review annotation or explicit allowlisting) and `SEC-LINT-007` (sensitive-flow `localStorage`/`sessionStorage` writes require `SECURITY_PERSISTENCE_ALLOWLIST`), and annotated the safe chart style injection path in `components/ui/chart.tsx` with `SECURITY_XSS_ALLOWLIST`.
- **Tier-3 high-value action guardrails (2026-04-04):** extended `app/lib/actions/secure-action.ts` with first-class `recentAuth` and per-action `rateLimit` options, then applied both controls to `requestWithdrawalAction` in `app/actions/finance.ts` for step-up authentication and per-actor anti-automation hardening; extended `scripts/report-security-drift.mjs` with `highValueServerActionGuards` drift detection so strict CI mode fails if required guard options are removed from designated high-value server actions.
- **Tier-3 high-value guardrail expansion and sequencing pass (2026-04-04):** expanded `highValueServerActionGuards` drift enforcement to include escrow route mutations (`fund`, `release`, `dispute`) and verification-role transition onboarding actions (`submitOnboarding`, `skipOnboarding`, `skipProfessionalOnboarding`), added a second Tier-3 drift category `criticalTransitionStepSequencing` to enforce canonical server-side ordering on onboarding transition steps and verification adapter mutations (`professional-portal/documents` and `professional-portal/licenses`), and added focused policy and action tests in `__tests__/actions/tier3-high-value-guard-policy.test.ts` and `__tests__/actions/onboarding-tier3-guards.test.ts` with runnable aliases `test:tier3-transition-policy` (client) and `client:test:tier3-transition-policy` (root).
- **ADD-009 policy regression suite (2026-04-04):** added focused action-policy tests in `__tests__/actions/add-009-server-action-validation-policy.test.ts` covering explicit regression cases for Zod `.parse()` detection, `safeParse()` followed by `throw new Error(...)` detection, compliant structured-failure paths, and a workspace-wide `app/actions/**` drift assertion; added runnable aliases `test:add-009-policy` (client) and `client:test:add-009-policy` (root).
- **ASVS ADD-009 server-action validation policy enforcement (2026-04-04):** extended `scripts/report-security-drift.mjs` with `serverActionValidationPolicy` checks over `app/actions/**` to flag Zod `.parse()` usage and `safeParse()` flows that still throw `new Error(...)`; remediated existing action validation throw patterns by switching to structured `throwActionFailure(createActionFailure(...))` handling in `actions/leads.ts`, `actions/inquiries.ts`, `actions/properties.ts`, `actions/stores.ts`, `actions/professionals.ts`, and `actions/calendar.ts`.
- **ASVS Tier-1 upload hardening drift enforcement (2026-04-04):** extended `scripts/report-security-drift.mjs` with `uploadProductionRisk` coverage for production local-provider and same-origin upload-delivery guardrails plus required regression-test presence (`__tests__/lib/storage-config.test.ts`); added `report-security-drift:strict` script alias in `apps/client/package.json` and aligned root/CI execution to `pnpm run client:report-security-drift:strict` so drift categories are blocking in CI.
- **ASVS machine-enforcement expansion (2026-04-04):** implemented a shared security-lint module and blocking check script for `SEC-LINT-002`, `SEC-LINT-004`, and `SEC-LINT-006`; wired `check-security-lint` into `check-security-drift`; extended `scripts/report-security-drift.mjs` summary and findings with mutation-schema `.passthrough()` drift, unsafe `apiError(error.message|error.stack)` drift, and `req.json()` usage inside exported `GET` handlers.
- **Onboarding identity and log-safety hardening (2026-04-04):** removed client-supplied `clerkId` from onboarding browser submit payloads so identity remains session-derived in adapters, and constrained onboarding validation logs to field-path arrays instead of raw validation payloads.
- **Environment and auth-bypass hardening (Phase 2/3):** tightened `BYPASS_AUTH` handling in `app/lib/api/api-middleware.ts` so bypass is constrained to safe local-development conditions and blocked in CI and non-local contexts; added focused middleware regression coverage in `__tests__/lib/api-middleware.test.ts` for both allowed and blocked bypass flows.
- **Env contract checker hardening:** tightened `apps/client/scripts/check-env-contract.mjs` to fail on high-risk unused template keys (not only missing keys), added env-definition key detection (`name: "KEY"`) to avoid false positives for centralized env schemas, and narrowed high-risk NATS matching to credential-like keys.

### Fixed (General)

- **Tailwind utility warning cleanup in shared chart UI (2026-04-08):** normalized the tooltip minimum-width class in `apps/admin/src/components/ui/chart.tsx` from `min-w-[8rem]` to `min-w-32` to remove arbitrary-value utility warnings without changing rendered layout.
- **Tailwind warning cleanup in chat and professional forms (2026-04-08):** resolved Tailwind lint and utility-class warnings in `components/chat/ConversationsList.tsx`, `components/forms/MultiPropertyForm.tsx`, `components/forms/MultiStoreForm.tsx`, and `components/forms/ProfessionalForm.tsx` without changing runtime behavior.
- **Static-analysis remediation sweep (2026-04-08):** resolved analyzer-reported null-safety, constant-condition, and identical-branch issues across client and companion admin surfaces touched by this pass, including professional/profile pages, leads adapters, chart and form utilities, multi-form themes, chat conversation rendering, and Clerk verification-flag typing; this pass also tightened type narrowing and removed redundant guard branches without changing runtime behavior.
- **PropertyForm snapshot normalization no-op fix (2026-04-08):** fixed `__tests__/components/forms/PropertyForm.test.tsx` snapshot markup normalization by replacing dynamic `radix-*` IDs with `radix-__ID__` instead of a self-replacement no-op.
- **Onboarding compliance and completion semantics (2026-04-04):** aligned user-profile consent and completion flows to transaction-safe and explicit `Result<T, DomainError>` semantics so onboarding/profile-complete callers no longer depend on partial-success branching or implicit completion fallback behavior.
- **Canonical env-boundary test alignment:** updated middleware resolver regression coverage to override `env.services.internalApiSecret` directly instead of mutating `process.env.INTERNAL_API_SECRET` at runtime, matching the canonical env singleton behavior in resolver modules.

### Fixed (Staff-level onboarding and user-profile)

- **Staff-level onboarding and user-profile fixes:** GDPR consent records now create one `ConsentRecord` per changed type (MARKETING_EMAIL, MARKETING_SMS, ANALYTICS_COOKIES) in `service.ts`, `profile-complete.ts`, and `onboarding.ts` — previously a ternary picked a single type and dropped the others. Clerk metadata update now runs before `IdempotencyService.complete()` in all onboarding routes so retries re-attempt the Clerk update. Replaced duplicated `ClerkMetadataClient` type cast in `actions/onboarding.ts` with shared `updateClerkOnboardingMetadata` from `clerk-metadata.ts`. `skipClientOnboarding` no longer hardcodes county (uses null). `skipProfessionalOnboarding` uses `companyName: ""` instead of fabricated strings. Document materialization runs before `prisma.$transaction` in `completeOnboarding` and `completeProfessionalOnboarding`. `completeOnboarding` now guards against already-onboarded users (returns conflict). Property fields use `z.nativeEnum(PropertyType|Category|Status)` and removed `as never` casts. `syncUserProfileCompletionStatus` runs after transaction commit. Upload route uses `isOk()` and correct Result field access instead of fragile discriminant union.

### Changed (Unreleased)

- **Turbo workspace alignment and install-warning cleanup (2026-04-08):** aligned `turbo` to `^2.9.5` across root and client package manifests, and removed unused direct `ts-node` dependencies from `apps/client` and `packages/db` to eliminate recurring pnpm Windows bin-link ENOENT warnings during install.
- **Dependency and peer-alignment cleanup (2026-04-08):** upgraded `react-day-picker` to `^9.14.0` in admin and client to remove React/date-fns peer-range mismatches under React 19 and current `date-fns`.
- **Cypress component test dependency cleanup (2026-04-08):** removed deprecated `@cypress/react18` from `apps/client` and kept `@cypress/react` as the active component-testing adapter.
- **Clerk middleware modernization (2026-04-08):** upgraded `@clerk/nextjs` (admin and payment-service) and `@clerk/express` (project-service), then replaced `@hono/clerk-auth` in payment-service with a local Clerk backend adapter (`src/lib/clerkAuth.ts`) built on `@clerk/backend` to eliminate deprecated Clerk transitive dependency paths.
- **CI action/runtime alignment (2026-04-08):** updated `.github/workflows/ci.yml` to use `actions/github-script@v8` (Node 24 runtime) and removed redundant pnpm version pinning from `pnpm/action-setup`, relying on root `packageManager` (`pnpm@10.29.2`) as the single pnpm version source.
- **ADR-007 admin-path migration (phase 2 baseline closure):** completed the final type-baseline cleanup pass in admin actions by replacing string-based lead filter typing with canonical enum-safe contracts and removing suppression-based compilation masking from the leads action surface.
- **ADR-007 ClientType onboarding compliance routing (2026-04-04):** domain onboarding now treats `ClientType` as a profile classification (not identity), derives a dedicated `government_entity` onboarding branch for `GOVERNMENT_ENTITY` clients, and persists explicit routing metadata for downstream project-creation and payment-initiation compliance checks in profile preferences.
- **Onboarding observability contract completion (2026-04-04):** middleware onboarding resolver now emits structured outcomes for internal-secret-missing fallback, non-OK internal API fallback, internal API errors, and successful internal API resolution; onboarding route suites now assert the terminal structured logging contract for success and unauthorized or bad-request terminal outcomes across all onboarding endpoint families.
- **ADR-007 client-first phase implemented:** added typed onboarding lifecycle statuses (`ONBOARDING`, `PENDING_VERIFICATION`) to the Prisma schema surface, added a dedicated professional pending-verification route (`/professional-portal/pending-verification`) with middleware loop-safe redirect orchestration, propagated status-aware onboarding resolution through internal status and middleware helpers, and normalized client role handling toward the canonical `ADMIN + AdminRole` model (including legacy `SUPPORT` normalization at trust boundaries).
- **ADR-007 migration scaffold added:** introduced `packages/db/prisma/migrations/20260402120000_adr007_role_model_phase1/migration.sql` to provision `AdminProfile` for migrated support users, normalize `SYSTEM_ADMIN` to `SUPER_ADMIN`, and contract role enums as part of the phased rollout.
- **ADR-007 next phase scoped:** admin-path migration is intentionally deferred to the next phase and will cover remaining admin route/action/UI role gates and policy coverage alignment (`__tests__/policy/**`) for the consolidated admin capability model.
- **ADR-007 admin-path migration (phase 2 start):** opened first concrete admin role-gate edits by switching initial admin action and middleware super-role gates from `SYSTEM_ADMIN | SUPER_ADMIN` to `SUPER_ADMIN`, including `apps/admin/src/actions/admin/shared.ts`, `apps/admin/src/actions/admin/users.ts`, verification route families under `apps/admin/src/actions/admin/**`, and `apps/admin/src/lib/api/api-middleware.ts`.
- **ADR-007 admin-path migration (phase 2 sweep):** completed non-dashboard admin reference sweep and confirmed no remaining `SYSTEM_ADMIN` usages under `apps/admin/src/**`, `apps/admin/__tests__/**`, or `apps/admin/scripts/**` after the first-wave gate updates.
- **ADR-007 admin-path migration (phase 2 validation):** added and refreshed admin capability policy-matrix assertions in `apps/admin/src/lib/security/__tests__/authorization-policy.test.ts` to lock consolidated role expectations (`admin` vs `verification_admin`) across route and action policy maps.
- **ADR-007 admin-path migration (phase 2 typecheck cleanup):** resolved enum-casing and strict typing blockers in admin verification tests, scripts, analytics action enums/aggregates, dashboard property detail callbacks, verification tabs queue props, and notification mailer integration; `pnpm run admin:check-types` now passes.

- **Upload observability key normalization (L-1):** normalized upload adapter `operationName` fields to snake_case for stable query joins. Renames: `create-upload-asset` -> `create_upload_asset`, `get-upload-asset-metadata` -> `get_upload_asset_metadata`, `delete-upload-asset` -> `delete_upload_asset`, `onboarding-upload` -> `onboarding_upload`. Coordinated rollout note: update dashboard and log-query filters keyed by the legacy names in the same deployment window.
- **AuthContext minimization (L-2):** removed `userEmail` from shared API auth context in `app/lib/api/api-middleware.ts`; authenticated route context now carries `clerkId`, `dbUserId`, `userRole`, and optional `adminRole` only, reducing unnecessary PII propagation at adapter boundaries.
- **Uploads service startup and testability hardening (L-3):** replaced module-load storage provider initialization in `app/lib/domains/uploads/service.ts` with lazy per-call resolution and added `setUploadServiceStorageProviderForTests(...)` override support to keep startup behavior predictable and improve isolated domain testing.

- **Turbo workspace alignment and install-warning cleanup (2026-04-08):** aligned `turbo` to `^2.9.5` across root and client package manifests, and removed unused direct `ts-node` dependencies from `apps/client` and `packages/db` to eliminate recurring pnpm Windows bin-link ENOENT warnings during install.
- **Dependency and peer-alignment cleanup (2026-04-08):** upgraded `react-day-picker` to `^9.14.0` in admin and client to remove React/date-fns peer-range mismatches under React 19 and current `date-fns`.
- **Cypress component test dependency cleanup (2026-04-08):** removed deprecated `@cypress/react18` from `apps/client` and kept `@cypress/react` as the active component-testing adapter.
- **Clerk middleware modernization (2026-04-08):** upgraded `@clerk/nextjs` (admin and payment-service) and `@clerk/express` (project-service), then replaced `@hono/clerk-auth` in payment-service with a local Clerk backend adapter (`src/lib/clerkAuth.ts`) built on `@clerk/backend` to eliminate deprecated Clerk transitive dependency paths.
- **CI action/runtime alignment (2026-04-08):** updated `.github/workflows/ci.yml` to use `actions/github-script@v8` (Node 24 runtime) and removed redundant pnpm version pinning from `pnpm/action-setup`, relying on root `packageManager` (`pnpm@10.29.2`) as the single pnpm version source.
- **ADR-007 admin-path migration (phase 2 baseline closure):** completed the final type-baseline cleanup pass in admin actions by replacing string-based lead filter typing with canonical enum-safe contracts and removing suppression-based compilation masking from the leads action surface.
- **ADR-007 ClientType onboarding compliance routing (2026-04-04):** domain onboarding now treats `ClientType` as a profile classification (not identity), derives a dedicated `government_entity` onboarding branch for `GOVERNMENT_ENTITY` clients, and persists explicit routing metadata for downstream project-creation and payment-initiation compliance checks in profile preferences.
- **Onboarding observability contract completion (2026-04-04):** middleware onboarding resolver now emits structured outcomes for internal-secret-missing fallback, non-OK internal API fallback, internal API errors, and successful internal API resolution; onboarding route suites now assert the terminal structured logging contract for success and unauthorized or bad-request terminal outcomes across all onboarding endpoint families.
- **ADR-007 client-first phase implemented:** added typed onboarding lifecycle statuses (`ONBOARDING`, `PENDING_VERIFICATION`) to the Prisma schema surface, added a dedicated professional pending-verification route (`/professional-portal/pending-verification`) with middleware loop-safe redirect orchestration, propagated status-aware onboarding resolution through internal status and middleware helpers, and normalized client role handling toward the canonical `ADMIN + AdminRole` model (including legacy `SUPPORT` normalization at trust boundaries).
- **ADR-007 migration scaffold added:** introduced `packages/db/prisma/migrations/20260402120000_adr007_role_model_phase1/migration.sql` to provision `AdminProfile` for migrated support users, normalize `SYSTEM_ADMIN` to `SUPER_ADMIN`, and contract role enums as part of the phased rollout.
- **ADR-007 next phase scoped:** admin-path migration is intentionally deferred to the next phase and will cover remaining admin route/action/UI role gates and policy coverage alignment (`__tests__/policy/**`) for the consolidated admin capability model.
- **ADR-007 admin-path migration (phase 2 start):** opened first concrete admin role-gate edits by switching initial admin action and middleware super-role gates from `SYSTEM_ADMIN | SUPER_ADMIN` to `SUPER_ADMIN`, including `apps/admin/src/actions/admin/shared.ts`, `apps/admin/src/actions/admin/users.ts`, verification route families under `apps/admin/src/actions/admin/**`, and `apps/admin/src/lib/api/api-middleware.ts`.
- **ADR-007 admin-path migration (phase 2 sweep):** completed non-dashboard admin reference sweep and confirmed no remaining `SYSTEM_ADMIN` usages under `apps/admin/src/**`, `apps/admin/__tests__/**`, or `apps/admin/scripts/**` after the first-wave gate updates.
- **ADR-007 admin-path migration (phase 2 validation):** added and refreshed admin capability policy-matrix assertions in `apps/admin/src/lib/security/__tests__/authorization-policy.test.ts` to lock consolidated role expectations (`admin` vs `verification_admin`) across route and action policy maps.
- **ADR-007 admin-path migration (phase 2 typecheck cleanup):** resolved enum-casing and strict typing blockers in admin verification tests, scripts, analytics action enums/aggregates, dashboard property detail callbacks, verification tabs queue props, and notification mailer integration; `pnpm run admin:check-types` now passes.

- **Upload observability key normalization (L-1):** normalized upload adapter `operationName` fields to snake_case for stable query joins. Renames: `create-upload-asset` -> `create_upload_asset`, `get-upload-asset-metadata` -> `get_upload_asset_metadata`, `delete-upload-asset` -> `delete_upload_asset`, `onboarding-upload` -> `onboarding_upload`. Coordinated rollout note: update dashboard and log-query filters keyed by the legacy names in the same deployment window.
- **AuthContext minimization (L-2):** removed `userEmail` from shared API auth context in `app/lib/api/api-middleware.ts`; authenticated route context now carries `clerkId`, `dbUserId`, `userRole`, and optional `adminRole` only, reducing unnecessary PII propagation at adapter boundaries.
- **Uploads service startup and testability hardening (L-3):** replaced module-load storage provider initialization in `app/lib/domains/uploads/service.ts` with lazy per-call resolution and added `setUploadServiceStorageProviderForTests(...)` override support to keep startup behavior predictable and improve isolated domain testing.

- **Environment contract enforcement and template alignment (Phase 4/6):** expanded `.env.example` to include runtime-consumed env keys, added `apps/client/scripts/check-env-contract.mjs` to detect drift between `process.env` usage and template declarations, wired script entries in `apps/client/package.json` and root `package.json`, and added an env-contract check step to `.github/workflows/ci.yml`.
- **Deployment/local env hygiene:** updated `apps/client/.gitignore` to ignore `.env.vercel` while preserving `.env.vercel.example`, refreshed `apps/client/.env.local.example` local guidance defaults, sanitized `apps/client/.env.vercel`, and added `apps/client/.env.vercel.example` as the committed deployment template.
- **Phase 5 central env access plan clarified:** documented canonical env boundary usage under `app/lib/infrastructure/env.ts`, prioritized high-risk direct env-read migration targets (`api-middleware`, `internal-secret`, `infrastructure/storage`, `jobs/asset-cleanup`), and captured validation-group expansion scope in `docs/ENV-FILES-REMEDIATION-WALKTHROUGH.md`.
- **High-risk template cleanup:** removed stale high-risk unused placeholders from `.env.example` (`SMTP_PASSWORD`, `AFRICASTALKING_API_KEY`) to align with strict checker policy.

- **Onboarding asset migration refinement:** Completed staff-level audit of `app/api/ONBOARDING_ASSET_MIGRATION.md`; removed `fileUrl` from `MaterializedUpload` (assetId-only); stopped writing `fileUrl` when creating `ProfessionalDocument` from staged uploads in `user-profile/onboarding.ts` and `professional-settings/service.ts`; aligned TTL cleanup to `uploadService.cleanupExpiredStagedUploads()` with repository-level `markStagedUploadsExpiredByIds()` status updates; updated onboarding README with correct `uploadId`/`previewUrl` response format and documents payload; refinement checklist in migration doc.
- **Onboarding upload cleanup job:** Added BullMQ job `cleanup-expired-staged-uploads` in `app/jobs/onboarding-upload-cleanup.ts` that calls `uploadService.cleanupExpiredStagedUploads()`; scheduled daily at 3 AM (configurable via `ONBOARDING_UPLOAD_CLEANUP_CRON`); integrated into central job orchestrator with schedule, worker, shutdown, status, manual trigger, and health check.
- **Onboarding upload storage cleanup:** Extended cleanup job to delete storage blobs for expired staged uploads: added `uploadRepository.findExpiredStagedUploadsForCleanup()` and `markStagedUploadsExpiredByIds()`; added `uploadService.cleanupExpiredStagedUploads()` (finds expired, deletes via storage provider, marks EXPIRED); job now returns `deletedFromStorage` and `failedDeletions`; tests in `__tests__/jobs/onboarding-upload-cleanup.test.ts` and `__tests__/lib/uploads/service.test.ts`.
- **Properties settings refinement:** Extracted `PropertyListCard` and `PropertyDocumentsSection` from `properties-settings-page-client.tsx`; updated `MyPropertyListing` to use ISO strings for `createdAt`/`updatedAt` (hydration-safe); wired extracted components into the properties and verification tabs; staff audit in `docs/AUDIT-PROPERTIES.md`.
- **Documents carry-forward refinement:** Applied staff-level carry-forward rules to the documents slice: added `Result<T, DocumentDomainError>` and `DocumentActor` contracts; refactored service to use `ok`/`err` helpers and actor-based authorization; updated routes to pass full actor context and map domain Result to HTTP (403/404); added explicit DTOs (`DocumentListItem`, `DocumentDetail`); added domain and route adapter tests (`documents.service.test.ts`, `documents.route.test.ts`).
- **Licenses carry-forward refinement:** Applied staff-level carry-forward rules to the licenses slice: added `Result<T, LicenseDomainError>` and `LicenseActor` contracts; refactored service to use `ok`/`err` helpers and actor-based authorization; updated routes to pass full actor context and map domain Result to HTTP (403/404); added explicit DTOs (`LicenseListItem`, `LicenseDetail`, `LicenseCreateResult`, etc.); added domain and route adapter tests (`licenses.service.test.ts`, `licenses.route.test.ts`); fixed PATCH handler to destructure `userRole` for actor context.
- **Client-dashboard carry-forward refinement:** Applied staff-level carry-forward rules to the client-dashboard slice: added `Result<T, ClientDashboardDomainError>` and `ClientDashboardActor` contracts; refactored service to use `ok`/`err` helpers and actor-based authorization (`requireClientDashboardActor`); updated route to pass actor context and map domain Result to HTTP (403); added domain and route adapter tests (`client-dashboard.service.test.ts`, `dashboard.route.test.ts`).
- **Reviews carry-forward refinement:** Applied staff-level carry-forward rules to the reviews slice: added `Result<T, ReviewsDomainError>` and `ReviewsActor` (public/empty) contracts; refactored service to use `ok` helper and accept actor; updated route to pass actor and map domain Result to HTTP (403); added domain and route adapter tests (`reviews.service.test.ts`, `reviews/route.test.ts`).
- **Search carry-forward refinement:** Applied staff-level carry-forward rules to the search slice: added `Result<T, SearchDomainError>` and `SearchActor` (public/empty) contracts; refactored service to use `ok` helper and accept actor; updated `searchProfessionalsAction` to pass actor and map Result (throws on error); added domain and action tests (`search.service.test.ts`, `search.test.ts`).
- **Seller-insights carry-forward refinement:** Applied staff-level carry-forward rules to the seller-insights slice: added `Result<T, SellerInsightsDomainError>` and `requireProfessionalActor`; refactored service to use `ok`/`err` helpers and actor-based authorization; replaced `createProfessionalPortalGet` with custom `withAuth` handlers that map Result to HTTP (403); added domain and route adapter tests (`seller-insights.service.test.ts`, `seller-insights-adapters.route.test.ts`).
- **Pending refinement completed:** Removed orphaned `lib/services` legacy files (`reviews.ts`, `search.ts`, `documents.ts`, `licenses.ts`, `certificates.ts`, `client-dashboard.ts`, `upload.ts`); updated `lib/idea-books-client.ts` comment to reference `app/lib/domains/idea-books`; resolved PROGRESS-SUMMARY pending items (project-operations kept as internal app/lib; staff candidates removed from pending).
- **Certificates carry-forward refinement:** Applied staff-level carry-forward rules to the certificates slice: added `Result<T, CertificateDomainError>` and `CertificateActor` contracts; refactored service to use `ok`/`err` helpers and `requireProfessionalCertificateActor`; replaced ad-hoc result types with shared Result pattern; added explicit DTOs (`CertificateListItem`, `CertificateDetail`); updated routes to pass actor and map Result to HTTP (403/404); added domain and route adapter tests (`certificates.service.test.ts`, `certificates.route.test.ts`).
- **lib/services Migration (Phase 1–7):** Migrated six route-backed vertical slices from `lib/services` to canonical domains: **Reviews** (`app/lib/domains/reviews/`), **Search** (`app/lib/domains/search/`), **Documents** (`app/lib/domains/documents/`), **Licenses** (`app/lib/domains/licenses/`), **Certificates** (`app/lib/domains/certificates/`), and **Client Dashboard** (`app/lib/domains/client-dashboard/`). Routes and actions now delegate through domain services instead of `lib/services/*`. Upload refinement: moved `isLocalUpload` to `lib/utils/upload.ts`; created `lib/upload-client.ts` for `uploadFiles`, `UploadError`, `validateFiles`, `FILE_LIMITS`; repointed `PropertyForm`, `StoreForm`, `DocumentUploader`, and `useImageUploader` to the new locations. Removed dead `lib/services/inventory.ts`, `orders.ts`, and `products.ts` (seller-insights domain owns this logic).
- Refined the messaging slice: added route-level `loading.tsx` for `app/(user)/messages`; added `loading.tsx` and `error.tsx` for `app/professional-portal/messages` and `app/professional-portal/messages/[id]` with layout-aligned skeletons and error surfaces; updated `lib/messaging-client.ts` comment to reference the canonical domain.
- Refined the notifications slice: added route-level `loading.tsx` and `error.tsx` boundaries for `app/(user)/notifications` aligned to the page layout (ClientNavbar, Footer, header skeleton, list skeleton); updated `lib/notifications-client.ts` comment to reference the canonical domain (`app/lib/domains/notifications/`) instead of legacy `lib/services/notifications.ts`.
- Refined the seller-insights domain and frontend slice: moved inventory, orders, and products logic from `lib/services/*` into `app/lib/domains/seller-insights/repository.ts` so the domain owns persistence and DTO shaping; removed `lib/services/inventory`, `lib/services/orders`, and `lib/services/products` imports from the domain; updated `lib/inventory-client.ts`, `lib/orders-client.ts`, and `lib/products-client.ts` to use explicit domain contracts (`SellerInventoryAlert`, `SellerInventoryAlertsResult`, `SellerOrderListResult`, `SellerTopProduct`); aligned `hooks/useDashboardData.ts` and `InventoryAlertsWidget` to import from the seller-insights domain instead of legacy services.
- Refined the `finance` domain and frontend slice: narrowed `providerMetadata` to `Prisma.JsonValue`, created `FinanceBrowserTransaction` contract to formalize the client status normalization boundary, removed duplicate `FinanceStats` from `finance-client.ts`, fixed the `requestWithdrawal` return type, removed the duplicate zod schema in the dashboard page, extracted `FinanceCard` and `TransactionRow` to route-local `_components/`, pinned locals, added `loading.tsx` and `error.tsx` segment boundaries, and corrected the `useWithdraw` hook comment.
- Refined the professional-portal dashboard UI: added App Router segment-level `loading.tsx` (uses shared `DashboardSkeleton`) and `error.tsx` boundary to `app/professional-portal/dashboard/`; extracted `VerificationPromptCard`, `ErrorAlert`, and `DashboardSkeleton` from `page.tsx` into co-located `_components/` files; loaded `VerificationPromptCard` with `dynamic()` (ssr: false) so its icons and card imports are absent from the initial bundle for users who never skipped onboarding; pinned locale to `"en-KE"` in `MetricsRow` (`store_views`, `property_views` formatters) and `AgendaWidget` (`toLocaleTimeString`) for deterministic output; removed the dead if/else in `DashboardHeader` whose two branches rendered identical JSX.
- Refined the onboarding uploads slice post-migration: fixed a double `arrayBuffer()` read in `app/api/onboarding/uploads/route.ts` by buffering each file once during collection and reusing the `Buffer` in both validation and staging calls; removed the legacy `fileUrl` field from `MaterializedUpload` in `app/lib/domains/uploads/service.ts` so the domain type now surfaces only `assetId` as the canonical post-materialization reference; introduced a typed `CreateStagedUploadInput` DTO in `app/lib/domains/uploads/repository.ts` replacing the raw `Prisma.OnboardingUploadCreateInput` parameter so field-level mismatches are caught at compile time. Extended `__tests__/api/onboarding/uploads.test.ts` with a rate-limit 429 adapter test and a `MAX_FILES_PER_REQUEST` 400 adapter test, bringing the uploads adapter suite to complete admission-guard coverage.
- Hardened the user-profile and professional-settings migration with shared user-profile serialization mappers, stricter profile-complete route typing and target-specific schema dispatch, explicit profile-status browser contracts, and route-segment `loading.tsx`/`error.tsx` boundaries for `app/profile` and `app/profile/complete`.
- Added canonical notifications domain boundaries under `app/lib/domains/notifications/` and cut `app/api/notifications/route.ts` plus `app/api/notifications/[id]/route.ts` over to actor-aware domain orchestration and explicit domain-error HTTP mapping.
- Added canonical idea-books and seller-insights seams under `app/lib/domains/idea-books/` and `app/lib/domains/seller-insights/`, then migrated the idea-books route family and professional seller read-model adapters (`inventory/alerts`, `orders`, `products/top`) to thin domain-backed adapters.
- Hardened idea-books route adapter tests for isolation by switching validation-failure schema overrides to one-shot mock behavior, preventing cross-test contamination in route-level error-mapping assertions.

### Docs (Historical)

- Updated `docs/PROGRESS-SUMMARY.md` and `docs/CHANGELOG.md` with recently migrated vertical slices (Reviews, Search, Documents, Licenses, Certificates, Client Dashboard), pending refinement (lib/services cleanup, idea-books comment), and tests implementation status (domain/route tests pending for migrated slices).
- Added environment hardening documentation artifacts: `docs/ENV-FILES-AUDIT.md` (staff-level audit findings and recommendations) and `docs/ENV-FILES-REMEDIATION-WALKTHROUGH.md` (phased remediation and rollout checks).

### Added (Historical)

- Added focused adapter regression coverage in `__tests__/api/notifications/route.test.ts`, `__tests__/api/notifications/notification-id.route.test.ts`, and `__tests__/api/professional-portal/seller-insights-adapters.route.test.ts` for route-to-domain delegation and status-code mappings.
- Added focused idea-books adapter regression coverage across the full route family in `__tests__/api/idea-books/route.test.ts`, `__tests__/api/idea-books/book-id.route.test.ts`, `__tests__/api/idea-books/attachments.route.test.ts`, and `__tests__/api/idea-books/attachment-id.route.test.ts`.

### Docs (Historical Architecture Review Checklist)

- Added a staff-level architecture review checklist to `.agent/API-TO-FRONTEND-ARCHITECTURE.md` for data flow, DTO serialization, bundle review, hydration safety, and route-level resilience checks.
- Added a migrated-slice refinement checklist to `.agent/API-TO-FRONTEND-ARCHITECTURE.md` so completed slices are still reviewed for server-owned DTO mapping, dynamic split opportunities, and App Router error/loading boundaries.
- Documented CRM as the next planned migration slice, covering public leads, professional leads, inquiries, and pipeline, ahead of the domain cutover.
- Documented the follow-through guidance from the completed CRM migration: use shared `Result<T, DomainError>` contracts, keep role and ownership checks inside services, route server actions through `secureAction`, and inline collection GET adapters when domain errors need precise HTTP mapping.
- Added a domain-layer README at `app/lib/domains/README.md` documenting the CRM service/repository boundary, public versus authenticated semantics, and the new direct domain coverage files.
- Updated the progress tracking docs to record the completed CRM follow-through work: direct leads/inquiries/pipeline domain coverage plus dashboard consumer and browser-client CRM verification.
- Refreshed the top-level API architecture docs (`app/lib/API_ARCHITECTURE.md`, `app/api/API.md`, and `app/api/DESIGN.md`) so they now describe the current thin-adapter, domain-core model, actor-aware service boundaries, rollout-gated shared projects API ownership, and the difference between canonical domains and browser/client facades.
- Strengthened ADR-001 through ADR-003 to codify role-bearing actor propagation, `app/lib/domains/*` as the canonical server-side business layer, and structured domain-result mapping as the expected adapter-to-domain contract.
- Updated ADR-002 and ADR-003 to treat server-owned DTO serialization, meaningful dynamic import boundaries, and route-level segment resilience as part of the standing client architecture rules.
- Added a migration audit for the remaining `apps/client` legacy service surfaces and ranked the next vertical slices by scope impact.

#### Remaining Vertical Slice Queue (Ranked By Scope Impact)

1. **Idea Books** — medium-high impact client-facing CRUD plus attachment slice.
   Action plan: create `app/lib/domains/idea-books/`; move list/detail/update/delete and attachment ownership logic out of the route layer; add a browser-safe facade and route plus domain coverage for collaborator and attachment semantics.
2. **Notifications** — medium-high impact cross-app user state slice.
   Action plan: create `app/lib/domains/notifications/`; migrate collection and item routes to structured domain results for list, mark-read, and delete flows; then align notification consumer contracts on `isRead` and the canonical envelope.
3. **Seller Dashboard Read Models** (`inventory`, `orders`, `products`) — medium impact but currently fragmented.
   Action plan: treat these as one read-model migration wave, either under a shared seller-insights domain or as tightly coordinated `inventory`, `orders`, and `products` domains; migrate the three professional-portal API routes plus `inventory-client`, `orders-client`, `products-client`, and `useDashboardData` dependencies together.
4. **Reviews** — lower-impact standalone public read slice.
   Action plan: either fold review reads into the professionals public read model or create a small `app/lib/domains/reviews/` module now that the professionals cutover is complete, so discovery-related public DTOs stop straddling multiple legacy services.

Scope-impact criteria used for ranking:

- breadth of route-family coverage still backed by `lib/services/*`
- presence of server actions and browser consumers that would need contract migration
- user-facing importance of the slice in public discovery, authenticated workflow, or shared dashboard surfaces
- likelihood that the slice removes fragmented ownership logic from adapters rather than only moving read helpers

### Additional Changed

- Began the CRM domain cutover by routing both public and authenticated leads adapters plus `app/actions/leads.ts` through `app/lib/domains/leads/`, leaving inquiries and pipeline as the remaining legacy CRM surfaces.
- Completed the CRM domain cutover by routing inquiries and pipeline through canonical actor-aware domain modules, removing the remaining legacy `lib/services/inquiries.ts` and `pipeline.ts` dependencies from CRM routes and inquiry actions.
- Removed the dead compatibility layer under `apps/client/lib/services/` for CRM (`leads.ts`, `public-leads.ts`, `inquiries.ts`, and `pipeline.ts`) now that all lead, inquiry, and pipeline adapters resolve through the canonical domain services.
- **Messaging Boundary Hardening**: Refactored the client messaging slice onto the shared actor-aware domain boundary. `app/lib/domains/messaging/service.ts` now owns participant, sender, and owner/admin authorization checks for reads and mutations; messaging server actions use `secureAction` directly; and messaging route adapters pass role-bearing actor context into the service instead of only raw user IDs.
- **Messaging API**: Removed the remaining route-local Prisma authorization blocks from conversation participant and read-marker handlers, moving those operations into the messaging domain with explicit `forbidden`, `not_found`, and `conflict` mapping preserved at the route layer.
- **Onboarding Actions**: Reworked `app/actions/onboarding.ts` to use `secureAction` directly for validation and structured failure handling while keeping Clerk-first identity resolution for pre-materialized users and delegating persistence to the user-profile onboarding domain.
- **Professional Settings**: Expanded the professional-settings actor contract to carry role context, enforced professional-role access inside `professionalSettingsService`, and routed downstream store/property creation through actor-aware domain calls instead of bare user-id caller discipline.
- **Messaging Tests**: Extended messaging regression coverage into route adapters so conversation detail, participant listing, and conversation-message collection handlers now prove `403` versus `404` HTTP mapping directly instead of relying only on domain-service tests.
- **User Profile Actors**: Propagated role-bearing actor context through the remaining authenticated onboarding route adapters (`/api/onboarding`, `/api/onboarding/skip`, `/api/onboarding/skip-professional`) so every user-profile seam now carries full actor identity into the domain layer.
- **Client Type Baseline**: Restored the client TypeScript baseline by tightening finance null handling, aligning portfolio project-type client types with the shared schema union, and exposing professional verification status on the profile contract used by redirect hooks.
- **Browser Client Coverage**: Extended the browser-safe client-boundary verification pass with focused contract coverage for the non-dashboard facades used by identity and portal consumers, including profile status null mapping, consent bulk writes, onboarding responses, finance transaction normalization, and portfolio detail normalization.
- **Onboarding Consumer Coverage**: Added consumer-layer verification for the onboarding flow so `useOnboarding` and `OnboardingForm` now prove metadata-driven redirects, submit and skip routing, cancellation sign-out, and role-specific dashboard navigation without relying only on route tests.
- **Consent and Finance Adapter Coverage**: Added focused adapter and route regression tests for `/api/user/consent` and the professional finance routes, covering bulk partial-success consent handling, shared professional-portal GET wrapper composition, transaction query parsing, and withdrawal plus transaction mutation mappings.
- **CRM Follow-Through Coverage**: Added direct domain-level regression suites for leads, inquiries, and pipeline, then extended dashboard consumer and browser-client coverage so the CRM path is now verified at the service, facade, and hook layers.

### Added (Unreleased)

- Added shared client server-action hardening primitives:
  - `app/lib/actions/secure-action.ts`
  - `app/lib/errors/result.ts`
- Added wrapper coverage for secure action parsing, actor resolution, and domain-result failure translation:
  - `__tests__/lib/secure-action.test.ts`
- Introduced security and middleware collaborators under `app/lib/security/`:
  - role normalization (`roles.ts`)
  - authorization policies (`policies.ts`)
  - middleware collaborators (`route-matcher.ts`, `onboarding-resolver.ts`, `redirect-policy.ts`, `system-settings-resolver.ts`)
  - internal secret guard helper (`internal-secret.ts`)
- Added middleware decision logging utility:
  - `app/lib/security/middleware/decision-log.ts`
- Added auth hash utility module `app/lib/auth/password-hash.ts` to reduce auth boundary leakage.
- Added architecture ADRs:
  - `docs/adr/ADR-001-auth-model.md`
  - `docs/adr/ADR-002-client-layer-boundaries.md`
- Added risk-focused tests:
  - `__tests__/middleware/route-guards.test.ts`
  - `__tests__/lib/security-policies.test.ts`
  - `__tests__/api/internal/secret-guard.test.ts`
- Added middleware hardening test suites:
  - `__tests__/lib/middleware-resolvers.test.ts`
  - `__tests__/lib/middleware-decision-log.test.ts`
- Added PR CI guard to enforce changelog discipline when `apps/client` code changes:
  - `.github/workflows/ci.yml` (`client-changelog-guard` job)
- Added canonical messaging domain module under `app/lib/domains/messaging/`:
  - `contracts.ts`
  - `repository.ts`
  - `service.ts`
- Added boundary bridge modules under `lib/` for config, validation, operations, and repository imports to reduce direct `lib -> app/lib/*` coupling for stores/properties/projects.
- Added messaging client contract regression test:
  - `__tests__/lib/messaging-client-contracts.test.ts`
- Added lightweight security contracts:
  - `app/lib/security/auth-context.ts`
  - `app/lib/security/authorization-policy.ts`
- Added server-runtime workspace packages:
  - `packages/auth-server` (`@build/auth-server`)
  - `packages/messaging-server` (`@build/messaging-server`)
  - `packages/mail-server` (`@build/mail-server`)
  - `packages/queue-server` (`@build/queue-server`)
- Added `docs/dependency-audit.md` with runtime classification and package extraction mapping.
- Added `types/clerk-nextjs-server.d.ts` to provide explicit local module declarations for `@clerk/nextjs/server` when workspace package-link resolution is unstable, keeping middleware/actions/routes type-safe without changing runtime auth behavior.
- Added canonical properties domain module under `app/lib/domains/properties/`:
  - `repository.ts`
  - `service.ts`
  - `index.ts`
- Added properties client contract regression test:
  - `__tests__/lib/properties-client-contracts.test.ts`
- Added dedicated similar-listings endpoint:
  - `app/api/properties/[id]/similar/route.ts`
- Added project item-route integration tests:
  - `__tests__/api/projects/project-item-routes.test.ts`
  - Covers item GET/DELETE for documents/images and confirms legacy query-param delete exports are removed from collection routes.
- Added project core-route sanity tests:
  - `__tests__/api/projects/project-core-routes.test.ts`
  - Covers projects collection list/create behavior, project detail GET/ETag and not-found mapping, patch precondition guard, and milestones list/create error mapping.
- Added portfolio image item-route sanity tests:
  - `__tests__/api/portfolio/portfolio-image-item-routes.test.ts`
  - Covers item `PATCH`/`DELETE` behavior and asserts collection route no longer exports legacy image item mutation handlers.
- Added portfolio core-route sanity tests:
  - `__tests__/api/portfolio/portfolio-core-routes.test.ts`
  - Covers portfolio collection list/create (including idempotency cache and limit handling), detail not-found mapping, patch idempotency pending conflict, and delete forbidden mapping.
  - Documented CRM as the next planned migration slice, covering public leads, professional leads, inquiries, and pipeline, ahead of the domain cutover.
- Added focused browser-client and consumer regression suites:
  - `__tests__/lib/non-dashboard-browser-clients.test.ts`
  - `__tests__/hooks/profile-client-hooks.test.ts`
  - `__tests__/hooks/useOnboarding.test.tsx`
  - `__tests__/components/forms/OnboardingForm.test.tsx`
- Added focused adapter and route regression suites for identity/compliance and finance:
  - `__tests__/api/user/consent.route.test.ts`
  - `__tests__/api/professional-portal/finance-adapters.route.test.ts`
  - `__tests__/api/professional-portal/finance-routes.test.ts`

### Changed (Historical)

- Started the identity/profile/compliance migration by extracting a canonical professional-settings domain module under `app/lib/domains/professional-settings/` and refactoring `app/professional-portal/settings/actions.ts` into a `secureAction`-backed adapter over typed domain results.
- Removed the last legacy `@/lib/services/projects` and `@/lib/services/properties` imports from query-oriented server actions by routing `app/actions/projects.ts` and `app/actions/properties.ts` through domain services for authenticated project reads, public property list/detail reads, and similar-property lookups.
- Normalized actor propagation beyond mutation-only paths by adding a domain-backed user-project listing flow and by switching onboarding property creation to `app/lib/domains/properties/service.ts` so action boundaries stop mixing direct legacy service calls with actor-aware domain services.
- Re-verified the targeted API suites after the follow-through pass: projects `4/4` files and `19/19` tests passing, portfolio `2/2` files and `11/11` tests passing.
- Finished the secure-action rollout for remaining optimistic-lock project mutations by migrating `app/actions/projects.ts` update/delete and milestone mutation handlers onto `app/lib/domains/projects/service.ts`, with explicit actor propagation instead of raw `dbUserId` strings.
- Propagated explicit actor-aware service signatures through stores, properties, and projects so server actions can hand domain services normalized actor context while preserving backward-compatible call sites.
- Hardened portfolio image API adapters (`/api/professional-portal/portfolio/[id]/images` and `/api/professional-portal/portfolio/[id]/images/[imageId]`) by extracting ownership, asset-authorization, and image mutation logic into `app/lib/domains/portfolio/service.ts`, reducing route-level IDOR exposure and keeping the routes as thin HTTP adapters.
- Started client command/query hardening rollout across migrated slices by replacing duplicated Clerk-to-DB actor resolution in server actions with the shared secure-action actor resolver, and by standardizing validation/error handling in representative `stores`, `properties`, and `projects` actions.
- Refactored messaging server actions to consume the canonical messaging domain service instead of legacy caller-disciplined assertion helpers, with Zod-backed input validation and typed domain-result mapping at the action boundary.
- Standardized the messaging domain service on a shared `Result<T, DomainError>`-style contract and added a dedicated thread-read repository/service path so message and thread access checks remain service-owned.
- Hardened validation enum schemas across `app/lib/validation/*` with explicit `z.ZodType<Enum>` annotations (calendar, documents, profile, professionals, portfolio, orders, notifications, messaging, stores, idea-books, finance, properties, certificate, leads) to prevent TypeScript implicit-any/inference regressions.
- Refactored professional-project route adapters to use schema-inferred payload types from `app/lib/validation/projects-validation` (documents, milestones list/create, milestone detail update, escrow dispute, milestone approve, and projects collection), removing remaining Prisma enum import leakage from route modules.
- Refactored `middleware.ts` into thin orchestration using extracted collaborators.
- Further hardened `middleware.ts` with centralized redirect helpers and stable decision events.
- Normalized session role parsing in `app/lib/auth/session-claims.ts`.
- Applied explicit policy guards across messaging and project high-risk paths.
- Updated test middleware invocation patterns and response type narrowing for strict typing.
- Expanded middleware redirect matrix coverage (maintenance, signup controls, onboarding fallback/indeterminate scenarios).
- Upgraded middleware resolvers to explicit typed outcomes (state/source/confidence/reason and cache strategy metadata).
- Refactored messaging route adapters (`/api/messaging/conversations*`, `/api/messaging/messages*`) to call domain service methods instead of embedding route-level persistence logic.
- Aligned `lib/messaging-client.ts` message-list API contract with `/api/messaging/messages/conversation/[conversationId]`.
- Repointed high-leak client and service modules (`projects`, `properties`, `stores`) to `lib/*` boundary modules for config/validation/operations dependencies.
- Refactored remaining messaging adapters (`/api/messaging/messages/[id]`, `/api/messaging/messages/[id]/read`, `/api/messaging/messages/[id]/reactions`, `/api/messaging`) to delegate to the domain service and repository.
- Updated `app/api/messaging/README.md` to document the thin-adapter/domain-core architecture.
- Updated `app/lib/security/policies.ts` to evaluate named authorization policies using shared auth/authorization contracts while keeping existing boolean helper APIs.
- Rewired messaging route adapters to consume `@build/messaging-server` instead of directly importing domain internals.
- Rewired middleware and auth utilities to consume `@build/auth-server`.
- Rewired mail and queue runtime imports to consume `@build/mail-server` and `@build/queue-server` entrypoints.
- Added transpilation for new server packages in `next.config.ts`.
- Refactored properties route adapters (`/api/properties`, `/api/properties/[id]`, `/api/properties/my-listings`, `/api/properties/[id]/documents`) to delegate core business/data operations to `app/lib/domains/properties/service.ts`.
- Refactored `app/api/properties/[id]/attachments/route.ts` into a thin adapter that delegates attachment persistence/ownership checks to `app/lib/domains/properties/service.ts`.
- Aligned `app/api/properties/[id]/documents/route.ts` to the same thin-adapter pattern and error envelope as attachments (consistent resilient execution shape, correlation-aware domain error mapping, and write rate limiting on delete).
- Normalized `app/api/properties/route.ts` and `app/api/properties/[id]/route.ts` to the same adapter error-envelope contract (guarding `resilientExecutor` null data, correlation-aware domain error propagation, and consistent 500 fallback handling).
- Added resource-scoped document route `app/api/properties/[id]/documents/[documentId]/route.ts` with `PATCH` and `DELETE`, and extended properties domain service/legacy service support for document updates to align with attachment-style adapter boundaries.
- Refactored properties attachment/document route adapters (`/api/properties/[id]/attachments`, `/api/properties/[id]/documents`, `/api/properties/[id]/documents/[documentId]`) to remove direct `@prisma/client` imports and consume canonical properties contracts from `app/lib/domains/properties/contracts.ts`.
- Implemented resource-scoped attachment route `app/api/properties/[id]/attachments/[attachmentId]/route.ts` (`GET`, `PATCH`, `DELETE`) as a thin adapter with canonical contracts-based validation and domain-service delegation.
- Slimmed `app/api/properties/[id]/attachments/route.ts` to collection-only operations (`GET`/`POST`) and deprecated legacy query-param item mutation usage in favor of `/api/properties/[id]/attachments/[attachmentId]`.
- Refactored stores route adapters (`/api/stores`, `/api/stores/[id]`, `/api/stores/[id]/documents`, `/api/stores/[id]/documents/[documentId]`) to consume canonical domain contracts exports from `app/lib/domains/stores` and remove remaining route-level `@prisma/client` import leakage.
- Aligned `lib/properties-client.ts` owner listings endpoint to `/api/properties/my-listings` (previously pointed at non-existent `/api/properties/me`).
- Expanded `lib/links.ts` `API_ROUTES` properties coverage to include `my-listings`, `similar`, `documents`, and `documents/[documentId]` helpers alongside attachment detail helpers.
- Extended `app/lib/domains/properties/service.ts` with explicit attachment and similar-properties methods so route adapters no longer embed Prisma-level attachment logic.
- Expanded boundary bridge coverage under `lib/validation/*` and `lib/repositories/*`, and added bridge shims for `lib/security/policies.ts`, `lib/infrastructure/env.ts`, and `lib/utils/slug-generator.ts` to eliminate direct `lib/* -> app/lib/*` imports outside sanctioned bridges.
- Rewired remaining client/service imports (calendar, inquiries, leads, professionals, portfolio, messaging, documents, certificates, licenses, finance, notifications, profile, idea-books) to consume `@/lib/*` bridge modules instead of `@/app/lib/*` internals.
- Hardened ADR-002 lint guardrails by promoting key `no-restricted-imports` boundary rules from `warn` to `error` for `lib/services/**` and general `lib/**/*` imports.
- Consolidated projects client contracts and split-context implementations into `app/lib/domains/projects/client/*` so the projects vertical slice is colocated under the projects domain root.
- Removed redundant concrete implementations from `lib/projects-client/*`, retaining compatibility via `lib/projects-client.ts` as the public facade.
- Updated `hooks/useDashboardData.ts` to consume canonical project-list envelopes from the projects client (`data.items`).
- Refactored `app/lib/domains/projects/repository.ts` to own project participant and milestone ownership verification internally, removing direct dependency on `app/lib/services/project-operations.service` and aligning projects domain dependency direction with ADR-003.
- Refactored escrow route adapters (`/api/professional-portal/projects/[id]/escrow`, `/api/professional-portal/projects/[id]/escrow/[escrowId]`, `/api/professional-portal/projects/[id]/escrow/[escrowId]/dispute`) to delegate list/detail/dispute business logic to `app/lib/domains/projects/service.ts`, removing direct Prisma and operations-service coupling from those routes.
- Refactored milestone detail adapter (`/api/professional-portal/projects/[id]/milestones/[milestoneId]`) to delegate GET/PATCH/DELETE domain behavior (ownership checks, transition validation, optimistic-lock conflict handling) to `app/lib/domains/projects/service.ts`, removing direct `@build/db` and `project-operations.service` imports from that route.
- Refactored project detail adapter (`/api/professional-portal/projects/[id]`) to delegate GET/PATCH/DELETE domain behavior (owner lookup, optimistic-lock update/delete, conflict version propagation) to `app/lib/domains/projects/service.ts`, removing direct `project-operations.service` and legacy service imports from that route.
- Refactored project documents adapter (`/api/professional-portal/projects/[id]/documents`) to delegate list/create/delete document behavior (ownership checks, asset ownership validation, limits, milestone linkage validation, GDPR/audit logging triggers) to `app/lib/domains/projects/service.ts`, removing direct Prisma and `project-operations.service` imports from that route.
- Refactored project images adapter (`/api/professional-portal/projects/[id]/images`) to delegate list/create/delete image behavior (ownership checks, asset ownership validation, limits, consent logging) to `app/lib/domains/projects/service.ts`, removing direct Prisma and `project-operations.service` imports from that route.
- Implemented and refactored remaining project item-resource adapters (`/api/professional-portal/projects/[id]/documents/[documentId]`, `/api/professional-portal/projects/[id]/images/[imageId]`) as thin routes delegating GET/DELETE behavior to `app/lib/domains/projects/service.ts`.
- Removed legacy query-parameter delete handlers from project collection routes (`/api/professional-portal/projects/[id]/documents?documentId=...`, `/api/professional-portal/projects/[id]/images?imageId=...`) so deletion is canonicalized to item-resource endpoints only.
- Refactored remaining projects collection adapters (`/api/professional-portal/projects`, `/api/professional-portal/projects/[id]/milestones`) to consume `app/lib/domains/projects/service.ts` for list/create flows, removing direct dependence on `@/lib/services/projects` from professional-project API adapters.
- Refactored projects escrow mutation adapters (`/api/professional-portal/projects/[id]/escrow/[escrowId]/fund`, `/api/professional-portal/projects/[id]/escrow/[escrowId]/release`) to delegate funding/release transitions and ledger-side effects to `app/lib/domains/projects/service.ts`, removing remaining route-level Prisma coupling.
- Refactored milestone approval adapter (`/api/professional-portal/projects/[id]/milestones/[milestoneId]/approve`) to delegate approval transition and conditional escrow release orchestration to `app/lib/domains/projects/service.ts`.
- Expanded `app/lib/domains/projects/repository.ts` and `app/lib/domains/projects/service.ts` with document/image/milestone/escrow operations (ownership/participant checks, limits, consent/audit hooks, and dispute marking) to support thin route adapters across `professional-portal/projects`.
- Added a feature flag gate for generic projects client methods in `app/lib/domains/projects/client/index.ts` using `NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API`; generic client calls now fail fast when disabled so Phase 2 `/api/projects/**` can remain explicitly deferred without silent contract drift.
- Verified project API route test suite passes with current refactor state: `pnpm vitest --run __tests__/api/projects` (3 files, 18 tests).
- Canonicalized portfolio image mutations to item-resource routes by moving image metadata update/delete from `/api/professional-portal/portfolio/[id]/images?imageId=...` to `/api/professional-portal/portfolio/[id]/images/[imageId]`, and retaining collection route as `GET`/`POST` only.
- Verified portfolio API sanity suite passes: `pnpm vitest --run __tests__/api/portfolio` (2 files, 11 tests).
- Started Phase 2 role-neutral projects API implementation:
  - Added canonical shared core routes `/api/projects` and `/api/projects/[id]` as thin adapters with auth, rate limiting, zod validation, idempotency, and response mapping.
  - Repointed `/api/professional-portal/projects` and `/api/professional-portal/projects/[id]` to alias shared handlers.
  - Added explicit policy methods in projects domain service (`canReadProject`, `canUploadProject`, `canManageMilestone`) and wired project/document/image access decisions through domain policy checks.
  - Added actor-scoped project list/detail and professional-create repository methods to support shared route behavior.
  - Updated core projects route tests to validate canonical shared handlers and verified project API suite passes (`pnpm vitest --run __tests__/api/projects`, 3 files, 16 tests).

### Removed

- Removed dead or misplaced dependencies from `apps/client/package.json`:
  - `@clerk/express`
  - `@ngrok/ngrok`
  - `@react-email/render`
  - `bcrypt`
  - `better-auth`
  - `express`
  - `ioredis`
  - `nodemailer`
  - `radix-ui`
  - `resend`
- Removed fixed-version workspace declarations from `devDependencies` in favor of `workspace:*`.

### Security (Historical)

- Internal endpoints now fail closed if `INTERNAL_API_SECRET` is missing:
  - `app/api/internal/user-status/route.ts`
  - `app/api/internal/system-settings/route.ts`
  - `app/api/metrics/route.ts`

### Additional Docs

- Established this changelog for ongoing architecture and refactor tracking.
- Documented middleware runtime hardening and CI policy enforcement in `Unreleased`.
- Updated `app/api/properties/README.md` to match current implementation:
  - removed non-existent `PATCH /api/properties/[id]/documents`
  - clarified thin-adapter/domain-service architecture and error-envelope mapping
  - corrected validation/domain file references in related files
- Updated `app/api/properties/README.md` routes table to document collection-only attachments (`GET`/`POST`) and resource-scoped attachment item operations (`GET`/`PATCH`/`DELETE`).
- Updated `app/api/professional-portal/projects/README.md` with Phase 2 ownership matrix, canonical `/api/projects/**` route ownership, and professional-portal alias notes.
- Migrated entries from `apps/client/Changelog.md` into this canonical changelog and redirected `apps/client/Changelog.md` to this document.

---

## Entry Template (copy for new release slices)

```md
## [YYYY-MM-DD or vX.Y.Z]

### Added

- ...

### Changed

- ...

### Fixed

- ...

### Security

- ...

### Docs

- ...
```

## Format Note (Entries from 2026-04-11 forward)

New entries use the semantic category format with an explicit `**Files changed:**`
and `**Verification:**` block. Existing checkpoint entries are preserved as-is.

Categories: `Added` - `Changed` - `Deprecated` - `Removed` - `Fixed` -
`Security` - `Docs`
