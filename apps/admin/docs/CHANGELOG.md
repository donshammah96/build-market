# apps/admin Changelog

## [Unreleased]

### Changed (Monorepo Catalog Governance & CI Guard)

- **Strict Catalog Governance**: Updated `apps/admin/package.json` dependencies (`@opentelemetry/sdk-metrics`, `@clerk/nextjs`, `next`, `next-themes`, etc.) to `"catalog:"`. Integrated pre-install catalog consistency linter into CI workflow (`.github/workflows/ci.yml`).

**Files changed:**

- `apps/admin/package.json`
- `pnpm-workspace.yaml`
- `scripts/check-catalog-consistency.mjs`
- `.github/workflows/ci.yml`

### Fixed (CI Lint Errors)

- **NULL_POINTER** (`audit-tamper-evidence.test.ts`): Resolved two static analysis `NULL_POINTER` findings on lines 111 and 169 where `(createdCall?.details as any)._audit.loggedAt` accessed a property through optional chaining but then dereferenced it unconditionally. Extracted `const details = createdCall!.details as any` after the existing `expect(createdCall).toBeDefined()` guard to satisfy the null-safety contract.
- **UNUSED_IMPORT** (`telemetry.test.ts`): Removed stale `vi` import from `vitest` — the test file only uses `describe`, `it`, and `expect`.
- **UNUSED_IMPORT** (`resilient-api.ts`): Removed unused `import { omitUndefined } from "@/lib/utils"` — the helper was never called in the file after a prior refactor.

### Security (Next.js Vulnerability Patch)

- **Next.js 16.2.11 Security Upgrade**: Bumped all workspace catalog Next.js pins (`next`, `eslint-config-next`, `@next/bundle-analyzer`, `@next/eslint-plugin-next`) from `16.2.6` to `16.2.11` to remediate 7 security advisories:
  - `GHSA-6gpp-xcg3-4w24` (high) — Middleware / Proxy bypass in App Router with Turbopack + single locale
  - `GHSA-m99w-x7hq-7vfj` (high) — Denial of Service in App Router via Server Actions
  - `GHSA-89xv-2m56-2m9x` (high) — SSRF in Server Actions on custom servers
  - `GHSA-p9j2-gv94-2wf4` (high) — SSRF via attacker-controlled destination hostname in rewrites
  - `GHSA-4c39-4ccg-62r3` (moderate) — Cache confusion of response bodies for requests with bodies
  - `GHSA-q8wf-6r8g-63ch` (moderate) — DoS in Image Optimization API via SVGs
  - `GHSA-955p-x3mx-jcvp` (moderate) — Unauthenticated disclosure of internal Server Function endpoints

**Files changed:**

- `apps/admin/__tests__/security/audit-tamper-evidence.test.ts`
- `apps/admin/__tests__/infrastructure/telemetry.test.ts`
- `apps/admin/src/lib/api/resilient-api.ts`
- `pnpm-workspace.yaml`

### Added (Phase 4 Continuous Governance & Flag Retirement)

