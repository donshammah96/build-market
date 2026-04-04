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

## Latest

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

- **Onboarding identity and log-safety hardening (2026-04-04):** removed client-supplied `clerkId` from onboarding browser submit payloads so identity remains session-derived in adapters, and constrained onboarding validation logs to field-path arrays instead of raw validation payloads.
- **Environment and auth-bypass hardening (Phase 2/3):** tightened `BYPASS_AUTH` handling in `app/lib/api/api-middleware.ts` so bypass is constrained to safe local-development conditions and blocked in CI and non-local contexts; added focused middleware regression coverage in `__tests__/lib/api-middleware.test.ts` for both allowed and blocked bypass flows.
- **Env contract checker hardening:** tightened `apps/client/scripts/check-env-contract.mjs` to fail on high-risk unused template keys (not only missing keys), added env-definition key detection (`name: "KEY"`) to avoid false positives for centralized env schemas, and narrowed high-risk NATS matching to credential-like keys.

### Fixed

- **Onboarding compliance and completion semantics (2026-04-04):** aligned user-profile consent and completion flows to transaction-safe and explicit `Result<T, DomainError>` semantics so onboarding/profile-complete callers no longer depend on partial-success branching or implicit completion fallback behavior.
- **Canonical env-boundary test alignment:** updated middleware resolver regression coverage to override `env.services.internalApiSecret` directly instead of mutating `process.env.INTERNAL_API_SECRET` at runtime, matching the canonical env singleton behavior in resolver modules.

- **Staff-level onboarding and user-profile fixes:** GDPR consent records now create one `ConsentRecord` per changed type (MARKETING_EMAIL, MARKETING_SMS, ANALYTICS_COOKIES) in `service.ts`, `profile-complete.ts`, and `onboarding.ts` — previously a ternary picked a single type and dropped the others. Clerk metadata update now runs before `IdempotencyService.complete()` in all onboarding routes so retries re-attempt the Clerk update. Replaced duplicated `ClerkMetadataClient` type cast in `actions/onboarding.ts` with shared `updateClerkOnboardingMetadata` from `clerk-metadata.ts`. `skipClientOnboarding` no longer hardcodes county (uses null). `skipProfessionalOnboarding` uses `companyName: ""` instead of fabricated strings. Document materialization runs before `prisma.$transaction` in `completeOnboarding` and `completeProfessionalOnboarding`. `completeOnboarding` now guards against already-onboarded users (returns conflict). Property fields use `z.nativeEnum(PropertyType|Category|Status)` and removed `as never` casts. `syncUserProfileCompletionStatus` runs after transaction commit. Upload route uses `isOk()` and correct Result field access instead of fragile discriminant union.

### Changed

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

### Docs

- Updated `docs/PROGRESS-SUMMARY.md` and `docs/CHANGELOG.md` with recently migrated vertical slices (Reviews, Search, Documents, Licenses, Certificates, Client Dashboard), pending refinement (lib/services cleanup, idea-books comment), and tests implementation status (domain/route tests pending for migrated slices).
- Added environment hardening documentation artifacts: `docs/ENV-FILES-AUDIT.md` (staff-level audit findings and recommendations) and `docs/ENV-FILES-REMEDIATION-WALKTHROUGH.md` (phased remediation and rollout checks).

### Added (Historical)

- Added focused adapter regression coverage in `__tests__/api/notifications/route.test.ts`, `__tests__/api/notifications/notification-id.route.test.ts`, and `__tests__/api/professional-portal/seller-insights-adapters.route.test.ts` for route-to-domain delegation and status-code mappings.
- Added focused idea-books adapter regression coverage across the full route family in `__tests__/api/idea-books/route.test.ts`, `__tests__/api/idea-books/book-id.route.test.ts`, `__tests__/api/idea-books/attachments.route.test.ts`, and `__tests__/api/idea-books/attachment-id.route.test.ts`.

### Docs

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

### Added

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

### Security

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
