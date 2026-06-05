# apps/admin Changelog

## [2026-06-05] Copilot Instructions Sync & Workspace Type-Checking Fixes

### Added

- **Copilot Instructions**: Registered `.github/instructions/apps-admin-adr-authoring.instructions.md` under scoped instruction map.
- **Key Commands**: Documented strict drift command `pnpm run admin:report-security-drift:strict`.
- **Admin Hard Rules**: Documented explicit deprecations for legacy helpers `assertAdmin` (ADM-012), `safeVerificationAction` (ADM-011), and `logAdminAction` (ADM-013).

### Fixed

- **TypeScript Compilation**: Resolved multiple `exactOptionalPropertyTypes` type mismatch failures in `@build/nats` (`client.ts`, `producer.ts`, `consumer.ts`, `streams.ts`) to allow workspace type check and Next.js builds to compile cleanly.

## [2026-06-05] Architecture Autopsy & Documentation Hardening (F-Doc1, F-Doc2, F-Doc3)

### Added (Architecture Autopsy & Documentation Hardening (F-Doc1, F-Doc2, F-Doc3))

- **Architecture Autopsy**: Created [`docs/ARCHITECTURE-AUTOPSY.md`](ARCHITECTURE-AUTOPSY.md) — a full staff-level architectural audit of `apps/admin` at the Phase 12 baseline. Covers file/folder hierarchy, layer boundary analysis, 23 findings across classes A (architectural), B (structural), C (design pattern), and D (cosmetic/ergonomic), an ordered improvement table (I-1 through I-23, P0–P3), and a priority roadmap.
- **Contributor Guide**: Created [`docs/CONTRIBUTING.md`](CONTRIBUTING.md) — an 8-section how-to for new contributors covering the layer model, step-by-step domain slice creation, step-by-step action authoring (with full `safeAction`/idempotency/audit rules), feature flag lifecycle, test naming conventions, observability and security pre-merge checklists, and the full verification command sequence.
- **Defects Registry**: Created [`docs/DEFECTS.md`](DEFECTS.md) — extracted from `PROGRESS-SUMMARY.md`. Contains resolved defects ADM-001–ADM-010 (Phase 0–12) and new autopsy findings ADM-011–ADM-020 with severity, class, status, and owner.
- **Verification Reference**: Created [`docs/VERIFICATION.md`](VERIFICATION.md) — extracted from `PROGRESS-SUMMARY.md`. Contains all verification commands, a what-each-command-checks table, gate policy (no suppression allowed), and Phase 12 verification results.
- **Rollback Contracts**: Created [`docs/ROLLBACK-CONTRACTS.md`](ROLLBACK-CONTRACTS.md) — extracted from `PROGRESS-SUMMARY.md`. Contains the active feature flag rollback table, an irreversible-state tracker, and a step-by-step flag retirement checklist linked to ADR-ADMIN-009.

### Changed

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

### Removed

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