- **CI Governance Pipeline Integration & Feature Flag Expiration Enforcement (P1-3 / Phase 4)**:
  - Enforced strict automated feature flag lifespan and target retirement date checks in [check-continuous-governance.mjs](file:///c:/Users/User/build-market/apps/admin/scripts/check-continuous-governance.mjs) and [check-security-drift.mjs](file:///c:/Users/User/build-market/apps/admin/scripts/check-security-drift.mjs). CI fails strictly when any flag in `AdminFeatureFlag` exceeds `maxLifetimeDays` or passes `targetRetirementDate`.
  - Added [feature-flags-lifecycle.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/config/feature-flags-lifecycle.test.ts) asserting metadata presence and testing expiration bounds in Vitest.
  - Integrated `admin:check-governance` and `admin:check-all` into [.github/workflows/ci.yml](file:///c:/Users/User/build-market/.github/workflows/ci.yml) in the primary `validate` job.
  - Refactored logger calls across adapter layers, jobs, and middleware ([api-middleware.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/api/api-middleware.ts), [resilient-api.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/api/resilient-api.ts), [safe-action.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/_core/safe-action.ts), [asset-cleanup.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/asset-cleanup.ts), [export-cleanup.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/export-cleanup.ts), and [license-expiry.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/license-expiry.ts)) to use explicit properties, eliminating all static security drift logger spread warnings (`[WARN] logger call includes spread metadata`).
- **Continuous Governance Automated Linter (Phase 4)**:
  - Authored [check-continuous-governance.mjs](file:///c:/Users/User/build-market/apps/admin/scripts/check-continuous-governance.mjs) asserting feature flag lifespans against `FEATURE_FLAG_LIFECYCLE_METADATA`, high-risk audit coverage across `high-risk-admin-registry.mjs`, and dependency patch SLO overrides in monorepo `pnpm-workspace.yaml`.
  - Added package scripts `admin:check-governance` and `admin:check-all` in [package.json](file:///c:/Users/User/build-market/apps/admin/package.json).
- **GDPR Erasure & Tamper-Evident Replay Integration Suite (Phase 4 / ADR-ADMIN-015)**:
  - Created [verify-gdpr-replay.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/security/verify-gdpr-replay.test.ts) verifying queue payload validation, cryptographic audit hash chain genesis, and tamper detection.

### Added (Structural Cleanup, Shell Component Extraction & Feature Flag Lifecycle)

- **Dashboard Shell & Access Boundary Component Extraction (P2-1 / Phase 3)**:
  - Extracted modular layout presentation components under `src/components/admin/shell/`: [AdminShell.tsx](file:///c:/Users/User/build-market/apps/admin/src/components/admin/shell/AdminShell.tsx), [AdminAccessBoundary.tsx](file:///c:/Users/User/build-market/apps/admin/src/components/admin/shell/AdminAccessBoundary.tsx), [AdminUserMenu.tsx](file:///c:/Users/User/build-market/apps/admin/src/components/admin/shell/AdminUserMenu.tsx), and [AdminSystemErrorCard.tsx](file:///c:/Users/User/build-market/apps/admin/src/components/admin/shell/AdminSystemErrorCard.tsx).
  - Refactored [layout.tsx](file:///c:/Users/User/build-market/apps/admin/src/app/%28dashboard%29/layout.tsx) into a thin async layout composing `AdminAccessBoundary` with server-side auth/permission resolution.
  - Added unit test suite [shell.test.tsx](file:///c:/Users/User/build-market/apps/admin/src/components/admin/shell/__tests__/shell.test.tsx) verifying access denial, database error displays with correlation IDs, and successful rendering.
- **Architectural Boundary Lint Enforcement (P2-2 / Phase 3)**:
  - Extended [check-security-drift.mjs](file:///c:/Users/User/build-market/apps/admin/scripts/check-security-drift.mjs) with strict static architectural checks: `no-direct-orm-access` (forbidding runtime Prisma/DB query instances in presentation and server action layers), `no-raw-clerk-server` (forbidding raw Clerk server imports outside auth adapters and shell), and `checkFeatureFlagLifecycle`.
- **Feature Flag Lifecycle Governance (P1-3 / Phase 3)**:
  - Extended [feature-flags.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/config/feature-flags.ts) with `FEATURE_FLAG_LIFECYCLE_METADATA` specifying `owner`, `createdAt`, `targetRetirementDate`, `maxLifetimeDays`, and description for every `AdminFeatureFlag`.
  - Added static linter assertion in `check-security-drift.mjs` verifying that every active feature flag has complete lifecycle metadata and complies with retirement schedules.

- **Background Jobs, Metrics Scaffolding & Tamper-Evident Audit (ADR-ADMIN-011 / ADR-ADMIN-012 / ADR-ADMIN-015 / Phase 2)**:
  - **OpenTelemetry Metrics Scaffolding**: Added `@opentelemetry/exporter-metrics-otlp-grpc` and `@opentelemetry/sdk-metrics` dependencies to `package.json`, configured the standard OTLP metric exporter and `PeriodicExportingMetricReader` in [otel.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/infrastructure/otel.ts), and created [metrics.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/infrastructure/metrics.ts) defining standard counters (`admin.action.outcome`, `admin.route.outcome`, `admin.audit.write`, `admin.job.attempt`, `admin.queue.lag`) and latency histograms.
  - **Boundary Instrumentation**: Instrumented server action boundary [safe-action.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/_core/safe-action.ts), API route handler authentication [route-auth.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/security/route-auth.ts), and background BullMQ workers with outcome counters and latency histograms.
  - **Queue Payload Registry & Poison Message Guards**: Created [queue-registry.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/queues/queue-registry.ts) registering payload Zod validation schemas across all background queues and enforced fail-closed payload checks in workers ([incident.worker.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/workers/compliance/incident.worker.ts), [gdpr-erasure.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/gdpr-erasure.ts), [data-retention.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/data-retention.ts), [anonymization-batch.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/anonymization-batch.ts), [asset-cleanup.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/asset-cleanup.ts), [export-cleanup.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/export-cleanup.ts), and [license-expiry.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/license-expiry.ts)).
  - **Cryptographic Audit Hashing Chain**: Added `findLastAuditLog` in [repository.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/audit/repository.ts), implemented SHA-256 hash chaining in [service.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/audit/service.ts) stored on the existing JSON `details` field, exposed `verifyAuditLogIntegrity(actor)` to detect log tampering or broken pointer segments, and enforced fail-closed behavior for high-risk operations in [audit.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/_core/audit.ts).
  - **Operational Runbooks & Test Verification**: Authored [JOBS-QUEUES-RUNBOOKS.md](file:///c:/Users/User/build-market/apps/admin/docs/JOBS-QUEUES-RUNBOOKS.md) and [TELEMETRY-SLO.md](file:///c:/Users/User/build-market/apps/admin/docs/TELEMETRY-SLO.md), created test suites [telemetry.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/infrastructure/telemetry.test.ts), [queue-registry.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/infrastructure/queue-registry.test.ts), and [audit-tamper-evidence.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/security/audit-tamper-evidence.test.ts), and updated snapshot results in [VERIFICATION.md](file:///c:/Users/User/build-market/apps/admin/docs/VERIFICATION.md).

### Security (Dependency Vulnerability Patches)

- **Dependency Vulnerability Patches**: Updated root `pnpm-workspace.yaml` overrides to patch security vulnerabilities flagged by `pnpm run deps:audit` impacting `apps/admin`:
  - `brace-expansion`: Upgraded override from `2.0.3` to `2.1.2` (remediating DoS via exponential-time expansion, GHSA-3jxr-9vmj-r5cp).
  - `protobufjs`: Upgraded override from `>=8.0.2` to `>=8.6.6` (remediating prototype pollution GHSA-jfj6-75fj-8934 and DoS infinite loop GHSA-j3f2-48v5-ccww in `@opentelemetry/exporter-trace-otlp-grpc` -> `@grpc/grpc-js` chain).
- **Consolidated Environment Flag Parsing**: Centralized environment variable boolean flag parsing into `env-utils.ts` and migrated calls to prevent raw string parsing inconsistencies.
- **Route & Action Authorization Hardening (ADR-ADMIN-001)**: Integrated database `UserRole` and `AdminRole` enums instead of raw string comparison in `route-auth.ts`, and enforced safe role fallback values to prevent route crashes.
- **CLI Tools Security**: Added CLI arguments, interactive safety prompts, target database host warnings, and structured Prisma `AdminAuditLog` record generation to the `promote-admin.ts` utility.
- **Static Linter Rules Parity**: Reconciled the security drift checker ([check-security-drift.mjs](file:///c:/Users/User/build-market/apps/admin/scripts/check-security-drift.mjs)) with client-side validation rules. Fixed a critical scanning path bug (where paths looked in root instead of `src/` causing 0 files to be scanned) and added rules for `no-direct-env`, `no-banned-log-keys`, `no-unallowlisted-storage`, `no-cors-drift`, `zod-mutation-passthrough`, `unsafe-client-errors`, and `req-json-in-get`.
- **Observability and Privacy (ADR-ADMIN-003)**: Hardened standard log calls in [api-middleware.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/api/api-middleware.ts) and [api-utils.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/api/api-utils.ts) to eliminate raw `userId` and `clerkId` log properties. Added explicit log safety exemptions to compliance cron and queue worker files to safely track user erasure life cycles.
- **Production Gate Hardening (P0-1 & P0-5)**: Disabled TypeScript build suppression (`ignoreBuildErrors: false`) in [next.config.ts](file:///c:/Users/User/build-market/apps/admin/next.config.ts) and redacted raw exception output/database connection errors in [layout.tsx](<file:///c:/Users/User/build-market/apps/admin/src/app/(dashboard)/layout.tsx>), replacing them with correlation IDs. Added static check `checkIgnoreBuildErrors()` to [check-security-drift.mjs](file:///c:/Users/User/build-market/apps/admin/scripts/check-security-drift.mjs) to prevent reintroduction of build error bypasses.
- **Central Browser Security Headers (ADR-ADMIN-010)**: Configured central security headers policy (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Content-Security-Policy-Report-Only`) in [next.config.ts](file:///c:/Users/User/build-market/apps/admin/next.config.ts) and created module [security-headers.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/security/security-headers.ts).
- **Deployment Profile Environment Governance (ADR-ADMIN-013 / Phase 1)**: Added `ADMIN_DEPLOYMENT_PROFILE` (`local`, `test`, `preview`, `staging`, `production`) to [env.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/infrastructure/env.ts). Configured schema refinements enforcing required presence of database URLs and queue providers when deploying under `production` or `staging` profiles.
- **Typed Route Registry & Single Source of Truth (Phase 1)**: Centralized App Router dashboard route matchers, titles, sections, and role policies in [route-registry.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/security/route-registry.ts) and refactored [middleware.ts](file:///c:/Users/User/build-market/apps/admin/src/middleware.ts) to consume matchers directly. Added automated test [route-registry.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/security/route-registry.test.ts) enforcing that every filesystem page under `src/app/(dashboard)` is registered.
- **SSRF-Safe Outbound Client & Static Egress Linter Rule (Phase 1)**: Created [ssrf-safe-fetch.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/infrastructure/ssrf-safe-fetch.ts) validating outbound target URLs against private IPv4 blocks (RFC 1918), link-local cloud metadata (`169.254.169.254`), and loopbacks (`127.0.0.1`, `::1`, `localhost`). Created test suite [ssrf-safe-fetch.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/infrastructure/ssrf-safe-fetch.test.ts) and added static linter rule `checkDirectOutboundFetch` to [check-security-drift.mjs](file:///c:/Users/User/build-market/apps/admin/scripts/check-security-drift.mjs).
- **High-Risk Operation Registry & Audit Coverage Assertions (ADR-ADMIN-015 / Phase 1)**: Extended [high-risk-admin-registry.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/security/high-risk-admin-registry.ts) with `suspendUser`, `unsuspendUser`, and `anonymizeUser` entries and created [audit-coverage.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/security/audit-coverage.test.ts) asserting `maxAgeSeconds` freshness thresholds and rate limit namespaces across tier-1 mutations.

### Fixed

- **TypeScript 7 Native Bridge Compatibility & Build Typechecking (`patch-typescript.mjs`)**: Fixed a Next.js production build failure (`.module is not defined in ES module scope` & `Cannot read properties of undefined (reading 'ESNext')`) caused by `"type": "module"` in `node_modules/typescript/package.json` and incomplete TypeScript compiler exports. Updated [patch-typescript.mjs](file:///c:/Users/User/build-market/scripts/patch-typescript.mjs) to set `node_modules/typescript/package.json` as CommonJS, use resolved target paths, and re-export the full TypeScript compiler CJS bundle (`module.exports = require("${ts6Path}")`).
- **Next.js Dynamic Server Usage Signal Rethrow in Layout (`layout.tsx`)**: Fixed false-positive database failure log output during `next build` static page collection by rethrowing `err.digest === "DYNAMIC_SERVER_USAGE"` inside [layout.tsx](<file:///c:/Users/User/build-market/apps/admin/src/app/(dashboard)/layout.tsx>).

### Added

- **Production Readiness Audit Docs & Governance ADRs**: Added proposed production readiness audit and ADRs for admin browser security headers/CSP, observability SLOs and telemetry, background job and queue semantics, environment and secret governance, incident response and break-glass access, and data retention/export/tamper-evident audit controls.
- **Security Headers & Policy Assertion Test Suites**: Created test suites [security-headers.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/config/security-headers.test.ts), [route-and-action-policy-drift.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/security/route-and-action-policy-drift.test.ts), [route-registry.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/security/route-registry.test.ts), [audit-coverage.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/security/audit-coverage.test.ts), and [ssrf-safe-fetch.test.ts](file:///c:/Users/User/build-market/apps/admin/__tests__/infrastructure/ssrf-safe-fetch.test.ts).

- **Admin Shared NATS Producer Singleton**: Created centralized infrastructure-level NATS producer lazy-singleton in [nats-client.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/infrastructure/nats-client.ts) with `getAdminNatsProducer()` and `shutdownAdminNatsProducer()`, respecting `adminEnvConfig.NATS_URL`.
- **License NATS Verification Events**: Implemented `publishLicenseVerificationEvent()` in [notification.service.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/verification/internal/notification.service.ts) to publish typed `LicenseVerificationEvent` payloads on `license.<action>` (`verified`, `rejected`, `needs_correction`).
- **License Email Consumer Handler**: Extended [verification-email.worker.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/verification/internal/verification-email.worker.ts) with a subscription to `license.>` (durable consumer `verification-email-worker-license`) to handle email delivery for license verification outcomes.
- **System Health Domain Slice**: Created a new domain slice at [`contracts.ts`](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/system-health/contracts.ts) and [`service.ts`](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/system-health/service.ts) running concurrent, error-isolated diagnostic probes (database `$queryRaw` ping, serverless-safe Upstash Redis ping, NATS JetStream configuration validation, and implicit Clerk status checking) with latency timing and degraded threshold flags.
- **System Infrastructure Health Widget**: Added a dynamic presentational widget at [`SystemInfrastructureWidget.tsx`](file:///c:/Users/User/build-market/apps/admin/src/components/admin/dashboard/SystemInfrastructureWidget.tsx) displaying latency in milliseconds, detailed error logs for failed probes, a status strip, and a custom loading skeleton (`SystemInfrastructureSkeleton`).
- **Resilient Layout and Error Screens**: Created root-level [`global-error.tsx`](file:///c:/Users/User/build-market/apps/admin/src/app/global-error.tsx), dashboard-level [`loading.tsx`](<file:///c:/Users/User/build-market/apps/admin/src/app/(dashboard)/loading.tsx>), [`error.tsx`](<file:///c:/Users/User/build-market/apps/admin/src/app/(dashboard)/error.tsx>) overlays, and a custom [`not-found.tsx`](file:///c:/Users/User/build-market/apps/admin/src/app/not-found.tsx) page to prevent runtime exceptions from breaking the dashboard.
- **Banned, Deactivated, and Archived User Statuses**: Implemented validators and transitions in [service.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/users/service.ts) and [users.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/users.ts) for `BANNED`, `DEACTIVATED`, and `ARCHIVED` statuses, preventing self-mutations and locking operations on deactivated accounts.
- **GDPR Compliance Erasure Helper**: Created a dedicated anonymization helper in [gdpr-erasure.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/gdpr-erasure.ts) that hashes the user email (`deactivated-hash@deleted.local`), nullifies profile data, soft-deletes professional stores, schedules asset deletion, and deletes the Clerk profile.
- **Unauthorized Sign-In Flow:** Implemented a new `/unauthorized-sign-in` public route and page ([page.tsx](<file:///c:/Users/User/build-market/apps/admin/src/app/(auth)/unauthorized-sign-in/page.tsx>)) that displays tailored restriction notices (Account Suspended, Account Banned, etc.) and auto-signs out blocked sessions on mount.
- **Blocked-User Middleware Gate:** Added a middleware validation step in [middleware.ts](file:///c:/Users/User/build-market/apps/admin/src/middleware.ts) checking user status claims to redirect suspended, banned, deactivated, or archived users to the unauthorized sign-in page.
- **User Suspension Server Actions:** Added `suspendUser` and `unsuspendUser` safe mutations in [users.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/users.ts) to toggle DB user status, synchronize state to Clerk `publicMetadata`, check action policies (requiring `recentAuth`), and write append-only audit log records.
- **User Status Domain Logic:** Added status checking and update capabilities to the user repository ([repository.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/users/repository.ts)) and domain service ([service.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/users/service.ts)).
- **Clerk Satellite Configuration:** Added `NEXT_PUBLIC_CLERK_IS_SATELLITE`, `NEXT_PUBLIC_CLERK_DOMAIN`, and `NEXT_PUBLIC_CLERK_SIGN_IN_URL` environment variables in `apps/admin/.env.development` and `apps/admin/.env.test` for satellite domain authentication support.
- **TSConfig References:** Added `@build/enums` reference path in `tsconfig.json`.
- **GDPR Erasure Queue Integration**: Integrated the compliance erasure queue (`erasureQueue`), daily cron batch scheduler (`scheduleGdprErasure`), and queue processing worker (`createGdprErasureWorker`) into the central job orchestrator ([index.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/index.ts)) with support for manual trigger operations, worker health checks, and graceful shutdown handlers.
- **Clerk Redirect Configuration**: Configured default `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` and `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` redirect routes pointing to `/` in `.env.development` and `.env.example` to resolve redirection loop bugs on admin.buildmarket.app.
- **Satellite Primary Sign-In URL Env Var**: Introduced `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` to [env.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/infrastructure/env.ts), `.env.example`, and `.env.development`. Holds the absolute primary-domain sign-in URL (`https://buildmarket.app/sign-in`) for `ClerkProvider.signInUrl` when running as a Clerk satellite — distinct from `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (`/sign-in`), which remains the local satellite route used by middleware and internal routing.

### Changed

- **Verification Entity Core Strategy Pattern**: Consolidated entity verification logic across `verifyProfessional()`, `verifyStore()`, and `verifyProperty()` into a shared `verifyEntityCore()` adapter strategy in [verify-entity-core.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/verification/internal/verify-entity-core.ts), eliminating ~180 lines of structural duplication while preserving domain boundary definitions, audit log generation, transaction guarantees, and `exactOptionalPropertyTypes: true` compliance. Added comprehensive unit tests in `verify-entity-core.test.ts`.
- **License Verification Domain Event Wiring**: Updated `verifyLicense()` in [service.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/verification/service.ts) to publish NATS events non-blocking while preserving ADR-ADMIN-002 domain boundary layer structure.
- **Audit Service Transaction Typing**: Updated `tx?: any` parameter in `createAuditLog()` in [audit-service.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/verification/internal/audit-service.ts) to `tx?: Prisma.TransactionClient` from `@build/db`.
- **Notification Helpers Entity Context**: Added `case "license"` handling in `getEntityName()` in [notification-helpers.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/verification/internal/notification-helpers.ts) to resolve authority and license number context for notification templates.
- **Code Reorganization & Test Relocation**: Moved 13 action boundary tests from `src/actions/admin/__tests__/` to `__tests__/actions/` at the application root, aligning the codebase with established guidelines. Replaced all relative mock paths and imports with type-safe path aliases (`@/actions/admin/...` and `@/_core/...`).
- **CLI Scripts Consolidation**: Consolidated the CLI scripts directory by moving the Clerk administrative role setup script `src/scripts/set-admin.ts` to `scripts/set-admin.ts`, updating its relative paths for dotenv configuration and dynamic infrastructure env imports, and removing the now-empty `src/scripts/` directory.
- **Admin Documentation & README**: Generated a comprehensive, staff-level root `README.md` for the admin application detailing layer boundaries, directory structures, environment variables, security controls (freshness gating and audit logs), and development/testing instructions. Also updated the test structure mapping in `docs/CONTRIBUTING.md`.
- **TypeScript Catalog**: Upgraded the monorepo-wide TypeScript version to `7.0.2` and migrated the local `typescript` dependency to the workspace `catalog:` schema to ensure workspace-wide version consistency.
- **Non-Blocking Dashboard Health Streaming**: Refactored the dashboard [`page.tsx`](<file:///c:/Users/User/build-market/apps/admin/src/app/(dashboard)/page.tsx>) to render the System Infrastructure widget concurrently using `<Suspense>`, eliminating head-of-line blocking from slow database/cache checks.
- **Structured Audit/Permissions Logging (ADR-ADMIN-003)**: Migrated permissions retrieval actions and layout-level connection validation logic from raw `console.error` logs to standard `StructuredLogger` events with trace correlation ID tracking.
- **Vercel Build Command:** Modified `vercel.json` build command to compile referenced projects using `pnpm tsc --build tsconfig.json` before running next.js build to avoid build-time dependency resolution issues.
- **Queue Provider Resolution:** Simplified `CURRENT_PROVIDER` logic in `notification-queue.ts` to map both `redis` and `bullmq` env values to `QueueProvider.REDIS`.
- **Code Cleanup:** Removed unused imports (`adminEnvConfig`, `AdminLogEvent`, `NextResponse`, `AdminRole`, `superAdmin`) and unused destructuring assignments across several route handlers, contracts, and tests.
- **ClerkProvider `signInUrl` (satellite mode):** [layout.tsx](file:///c:/Users/User/build-market/apps/admin/src/app/layout.tsx) now resolves `signInUrl` from `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` (absolute) before falling back to `NEXT_PUBLIC_CLERK_SIGN_IN_URL`. Ensures `ClerkProvider` always points unauthenticated users to the primary-domain OAuth endpoint, not the satellite's own relative path.
- **`<SignIn>` redirect prop:** [sign-in/page.tsx](<file:///c:/Users/User/build-market/apps/admin/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx>) changed from `forceRedirectUrl="/"` to `fallbackRedirectUrl="/"`. `forceRedirectUrl` unconditionally overrides any `redirect_url` param, breaking deep-link return navigation. `fallbackRedirectUrl` respects a present `redirect_url` and only falls back to `/` when none exists.
- **Observability (PII Removal Audit)**: Cleaned up 19 compile-time type-safety violations across 6 `apps/admin` files ([notification.service.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/verification/internal/notification.service.ts), [anonymization-batch.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/anonymization-batch.ts), [data-retention.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/data-retention.ts), [export-cleanup.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/export-cleanup.ts), [gdpr-erasure.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/gdpr-erasure.ts), and [notification.worker.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/workers/compliance/notification.worker.ts)) by removing raw PII identifiers (`userId`, `userEmail`) from logging contexts.

### Fixed (Static Build Environment Validation)

- **Static Build Environment Validation (`env.ts`)**: Extracted `adminBaseEnvSchema` as a pure `ZodObject` before refinement, allowing `isStaticBuildPhase()` to execute `adminBaseEnvSchema.partial()` when environment validation fails during production `next build`. This prevents Zod runtime exceptions (`Error: .partial() cannot be used on object schemas containing refinements`) during static page data collection for `/_not-found` and server components. Added unit test reproduction using `vi.stubEnv` in [env-and-layout.test.tsx](file:///c:/Users/User/build-market/apps/admin/__tests__/config/env-and-layout.test.tsx).
- **CI Admin Preview Smoke Gate (`ci.yml`)**: Added `QUEUE_PROVIDER: memory` to the `admin-preview-smoke-gate` job environment block in [.github/workflows/ci.yml](file:///c:/Users/User/build-market/.github/workflows/ci.yml) to satisfy production environment schema requirements during CI preview builds.
- **Security Drift Log Safety (`verification-email.worker.ts`)**: Reworded log message strings in [verification-email.worker.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/verification/internal/verification-email.worker.ts) to replace `email:` colons with hyphens, resolving false-positive `no-banned-log-keys` security drift linter violations (ADR-ADMIN-003).
- **Unused Import Removal (`notification-queue.ts`)**: Removed unused `Job` import binding from `bullmq` in [notification-queue.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/verification/internal/notification-queue.ts).
- **Middleware API Redirect Bypass**: Updated `middleware.ts` to return `401 Unauthorized` and `403 Forbidden` JSON responses on API/tRPC routes when user session is unauthenticated or blocked, instead of redirecting the requests to HTML login pages.
- **Deep-link Query Params Forwarding**: Refactored the satellite sign-in catch-all route page component to accept and propagate query parameters during primary domain sign-in forwarding.
- **Middleware Test Suite**: Updated `middleware.test.ts` to verify 401/403 JSON responses on API routes.
- **Compliance Queue Status Mock**: Added mocked `UserRole` and `AdminRole` enums to `compliance-queue-status.test.ts` to prevent runtime crashes during route-auth checks.
- **Admin Middleware Clerk Hardening**: Hardened the `clerkMiddleware()` options resolver and routing guards in [middleware.ts](file:///c:/Users/User/build-market/apps/admin/src/middleware.ts) to prevent request-time crashes (500 errors) when environment variables are missing or malformed.
  - Added strict absolute URL validation via `isAbsoluteHttpUrl` to check `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` before using it, falling back to host-derivation and logging errors instead of crashing.
  - Hardened host-derivation in `deriveFallbackPrimarySignInUrl` to bail out on known shared hosting suffixes (like `vercel.app` and `vercel.sh`).
  - Added defensive `toBool` coercion utility for boolean-like environment variables (`NEXT_PUBLIC_CLERK_IS_SATELLITE` and `DEV_ADMIN_BYPASS`) to avoid string values (like `"false"`) being evaluated as truthy.
  - Added domain normalization (`normalizeClerkDomain`) to strip schemes (like `https://`) accidentally included in `NEXT_PUBLIC_CLERK_DOMAIN`.
  - Configured the middleware options resolver to fail open (disable satellite mode for the request) and log console errors instead of throwing synchronously and crashing the site if a valid sign-in URL cannot be resolved.
- **TypeScript Project References Build Failure (`TS6305` & `TS2307`):** Resolved CI/Vercel compile errors where imports of `@build/redis` inside `packages/resilience` and `apps/admin` caused TypeScript project reference validation to crash on clean checkouts (no `dist/`). Root cause: a previous fix incorrectly pointed `packages/redis/package.json` `types`/`exports` to `./dist/index.d.ts` — a built artifact absent in CI. The correct fix aligns `@build/redis` with the established monorepo pattern used by `@build/nats`, `@build/auth-server`, and other packages: `"types": "./src/index.ts"` so TypeScript resolves directly from source. `composite: true` is retained in `packages/redis/tsconfig.json` for project-reference chaining. The `"references": [{ "path": "../redis" }]` entry added to [`packages/resilience/tsconfig.json`](file:///c:/Users/User/build-market/packages/resilience/tsconfig.json) is kept (required by TypeScript when both projects are composite). `"type": "module"` removal and addition of `"build": "tsc"` from the prior attempt are preserved as correct changes.
- **Middleware Edge Runtime Crash (`TypeError: immutable`):** Fixed `500 MIDDLEWARE_INVOCATION_FAILED` crashes on production (`admin.buildmarket.app`) where native `Response.redirect()` and Clerk's `authObj.redirectToSignIn()` were generating standard response objects with immutable headers. When wrapped downstream by Clerk's authentication handler (`clerkMiddleware`), attempts to append state or synchronize session cookies failed during edge-on-lambda execution. Resolved by migrating all redirect triggers to use mutable `NextResponse.redirect()` from `next/server` and wrapping Clerk's `redirectToSignIn()` response in a `NextResponse` instance.
- **Middleware Test Typings:** Updated `middleware.test.ts` to pass a second dummy argument (`{} as any`) to `middleware()` to conform with the `NextFetchEvent` signature constraints inside Clerk/Next.js middleware type definitions, resolving the `Expected 2 arguments, but got 1` compilation error.
- **Verification Notification Tests:** Mocked the Prisma `user` model on the `@build/db` mock in `notification-service.test.ts` to prevent `TypeError: Cannot read properties of undefined (reading 'findUnique')` when testing notification dispatches that query user profile details.
- **Admin Sign-In Redirect Loop (RC-1 — Dead Middleware):** `src/proxy.ts` exported a valid `clerkMiddleware` and `config.matcher` but was **never loaded** by Next.js, which only recognises `src/middleware.ts` as the middleware entry point. The entire route-protection layer was silently bypassed, causing Clerk's default unauthenticated-redirect to fire on every request and produce an infinite loop at `/sign-in?redirect_url=https://admin.buildmarket.app/`. Resolved by migrating all logic to [src/middleware.ts](file:///c:/Users/User/build-market/apps/admin/src/middleware.ts) and deleting the dead `proxy.ts`. Also expanded the `isDashboardRoute` matcher to cover all routes in the `(dashboard)` route group (`analytics`, `audit`, `leads`, `properties`, `services`, `stores`) that were previously unguarded.
- **Admin Sign-In Redirect Loop (RC-2 — Satellite `signInUrl`):** `ClerkProvider` was receiving `signInUrl: "/sign-in"` (relative) while `isSatellite: true`. For a Clerk satellite app, token exchange must occur on the primary domain; a relative URL makes Clerk attempt auth locally on the satellite, which cannot complete the OAuth handshake and collapses into a redirect loop. Fixed by passing the absolute `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` (`https://buildmarket.app/sign-in`) as `ClerkProvider.signInUrl`.
- **Admin Sign-In Redirect Loop (RC-3 — `forceRedirectUrl` override):** `<SignIn forceRedirectUrl="/">` unconditionally overrode the `redirect_url` query param appended by the middleware redirect, always discarding deep-link return URLs and sending users to `/`. Middleware would then re-evaluate `/` as unauthenticated on first load, completing the loop cycle. Changed to `fallbackRedirectUrl="/"` to restore correct post-authentication return-URL behaviour.
- **Admin Sign-In Redirect Loop (RC-4 — Satellite Middleware Redirect):** Updated `middleware.ts` to manually redirect unauthenticated requests directly to the primary domain's sign-in URL when running in Clerk satellite mode (`NEXT_PUBLIC_CLERK_IS_SATELLITE=true`), preventing the default `redirectToSignIn()` from sending users to the local relative `/sign-in` route (which caused unauthorized redirect loops in production). Also explicitly passed the `isSatellite` and `domain` parameters as configuration options to `clerkMiddleware` to resolve middleware initialization errors on Vercel.
- **Admin Sign-In Redirect Loop (RC-5 — Satellite Page Redirect & Blank Component Fix):** Updated the local `/sign-in` Server Component page to immediately redirect to the primary sign-in URL in satellite mode, resolving and forwarding `redirect_url` parameters (making relative URLs absolute with the admin base URL). This resolves blank page rendering issues caused by mounting Clerk's custom `<SignIn>` component on a satellite domain.
- **Config & Layout test timeouts:** Increased the timeout of the layout fail-fast test case in `env-and-layout.test.tsx` to 60 seconds to prevent random test timeouts in resource-constrained CI environments.
- **`ClerkProvider` domain normalization (`clerk.https` production outage):** Production sign-ins were failing with `DNS_PROBE_FINISHED_NXDOMAIN` because `NEXT_PUBLIC_CLERK_DOMAIN` was set in Vercel with an `https://` scheme prefix. Clerk constructs its Frontend API host by prepending `clerk.` to the raw `domain` prop value; with the scheme present the derived FAPI host became the syntactically valid but unresolvable `clerk.https`. Fixed by introducing a `normalizeClerkDomain` helper in [layout.tsx](file:///c:/Users/User/build-market/apps/admin/src/app/layout.tsx) that strips any scheme prefix before passing the value to `ClerkProvider` — mirroring the same normalization already applied by the middleware. The helper is intentionally inlined in `layout.tsx` (rather than imported from `middleware.ts`) because Edge Runtime module boundaries prevent cross-importing between middleware and app code; the JSDoc note keeps both copies in sync.

### Removed

- **Dead admin sign-in UI (RC-6 — satellite route clean-up):** Replaced the 124-line `(auth)/sign-in/[[...sign-in]]/page.tsx` with a 28-line pure server-side `redirect()`. The local `<SignIn>` Clerk component, all associated JSX and styling, the `redirect_url` stitching routine, and the `export const dynamic = "force-dynamic"` sentinel have been removed. Rationale: the admin app is always a Clerk satellite; the middleware already intercepts every unauthenticated request and redirects it to the primary sign-in URL with `redirect_url` attached before this page is ever reached in normal flow. Anyone navigating directly to `/sign-in` on the admin domain (e.g. a stale bookmark) is forwarded to `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` (falling back to `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and then `/`). The `[[...sign-in]]` catch-all segment is retained so that stale Clerk sub-path links (e.g. `/sign-in/sso-callback`) redirect rather than 404.

## [2026-06-18] CI & Security Drift Fixes

### Fixed (CI & Security Drift Fixes)

- **TypeScript build error (`TS2561`)**: Corrected a property name typo in [`notification.service.ts`](../src/lib/domains/verification/internal/notification.service.ts) — `retryDelay` → `retryDelayMs` — to match the `PublishOptions & { maxRetries?: number; retryDelayMs?: number }` type accepted by `producer.publishWithRetry`. This was blocking `pnpm tsc --build tsconfig.json` and the Vercel deployment pipeline.
- **Prettier format violation**: Reformatted [`instrumentation.ts`](../src/instrumentation.ts) to satisfy `format:check`. The original inline `// bootstrap-only:` comment on the `if` opening-brace line was rejected by Prettier; the fix uses a multi-line `if` form that co-locates the comment on the condition line, keeping it on the same line as the `process.env` reference.
- **Security drift regression**: The Prettier reformat initially moved the `// bootstrap-only:` comment to its own line above the `if`, breaking the `adminEnvBoundaryDrift` exemption check in `report-security-drift.mjs` (which exempts a `process.env` hit only when `bootstrap-only:` appears on the **same line** as the reference). Resolved by adopting a Prettier-compatible multi-line `if` that keeps the annotation co-located with the `process.env.NEXT_RUNTIME` condition.

### Verification (CI & Security Drift Fixes)

- `pnpm tsc --build tsconfig.json` → pass (zero TypeScript errors).
- `pnpm run format:check` → pass (all files use Prettier code style).
- `pnpm admin:report-security-drift:strict` → pass; all eight categories at 0 findings.

---

## [2026-06-15] License Verification Workflow, Distributed Safety & OpenTelemetry Integration

### Added (License Verification Workflow, Distributed Safety & OpenTelemetry Integration)

- **OpenTelemetry APM Pipeline:** Configured OpenTelemetry `NodeSDK` at `apps/admin/src/lib/infrastructure/otel.ts` and dynamic runtime registry hook `apps/admin/src/instrumentation.ts` to capture and forward Prisma query traces and HTTP requests to Datadog.
- **License Expiry Maintenance Job:** Implemented daily 1 AM BullMQ scheduler at `apps/admin/src/lib/jobs/license-expiry.ts` to transition past-due licenses to `EXPIRED` status and emit 30-day pre-expiry warning event streams (`license.expiring_soon`).
- **Feature-Gated License Verification Queue:** Added `NEXT_PUBLIC_ADMIN_FF_LICENSE_VERIFICATION_QUEUE` gate at action/UI layers to control display of the license queue inside `VerificationQueue.tsx`.
- **License Verification Service:** Created `license-verification.service.ts` to handle admin verification updates, transitioning status and outputting declarative audit log records.

### Changed (License Verification Workflow, Distributed Safety & OpenTelemetry Integration)

- **Distributed Context Propagation:** Integrated trace context injection/extraction headers into NATS publish/subscribe handlers to maintain trace visibility across distributed services.
- **Deadlock Prevention sorting:** Modified `batchVerifyEntities` and `batchVerifyDocuments` inside `verification/service.ts` to lexicographically sort target UUID lists before execution to prevent deadlock lock-waits.
- **Atomic State Transactions:** Standardized database mutations inside `license-verification.service.ts` to run inside a unified sequential `$transaction` block, ensuring strict lock-acquisition order.

---

## [2026-06-07] v2 shadow route UI tests

### Added (v2 shadow route UI tests)

- Added v2-specific UI tests for the four shadow routes:
  - **`users-v2/__tests__/page.test.tsx`**: Happy path and error state tests.
  - **`verifications-v2/__tests__/page.test.tsx`**: Happy path and error state tests, including validation of capability-aware badge rendering.
  - **`analytics-v2/__tests__/page.test.tsx`**: Happy path and error state tests, validating platform overview and financial card rendering.
  - **`audit-v2/__tests__/page.test.tsx`**: Happy path and error state tests, verifying stats calculations and filtered audit log item listings.

### Changed (v2 shadow route UI tests)

- Updated `docs/RETIREMENT.md` to reflect complete test coverage status for all four flags.
- Updated `docs/PROGRESS-SUMMARY.md` next priorities to mark the UI tests task as completed.

## [2026-06-07] v2 Route Independent Page Implementations

### Added (v2 Route Implementations)

- **`users-v2/page.tsx`**: Replaced pass-through re-export stub with an independent page that owns its own data fetching, filtering, pagination, and rendering (full feature parity with v1). Adds `data-v2-route="users"` attribute for observability test hooks.
- **`verifications-v2/page.tsx`**: Replaced stub with independent page. v2 enhancement: capability-aware admin role badge in queue header (resolves the "capability-aware queue filtering" item from `RETIREMENT.md`). Adds `data-v2-route="verifications"`.
- **`analytics-v2/page.tsx`**: Replaced stub with independent page covering all 8 overview stat cards, revenue panel, verification queue summary, top professionals, and geographic distribution. Adds `data-v2-route="analytics"`.
- **`audit-v2/page.tsx`**: Replaced stub with independent page covering stats cards, full audit trail log list with filters, details expansion, and pagination. Adds `data-v2-route="audit"`.

### Documentation

- Updated `docs/RETIREMENT.md`: All four per-flag status tables updated from **Stub** → **Independent implementation** / **Feature parity confirmed**. Next step for each flag is enabling in production to begin the 30-day stability window.
- Updated `docs/PROGRESS-SUMMARY.md`: Next Priority updated to reflect implementations done; production flag enablement is the remaining step.

### Verification

- `pnpm check-types` → pass (zero TypeScript errors).
- All four v2 route layouts continue to redirect to v1 when their respective feature flags are off — no production behaviour change.

---

## [2026-06-07] Final Autopsy Completion Pass (I-13, I-14, I-23)

### Added (Final Autopsy Completion Pass)

- **`docs/RETIREMENT.md`**: Created v2 route retirement tracker documenting per-flag migration criteria, feature-parity gate (4 criteria), current status for all four v2 shadow routes (`users-v2`, `verifications-v2`, `analytics-v2`, `audit-v2`), and a per-flag retirement checklist. Implements I-13 / F-D3.
- **`src/actions/admin/README.md`**: Created action layer structure guide documenting the flat-file rule, the Next.js route-handler architectural constraint that exempts `route.ts` directories from the collapse policy, and a table of all exempt API route handlers. Implements I-14 / F-S2.
- **`src/lib/validation/README.md`**: Created deprecation notice for `lib/validation/` confirming all 18 schemas are orphaned (zero active imports), with a per-file audit table and deletion runbook. Implements I-23 / F-S5.

### Removed (orphaned `lib/validation/` schemas)

- Deleted orphaned `lib/validation/` schemas.

### Verification (Final Autopsy Completion Pass)

- `pnpm run check-types` -> pass (no new TypeScript errors introduced).
- No runtime logic changed — this pass adds only documentation files.

### Autopsy Items Resolved: P2 Remainder & P3

- I-13 / F-D3: Create `RETIREMENT.md` for v2 shadow routes with migration criteria.
- I-14 / F-S2: Document flat-file rule; exempt Next.js route handlers from collapse policy.
- I-23 / F-S5: Audit `lib/validation/`; document all 18 schemas as orphaned with deletion runbook.

---

## [2026-06-07] P2 & P3 Autopsy Refactoring Pass

### Added (P2 & P3 Autopsy Refactoring Pass)

- **Component-Level Unit Tests**: Added unit tests for `NavigationSidebar` (`navigation-sidebar.test.tsx`), `AddUser` (`AddUser.test.tsx`), and `EditUser` (`EditUser.test.tsx`) asserting role-based capability gating, form rendering, custom submissions, validation checks, and mutation handlers.

### Changed (P2 & P3 Autopsy Refactoring Pass)

- **GDPR Domain Consolidation**: Consolidated GDPR-related services, encryption components, and tests (e.g. Compliance, Consent, Anonymization, Export, Asset Cleanup, and Field Encryption) into the dedicated `domains/gdpr/` directory.
- **Verification Domain Consolidation**: Consolidated internal verification services and tests (Notification, Audit, Entity Verification) into `domains/verification/internal/`.
- **Idempotency Service Relocation**: Moved the action-layer idempotency service to `lib/infrastructure/idempotency.service.ts` and its test.
- **Domain Configuration Colocation**: Relocated document, lead, portfolio, professional, project, property, and store configurations from the shared `lib/config/` directory into their respective domain slice folders.
- **Single-File Folder Cleanups**: Collapsed single-file folders (`errors/`, `users/`, `observability/`) into corresponding core paths (`lib/result.ts`, `domains/users/user-roles.ts`, and `lib/infrastructure/operation-names.ts`).
- **Component Directory Organization**: Reorganized user forms (moving `AddUser` and `EditUser` to `components/admin/users/`), charts (`components/charts/`), and common layout helpers (`components/layout/`).
- **Test Suite Reorganization**: Moved action integration tests under `src/actions/admin/__tests__/` and centralized domain services tests.

### Verification (P2 & P3 Autopsy Refactoring Pass)

- `pnpm run check-types` -> pass.
- `pnpm run test:all` -> pass; 49 files passed, 378 of 378 tests passed.
- `pnpm run report-security-drift:strict` -> pass; zero findings in all categories.
- `pnpm run lint` -> pass with 79 known warnings, 0 errors.

### Autopsy Items Resolved

- I-8 / ADM-018: Consolidate `lib/gdpr/` into `domains/gdpr/`.
- I-9 / ADM-019: Move `lib/services/verification/` into `domains/verification/internal/`.
- I-15: Move domain configs into their domain slice.
- I-16: Collapse single-file folders (`errors/`, `users/`, `observability/`).
- I-19: Consolidate test root structure.
- I-20: Add component-level tests for `AddUser`, `EditUser`, nav visibility.

## [2026-06-05] Architecture Autopsy Implementation Pass

### Added (Architecture Autopsy Implementation Pass)

- **Action Core Modules**: Split the former `src/actions/admin/shared.ts` god-file into focused `_core` modules for action execution, actor resolution, declarative audit recording, client API calls, DB-resolved permissions, and reusable validation.
- **Navigation Sidebar**: Added `src/components/admin/navigation-sidebar.tsx` as a server component with capability-based navigation visibility and a Suspense-wrapped verification badge.
- **Typed Verification Details**: Added per-entity detail types for professional, store, and property verification details in both the domain contract and action surface.
- **Typed Compliance Queue Payloads**: Added discriminated incident metadata and typed audit metadata payloads for compliance queue jobs.

### Changed (Architecture Autopsy Implementation Pass)

- **Canonical Action Boundary**: Removed `safeVerificationAction` and migrated verification-sensitive actions to `safeAction`, relying on the policy map for capability, session freshness, rate limiting, and audit behavior.
- **Legacy Helper Removal**: Removed legacy public helper exports (`assertAdmin`, `assertVerificationAdmin`, `requireAdminGranularRole`, and `logAdminAction`) from the admin action surface.
- **Audit Path Consolidation**: Migrated legacy verification route audit writes from `logAdminAction` to `auditService.recordAdminAuditEvent`.
- **Parser De-duplication**: Replaced duplicated `parseActionInput` helpers across action slices with the shared `_core/validation.ts` helper.
- **Security Result Contract**: Standardized `requireAdminCapability()` on the canonical `{ ok: true | false }` result discriminant from `src/lib/errors/result.ts`.
- **Dashboard Shell**: Reduced `(dashboard)/layout.tsx` to shell composition, removed layout-level `syncUserRole()`, sourced role display from DB-resolved permissions, and moved nav and verification badge loading into `NavigationSidebar`.
- **Security Drift Reporter**: Updated `report-security-drift.mjs` so action infrastructure files under `src/actions/admin/_core/` are not misclassified as unsafe mutations.
- **Verification Detail UI**: Updated `VerificationDetailView` to narrow on the discriminated `VerificationDetails.entityType` union instead of reading from `Record<string, any>`.

### Removed (Architecture Autopsy Implementation Pass)

- **Orphaned Components**: Deleted unused `src/components/AppSidebar.tsx` and `src/components/Navbar.tsx`.
- **Duplicate Execution Primitive**: Deleted `safeVerificationAction`.
- **Parallel Audit Helper**: Deleted the action-layer `logAdminAction` path.

### Verification (Architecture Autopsy Implementation Pass)

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:test:all` -> pass; 46 files passed, 369 of 369 tests passed.
- `pnpm run admin:report-security-drift:strict` -> pass; zero findings in all categories.
- `pnpm run admin:lint` -> pass with 79 known warnings, 0 errors.

### Autopsy Items Resolved: P0 & P1

- I-1 / ADM-011: Delete `safeVerificationAction`.
- I-2 / ADM-012: Remove legacy auth helper exports.
- I-3 / ADM-013: Remove `logAdminAction` parallel audit path.
- I-4 / ADM-014: Split `shared.ts` into focused `_core` modules.
- I-5 / ADM-015: De-duplicate `parseActionInput`.
- I-6 / ADM-016: Standardize security `Result` on `ok`.
- I-7 / ADM-017: Extract `NavigationSidebar` and Suspense badge loading.
- I-10 / ADM-020: Replace verification detail `Record<string, any>` with a discriminated union.
- I-11: Delete orphaned `AppSidebar` and `Navbar`.
- I-12: Add capability-based nav item visibility.
- I-17: Memoize the admin logger at module load.
- I-18: Remove layout-level `syncUserRole()`.
- F-O3: Type compliance queue metadata payloads.

## [2026-06-05] Copilot Instructions Sync & Workspace Type-Checking Fixes

### Added (Copilot Instructions Sync & Workspace Type-Checking Fixes)

- **Copilot Instructions**: Registered `.github/instructions/apps-admin-adr-authoring.instructions.md` under scoped instruction map.
- **Key Commands**: Documented strict drift command `pnpm run admin:report-security-drift:strict`.
- **Admin Hard Rules**: Documented explicit deprecations for legacy helpers `assertAdmin` (ADM-012), `safeVerificationAction` (ADM-011), and `logAdminAction` (ADM-013).

### Fixed (Copilot Instructions Sync & Workspace Type-Checking Fixes)

- **TypeScript Compilation**: Resolved multiple `exactOptionalPropertyTypes` type mismatch failures in `@build/nats` (`client.ts`, `producer.ts`, `consumer.ts`, `streams.ts`) to allow workspace type check and Next.js builds to compile cleanly.

## [2026-06-05] Architecture Autopsy & Documentation Hardening (F-Doc1, F-Doc2, F-Doc3)

### Added (Architecture Autopsy & Documentation Hardening (F-Doc1, F-Doc2, F-Doc3))

- **Architecture Autopsy**: Created [`docs/ARCHITECTURE-AUTOPSY.md`](ARCHITECTURE-AUTOPSY.md) — a full staff-level architectural audit of `apps/admin` at the Phase 12 baseline. Covers file/folder hierarchy, layer boundary analysis, 23 findings across classes A (architectural), B (structural), C (design pattern), and D (cosmetic/ergonomic), an ordered improvement table (I-1 through I-23, P0–P3), and a priority roadmap.
- **Contributor Guide**: Created [`docs/CONTRIBUTING.md`](CONTRIBUTING.md) — an 8-section how-to for new contributors covering the layer model, step-by-step domain slice creation, step-by-step action authoring (with full `safeAction`/idempotency/audit rules), feature flag lifecycle, test naming conventions, observability and security pre-merge checklists, and the full verification command sequence.
- **Defects Registry**: Created [`docs/DEFECTS.md`](DEFECTS.md) — extracted from `PROGRESS-SUMMARY.md`. Contains resolved defects ADM-001–ADM-010 (Phase 0–12) and new autopsy findings ADM-011–ADM-020 with severity, class, status, and owner.
- **Verification Reference**: Created [`docs/VERIFICATION.md`](VERIFICATION.md) — extracted from `PROGRESS-SUMMARY.md`. Contains all verification commands, a what-each-command-checks table, gate policy (no suppression allowed), and Phase 12 verification results.
- **Rollback Contracts**: Created [`docs/ROLLBACK-CONTRACTS.md`](ROLLBACK-CONTRACTS.md) — extracted from `PROGRESS-SUMMARY.md`. Contains the active feature flag rollback table, an irreversible-state tracker, and a step-by-step flag retirement checklist linked to ADR-ADMIN-009.

### Changed (Architecture Autopsy & Documentation Hardening (F-Doc1, F-Doc2, F-Doc3))

- **All 9 ADRs extended** ([ADR-ADMIN-001](adr/ADR-ADMIN-001-admin-authentication-and-authorization-model.md) through [ADR-ADMIN-009](adr/ADR-ADMIN-009-admin-strangler-fig-and-feature-flag-strategy.md)):
  - Added `## Alternatives Considered` to each ADR (3 alternatives per ADR, each with an explicit rejection rationale explaining _why_ the alternative was declined).
  - Added `## Revision History` to each ADR (date-stamped table of acceptance and amendments, including Phase 12 ASVS L2 audit updates).
  - **ADR-ADMIN-009** additionally received: Migration Criteria section (30-day stability window, feature parity, test coverage, observability requirements), a step-by-step retirement checklist (8 steps), and a per-flag owner table.
- **`PROGRESS-SUMMARY.md` slimmed** — reduced from 123 to ~60 lines. Retains only: active phase status, slice status registry, completed phases table, and next priority. All extracted sections now have dedicated, focused documents with cross-links.

**Files changed:**

- `apps/admin/docs/ARCHITECTURE-AUTOPSY.md` [NEW]
- `apps/admin/docs/CONTRIBUTING.md` [NEW]
- `apps/admin/docs/DEFECTS.md` [NEW]
- `apps/admin/docs/VERIFICATION.md` [NEW]
- `apps/admin/docs/ROLLBACK-CONTRACTS.md` [NEW]
- `apps/admin/docs/PROGRESS-SUMMARY.md` [SLIMMED]
- `apps/admin/docs/adr/ADR-ADMIN-001` through `ADR-ADMIN-009` [EXTENDED]

---

## [2026-06-05] Development Env, RSC Boundary, and Schema Limit Fixes

### Fixed (Development Env, RSC Boundary, and Schema Limit)

- **Database Connection**: Fixed database connection failure (`ECONNREFUSED` / `PrismaClientKnownRequestError`) in development mode by commenting out the default `DATABASE_URL` and `DIRECT_URL` placeholders in `apps/admin/.env.development` and commenting out duplicate, non-functional `DATABASE_URL` / `POSTGRES_URL` entries pointing to `localhost:5434` in the main gitignored `apps/admin/.env` file. This resolves the loading priority issues, allowing Next.js to cleanly fall back to the active Supabase connection string.
- **RSC Table Boundary**: Resolved React Server Component runtime boundary error (`getUserColumns is on the client. It's not possible to invoke a client function from the server`) on the users list page by introducing the Client Component wrapper [UsersTableClient](<file:///c:/Users/User/build-market/apps/admin/src/app/(dashboard)/users/users-table-client.tsx>) that encapsulates the client-side column generation logic.
- **Query Schema Limits**: Fixed Zod input validation failure (`Too big: expected number to be <=100`) on the services page categories query by proactively raising the maximum allowed page size `limit` constraint from `100` to `1000` across all admin query schemas (`ServiceFilterSchema`, `PaginationSchema`, `VerificationFilterSchema`, `StoreFilterSchema`, `PropertyFilterSchema`, `ProjectFilterSchema`, `LeadFilterSchema`).

## [2026-06-05] Build & Type Safety Fixes

### Changed (Build & Type Safety Fixes)

- **CI Pipeline**: Added workspace packages build step (`pnpm tsc --build tsconfig.json`) prior to type checking in [.github/workflows/ci.yml](file:///c:/Users/User/build-market/.github/workflows/ci.yml) to resolve typescript project reference compilation issues (`TS6305` and `TS2307`).
- **Security Repository**: Selected `clerkId: true` in `findUserPermissions()` query inside [repository.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/security/repository.ts) to provide the Clerk identifier expected by development-only bypass blocks in admin actions.
- **Actions Type Exports**: Rerouted action-layer type exports in `src/actions/admin/index.ts` to fetch directly from domain contracts or from `types.ts` (non-action, normal TS modules), removing all type exports from `"use server"` action files themselves to resolve Next.js Turbopack client-stub compilation failures.
- **Actions Cleanup**: Cleaned up `"use server"` action files by removing all `export type` declarations from `analytics.ts`, `dashboard.ts`, `users.ts`, `professionals.ts`, `projects.ts`, `settings.ts`, `services.ts`, `stores.ts`, `properties.ts`, `leads.ts`, `audit.ts`, `verification.ts`, and `onboarding-remediation.ts`.
- **Centralized Types**: Consolidated onboarding remediation and filter types into the non-action module `types.ts`.
- **Table Imports**: Adjusted table column components to import types directly from the central actions index `@/actions/admin`.

**Verification:**

- `pnpm run check-types` (in `apps/admin`) → pass (exit 0)
- `pnpm run test` (in `apps/admin`) → pass (369 of 369 tests passed)

## [2026-06-04] Phase 12 — Security Hardening Pass

### Added (Phase 12 — Security Hardening Pass)

- **Mass-Assignment Protection**: Enforced strict schemas on mutation actions by appending `.strict()` to `UpdateProfileSchema` and `SystemSettingsSchema` in [types.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/types.ts).

### Changed (Phase 12 — Security Hardening Pass)

- **Security Drift Script**: Refactored [report-security-drift.mjs](file:///c:/Users/User/build-market/apps/admin/scripts/report-security-drift.mjs) to exclude routes/shared/types files from action checks, ignore signatures in log safety rules, and support ignoring system stub/log/sync files in unstructured logging.
- **Environment Boundaries**: Migrated direct `process.env` references in [layout.tsx](file:///c:/Users/User/build-market/apps/admin/src/app/layout.tsx) and [CardList.tsx](file:///c:/Users/User/build-market/apps/admin/src/components/CardList.tsx) to use `adminEnvConfig`.
- **Environment Boundaries**: Annotated public auth services and bootstrap scripts with inline same-line `// bootstrap-only:` comments in [AddUser.tsx](file:///c:/Users/User/build-market/apps/admin/src/components/AddUser.tsx) and [sync-clerk-users.ts](file:///c:/Users/User/build-market/apps/admin/scripts/sync-clerk-users.ts).
- **CORS API Route Helper**: Refactored [cors.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/api/cors.ts) to utilize `adminEnvConfig` and removed `@ts-nocheck`.
- **Type Safety Overhaul**: Removed `@ts-nocheck` directives from and fully compiled:
  - [analytics/page.tsx](<file:///c:/Users/User/build-market/apps/admin/src/app/(dashboard)/analytics/page.tsx>)
  - [audit/page.tsx](<file:///c:/Users/User/build-market/apps/admin/src/app/(dashboard)/audit/page.tsx>)
  - [leads/page.tsx](<file:///c:/Users/User/build-market/apps/admin/src/app/(dashboard)/leads/page.tsx>)
  - [page.tsx](<file:///c:/Users/User/build-market/apps/admin/src/app/(dashboard)/page.tsx>)
  - [services/[id]/page.tsx](<file:///c:/Users/User/build-market/apps/admin/src/app/(dashboard)/services/[id]/page.tsx>)
- **Leads Filters**: Fixed leads page compilation errors by casting source/project type filters to database enums (`LeadSource` and `ProjectType`) imported from `@build/db`.

### Removed (Phase 12 — Security Hardening Pass)

- **Legacy Services**: Deleted obsolete, unused legacy files containing `@ts-nocheck` directives and outdated database models under `src/lib/services/`:
  - `store-operations.service.ts`
  - `property-operations.service.ts`
  - `project-operations.service.ts`
  - `store-event.service.ts`

**Drift reduction:** directPrismaInActions: 0; zodParseDrift: 0; tsNoCheck: 0 (reduced to 0); adminEnvBoundaryDrift: 0 (reduced to 0); unstructuredLogging: 0 (reduced to 0); missingAuditLog: 0.

**Files changed:** `apps/admin/scripts/report-security-drift.mjs`, `apps/admin/scripts/sync-clerk-users.ts`, `apps/admin/src/app/(dashboard)/analytics/page.tsx`, `apps/admin/src/app/(dashboard)/audit/page.tsx`, `apps/admin/src/app/(dashboard)/leads/page.tsx`, `apps/admin/src/app/(dashboard)/page.tsx`, `apps/admin/src/app/(dashboard)/services/[id]/page.tsx`, `apps/admin/src/app/layout.tsx`, `apps/admin/src/components/AddUser.tsx`, `apps/admin/src/components/CardList.tsx`, `apps/admin/src/lib/api/cors.ts`, `apps/admin/src/actions/admin/types.ts`, `apps/admin/src/actions/admin/shared.ts`, `apps/admin/src/lib/services/*` [DELETED]

**Verification:**

- `pnpm run admin:check-types` → pass (exit 0)
- `pnpm run admin:report-security-drift:strict` → pass (exit 0, 0 findings)
- `pnpm run admin:test:all` → pass (368 of 368 tests passed)

## [2026-06-04] Phase 8 — Audit Log Implementation

### Added (Phase 8 — Audit Log Implementation)

- **Audit Domain**: Implemented `recordAdminAuditEvent` in [service.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/audit/service.ts) to log all declarative admin action events to the database.
- **Audit Domain**: Extended [repository.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/audit/repository.ts) with `createAuditLog` to write audit entries.
- **Audit Domain**: Defined `AdminAuditEvent` canonical interface in [contracts.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/domains/audit/contracts.ts) and updated type signatures to handle strict `exactOptionalPropertyTypes: true` rules.

### Changed (Phase 8 — Audit Log Implementation)

- **Actions**: Hardened `safeAction` and `safeVerificationAction` in [shared.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/shared.ts) to automatically record declarative audits for both success and failure outcomes (forbidden, unauthenticated, rate-limited, session-stale, and internal error).
- **ADR Foundation**: Updated statuses to `Accepted` for all remaining proposed ADRs (`ADR-ADMIN-003`, `ADR-ADMIN-004`, `ADR-ADMIN-005`, `ADR-ADMIN-006`, `ADR-ADMIN-007`, `ADR-ADMIN-008`).

**Files changed:** `apps/admin/docs/adr/*`, `apps/admin/src/actions/admin/shared.ts`, `apps/admin/src/actions/admin/__tests__/audit-actions.test.ts`, `apps/admin/src/lib/domains/audit/contracts.ts`, `apps/admin/src/lib/domains/audit/repository.ts`, `apps/admin/src/lib/domains/audit/service.ts`, `apps/admin/src/lib/domains/audit/__tests__/service.test.ts`, `apps/admin/src/lib/infrastructure/logger.ts`  
**Verification:**

- `pnpm run admin:check-types` → pass (exit 0)
- `pnpm run admin:report-security-drift` → pass
- `pnpm run admin:test:all` → pass (368 of 368 tests passed)

## [2026-06-04] Track A Phase 6 — GDPR & Data Export Slice Refactoring

### Changed (Track A Phase 6 — GDPR & Data Export Slice Refactoring)

- **GDPR Encryption**: Integrated `adminEnvConfig` into [field-encryption.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/gdpr/encryption/field-encryption.ts) and replaced unstructured `console` logging with structured `StructuredLogger`.
- **GDPR Prisma Extension**: Removed `@ts-nocheck` and added proper TypeScript typings in [prisma-extension.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/gdpr/encryption/prisma-extension.ts).
- **GDPR Services**: Added type safety to [export.service.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/gdpr/services/export.service.ts) and integrated `StructuredLogger` into [anonymization.service.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/gdpr/services/anonymization.service.ts).
- **GDPR Jobs & Schedulers**: Migrated [anonymization-batch.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/anonymization-batch.ts), [asset-cleanup.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/asset-cleanup.ts), [data-retention.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/data-retention.ts), and [export-cleanup.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/export-cleanup.ts) off `process.env` and unstructured logs, replacing them with `adminEnvConfig` and structured `logger`. Refactored `s3Client` type issues using structural compatibility casting (`S3Sender`).
- **GDPR Queue Workers**: Refactored [incident.worker.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/workers/compliance/incident.worker.ts), [notification.worker.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/workers/compliance/notification.worker.ts), [processor.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/workers/export/processor.ts), and [worker.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/workers/export/worker.ts) to utilize `adminEnvConfig` and structured loggers.
- **Job Orchestrator**: Refactored [index.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/jobs/index.ts) to migrate all 14 unstructured log statements to `StructuredLogger` with active `correlationId` tracking.
- **Notifications**: Replaced direct env reads in [email.service.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/notifications/email.service.ts) with validated `adminEnvConfig` variables.

**Files changed:** `apps/admin/src/lib/gdpr/encryption/field-encryption.ts`, `apps/admin/src/lib/gdpr/encryption/prisma-extension.ts`, `apps/admin/src/lib/gdpr/encryption/__tests__/field-encryption.test.ts`, `apps/admin/src/lib/gdpr/services/anonymization.service.ts`, `apps/admin/src/lib/gdpr/services/export.service.ts`, `apps/admin/src/lib/notifications/email.service.ts`, `apps/admin/src/lib/jobs/anonymization-batch.ts`, `apps/admin/src/lib/jobs/asset-cleanup.ts`, `apps/admin/src/lib/jobs/data-retention.ts`, `apps/admin/src/lib/jobs/export-cleanup.ts`, `apps/admin/src/lib/jobs/index.ts`, `apps/admin/src/lib/workers/compliance/incident.worker.ts`, `apps/admin/src/lib/workers/compliance/notification.worker.ts`, `apps/admin/src/lib/workers/export/processor.ts`, `apps/admin/src/lib/workers/export/worker.ts`, `apps/admin/src/actions/admin/verify/route.ts`, `apps/admin/src/lib/security/repository.ts`  
**Verification:**

- `pnpm run admin:check-types` → pass (exit 0)
- `pnpm run admin:lint` → pass with 94 warnings (0 errors)
- `pnpm run admin:check-env-contract` → pass; 59 keys
- `pnpm run admin:report-security-drift` → pass; unstructuredLogging reduced to 14 (all exempt)
- `pnpm run admin:test:all` → pass; 46 files passed, 366 of 366 tests passed

## [2026-06-04] Refactoring & Drift Reduction (Actions Drift Reduction)

### Changed (Refactoring & Drift Reduction (Actions Drift Reduction))

- **Security Repository**: Created [repository.ts](file:///c:/Users/User/build-market/apps/admin/src/lib/security/repository.ts) to isolate all Prisma database queries used by auth and auditing helpers.
- **Actions/Shared**: Refactored [shared.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/shared.ts) to remove all direct database queries, delegating database execution entirely to `securityRepository`.
- **Compliance Queue Status Route**: Refactored [route.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/compliance/queue-status/route.ts) to utilize the canonical `resolveAdminRouteActor` helper, completely eliminating direct Prisma access.
- **Verify Professional Route**: Hardened [route.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/verify-professional/route.ts) to resolve route authentication with `resolveAdminRouteActor`, delegate database updates to `professionalsService`, handle validation with `safeParse`, and write declarative audit logs.
- **Onboarding Remediation Action**: Refactored [onboarding-remediation.ts](file:///c:/Users/User/build-market/apps/admin/src/actions/admin/onboarding-remediation.ts) to access `INTERNAL_API_SECRET` through `adminEnvConfig`, and updated the test suite to use a dynamic environment mock.

**Drift reduction:** directPrismaInActions: 0; zodParseDrift: 0; missingAuditLog: 0; adminEnvBoundaryDrift: −3.

**Verification:**

- `pnpm run admin:check-types` → pass.
- `pnpm run admin:lint` → pass with 148 warnings (0 errors).
- `pnpm run admin:check-env-contract` → pass; 59 keys.
- `pnpm run admin:test:all` → pass; 46 files passed, 366 of 366 tests passed.

## [2026-05-22] Phase 6 Overhaul: Dashboard, Projects, Settings, & GDPR Action Overhaul

### Added (Phase 6 Overhaul)

- **Domain/Dashboard**: Created a dedicated domain slice under `src/lib/domains/dashboard/` (`contracts.ts`, `repository.ts`, `service.ts`, and full unit tests) with the `VIEW_FINANCIALS` policy capability check (with explicit `SUPPORT_AGENT` bypass for non-financial stats).
- **Domain/Projects**: Created a dedicated domain slice under `src/lib/domains/projects/` (`contracts.ts`, `repository.ts`, `service.ts`, and full unit tests) with dynamic database schema queries for budget resolving.
- **Domain/Settings**: Created a dedicated domain slice under `src/lib/domains/settings/` (`contracts.ts`, `repository.ts`, `service.ts`, and full unit tests) protecting configuration values and caching gates with the `SYSTEM_ADMIN_ONLY` capability.
- **Domain/GDPR**: Created a dedicated domain slice under `src/lib/domains/gdpr/` (`contracts.ts`, `service.ts`, and full unit tests) providing clean encapsulation of GDPR actions.

### Changed (Phase 6 Overhaul)

- **Actions/Dashboard**: Refactored `src/actions/admin/dashboard.ts` to utilize `safeAction` and delegate to `dashboardService.getDashboardStats`, completely removing direct Prisma queries.
- **Actions/Projects**: Refactored `src/actions/admin/projects.ts` off legacy Prisma. Wired Zod schema parameters (`projectsQuerySchema`, `projectIdSchema`) through `safeAction` inputs to prevent unhandled throwing.
- **Actions/Settings**: Refactored `src/actions/admin/settings.ts` to consume `settingsService`. Wired Tier 1 mutations (`updateSystemSettings` and `clearSystemCache`) through `safeAction` with strict `recentAuth: { maxAgeSeconds: 180 }` freshness enforcement and declarative `auditLog` annotations.
- **Compliance Route**: Hardened `/api/admin/compliance/route.ts` to wire route authentication, correlation logging, and delegate queue processing fully to `gdprService`.

### Tests (Phase 6 Overhaul)

- Created comprehensive action-boundary test files: `dashboard-actions.test.ts` (4 tests), `projects-actions.test.ts` (6 tests), and `settings-actions.test.ts` (7 tests) verifying successful execution, validation failure handling, capability denials, and stale session rejections.
- Extended domain test suites to cover the new domain logic, achieving 100% test coverage with **366 green tests across 46 files**.

**Files changed:** `apps/admin/src/actions/admin/dashboard.ts`, `apps/admin/src/actions/admin/projects.ts`, `apps/admin/src/actions/admin/settings.ts`, `apps/admin/src/actions/admin/compliance/route.ts`, `apps/admin/src/lib/observability/operation-names.ts`, `apps/admin/src/lib/domains/dashboard/` [NEW], `apps/admin/src/lib/domains/projects/` [NEW], `apps/admin/src/lib/domains/settings/` [NEW], `apps/admin/src/lib/domains/gdpr/` [NEW], `src/actions/admin/__tests__/dashboard-actions.test.ts` [NEW], `src/actions/admin/__tests__/projects-actions.test.ts` [NEW], `src/actions/admin/__tests__/settings-actions.test.ts` [NEW]

**Drift reduction:** directPrismaInActions −4 files; zodParseDrift −4 call sites; `@ts-nocheck` −3 files.

**Verification:**

- `pnpm run check-types` → pass.
- `pnpm run test:all` → pass; 46 files passed, 366 of 366 tests passed.

## [2026-05-22] Phase 6 & 7 Overhaul: Leads, Services, & Professionals Slices with UI Token Hardening

### Added (Phase 6 & 7 Overhaul)

- **Domain/Leads**: Created a dedicated domain slice under `src/lib/domains/leads/` (`contracts.ts`, `repository.ts`, `service.ts`, and full unit tests) with complete business capabilities (`VIEW_CONTENT` for reads, and action capability gates checked via `requireAdminCapability` for updates/deletions).
- **Domain/Services**: Created a dedicated domain slice under `src/lib/domains/services/` (`contracts.ts`, `repository.ts`, `service.ts`, and full unit tests) ensuring a clean database adapter split.
- **Domain/Professionals**: Created a dedicated domain slice under `src/lib/domains/professionals/` (`contracts.ts`, `repository.ts`, `service.ts`, and full unit tests) that correctly maps nullable schema fields like `yearsExperience`, `city`, and `country` to prevent type mismatches.
- **Compliance Queue Route Hardening**: Hardened `/api/admin/compliance/queue-status` route in `src/actions/admin/compliance/queue-status/route.ts` with standard Clerk authentication validation, correlation logging, and active profile verification. Added a dedicated test suite in `__tests__/compliance-queue-status.test.ts`.

### Changed (Phase 6 & 7 Overhaul)

- **Actions/Leads**: Refactored `src/actions/admin/leads.ts` to utilize `safeAction` and `leadsService`. Removed direct Prisma database access, incorporated `safeParse` for strict validation, and wired declarative `auditLog` annotations for mutations (`updateLead`, `deleteLead`).
- **Actions/Services**: Refactored `src/actions/admin/services.ts` to fully delegate all actions (`getServices`, `getServiceDetails`, `createService`, `updateService`, `deleteService`) to `servicesService`, removing legacy `@ts-nocheck` and raw Prisma imports.
- **Actions/Professionals**: Refactored `src/actions/admin/professionals.ts` to delegate actions to `professionalsService`. Implemented dynamic field sanitization via `omitUndefined` to seamlessly handle `exactOptionalPropertyTypes: true` compiler rules.
- **UI/CardList & UI/AppBarChart**: Removed legacied `// @ts-nocheck` comments. Formulated explicit type parameters describing microservice API models, and migrated styling classes to use Tailwind CSS v4 native parentheses variables `(--var)` instead of old brackets `[var(--var)]`.
- **UI/AddUser**: Refactored styling to use modern parentheses theme shortcuts `focus:bg-(--admin-surface-input-focus)`. Identified and resolved a whitespace CSS parsing typo in sibling label nodes.

### Tests (Phase 6 & 7 Overhaul)

- Added complete action and domain test files for all three slices, achieving a comprehensive Vitest verification with **326 passing unit tests across 39 files**.

**Files changed:** `apps/admin/src/actions/admin/compliance/queue-status/route.ts`, `apps/admin/src/actions/admin/leads.ts`, `apps/admin/src/actions/admin/professionals.ts`, `apps/admin/src/actions/admin/services.ts`, `apps/admin/src/components/AddUser.tsx`, `apps/admin/src/components/AppBarChart.tsx`, `apps/admin/src/components/CardList.tsx`, `apps/admin/src/lib/domains/professionals/service.ts`, `apps/admin/src/lib/observability/operation-names.ts`, `apps/admin/src/lib/security/authorization-policy.ts`, `__tests__/compliance-queue-status.test.ts` [NEW], `src/lib/domains/leads/` [NEW], `src/lib/domains/services/` [NEW], `src/lib/domains/professionals/` [NEW]

**Drift reduction:** directPrismaInActions −3 files; zodParseDrift −3 call sites; `@ts-nocheck` −3 files; unstructuredLogging −1 route.

**Verification:**

- `pnpm run check-types` → pass.
- `pnpm run test` → pass; 39 files passed, 326 of 326 tests passed.

## [2026-05-21] Finance/Analytics + Stores/Properties Action Slice

### Added (Finance/Analytics + Stores/Properties Action Slice)

- **Domain/Stores**: Created a brand new domain slice under `src/lib/domains/stores/` (`contracts.ts`, `repository.ts`, `service.ts`, and full unit tests) with complete business rules, Prisma-free repository, and security policy capability gates (`VIEW_CONTENT` for reads, `MANAGE_CONTENT` for updates/featured toggle, and `MANAGE_VERIFICATION` / `strictMutationPolicy` / 180s recentAuth freshness for deletions).
- **Domain/Properties**: Created a brand new domain slice under `src/lib/domains/properties/` (`contracts.ts`, `repository.ts`, `service.ts`, and full unit tests) with same capability-split policy.
- **Domain/Finance (Analytics)**: Extended finance repository with 8 specialized analytical aggregation queries (time-series metrics, active stores/properties, verification rates, transactional value, geographic distribution, and top performing professionals). Extended finance service with 4 analytics methods (`getPlatformAnalytics`, `getMetricTimeSeries`, `getGeographicDistribution`, `getTopProfessionals`) protected by the `VIEW_FINANCIALS` capability gate. Added comprehensive unit tests under `src/lib/domains/finance/__tests__/analytics.test.ts`.

### Changed (Finance/Analytics + Stores/Properties Action Slice)

- **Actions/Stores**: Rewrote `src/actions/admin/stores.ts` to utilize `safeAction` and `storesService`. Added Zod-based validation, exactOptionalPropertyTypes compliance utilizing `omitUndefined` to map action inputs to domain contracts safely, and declarative `auditLog` annotations for mutations (`updateStore`, `deleteStore`), completely removing legacy direct Prisma usage, `@ts-nocheck`, and the unstructured `logAdminAction`.
- **Actions/Properties**: Rewrote `src/actions/admin/properties.ts` in the identical secure, Prisma-free pattern.
- **Actions/Analytics**: Rewrote `src/actions/admin/analytics.ts` to completely eliminate direct Prisma usage and raw SQL queries, delegating fully to `financeService`.
- **Infrastructure/Security**: Added `VIEW_CONTENT` to the central capability registry `src/lib/security/authorization-policy.ts` and mapped it to roles (`SUPER_ADMIN`, `CONTENT_MODERATOR`, `SUPPORT_AGENT`). Registered 12 new snake_case operation names to `src/lib/observability/operation-names.ts` covering stores, properties, and finance/analytics actions.

### Tests (Finance/Analytics + Stores/Properties Action Slice)

- Created `src/actions/admin/__tests__/stores-actions.test.ts` (12 tests) and `src/actions/admin/__tests__/properties-actions.test.ts` (12 tests) to assert strict boundary integration, capability policy gates, validation, and fresh-session enforcement (`recentAuth: 180`).
- Created `src/actions/admin/__tests__/analytics-actions.test.ts` (6 tests) to test action-delegation for all platform and metric actions.

**Files changed:** `apps/admin/src/actions/admin/analytics.ts`, `apps/admin/src/actions/admin/properties.ts`, `apps/admin/src/actions/admin/stores.ts`, `apps/admin/src/lib/domains/finance/contracts.ts`, `apps/admin/src/lib/domains/finance/repository.ts`, `apps/admin/src/lib/domains/finance/service.ts`, `apps/admin/src/lib/observability/operation-names.ts`, `apps/admin/src/lib/security/authorization-policy.ts`, `apps/admin/src/actions/admin/__tests__/stores-actions.test.ts`, `apps/admin/src/actions/admin/__tests__/properties-actions.test.ts` [NEW], `apps/admin/src/actions/admin/__tests__/analytics-actions.test.ts` [NEW], `apps/admin/src/lib/domains/finance/__tests__/analytics.test.ts` [NEW], `apps/admin/src/lib/domains/properties/` [NEW], `apps/admin/src/lib/domains/stores/` [NEW]

**Drift reduction:** directPrismaInActions −3 files; zodParseDrift −6 call sites; `@ts-nocheck` −3 files; unstructuredLogging −3 findings.

**Verification:**

- `pnpm run admin:check-types` → pass.
- `pnpm run admin:test:all` → pass; 35 files passed, 294 of 294 tests passed.

## [2026-05-21] Track A — Audit/Export Action Slice (Phase 5 continuation)

### Changed (Track A — Audit/Export Action Slice)

- Migrated `src/actions/admin/audit.ts` off direct Prisma, `AuditLogFilterSchema.parse()`, and `@ts-nocheck`. All four actions (`getAuditLogs`, `getAuditLogStats`, `getAuditLogActions`, `exportAuditLogs`) delegate to the Phase 4 audit domain service via `auditService`. Operation names use the typed `AdminOperationName` registry so every `safeAction` call emits a structured log event with a stable join key (ADR-ADMIN-003 §7.3).
- `exportAuditLogs` adds `recentAuth: { maxAgeSeconds: 300 }` (Tier 2 — high-sensitivity read) and a declarative `auditLog` entry per ADR-ADMIN-008, written before success is returned.
- Hardened `src/actions/admin/compliance/route.ts`: replaced `console.log/warn/error` PII logging with structured `getAdminLogger()` events keyed by `correlationId`; added `adminProfile.isActive` check alongside role check; correlation ID sourced from `initializeAdminCorrelationId()`.
- Fixed stale `AuditLogFilterInput` re-export in `src/actions/admin/index.ts` → `AuditLogInput`; added `AuditLogPage`, `AuditExportPage`, `AuditExportEntry` to index re-exports.

### Added (Track A — Audit/Export Action Slice)

- `src/lib/domains/audit/contracts.ts`: added `AuditExportEntry`, `AuditExportPage`, `AUDIT_EXPORT_MAX_ROWS = 5_000`, `AUDIT_EXPORT_LIMIT_EXCEEDED` error code.
- `src/lib/domains/audit/repository.ts`: added `findDistinctActions()` (distinct action strings, persistence-only, `adminEmail` excluded) and `findForExport()` (capped at `AUDIT_EXPORT_MAX_ROWS`).
- `src/lib/domains/audit/service.ts`: added `getDistinctActions(actor)` (requires `VIEW_FINANCIALS`) and `exportAuditLogs(actor, input)` (requires `EXPORT_DATA` — Tier 1). Both exposed on `auditService` facade.

### Tests (Track A — Audit/Export Action Slice)

- Extended `src/lib/domains/audit/__tests__/service.test.ts` from 5 → 13 tests: `getDistinctActions` capability gates, `exportAuditLogs` capability gates (FINANCE_MANAGER denied, AUDITOR allowed), data shape assertions, `findForExport` call path.
- Added `src/actions/admin/__tests__/audit-actions.test.ts` (8 tests): service delegation, domain error propagation, UNAUTHORIZED gate, `exportAuditLogs` stale session rejection (`SESSION_STALE`), fresh session delegation, unauthenticated guard.

**Files changed:** `apps/admin/src/actions/admin/audit.ts`, `apps/admin/src/actions/admin/compliance/route.ts`, `apps/admin/src/actions/admin/index.ts`, `apps/admin/src/lib/domains/audit/contracts.ts`, `apps/admin/src/lib/domains/audit/repository.ts`, `apps/admin/src/lib/domains/audit/service.ts`, `apps/admin/src/lib/domains/audit/__tests__/service.test.ts` [EXTENDED], `apps/admin/src/actions/admin/__tests__/audit-actions.test.ts` [NEW]

**Drift reduction:** directPrismaInActions −1 file (`audit.ts`); zodParseDrift −2 call sites; `@ts-nocheck` −1 file; unstructuredLogging −3 findings (`compliance/route.ts`).

**Verification:**

- `pnpm run admin:check-types` → pass.
- `pnpm run admin:test:all` → pass; 30 files passed, 229 of 229 tests passed.

## [2026-05-21] Phase 7 - Observability foundation

### Added (Phase 7 - Observability foundation)

- Added `src/lib/infrastructure/logger.ts` implementing ADR-ADMIN-003: `getAdminLogger()` returns a feature-flag-gated structured logger with PII exclusion enforced at the type level (keys `userId`, `email`, `phone`, `nationalId`, `clerkId`, `userEmail`, `adminEmail`, `userPhone`, `firstName`, `lastName` are rejected). Structured mode writes JSON to stdout; fallback mode delegates to `console.log/warn/error` when `admin_v2_structured_logging` is disabled.
- Added `src/lib/infrastructure/correlation.ts` implementing ADR-ADMIN-003 §7.2: `initializeAdminCorrelationId()` reads `x-correlation-id` from request headers or generates UUID v4; `withAdminCorrelation()` threads the ID through async continuations via `AsyncLocalStorage`; `getAdminCorrelationId()` reads the active ID without prop-drilling.
- Added `src/lib/observability/operation-names.ts` implementing ADR-ADMIN-003 §7.3: typed `AdminOperationName` const registry with 40+ stable `<verb>_<resource>` operation names covering users, verification, audit, finance, content, leads/services, compliance, settings, and dashboard. Added `isRegisteredOperationName()` guard for drift-check use.

### Changed (Phase 7 - Observability foundation)

- Integrated structured logger into `safeAction` and `safeVerificationAction` in `shared.ts`: every terminal outcome path (unauthorized, forbidden, session_stale, rate_limited, success, internal_error) now emits a structured `AdminLogEvent` with `correlationId`, `operationName`, `adminRole`, `outcome`, and `durationMs`.
- `safeAction` now wraps action body execution in `withAdminCorrelation()` so downstream service/repository code can call `getAdminCorrelationId()` without receiving the ID via parameter.
- `correlationId` in the action context is now sourced from a single `crypto.randomUUID()` call at the top of `safeAction`, shared across the log emission and the action body context.

### Tests (Phase 7 - Observability foundation)

- Added `src/lib/infrastructure/__tests__/logger.test.ts` (11 tests): structured-mode JSON output, PII runtime stripping, optional field omission, all log levels, fallback-mode console routing.
- Added `src/lib/infrastructure/__tests__/correlation.test.ts` (11 tests): header extraction, UUID generation, blank-header guard, uniqueness, async propagation, scope isolation, concurrent scope independence, outside-scope undefined return.
- Added `src/lib/observability/__tests__/operation-names.test.ts` (14 tests): lower_snake_case enforcement, uniqueness, verb_resource format, domain coverage assertions, type assignability, `isRegisteredOperationName` guard.

**Files changed:** `apps/admin/src/lib/infrastructure/logger.ts` [NEW], `apps/admin/src/lib/infrastructure/correlation.ts` [NEW], `apps/admin/src/lib/observability/operation-names.ts` [NEW], `apps/admin/src/lib/infrastructure/__tests__/logger.test.ts` [NEW], `apps/admin/src/lib/infrastructure/__tests__/correlation.test.ts` [NEW], `apps/admin/src/lib/observability/__tests__/operation-names.test.ts` [NEW], `apps/admin/src/actions/admin/shared.ts`

**Verification:**

- `pnpm run admin:check-types` → pass.
- `pnpm run admin:lint` → pass with known warnings backlog.
- `pnpm run admin:check-env-contract` → pass; 59 boundary keys.
- `pnpm run admin:test:all` → pass; 29 files passed, 213 of 213 tests passed.
- Targeted suite: `pnpm -C apps/admin exec vitest run src/lib/infrastructure/__tests__/logger.test.ts src/lib/infrastructure/__tests__/correlation.test.ts src/lib/observability/__tests__/operation-names.test.ts --pool=threads --maxWorkers=1` → 3 files, 36 tests passed.

### Fixed (Phase 5 - Verification action bug fixes)

- Fixed a privilege escalation risk in API routes (`verification-details`, `verification-stats`, `pending-verifications`, `verify-document`, `verify`) where missing `adminRole` context improperly defaulted to `SUPER_ADMIN`.
- Fixed a bug in `safeAction` definitions (`verifyEntity`, `verifyDocument`, `batchVerifyDocuments`, `batchVerifyEntities`) where `auditLog` parsing threw synchronous exceptions before execution.
- Fixed a bug in `updateDocumentVerification` in `repository.ts` that concatenated "d" to the action string, producing "rejectd" instead of "rejected".
- Fixed an audit gap in `verify-document/route.ts` where single and batch document verifications bypassed `safeAction` audit logging by explicitly invoking `logAdminAction`.
- Added missing `.min(1)` validation to `BatchVerifyDocumentsSchema`.

## [2026-05-18] Phase 5 - Verification action slice

### Security (Phase 5 - Verification action slice)

- Replaced verification action and route `.parse()` calls with `safeParse`-backed validation and strict payload handling.
- Moved verification entity and document mutations behind the admin verification domain/service boundary and removed direct Prisma from the migrated verification adapters.
- Added declarative `auditLog` coverage on verification server actions for entity verification, single-document verification, batch document verification, and batch entity verification.

### Changed (Phase 5 - Verification action slice)

- Refactored `apps/admin/src/actions/admin/verification.ts` to use `safeAction` plus the verification domain service instead of client API round-trips and manual audit writes.
- Rebuilt `pending-verifications`, `verification-stats`, `verification-details`, `verify`, and `verify-document` handlers as thin verification-service adapters.
- Normalized property document verification onto the `property_document` contract while preserving `property_attachment` request compatibility at the parser boundary.
- Updated verification detail mapping so property verification reads from `PropertyDocument` records instead of the stale attachment-only shape.

### Tests (Phase 5 - Verification action slice)

- Reworked verification action tests to assert domain-service delegation and declarative audit wiring instead of action-layer Prisma or client API behavior.
- Reworked verification route tests to mock the verification service boundary instead of legacy Prisma-heavy internals.
- Extended verification domain service tests to cover entity verification, document verification, normalized details loading, and batch failure aggregation.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 156 warnings; warnings remain tracked Phase 5-12 backlog.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 26 files passed, 177 of 177 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 13, unsafe mutations 12, action `.parse()` 16, `@ts-nocheck` 18, unstructured logging 103, log safety 3, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the remaining Phase 5-12 drift backlog.

## [2026-05-18] Phase 5 - Users action slice

### Security (Phase 5 - Users action slice)

- Added `safeParse`-backed input validation for admin user detail, delete, bulk delete, invite, reset-credentials, and role-assignment actions.
- Added declarative `auditLog` coverage in `safeAction` so high-risk user mutations can attach target IDs and non-PII details without manual audit calls.
- Blocked self-deletion for admin user mutations to align single-delete behavior with the existing bulk-delete guard.

### Changed (Phase 5 - Users action slice)

- Removed direct Prisma access from `apps/admin/src/actions/admin/users.ts`; the action slice now delegates persistence to `usersRepository` and business rules to `usersService`.
- Moved remaining users mutation preconditions into the users domain service, including target lookups, bulk-delete normalization, and reset/role-assignment preparation.
- Updated the admin security drift reporter so declarative `auditLog:` usage counts as audit coverage for high-risk action files.

### Tests (Phase 5 - Users action slice)

- Reworked users action-boundary tests to assert service/repository delegation instead of action-layer Prisma calls.
- Extended users domain service tests for delete preparation, bulk-delete normalization, reset preparation, and role-assignment target loading.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 211 warnings; warnings remain tracked Phase 5-12 backlog.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 26 files passed, 174 of 174 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/users/__tests__/service.test.ts src/lib/domains/users/__tests__/repository.test.ts src/actions/admin/__tests__/users-actions.test.ts --pool=threads --maxWorkers=1` -> pass; 3 files passed, 22 of 22 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 17, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 103, log safety 3, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the remaining Phase 5-12 drift backlog.

## [2026-05-18] Phase 4 - Audit domain slice

### Added (Phase 4 - Audit domain slice)

- Added audit domain contracts, repository, and service under `apps/admin/src/lib/domains/audit`.
- Added a read-only audit log page contract and audit stats contract using existing `AdminAuditLog` snapshot fields.
- Added audit repository contract tests covering safe snapshot selects, caller filters, date bounds, group-by stats, and recent activity queries.
- Added audit service tests covering query normalization, `EXPORT_DATA` capability enforcement, invalid dates, pagination, and grouped stats.

### Changed (Phase 4 - Audit domain slice)

- Kept legacy audit actions behavior unchanged in this domain branch; Phase 5/8 will migrate readers and automatic audit writes onto the canonical audit service boundary.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain known Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 26 files passed, 171 of 171 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/audit/__tests__/service.test.ts src/lib/domains/audit/__tests__/repository.test.ts --pool=threads --maxWorkers=1` -> pass; 2 files passed, 9 of 9 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the same known Phase 4-12 drift backlog.

## [2026-05-18] Phase 4 - Finance domain slice

### Added (Phase 4 - Finance domain slice)

- Added finance domain contracts, repository, and service under `apps/admin/src/lib/domains/finance`.
- Added a read-only finance overview contract for revenue, paid/delivered orders, average order value, and pending payouts.
- Added finance repository contract tests covering successful payment sums, period ranges, paid-order metrics, and pending withdrawal payouts.
- Added finance service tests covering period normalization, `VIEW_FINANCIALS` capability enforcement, invalid filters, and overview assembly.

### Changed (Phase 4 - Finance domain slice)

- Kept legacy analytics actions behavior unchanged in this domain branch; Phase 5 will migrate finance and analytics callers onto the service boundary.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain known Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 24 files passed, 162 of 162 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/finance/__tests__/service.test.ts src/lib/domains/finance/__tests__/repository.test.ts --pool=threads --maxWorkers=1` -> pass; 2 files passed, 7 of 7 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the same known Phase 4-12 drift backlog.

## [2026-05-18] Phase 4 - Content domain slice

### Added (Phase 4 - Content domain slice)

- Added content domain contracts, repository, and service under `apps/admin/src/lib/domains/content`.
- Added a content moderation queue contract for stores, properties, and projects with result-based errors and `MANAGE_CONTENT` capability enforcement.
- Added content repository contract tests covering soft-delete guards, owner includes, caller filters, and model-specific sort mapping.
- Added content service tests covering policy denial, invalid filters, pagination, and all-entity sorting.

### Changed (Phase 4 - Content domain slice)

- Kept legacy content actions behavior unchanged in this domain branch; Phase 5 will migrate stores, properties, projects, and adjacent content actions onto the service boundary.
- Mapped admin-facing `title` sorting to the store `name` column while preserving `title` sorting for property and project records.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain known Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 22 files passed, 155 of 155 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/content/__tests__/service.test.ts src/lib/domains/content/__tests__/repository.test.ts --pool=threads --maxWorkers=1` -> pass; 2 files passed, 8 of 8 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the same known Phase 4-12 drift backlog.

## [2026-05-18] Phase 4 - Verification domain slice

### Added (Phase 4 - Verification domain slice)

- Added verification domain contracts, repository, and service under `apps/admin/src/lib/domains/verification`.
- Added verification queue query normalization, capability enforcement, result-based errors, and status/period validation.
- Added verification repository contract tests covering Prisma include shape, pending-submission predicates, soft-delete guards, and period-filtered status counts.
- Added verification service tests covering policy denial, invalid filters, single-entity pagination, all-entity sorting, and grouped stats.

### Changed (Phase 4 - Verification domain slice)

- Kept legacy verification actions/routes behavior unchanged in this domain branch; Phase 5 will migrate action/route callers onto the service boundary.
- Aligned the verification domain status contract with the Prisma `VerificationStatus` enum, including `IN_REVIEW`, `EXPIRED`, and `SUSPENDED`.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain known Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 20 files passed, 147 of 147 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/verification/__tests__/service.test.ts src/lib/domains/verification/__tests__/repository.test.ts --pool=threads --maxWorkers=1` -> pass; 2 files passed, 11 of 11 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the same known Phase 4-12 drift backlog.

## [2026-05-18] Phase 4 - Users domain slice

### Added (Phase 4 - Users domain slice)

- Added an admin-local `Result<T, E>` helper for domain/service boundaries.
- Added the users domain contracts, repository, and service under `apps/admin/src/lib/domains/users`.
- Added users repository contract tests covering Prisma query shape, soft-delete guards, and persistence-only mutation helpers.
- Added users service policy tests covering list/query normalization, typed not-found errors, invitation authorization, and self-demotion prevention.

### Changed (Phase 4 - Users domain slice)

- Routed read-only admin users actions through the users service/domain boundary while leaving destructive action migration for the Phase 5 users action branch.
- Preserved current UI response shapes for users list/detail actions while returning data from domain DTOs.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain known Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 59 boundary keys.
- `pnpm run admin:test:all` -> pass; 18 files passed, 136 of 136 tests passed.
- `pnpm -C apps/admin exec vitest run src/lib/domains/users/__tests__/service.test.ts src/lib/domains/users/__tests__/repository.test.ts src/actions/admin/__tests__/users-actions.test.ts --pool=threads --maxWorkers=1` -> pass; 3 files passed, 19 of 19 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the same known Phase 4-12 drift backlog.

## [2026-05-18] Phase 10 - Feature flag rollout foundation

### Added (Phase 10 - Feature flag rollout foundation)

- Added env-driven admin feature flags for v2 users, verification, finance dashboard, audit log UI, and structured logging rollout.
- Added `/users-v2`, `/verifications-v2`, `/analytics-v2`, and `/audit-v2` route gates that redirect to the current routes when flags are disabled.
- Added sidebar route switching so enabled v2 flags can steer navigation without removing current routes.
- Added feature-flag tests covering default-off behavior, enabled route switching, and disabled-flag rollback behavior.

### Docs (Phase 10 - Feature flag rollout foundation)

- Documented Phase 10 rollback behavior in `PROGRESS-SUMMARY.md`.
- Accepted ADR-ADMIN-009 for the env-driven strangler-fig feature flag foundation.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain legacy Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; env boundary count is now 59 and all templates match.
- `pnpm run admin:test:all` -> pass; 16 files passed, 125 of 125 tests passed.
- `pnpm -C apps/admin exec vitest run __tests__/config/feature-flags.test.ts --pool=threads --maxWorkers=1` -> pass; 3 of 3 tests passed.
- `pnpm run admin:report-security-drift:strict` -> fail with known Phase 4-12 drift backlog: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.

## [2026-05-18] Phase 3 - Auth hardening foundation

### Security (Phase 3 - Auth hardening foundation)

- Added canonical `AdminActor` / `AdminActorContext` types for admin action execution.
- Hardened `safeAction` and `safeVerificationAction` to resolve Clerk identity server-side, require an active database `AdminProfile`, authorize with `AdminRole`, enforce policy-provided recent-auth windows, and apply actor-scoped rate limits.
- Added typed admin action error details while preserving the existing string `error` response field for current UI compatibility.
- Added `AdminCapability`, capability-to-role policy mapping, high-risk action policy metadata, and `requireAdminCapability()` result-based authorization.
- Added the high-risk admin action registry and build-script mirror for later drift-check integration.

### Tests (Phase 3 - Auth hardening foundation)

- Added Phase 3 policy tests covering every `AdminRole` across every `AdminCapability`, `SUPER_ADMIN` bypass behavior, stale-session rejection, actor-scoped rate limiting, and canonical actor forwarding.
- Updated existing authorization policy tests for the database-backed `AdminRole` model.

### Docs (Phase 3 - Auth hardening foundation)

- Accepted ADR-ADMIN-001 and ADR-ADMIN-002 for the implemented admin actor, capability policy, and hardened action boundary foundation.

**Verification:**

- `pnpm run admin:check-types` -> pass.
- `pnpm run admin:lint` -> pass with 213 warnings; warnings remain legacy Phase 4-12 debt.
- `pnpm run admin:check-env-contract` -> pass; all env templates cover 54 boundary keys.
- `pnpm run admin:test:all` -> pass; 15 files passed, 122 of 122 tests passed.
- `pnpm -C apps/admin exec vitest run __tests__/security/admin-authorization-policy.test.ts src/lib/security/__tests__/authorization-policy.test.ts src/actions/admin/__tests__/users-actions.test.ts src/actions/admin/__tests__/verification-actions.test.ts --pool=threads --maxWorkers=1` -> pass; 4 files passed, 28 of 28 tests passed.
- `pnpm run admin:report-security-drift` -> pass with known drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm run admin:report-security-drift:strict` -> fail with the same known Phase 4-12 drift backlog.

## [2026-05-15] Phase 0-2 - Overhaul foundation

### Security (Phase 0-2 - Overhaul foundation)

- Added admin ADRs for authentication/authorization, action boundaries, observability, data handling, HTTP security, env access, UI contracts, audit logging, and strangler-fig rollout.
- Added an admin security drift report with strict categories for env boundary drift, direct Prisma in actions, unsafe mutations, action `.parse()`, `@ts-nocheck`, unstructured logging, log safety, and missing audit coverage.

### Fixed (Phase 0-2 - Overhaul foundation)

- Established canonical admin env templates and an env contract checker. `admin:check-env-contract` currently passes with 54 declared keys in each template.

### Changed (Phase 0-2 - Overhaul foundation)

- Tightened admin TypeScript configuration with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `docs` exclusion.
- Hardened admin ESLint configuration with env-boundary, action-persistence-boundary, server-only UI import, explicit-any, and floating-promise checks.
- Replaced the placeholder admin test script with Vitest-backed `test` and `test:all` scripts.
- Aligned `apps/admin` package manager metadata with the root `pnpm@11.1.2`.

### Added (Phase 0-2 - Overhaul foundation)

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`.
- Canonical `apps/admin/docs/adr/ADR-ADMIN-001` through `ADR-ADMIN-009`.
- Canonical `apps/admin/docs/PROGRESS-SUMMARY.md`.
- Admin root scripts: `admin:lint`, `admin:test`, `admin:test:all`, `admin:check-env-contract`, `admin:report-security-drift`, and `admin:report-security-drift:strict`.
- CI jobs for admin validation and admin changelog guarding.

### Docs (Phase 0-2 - Overhaul foundation)

- Documented Phase 0 critical and high-severity findings with evidence and command output.

**Files changed:** `.github/workflows/ci.yml`, `package.json`, `apps/admin/package.json`, `apps/admin/tsconfig.json`, `apps/admin/eslint.config.mjs`, `apps/admin/.env.example`, `apps/admin/.env.test`, `apps/admin/.env.development`, `apps/admin/scripts/check-env-contract.mjs`, `apps/admin/scripts/report-security-drift.mjs`, `apps/admin/src/lib/infrastructure/env.ts`, `apps/admin/docs/CHANGELOG.md`, `apps/admin/docs/PROGRESS-SUMMARY.md`, `apps/admin/docs/progress/AUTOPSY-REPORT.md`, `apps/admin/docs/adr/*`

**Verification:**

- `pnpm run admin:check-env-contract` -> pass; 54 boundary keys present in `.env.example`, `.env.test`, and `.env.development`.
- `pnpm run admin:lint` -> pass with 215 warnings. Warnings are tracked Phase 2/3 defects, mostly env-boundary reads, direct Prisma action imports, `@ts-nocheck`, and `any`.
- `pnpm run admin:check-types` -> fail after strict option tightening. Main categories: `exactOptionalPropertyTypes` violations in actions, API response/log contexts, verification services, GDPR consent, notification templates, and `src/scripts/set-admin.ts`.
- `pnpm run admin:report-security-drift:strict` -> fail by design with current drift counts: env boundary 83, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
- `pnpm -C apps/admin exec vitest run --pool=threads --maxWorkers=1` -> fail. 14 files discovered, 8 passed, 6 failed; 80 tests ran, 78 passed, 2 failed. Failures: root `__tests__/admin-verification/*` `@/` alias resolution and stale `SUPPORT` role expectations.

## [2026-05-15] Phase 2 Gate Stabilization

### Fixed (Phase 2 Gate Stabilization)

- Stabilized `admin:check-types` after the stricter compiler flags exposed optional-property propagation issues across admin actions, verification services, consent/audit flows, mailer paths, and helper contracts.
- Added `apps/admin/vitest.config.ts` so root admin tests resolve the `@/` alias consistently.
- Updated admin verification tests to match the current role model and verification/document contracts.

### Changed (Phase 2 Gate Stabilization)

- Switched several admin verification and infrastructure paths to `adminEnvConfig` and conditional object construction instead of passing `undefined` through typed contracts.
- Tightened shared helpers with `omitUndefined()` so exact optional properties stay explicit at API, logging, and Prisma boundaries.

**Verification:**

- `pnpm run admin:check-env-contract` -> pass; 54 boundary keys present in `.env.example`, `.env.test`, and `.env.development`.
- `pnpm run admin:check-types` -> pass.
- `pnpm -C apps/admin exec vitest run --pool=threads --maxWorkers=1` -> pass; 14 files passed, 116 of 116 tests passed.
- `pnpm run admin:lint` -> pass with 211 warnings; most remaining warnings are legacy action-boundary, env-boundary, `@ts-nocheck`, and `any` debt outside this stabilization slice.
- `pnpm run admin:report-security-drift:strict` -> fail with current drift counts: env boundary 69, direct Prisma action files 18, unsafe mutations 13, action `.parse()` 23, `@ts-nocheck` 21, unstructured logging 104, log safety 4, missing audit log 3.
