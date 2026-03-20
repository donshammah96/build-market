# Progress Summary

Last updated: 2026-03-20

## Snapshot

- Environment hardening pass completed for this branch: local auth-bypass guardrails tightened, env templates cleaned up for local/deployment usage, `.env.example` aligned to runtime-consumed keys, and env-contract drift checks now run in CI.
- Env governance follow-through expanded: Phase 5 central env-access guidance is now explicitly documented (canonical boundary, prioritized high-risk direct-read targets, and validation-group expansion), and the checker now enforces high-risk unused-key failures.
- **Recently migrated vertical slices (lib/services cutover):** Reviews, Search, Documents, Licenses, Certificates, and Client Dashboard now have canonical domains under `app/lib/domains/`; routes and actions delegate through domain services. Upload refinement complete: `isLocalUpload` in `lib/utils/upload.ts`, `uploadFiles` and related types in `lib/upload-client.ts`; consumers repointed. Dead `lib/services/inventory.ts`, `orders.ts`, `products.ts` removed.
- Seller-insights refinement is now complete beyond migration baseline: the domain owns inventory, orders, and products logic in `app/lib/domains/seller-insights/repository.ts`; the domain service no longer imports from `lib/services/*`; browser facades (`inventory-client`, `orders-client`, `products-client`) and dashboard consumers (`useDashboardData`, `InventoryAlertsWidget`) use explicit domain contracts.
- Shared server-action hardening is established through `app/lib/actions/secure-action.ts` and `app/lib/errors/result.ts`.
- User-profile refinement is now in progress beyond migration baseline: onboarding and profile-related browser boundaries removed a remaining client-side server-action import, onboarding submit responses now use explicit client DTO payloads, and the professional onboarding completion route now validates property payloads with typed Zod object schemas instead of `any`. **Onboarding UI:** Staff-level refinement complete per API-TO-FRONTEND-ARCHITECTURE.md: design tokens (including `--color-warning` for incomplete states), token migration complete across wizard (DetailsStep, DocumentsStep, ReviewStep, ProfessionStep), sessionStorage drafts with Zod restore, URL-encoded step/role, instrumentation context, ARIA hardening, accordion semantics, loading/error boundaries. OnboardingForm removed (legacy stub). Analytics provider swap complete: PostHog forwards onboarding events in production. **Staff-level onboarding fixes (2026-03-17):** GDPR consent records (one per type); Clerk metadata before idempotency; shared `updateClerkOnboardingMetadata`; skip flows use null/empty instead of synthetic data; document materialization outside transaction; completeOnboarding guard; Property enum validation; sync outside transaction; upload route Result pattern.
- Idea-books refinement is now in progress beyond migration baseline: the domain service now returns explicit DTO contracts instead of `unknown`, browser facade attachment/collaborator contracts are aligned to list versus detail payload shapes, and both `app/idea-books` route segments now have `loading.tsx`/`error.tsx` boundaries.
- Properties refinement is now in progress beyond migration baseline: the properties browser facade and hooks use explicit client DTO contracts instead of `any` payloads, properties route adapters pass actor objects through the domain boundary consistently, and the properties settings route now has route-local component extraction plus segment-level `loading.tsx`/`error.tsx` boundaries.
- Stores refinement is now in progress beyond migration baseline: the stores browser facade and hooks use explicit client DTO contracts instead of `any` payloads, the stores settings route has route-local component extraction plus segment-level `loading.tsx`/`error.tsx`, and stores route adapters now pass actor objects through the domain boundary consistently.
- Calendar refinement is now in progress beyond the initial migration baseline: the domain service owns serialized list/detail DTO mapping, the browser facade no longer repairs server payloads, the heavy month-sidebar and edit-dialog UI moved behind route-local dynamic imports, and the calendar route tree now has App Router `loading.tsx` and `error.tsx` coverage.
- Projects refinement is complete: explicit DTOs and mappers in `app/lib/domains/projects/`; service applies mappers for list/detail; API returns `{ items, pagination }` / `{ item }`; client DTO repair removed from portal and generic clients; `ClientDate` component for hydration-safe date display; staff audit in `docs/AUDIT-PROJECTS.md`.
- Calendar now follows the canonical client-app boundary: `app/lib/domains/calendar/` owns actor-aware list, detail, create, update, and delete behavior; professional-portal routes and `app/actions/calendar.ts` are thin adapters; and the browser facade now exports explicit calendar DTO contracts instead of `unknown` payloads.
- Clerk webhook handling now follows the same thin-adapter rule as the migrated route families: `app/api/clerk-webhook/route.ts` owns only Svix admission, rate limiting, and HTTP mapping, while `app/lib/integrations/clerk/service.ts` owns user and professional-profile synchronization.
- Upload lifecycle behavior is now centralized under `app/lib/domains/uploads/service.ts`, including pre-storage deduplication, asset access tracking, ownership-sensitive deletion, and staged onboarding upload materialization. Onboarding upload cleanup job now deletes storage blobs for expired staged uploads via `uploadService.cleanupExpiredStagedUploads()`; job tests in `__tests__/jobs/onboarding-upload-cleanup.test.ts`.
- Messaging, stores, properties, projects, and portfolio image flows now enforce authorization-sensitive behavior through domain services rather than caller-disciplined route or action logic.
- Actor-aware service inputs are in place across the main migrated slices, including non-mutation query paths where the actor boundary matters.
- CRM now follows the same shared boundary guidance: domain services return `Result<T, DomainError>` shapes, professional routes pass full actor context, and server actions use `secureAction` rather than hand-rolled auth and validation envelopes.
- Professionals public discovery now also follows the canonical domain pattern: `app/lib/domains/professionals/` owns the public list and detail DTO shaping, while the public routes, compatibility actions, client facade, hooks, mappers, and page types no longer treat `lib/services/professionals` as the source of truth.
- CRM follow-through documentation and regression coverage are now in place: `app/lib/domains/README.md` documents the service/repository boundary plus public-versus-authenticated semantics, and direct domain tests now cover leads, inquiries, and pipeline behavior without relying only on adapters.
- Professional collection reads that need explicit `forbidden` or `not_found` mapping now inline their GET adapters instead of flattening domain errors behind the shared professional GET factory.
- Identity/profile/compliance hardening has started with the professional settings seam, moving server actions off direct Prisma access and onto a dedicated domain module.
- Identity/profile/compliance hardening now also includes the authenticated user-profile route, which delegates profile read/update, consent audit writes, and completion recalculation to [app/lib/domains/user-profile/service.ts](app/lib/domains/user-profile/service.ts).
- Shared completion-state synchronization now lives in [app/lib/domains/user-profile/completion.ts](app/lib/domains/user-profile/completion.ts), and both onboarding and role-specific profile-complete routes use that same completion source of truth.
- The generic profile-complete router now dispatches directly through shared user-profile orchestration and no longer forwards requests internally over HTTP.
- The generic onboarding route now delegates the transaction-heavy role/profile creation flow to `app/lib/domains/user-profile/onboarding.ts`, so the route only owns Clerk auth, idempotency, rate limiting, request validation, and Clerk metadata sync.
- The remaining onboarding sibling routes now use that same domain-owned onboarding boundary, so professional completion and both skip flows no longer own inline transactions or route-local business-rule sentinels.
- GDPR consent, export, rectification, and deletion adapters now flow through [app/lib/domains/user-profile/compliance.ts](app/lib/domains/user-profile/compliance.ts) rather than mixing route-local Prisma and direct service calls.
- The professional-portal complete-profile adapter now delegates to [app/lib/domains/professional-settings/service.ts](app/lib/domains/professional-settings/service.ts), removing the last large inline transaction/orchestration block from [app/api/professional-portal/profile/complete/route.ts](app/api/professional-portal/profile/complete/route.ts).
- Messaging refinement is now complete beyond migration baseline: route-level `loading.tsx` added for `app/(user)/messages`; `loading.tsx` and `error.tsx` added for `app/professional-portal/messages` and `app/professional-portal/messages/[id]`; messaging-client comment updated to reference the canonical domain; domain owns participant, owner/admin, and sender checks.
- Onboarding and professional-settings now carry role-aware actor objects across their action, route, and service seams, and onboarding server actions use `secureAction` directly for validation and structured failure mapping even when Clerk-authenticated users are not yet fully materialized in the database.
- User-profile and professional-settings now include the same post-migration hardening applied in calendar: shared user-profile DTO serializers, typed profile-status client contracts, reduced profile-complete adapter branching, and route-segment `loading.tsx`/`error.tsx` boundaries for `app/profile` and `app/profile/complete`.
- Notifications refinement is now complete beyond migration baseline: route-level `loading.tsx` and `error.tsx` boundaries added for `app/(user)/notifications`; notifications-client comment updated to reference the canonical domain; domain owns DTO shaping via `app/lib/domains/notifications/`.
- Idea-books routes now delegate through `app/lib/domains/idea-books/` as the canonical domain seam, removing route-local orchestration in collection/detail and attachment routes while preserving structured error mapping.
- Idea-books route adapters now have full focused regression coverage across collection, item, attachments collection, and attachment item handlers, including mock-isolation hardening for validation edge cases.
- Seller dashboard read-model adapters (`inventory/alerts`, `orders`, and `products/top`) now route through `app/lib/domains/seller-insights/` so these professional-portal reads share one actor-aware domain boundary.

