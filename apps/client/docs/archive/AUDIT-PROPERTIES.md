# Staff-Level Audit: Properties Domain

**Date:** 2026-03-15  
**Scope:** `app/lib/domains/properties`  
**Ref:** API-TO-FRONTEND-ARCHITECTURE.md §8B Refinement Checklist

---

## 1. Audit Summary

### 1.1 Domain Layer (Boundary Refinement)

| Domain         | Contracts      | DTO Shape                    | lib/services Import |
| -------------- | -------------- | ---------------------------- | ------------------- |
| **properties** | `contracts.ts` | Explicit DTOs + `mappers.ts` | None                |

**Findings:**

- ✅ No compatibility imports from `lib/services/*` — domain is canonical and legacy properties service/repository wrappers are removed
- ✅ **Explicit DTO mappers:** `mappers.ts` maps Prisma results to `PropertyDocumentDto`, `PropertyAttachmentDto`, `PropertyCreateResultDto`; contracts use domain-owned types with serialized date fields (ISO strings)
- ✅ **Browser facade:** `lib/properties-client.ts` uses domain contracts; no client-side DTO repair

### 1.2 API Layer

| Slice          | Routes                                                                                                                                                                                                                                                             | Domain Delegation   | Tests                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| **properties** | `GET/POST /api/properties`, `GET/PATCH/DELETE /api/properties/[id]`, `GET /api/properties/my-listings`, `GET /api/properties/[id]/similar`, `GET/POST/PATCH/DELETE /api/properties/[id]/documents/**`, `GET/POST/PATCH/DELETE /api/properties/[id]/attachments/**` | `propertiesService` | `route.test.ts`, `property-id.route.test.ts`, `my-listings.route.test.ts`, `property-documents.route.test.ts` |

**Findings:**

- ✅ Routes are thin HTTP adapters delegating to domain services
- ✅ Route tests exist
- ✅ `lib/links.ts` has `properties`, `propertyDetail`, `propertyMyListings`, `propertySimilar`, document and attachment routes

### 1.3 UI Layer (Current State)

| Slice                 | Pages                                                     | Components                                                      | Notes                                              |
| --------------------- | --------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| **public properties** | `app/properties/page.tsx`, `app/properties/[id]/page.tsx` | `PropertySearchHero`, `PropertyGallery`                         | Server Components, 60s ISR                         |
| **settings**          | `app/professional-portal/settings/properties/page.tsx`    | `properties-settings-page-client.tsx`, `PropertyForm` (dynamic) | Tabs (properties, verification), route-aware retry |

**Findings:**

- ✅ Thin `page.tsx` → `_components/*-settings-page-client.tsx`
- ✅ `PropertyForm` loaded via `next/dynamic` with `ssr: false`
- ✅ Route-level `loading.tsx` and `error.tsx` for public and settings
- ✅ Settings page has route-aware retry via `refetchProperties()`

---

## 2. Refinement Checklist Status

### Boundary Refinement

- [x] Remove leftover client-side DTO repair logic — **Done** (removed `(attachmentsRaw as unknown as PropertyAttachment[])`; use typed `PropertyDocumentDto[]`)
- [x] Replace repository-return aliases with explicit DTO mappers — **Done** (`toPropertyDocumentDto`, `toPropertyAttachmentDto`, `toPropertyCreateResultDto`)
- [x] Remove compatibility imports from `lib/services/*` — **Done** (domain is canonical)

### UI Refinement

- [x] Split optional, heavy, or modal-only UI into route-local dynamic components — **Done** (`PropertyForm` is dynamic)
- [x] Prefer extracted route-local components for large client pages — **Done** (`PropertyListCard`, `PropertyDocumentsSection`)
- [x] Keep route-local skeletons and error surfaces aligned with layout — **Done**

### Correctness Refinement

- [x] Review hydration-sensitive rendering — **Done** (`MyPropertyListing` uses ISO strings for `createdAt`/`updatedAt`)
- [x] Replace full-page reload fallbacks with route-aware refetch — **Done** (settings page uses `refetchProperties()`)
- [x] Ensure idempotency, optimistic locking, actor propagation — **Done** (`operations.ts` enforces)

### Documentation Refinement

- [x] Update CHANGELOG.md when slice gains materially stricter boundary — **Done**
- [x] Update PROGRESS-SUMMARY.md when slice moves to refinement — **Done**
- [ ] Update ADRs when the change affects standing architectural rules — **N/A** (slice refinement only)

---

## 3. Verification

- [x] Typecheck: `pnpm -C apps/client exec tsc --noEmit`
- [x] Lint: `pnpm -C apps/client lint`
- [x] Tests: `pnpm -C apps/client test --run __tests__/api/properties __tests__/lib/domains/properties.service.test.ts __tests__/lib/properties-client-contracts.test.ts __tests__/hooks/useProperties.test.tsx`