## Recently Migrated Slices (lib/services Cutover)


| Slice            | Domain                              | Routes/Actions                                | Tests                |
| ---------------- | ----------------------------------- | --------------------------------------------- | -------------------- |
| Reviews          | `app/lib/domains/reviews/`          | `app/api/reviews/route.ts`                    | Domain + route tests |
| Search           | `app/lib/domains/search/`           | `app/api/search/professionals/route.ts`, `app/actions/search.ts` | Domain + route + action tests |
| Documents        | `app/lib/domains/documents/`        | `app/api/professional-portal/documents/`**    | Domain + route tests |
| Licenses         | `app/lib/domains/licenses/`         | `app/api/professional-portal/licenses/**`     | Domain + route tests |
| Certificates     | `app/lib/domains/certificates/`     | `app/api/professional-portal/certificates/**` | Domain + route tests |
| Client Dashboard | `app/lib/domains/client-dashboard/` | `app/api/client/dashboard/route.ts`           | Domain + route tests |


**Upload refinement:** `isLocalUpload` → `lib/utils/upload.ts`; `uploadFiles`, `UploadError`, `validateFiles`, `FILE_LIMITS` → `lib/upload-client.ts`. Consumers: `PropertyForm`, `StoreForm`, `DocumentUploader`, `useImageUploader`.

## Pending Refinement

- **Projects domain:** `project-operations.service` absorbed into `app/lib/domains/projects/operations.ts`; ownership verification, state machines, and optimistic locking now live in the projects domain.
- **Stores domain:** `store-operations.service` and `store-event.service` absorbed into `app/lib/domains/stores/`; operations live in `operations.ts`, event sourcing in `events.ts`; `lib/services` re-exports for compatibility.

## Tests Implementation


| Slice            | Domain Tests                | Route/Adapter Tests       | Status                            |
| ---------------- | --------------------------- | ------------------------- | --------------------------------- |
| Reviews          | `reviews.service.test.ts`   | `reviews/route.test.ts`    | Complete                          |
| Search           | `search.service.test.ts`    | `search.test.ts` (action)  | Complete                          |
| Documents        | `documents.service.test.ts` | `documents.route.test.ts` | Complete                          |
| Licenses         | `licenses.service.test.ts`  | `licenses.route.test.ts`  | Complete                          |
| Certificates     | `certificates.service.test.ts` | `certificates.route.test.ts` | Complete                          |
| Client Dashboard | `client-dashboard.service.test.ts` | `dashboard.route.test.ts` | Complete                          |
| Upload (browser) | —                           | —                         | `useImageUploader.test.ts` (mock hoisting fixed) |
| Onboarding Upload Cleanup | `uploads/service.test.ts` | `jobs/onboarding-upload-cleanup.test.ts` | Complete |


**Recommendation:** Add focused domain and/or route adapter tests for Reviews, Search, Documents, Licenses, Certificates, and Client Dashboard before removing `lib/services` compatibility layer.

## Migration Status

- Calendar: canonical domain module active; professional calendar routes, server actions, browser facade, dashboard agenda consumer, and hooks are domain-backed with explicit DTO contracts; remaining legacy surface is low.
- Messaging: canonical domain module complete; server actions and API routes are domain-backed; remaining legacy surface is low.
- Projects: canonical domain module complete; shared and professional API routes plus actions are domain-backed, including optimistic mutations and actor-scoped queries; remaining legacy surface is low.
- Properties: canonical domain module active; API routes, query actions, onboarding/settings/profile-complete flows, and document or attachment operations are domain-backed; remaining legacy surface is low.
- Stores: canonical domain module active; API routes, actions, and onboarding/profile-complete store creation are domain-backed; remaining legacy surface is low.
- Portfolio: canonical domain module active; core CRUD and image routes are domain-backed through `app/lib/domains/portfolio/service.ts`; remaining legacy surface is low.
- CRM: canonical domains active; public leads/status, professional leads, inquiries, pipeline, and inquiry or lead actions are domain-backed with actor-aware service enforcement; remaining legacy surface is low.
- Professionals: canonical domain module active; public professionals routes, compatibility actions, browser facade, hooks, mapper imports, and page-level DTOs are domain-backed; remaining legacy surface is low.
- Notifications: canonical domain module active; collection and item API routes are domain-backed with structured list, mark-read, and delete mappings; route-level `loading.tsx` and `error.tsx` boundaries for `app/(user)/notifications`; remaining legacy surface is low.
- Idea Books: canonical domain seam active; collection/detail/attachment routes now delegate through `app/lib/domains/idea-books/`, with deep repository extraction still pending.
- Seller dashboard read models: canonical `seller-insights` domain active; inventory, orders, and products logic now lives in `app/lib/domains/seller-insights/repository.ts`; domain no longer imports from `lib/services/*`; browser clients and dashboard consumers use domain contracts; remaining legacy surface is none for these adapters.
- Reviews: canonical domain under `app/lib/domains/reviews/`; `app/api/reviews/route.ts` delegates through domain; domain and route adapter tests complete; Result/actor carry-forward applied; refinement: `loading.tsx`/`error.tsx`, extracted `ReviewListCard` and `ReviewsSkeleton` to `_components/`.
- Search: canonical domain under `app/lib/domains/search/`; `app/api/search/professionals/route.ts` (new) and `app/actions/search.ts` delegate through domain; repository uses `select` and `toSearchProfessionalResultDto` mapper; `lib/search-client.ts`, `hooks/useSearchProfessionals.ts`, and search page at `app/(user)/search` with debounced input and results list; domain and action tests complete; Result/actor carry-forward applied.
- Documents: canonical domain under `app/lib/domains/documents/`; explicit DTOs and mappers; professional-portal documents routes delegate through domain; credentials UI with `DocumentsTab`; domain and route adapter tests complete.
- Licenses: canonical domain under `app/lib/domains/licenses/`; explicit DTOs and mappers; professional-portal licenses routes delegate through domain; credentials UI with `LicensesTab`; domain and route adapter tests complete; Result/actor carry-forward applied.
- Certificates: canonical domain under `app/lib/domains/certificates/`; explicit DTOs and mappers; professional-portal certificates routes delegate through domain; credentials UI with `CertificatesTab`; domain and route adapter tests complete; Result/actor carry-forward applied.
- Client Dashboard: canonical domain under `app/lib/domains/client-dashboard/`; explicit DTOs in repository; `app/api/client/dashboard/route.ts` delegates through domain; `app/(user)/dashboard` has route-level `loading.tsx`/`error.tsx` and extracted `DashboardSkeleton`, `EmptyState`, `QuickLink`; domain and route adapter tests complete; staff audit in `docs/AUDIT-CLIENT-DASHBOARD.md`.

## Completed In This Pass

- Completed Phase 2 (deployment/local env hygiene): updated `apps/client/.gitignore` to ignore `.env.vercel` while preserving `.env.vercel.example`; refreshed local template guidance in `apps/client/.env.local.example`; sanitized `apps/client/.env.vercel`; and added `apps/client/.env.vercel.example` as the committed deployment template.
- Completed Phase 3 (auth bypass hardening): tightened `BYPASS_AUTH` handling in `app/lib/api/api-middleware.ts` to block unsafe bypass paths (CI and non-local contexts), and extended `__tests__/lib/api-middleware.test.ts` with coverage for allowed local bypass plus blocked bypass scenarios.
- Completed Phase 4/6 (env contract and CI drift guard): aligned `apps/client/.env.example` to runtime-consumed env keys; added `apps/client/scripts/check-env-contract.mjs`; added scripts in `apps/client/package.json` and root `package.json`; and wired env contract validation into `.github/workflows/ci.yml`.
- Completed strict checker enforcement refinement: `apps/client/scripts/check-env-contract.mjs` now fails on high-risk unused template keys, recognizes centralized env-definition keys (for example `name: "KEY"`) as valid usage to reduce false positives, and narrows NATS high-risk matching to credential-like keys only.
- Completed high-risk template cleanup for strict mode: removed stale sensitive placeholders (`SMTP_PASSWORD`, `AFRICASTALKING_API_KEY`) from `apps/client/.env.example` so strict unused-key checks pass without exceptions.
- Completed Phase 5 documentation update: `docs/ENV-FILES-REMEDIATION-WALKTHROUGH.md` now carries explicit centralization guidance for canonical env boundary usage, prioritized high-risk direct-read migration targets, and validation-group expansion in `app/lib/infrastructure/env.ts`.
- **Staff-level onboarding and user-profile fixes (2026-03-17):** GDPR consent records now create one `ConsentRecord` per changed type in `service.ts`, `profile-complete.ts`, and `onboarding.ts`. Clerk metadata update runs before `IdempotencyService.complete()` in all onboarding routes. Replaced `ClerkMetadataClient` type cast in `actions/onboarding.ts` with shared `updateClerkOnboardingMetadata`. `skipClientOnboarding` uses null for county; `skipProfessionalOnboarding` uses `companyName: ""`. Document materialization moved before `prisma.$transaction`. `completeOnboarding` guards against already-onboarded users. Property fields use `z.nativeEnum(PropertyType|Category|Status)`; removed `as never` casts. `syncUserProfileCompletionStatus` runs after transaction. Upload route uses `isOk()` and correct Result handling. Added consent records test, conflict test, invalid-enum test, and transaction boundary comments.
- Refined legal segment: added `loading.tsx` and `error.tsx` for `app/legal`; fixed footer year hydration via `suppressHydrationWarning`; extracted `Toggle`, `CookieCategoryCard`, and `CATEGORIES` into `cookie-settings/_components/`.
- Refined properties domain: added `mappers.ts` with `toPropertyDocumentDto`, `toPropertyAttachmentDto`, `toPropertyCreateResultDto`; service now returns explicit DTOs for documents, attachments, create/update; tightened `lib/properties-client.ts` contracts; removed type assertion in properties-settings-page-client; staff audit in `docs/AUDIT-PROPERTIES.md`.
- Refined credentials settings tabs (DocumentsTab, LicensesTab): added route-aware retry via optional `onRetry` prop and "Try again" button in error states; parent passes `refetchDocuments` and `refetchLicenses` from hooks so users can retry without full-page reload. Matches CertificatesTab pattern.
- Refined CRM/Portfolio slices: inquiries (mappers, contracts, client DTO repair removed, loading/error); leads (mappers, contracts, client aligned, loading/error); pipeline (loading/error); portfolio (contracts, mappers, client DTO repair removed, loading/error); staff audit in `docs/AUDIT-CRM-PORTFOLIO.md`.
- Refined reviews slice: added route-level `loading.tsx` and `error.tsx` for `app/(user)/reviews`; extracted `ReviewListCard` and `ReviewsSkeleton` into `_components/`; staff audit in `docs/AUDIT-REVIEWS-SEARCH.md`.
- Refined search slice: added `app/lib/domains/search/mappers.ts`; updated repository to use `select` and mapper; added `GET /api/search/professionals?q=...`; added `lib/search-client.ts`, `hooks/useSearchProfessionals.ts`, search page at `app/(user)/search` with debounced input and results; staff audit in `docs/AUDIT-REVIEWS-SEARCH.md`.
- Refined client-dashboard slice: added route-level `loading.tsx` and `error.tsx` for `app/(user)/dashboard`; extracted `DashboardSkeleton`, `EmptyState`, `QuickLink` into `_components/`; staff audit in `docs/AUDIT-CLIENT-DASHBOARD.md`.
- Refined credentials slices (documents, certificates, licenses): replaced Prisma-derived DTOs with explicit domain-owned DTOs and mappers; extracted `DocumentsTab`, `CertificatesTab`, `LicensesTab` into route-local components; updated `docs/AUDIT-CREDENTIALS-UI.md` refinement checklist.
- Migrated Reviews, Search, Documents, Licenses, Certificates, and Client Dashboard from `lib/services` to canonical domains; refined upload slice (`isLocalUpload` → `lib/utils/upload.ts`, `uploadFiles` → `lib/upload-client.ts`); removed dead `lib/services/inventory.ts`, `orders.ts`, `products.ts`.
- Refined the messaging slice: added `app/(user)/messages/loading.tsx`; added `app/professional-portal/messages/loading.tsx`, `error.tsx`, `[id]/loading.tsx`, and `[id]/error.tsx`; updated `lib/messaging-client.ts` comment to reference domain.
- Refined the notifications slice: added `app/(user)/notifications/loading.tsx` and `error.tsx` with layout-aligned skeletons and error surfaces; updated `lib/notifications-client.ts` comment to reference domain instead of legacy service.
- Refined the seller-insights domain: added `app/lib/domains/seller-insights/repository.ts` with inventory, orders, and products persistence logic moved from `lib/services/*`; updated `app/lib/domains/seller-insights/service.ts` to use the repository instead of legacy service imports; updated `lib/inventory-client.ts`, `lib/orders-client.ts`, and `lib/products-client.ts` to use domain contracts (`SellerInventoryAlert`, `SellerInventoryAlertsResult`, `SellerOrderListResult`, `SellerTopProduct`); updated `hooks/useDashboardData.ts` and `InventoryAlertsWidget` to import from the seller-insights domain.
- Refined `app/lib/domains/properties/contracts.ts` and `app/lib/domains/properties/service.ts` so properties list/detail/create/update/attachment methods now use explicit typed DTO returns derived from Prisma payloads instead of `Result<unknown>`.
- Refined `lib/properties-client.ts` contracts by dropping manual facade definitions in favor of unified domain DTO imports, removing remaining `any` type drift.
- Modernized `app/properties/page.tsx` and `app/properties/[id]/page.tsx` from monolithic client components into Server Components with 60s ISR revalidation and actual API fetching via `propertiesClient`.
- Extracted interactive properties UI state into route-local client components `app/properties/_components/property-search-hero.tsx` and `app/properties/[id]/_components/property-gallery.tsx`.
- Added route-segment boundaries for public properties UI by introducing `app/properties/loading.tsx`, `app/properties/error.tsx`, `app/properties/[id]/loading.tsx`, and `app/properties/[id]/error.tsx`.
- Refined the `finance` domain and frontend slice: narrowed `providerMetadata` to `Prisma.JsonValue`, formalized the `FinanceBrowserTransaction` normalization boundary, removed duplicated types and schemas from `finance-client.ts` and `page.tsx`, extracted `FinanceCard` and `TransactionRow` to `_components/`, pinned locales to `"en-KE"`, and added segment boundaries (`loading.tsx`/`error.tsx`).
- Refined the `stores` domain and frontend slice: enforced strict `StoreDetail` and `StoreListItem` Prisma DTO contracts entirely across boundaries, dropped duplicate `any` / manual schemas from `stores-client.ts`, and deployed complete UI layers (`page.tsx`, `loading.tsx`, `error.tsx` combinations) for both the `app/professional-portal/stores` and public `app/stores` routes.
- Refined the professional-portal dashboard UI: added `loading.tsx` and `error.tsx` segment boundaries, extracted `VerificationPromptCard` (+ `dynamic()` load), `ErrorAlert`, and `DashboardSkeleton` to `_components/`, pinned locale in `MetricsRow` and `AgendaWidget`, and removed a dead conditional branch in `DashboardHeader`.
- Refined the onboarding uploads slice post-migration by fixing a double `arrayBuffer()` read in `app/api/onboarding/uploads/route.ts` (each file now buffered once during collection), removing the legacy `fileUrl` field from `MaterializedUpload` in `app/lib/domains/uploads/service.ts` (only `assetId` remains), introducing a typed `CreateStagedUploadInput` DTO in `app/lib/domains/uploads/repository.ts` to replace the raw Prisma create input, and completing adapter test coverage in `__tests__/api/onboarding/uploads.test.ts` with rate-limit 429 and `MAX_FILES_PER_REQUEST` admission-guard paths.
- Refined `app/lib/domains/idea-books/contracts.ts` and `app/lib/domains/idea-books/service.ts` so idea-books list/detail/create/update/attachment methods now use explicit typed DTO returns instead of `Result<unknown>`, including canonical mapping for list cover/count fields and detail count fields.
- Refined `lib/idea-books-client.ts` contracts by splitting list attachment previews from detail attachments and replacing `IdeaBookDetail.collaborators?: unknown[]` with an explicit collaborator DTO shape.
- Added route-segment boundaries for idea-books UI by introducing `app/idea-books/loading.tsx`, `app/idea-books/error.tsx`, `app/idea-books/[id]/loading.tsx`, and `app/idea-books/[id]/error.tsx`.
- Removed a client-side server-action dependency from `app/professional/onboarding/page.tsx` by relying on the canonical onboarding route/domain persistence path for store creation rather than dynamically importing `app/actions/stores` in browser code.
- Tightened `app/api/onboarding/professional/complete/route.ts` validation by replacing `properties: z.array(z.any())` with an explicit typed property object schema aligned to domain onboarding inputs.
- Refined `lib/onboarding-client.ts` to use an explicit onboarding submit response payload (`OnboardingSubmitPayload`) instead of `ApiResponse<unknown>`.
- Refined `lib/properties-client.ts` and `hooks/useProperties.ts` to canonical explicit payload contracts (`PropertyListPayload`, `MyPropertiesPayload`, `PropertyMutationPayload`, and document payloads), removing remaining `any` facade responses and hook `ReturnType`-derived mutation typing.
- Extracted `app/professional-portal/settings/properties/page.tsx` into a thin wrapper over `app/professional-portal/settings/properties/_components/properties-settings-page-client.tsx`, split the optional `PropertyForm` flow behind route-local dynamic import, and added `app/professional-portal/settings/properties/loading.tsx` plus `app/professional-portal/settings/properties/error.tsx` aligned to that route segment.
- Moved property optimistic-lock helper ownership to `app/lib/domains/properties/operations.ts`, updated property routes (`/api/properties`, `/api/properties/my-listings`, id route, and attachment/document routes) to pass full actor objects into properties domain service methods, and left `app/lib/services/property-operations.service.ts` as a compatibility re-export.
- Refined `lib/stores-client.ts` and `hooks/useStores.ts` to canonical explicit payload contracts (`StoreListPayload`, `StoreUpdatePayload`, document payloads, and batch/create envelopes), removing remaining `any` facade responses and hook `ReturnType`-derived mutation typing.
- Extracted `app/professional-portal/settings/stores/page.tsx` into a thin wrapper over `app/professional-portal/settings/stores/_components/stores-settings-page-client.tsx`, split the optional `StoreForm` flow behind route-local dynamic import, and added `app/professional-portal/settings/stores/loading.tsx` and `app/professional-portal/settings/stores/error.tsx` aligned to that route layout.
- Moved optimistic-lock store operation helpers from compatibility layer imports to `app/lib/domains/stores/operations.ts`, and updated stores route adapters (`/api/stores`, `/api/stores/me`, and document routes) to pass full actor objects into stores domain service methods.
- Refined `app/professional-portal/projects/page.tsx` and `app/professional-portal/projects/[id]/page.tsx` into thin route wrappers over route-local components, reducing inline page complexity and keeping large client UI stacks out of `page.tsx`.
- Split the optional project-management edit form from `app/professional-portal/projects/[id]/_components/project-details-page-client.tsx` into a dynamically loaded route-local component (`project-edit-form.tsx`) so form-heavy UI and validation code only load when edit mode is opened.
- Added route-level `loading.tsx` and `error.tsx` boundaries for `app/professional-portal/projects` and `app/professional-portal/projects/[id]`, with skeleton and error layouts matched to each route's actual UI composition.
- Moved canonical calendar DTO serialization into `app/lib/domains/calendar/service.ts`, so list/detail/create/update responses now cross the HTTP boundary as explicit client DTOs instead of raw repository return types.
- Removed browser-side calendar DTO repair from `lib/calendar-client.ts`, leaving the facade responsible for HTTP access, id validation, and concurrency limiting only.
- Extracted the month sidebar widget from `app/professional-portal/calendar/page.tsx` into a route-local dynamic component and replaced the page-level retry reload path with a query refetch.
- Extracted the detail edit form stack from `app/professional-portal/calendar/[id]/page.tsx` into a route-local dynamic component so the `react-hook-form` and Zod-heavy edit UI only loads when requested.
- Added `app/professional-portal/calendar/error.tsx`, `app/professional-portal/calendar/loading.tsx`, `app/professional-portal/calendar/[id]/error.tsx`, and `app/professional-portal/calendar/[id]/loading.tsx` to give the calendar route tree route-level resilience instead of relying only on inline query-state placeholders.
- Updated `.agent/API-TO-FRONTEND-ARCHITECTURE.md` with a staff architecture review checklist and a migrated-slice refinement checklist, then aligned ADR-002 and ADR-003 with those review rules.
- Added `app/lib/domains/calendar/repository.ts`, `service.ts`, and `contracts.ts`, then cut `app/api/professional-portal/calendar/route.ts`, `app/api/professional-portal/calendar/[id]/route.ts`, and `app/actions/calendar.ts` over to actor-aware domain methods instead of direct Prisma-backed `lib/services/calendar` behavior.
- Removed the dead calendar compatibility shim under `lib/services/calendar.ts` after repointing all route, action, hook, and client imports to the canonical calendar domain boundary.
- Tightened the calendar browser contract by replacing `unknown` calendar facade payloads in `lib/calendar-client.ts` with explicit list, detail, mutation, and delete DTOs, and aligned the dashboard agenda consumer plus calendar pages to the actual uppercase enum contract returned by the API.
- Added focused calendar migration coverage in `__tests__/lib/domains/calendar.service.test.ts`, `__tests__/api/professional-portal/calendar.route.test.ts`, and `__tests__/api/professional-portal/calendar-item.route.test.ts` for actor enforcement and adapter error mapping.
- Added `app/lib/integrations/clerk/repository.ts` and `app/lib/integrations/clerk/service.ts`, then refactored `app/api/clerk-webhook/route.ts` into a thin dispatcher over that integration boundary.
- Added canonical uploads domain files under `app/lib/domains/uploads/` (`repository.ts`, `service.ts`, `index.ts`) and cut `app/api/uploads/route.ts` and `app/api/uploads/[id]/route.ts` over to that domain-owned upload persistence, metadata access, and delete behavior.
- Rewired staged upload consumption in `app/lib/domains/user-profile/onboarding.ts` to call `uploadService.materializeOnboardingUpload(...)` inside the existing onboarding transaction instead of duplicating asset lookup, creation, and staged-row consumption logic.
- Moved upload dedupe ahead of storage writes using the processed-buffer checksum as the canonical asset key, preventing duplicate blob uploads for already-materialized assets.
- Replaced the stale Clerk webhook route tests with adapter-focused coverage in `__tests__/api/clerk-webhook/route.test.ts` and added direct upload lifecycle coverage in `__tests__/lib/uploads/service.test.ts`.
- Finished the project action cutover for optimistic-lock project and milestone mutations onto `app/lib/domains/projects/service.ts`.
- Removed the remaining legacy query-action imports from `app/actions/projects.ts` and `app/actions/properties.ts`.
- Added a domain-backed user-project listing path so authenticated project reads no longer bypass the projects domain layer.
- Repointed onboarding, settings, and profile-complete property creation/batch creation flows through `app/lib/domains/properties/service.ts`.
- Extracted portfolio core CRUD into `app/lib/domains/portfolio/service.ts`, so the whole portfolio slice now uses one canonical domain boundary.
- Removed the last intentional `@/lib/services/properties` dependency by porting property list/detail/create/batch/document/attachment internals into `app/lib/domains/properties/service.ts`.
- Added centralized completion sync in `app/lib/domains/user-profile/completion.ts` and repointed onboarding plus both role-specific profile-complete routes to it.
- Extracted shared profile-complete orchestration into `app/lib/domains/user-profile/profile-complete.ts`, added route-facing contracts in `app/lib/domains/user-profile/profile-complete-contracts.ts`, and removed the generic profile-complete route's internal HTTP forwarding in favor of direct domain dispatch plus a shared endpoint-family rate-limit helper.
- Extracted onboarding orchestration into `app/lib/domains/user-profile/onboarding.ts` and refactored `app/api/onboarding/route.ts` into a thin adapter over that service, including explicit domain mapping for invalid or expired staged document uploads.
- Extended `app/lib/domains/user-profile/onboarding.ts` to own professional completion plus both onboarding skip flows, then refactored `app/api/onboarding/professional/complete/route.ts`, `app/api/onboarding/skip/route.ts`, and `app/api/onboarding/skip-professional/route.ts` into thin adapters over those domain methods.
- Added actor-aware GDPR orchestration in `app/lib/domains/user-profile/compliance.ts` and refactored the consent, export, rectification, and deletion user APIs into thin adapters over that domain service.
- Expanded profile-complete regression coverage to include generic dispatch, shared rate-limit rejection, invalid JSON handling, and direct client/professional forbidden, banned-account, and not-found mappings.
- Rebased onboarding route tests onto the new domain boundary, added invalid-input mapping coverage for staged-upload failures, and added direct route coverage for skip and professional-complete adapter mappings.
- Cleared the standing client compile blocker by switching `components/forms/ServiceSelector.tsx` to the canonical `ServiceGroup` domain export.
- Refactored `app/api/professional-portal/profile/complete/route.ts` into a thin adapter over `professionalSettingsService.completeProfile(...)` and added direct route coverage for success, invalid-input mapping, schema rejection, and idempotent replay handling.
- Added direct domain-boundary coverage in `__tests__/lib/domains/properties.service.test.ts` for professional-profile gating and attachment authorization/not-found mappings.
- Added direct domain-boundary coverage in `__tests__/lib/domains/portfolio.service.test.ts` for portfolio limit enforcement, image ownership rejection, and main-image promotion on delete.
- Expanded direct portfolio domain coverage to include list/detail/update paths and actor-scoped pagination/filter assertions in `__tests__/lib/domains/portfolio.service.test.ts`.
- Expanded direct properties domain coverage beyond attachments into optimistic-lock update/delete mappings and property-document authorization in `__tests__/lib/domains/properties.service.test.ts`.
- Hardened `lib/projects-client.ts` so the public projects facade now honors the same `NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API` and `NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API_MUTATIONS` rollout guards as the canonical domain client, and added facade-level regression coverage in `__tests__/lib/projects-client-facade-gate.test.ts`.
- Added property batch-creation success-path coverage in `__tests__/lib/domains/properties.service.test.ts`, including slug-collision handling and single-consent auditing for the created property IDs.
- Added hook-level generic and portal projects consumer coverage in `__tests__/hooks/useProjects.test.tsx` so the React Query consumers now assert normalized list/detail reads through both client paths.
- Added mutation-side hook coverage in `__tests__/hooks/useProperties.test.tsx` for `useCreatePropertiesBatch`, asserting payload forwarding and invalidation of both my-properties and shared property-list caches.
- Extended `__tests__/hooks/useDashboardData.test.ts` to cover the UI-facing generic projects consumer path, asserting service-provider dashboard mapping from generic-project API results without touching store or property clients.
- Expanded `__tests__/hooks/useProperties.test.tsx` with a failure-path `useCreatePropertiesBatch` case, asserting API-error unwrapping and the absence of cache invalidation on rejected batch creation.
- Extended `__tests__/hooks/useDashboardData.test.ts` with a hybrid-dashboard path so the generic projects consumer is now covered when project and property widgets are enabled together.
- Added the canonical leads domain under `app/lib/domains/leads/`, cut both public and professional leads API adapters plus `app/actions/leads.ts` over to it, and removed the first CRM slice from the legacy leads service path.
- Added focused leads route regression coverage in `__tests__/api/leads/public.route.test.ts` and `__tests__/api/leads/professional.route.test.ts` for public status/create flows and authenticated list/detail/create/update/delete adapter behavior.
- Added canonical `app/lib/domains/inquiries/` and `app/lib/domains/pipeline/` boundaries using the shared `Result<T, DomainError>` pattern, then cut the remaining professional inquiries routes, inquiry actions, and pipeline route over to actor-aware service methods instead of legacy `lib/services/*` modules.
- Standardized the remaining CRM action and route boundaries on `secureAction`, structured domain-result mapping, and service-owned role plus resource-ownership checks to close the remaining inquiry and pipeline IDOR-style gaps.
- Refactored the full messaging slice onto the shared boundary pattern: `contracts.ts` now exposes a canonical actor type, `service.ts` returns shared `Result<T, DomainError>` values for reads and mutations, participant-management moved out of route-local Prisma blocks and into the domain service, and all messaging routes now pass full actor context with explicit `403`/`404` response mapping.
- Reworked `app/actions/onboarding.ts` to use `secureAction` directly for request validation and structured failure handling, while delegating role/profile persistence to `app/lib/domains/user-profile/onboarding.ts` and using actor-aware stores/properties domain calls for follow-on resource creation.
- Tightened the professional-settings seam so `professionalSettingsService` enforces professional-role access itself, accepts richer actor context, and passes that same actor shape into downstream store/property creation instead of relying on bare user-id caller discipline.
- Added non-dashboard browser-client contract coverage in `__tests__/lib/non-dashboard-browser-clients.test.ts` for profile status null-handling, consent bulk updates, onboarding envelope parsing, finance transaction normalization, and portfolio detail normalization.
- Added focused client-consumer hook coverage in `__tests__/hooks/profile-client-hooks.test.ts` for `useProfileStatus` mutation/refetch behavior and `useVerificationRedirect` professional and property verification redirects.
- Added onboarding consumer coverage in `__tests__/hooks/useOnboarding.test.tsx` and `__tests__/components/forms/OnboardingForm.test.tsx`, covering metadata-driven redirect behavior, submit and skip flows, cancellation sign-out, and role-specific dashboard routing.
- Added consent adapter regression coverage in `__tests__/api/user/consent.route.test.ts` for single-consent writes, consent reads, bulk partial-success `207` handling, and early validation plus rate-limit rejection.
- Added finance adapter and route regression coverage in `__tests__/api/professional-portal/finance-adapters.route.test.ts` and `__tests__/api/professional-portal/finance-routes.test.ts` for shared GET-wrapper composition, transaction query parsing, transaction detail/update/delete behavior, and withdrawal success plus business-rule failures.
- Added direct CRM domain coverage in `__tests__/lib/domains/leads.service.test.ts`, `__tests__/lib/domains/inquiries.service.test.ts`, and `__tests__/lib/domains/pipeline.service.test.ts` for actor enforcement, ownership checks, public lead notification/status shaping, and pipeline aggregation math.
- Documented the shared domain-layer boundary in `app/lib/domains/README.md`, including explicit CRM guidance for service versus repository responsibilities and public-versus-authenticated semantics.
- Extended `__tests__/hooks/useDashboardData.test.ts` to verify CRM consumer normalization for leads, property inquiries, and pipeline summaries in the service-provider and hybrid dashboard branches.
- Extended `__tests__/lib/dashboard-browser-clients.test.ts` to cover the dashboard-facing CRM browser facades directly, including lead filter serialization and pipeline summary envelopes.
- Added the canonical professionals public-read boundary under `app/lib/domains/professionals/`, then cut `app/api/professionals/`**, `app/actions/professionals.ts`, `lib/professionals-client.ts`, `hooks/useProfessionals.ts`, `lib/professionals-mappers.ts`, and the professional detail page type imports over to domain-owned DTOs instead of `lib/services/professionals`.
- Added focused professionals regression coverage in `__tests__/api/professionals/route.test.ts`, `__tests__/api/professionals/professional-id.route.test.ts`, and `__tests__/lib/domains/professionals.service.test.ts` for list filtering, detail `404` mapping, public DTO shaping, and location normalization.
- Hardened the user-profile plus professional-settings refinement pass by adding shared user-profile serialization mappers in `app/lib/domains/user-profile/mappers.ts`, tightening profile-complete route helper typing and target-specific schema dispatch, and adding route-level `loading.tsx`/`error.tsx` boundaries for `app/profile` and `app/profile/complete`.
- Tightened browser profile contracts by switching the profile status flow in `lib/user-profile-client.ts` and `hooks/useProfileStatus.ts` to an explicit discriminated result shape instead of loosely typed status parsing, and aligned non-dashboard browser client tests to the new contract.
- Added the canonical notifications boundary under `app/lib/domains/notifications/` (`contracts.ts`, `repository.ts`, `service.ts`, `index.ts`) and cut `app/api/notifications/route.ts` plus `app/api/notifications/[id]/route.ts` over to domain-owned list, detail, mark-read, and delete orchestration.
- Added an idea-books domain seam under `app/lib/domains/idea-books/` (`contracts.ts`, `service.ts`, `index.ts`) and cut `app/api/idea-books/route.ts`, `app/api/idea-books/[id]/route.ts`, `app/api/idea-books/[id]/attachments/route.ts`, and `app/api/idea-books/[id]/attachments/[attachmentId]/route.ts` over to domain-backed adapter flows.
- Added focused idea-books adapter coverage in `__tests__/api/idea-books/route.test.ts`, `__tests__/api/idea-books/book-id.route.test.ts`, `__tests__/api/idea-books/attachments.route.test.ts`, and `__tests__/api/idea-books/attachment-id.route.test.ts`, and tightened test isolation by using one-shot query-schema mock overrides where validation-failure paths are exercised.
- Added a seller-insights domain seam under `app/lib/domains/seller-insights/` (`contracts.ts`, `service.ts`, `index.ts`) and rewired `app/api/professional-portal/inventory/alerts/route.ts`, `app/api/professional-portal/orders/route.ts`, and `app/api/professional-portal/products/top/route.ts` to delegate through shared actor-aware domain methods.
- Added focused adapter regression coverage in `__tests__/api/notifications/route.test.ts`, `__tests__/api/notifications/notification-id.route.test.ts`, and `__tests__/api/professional-portal/seller-insights-adapters.route.test.ts` for domain delegation and HTTP error mapping.

## Verification

- Verified after this refinement pass: `pnpm run client:tsc-noemit` completed cleanly against the updated domain mappers, dynamic route components, and new segment boundaries.
- `pnpm -C apps/client exec tsc --noEmit`
- Focused calendar suites: `3/3` files, `6/6` tests passing for `__tests__/lib/domains/calendar.service.test.ts`, `__tests__/api/professional-portal/calendar.route.test.ts`, and `__tests__/api/professional-portal/calendar-item.route.test.ts`.
- Focused extracted-boundary suites: `2/2` files, `8/8` tests passing for `__tests__/api/clerk-webhook/route.test.ts` and `__tests__/lib/uploads/service.test.ts`.
- Projects API suite: `4/4` files, `19/19` tests passing.
- Portfolio API suite: `2/2` files, `11/11` tests passing.
- Profile-complete route suite: `1/1` file, `17/17` tests passing after the direct-endpoint forbidden, banned-account, and not-found extensions.
- Onboarding route suites: `4/4` files, `21/21` tests passing after the onboarding sibling-route extraction.
- Professional settings/profile-complete suites: `2/2` files, `10/10` tests passing after the professional-portal route cutover.
- Properties domain suite: `1/1` file, `7/7` tests passing for creation gating, batch-create success, attachment mappings, optimistic-lock mutation mappings, and document authorization coverage.
- Portfolio domain suite: `1/1` file, `6/6` tests passing for list/detail/update paths plus limit enforcement, asset ownership rejection, and main-image promotion on delete.
- Projects facade gate suite: `1/1` file, `3/3` tests passing for read-disabled, read-only rollout, and fully enabled generic-projects facade behavior.
- Focused projects hook consumer suite: `1/1` file, `4/4` tests passing for generic and portal list/detail consumers.
- Focused properties batch hook suite: `1/1` file, `2/2` tests passing for batch payload wiring, failure-path error unwrapping, and correct cache invalidation behavior.
- Dashboard hook suite: `1/1` file, `7/7` tests passing including CRM lead normalization plus property-inquiry and pipeline summary mapping for the service-provider and hybrid branches.
- Leads route suites: `2/2` files, `11/11` tests passing for public and authenticated leads adapter mappings after the initial CRM cutover.
- Inquiries and pipeline focused suites: `3/3` files, `13/13` tests passing for authenticated inquiry routes, inquiry actions, and pipeline route mappings after the final CRM cutover.
- Professional settings action and route suites remain the focused regression coverage for the role-bearing actor change in that seam.
- CRM direct domain suites: `3/3` files, `11/11` tests passing for leads, inquiries, and pipeline actor enforcement, ownership rules, DTO shaping, and aggregation behavior.
- Focused browser-client contract suites: `2/2` files, `11/11` tests passing for dashboard and non-dashboard browser facades after the client-boundary sweep, including direct dashboard coverage for the leads and pipeline clients.
- Profile client hook suite: `1/1` file, `4/4` tests passing for `useProfileStatus` and `useVerificationRedirect` consumer behavior.
- Onboarding consumer suites: `2/2` files, `7/7` tests passing for `useOnboarding` and `OnboardingForm` role-specific submit, skip, cancel, and redirect flows.
- Consent route suite: `1/1` file, `5/5` tests passing for POST, GET, bulk PUT, validation rejection, and rate-limit handling.
- Finance route suites: `2/2` files, `7/7` tests passing for stats/list adapter wiring plus transaction detail/update/delete and withdrawal route behavior.
- Professionals focused suites: `3/3` files, `13/13` tests passing for public list and detail route mappings plus direct professionals domain DTO shaping.
- Idea-books adapter suites: `4/4` files, `13/13` tests passing for collection/item/attachments/attachment-item route adapters, including forbidden/not-found mapping, idempotency pending handling, and validation guard behavior.
- Newly added notifications and seller-insights adapter suites are diagnostics-clean (`0` TypeScript errors across `__tests__/api/notifications/route.test.ts`, `__tests__/api/notifications/notification-id.route.test.ts`, and `__tests__/api/professional-portal/seller-insights-adapters.route.test.ts`); runtime suite output capture is pending due intermittent terminal stream issues.

## Audit: Next Migration Queue

Reviews, Search, Documents, Licenses, Certificates, and Client Dashboard are now migrated to domains. The remaining work is refinement and test coverage.

### Ranked Queue (Refinement & Tests)

1. **Reviews, Search, Documents, Licenses, Certificates, Client Dashboard** — add domain and/or route adapter tests; remove orphaned `lib/services/*` files after verification.
2. **Idea Books Deep Follow-Through** — medium impact post-cutover hardening.
  Why: the route family is now domain-backed and adapter-tested, but deep follow-through remains for browser-facade contract alignment and any residual repository-shape cleanup.
   Action plan: keep `app/lib/domains/idea-books/` as the canonical seam, complete browser-client contract normalization, and add any remaining domain-focused collaborator/privacy rule tests.
3. ~~**lib/services removal**~~ — Completed: removed orphaned `reviews.ts`, `search.ts`, `documents.ts`, `licenses.ts`, `certificates.ts`, `client-dashboard.ts`, `upload.ts` from `lib/services/`.

### Carry-Forward Rules For Every Remaining Slice

- Put canonical business logic under `app/lib/domains/<slice>/`, not `lib/services/*`.
- Pass full actor context into the domain whenever authorization or `403` versus `404` mapping matters.
- Keep routes and actions transport-only: auth, validation, idempotency, resilience, and response mapping.
- Prefer shared `Result<T, DomainError>` contracts so adapters do not invent route-local sentinels.
- Add at least domain-level coverage plus focused adapter or consumer coverage before calling the slice migrated.

## Remaining Follow-Through

- No additional code-side guardrail work remains in this pass; the remaining items below are rollout and contract-signoff steps before removing the generic-projects flags.

### Phase 2 Acceptance Criteria

1. Confirm homeowner/general route contract requirements and finalize response envelope guarantees for all `/api/projects/`** resources.
2. Monitor staging/production mutation-path health (idempotency conflicts, optimistic-lock conflicts, write error rates) during canary and broad rollout.
3. Remove rollout flags after full generic projects cutover.

