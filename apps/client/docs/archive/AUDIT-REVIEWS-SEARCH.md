# Staff-Level Audit: Reviews and Search

**Date:** 2026-03-15  
**Scope:** `app/lib/domains/reviews`, `app/lib/domains/search`  
**Ref:** API-TO-FRONTEND-ARCHITECTURE.md §8B Refinement Checklist

---

## 1. Audit Summary

### 1.1 Reviews Domain

| Aspect           | Status         | Notes                                                                                   |
| ---------------- | -------------- | --------------------------------------------------------------------------------------- |
| **Contracts**    | Explicit DTOs  | `ReviewListItemDto`, `ReviewsResultDto` in `contracts.ts`                               |
| **Repository**   | Inline mappers | Maps Prisma to DTOs in `repository.ts` (lines 84–112)                                   |
| **API**          | Thin adapter   | `GET /api/reviews` in `route.ts`                                                        |
| **Client**       | Parallel types | `reviews-client.ts` defines `ReviewListItem`, `ReviewsResult`; API returns domain shape |
| **lib/services** | None           | No compatibility imports                                                                |

### 1.2 Search Domain

| Aspect           | Status         | Notes                                                             |
| ---------------- | -------------- | ----------------------------------------------------------------- |
| **Contracts**    | Explicit DTOs  | `SearchProfessionalResultDto` in `contracts.ts`                   |
| **Repository**   | Mapper applied | Uses `select` and `toSearchProfessionalResultDto` in `mappers.ts` |
| **API**          | New route      | `GET /api/search/professionals?q=...` — public, rate-limited      |
| **Client**       | New facade     | `lib/search-client.ts` — `searchProfessionals(query)`             |
| **Hook**         | New            | `hooks/useSearchProfessionals.ts` — TanStack Query                |
| **lib/services** | None           | No compatibility imports                                          |

---

## 2. Refinement Checklist Status

### Reviews

| Item                                    | Status                                                       |
| --------------------------------------- | ------------------------------------------------------------ |
| Remove client-side DTO repair           | N/A — no repair logic                                        |
| Replace repository aliases with mappers | Done — repository maps inline to explicit DTOs               |
| Remove lib/services imports             | Done — none                                                  |
| Split heavy/modal UI                    | N/A — no modals                                              |
| Extract route-local components          | Done — `ReviewListCard`, `ReviewsSkeleton` in `_components/` |
| Route loading/error aligned             | Done — `loading.tsx`, `error.tsx`                            |
| Hydration review                        | OK — client page; `formatDistanceToNow` safe                 |
| Route-aware refetch                     | Done — route error boundary with `reset()`                   |
| Idempotency/actor                       | OK — GET-only; public actor                                  |
| Docs                                    | Done — CHANGELOG, PROGRESS-SUMMARY, this audit               |

### Search

| Item                                    | Status                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Replace repository aliases with mappers | Done — `mappers.ts` + repository uses `select` and mapper                                                                            |
| Remove lib/services imports             | Done — none                                                                                                                          |
| UI                                      | Done — search page at `app/(user)/search` with debounced input, results list, empty/loading/error states; `loading.tsx`, `error.tsx` |

---

## 3. Implementation Summary

### Reviews

- **`app/(user)/reviews/loading.tsx`** — Route-level skeleton (hero, controls, 6-card grid)
- **`app/(user)/reviews/error.tsx`** — Route error boundary with `reset()` and "Back to Home"
- **`app/(user)/reviews/_components/review-list-card.tsx`** — Extracted `ReviewListCard` using `ReviewListItemDto`
- **`app/(user)/reviews/_components/reviews-skeleton.tsx`** — Extracted `ReviewsSkeleton`
- **`app/(user)/reviews/page.tsx`** — Imports extracted components; inline definitions removed

### Search

- **`app/lib/domains/search/mappers.ts`** — `toSearchProfessionalResultDto(raw)` mapping Prisma `ProfessionalProfile` to `SearchProfessionalResultDto`
- **`app/lib/domains/search/repository.ts`** — Uses `select` + mapper before returning
- **`app/api/search/professionals/route.ts`** — `GET /api/search/professionals?q=...` (public, rate-limited)
- **`lib/search-client.ts`** — `searchClient.searchProfessionals(query)` returning `ApiResponse<SearchProfessionalResultDto[]>`
- **`hooks/useSearchProfessionals.ts`** — TanStack Query hook
- **`app/(user)/search/page.tsx`** — Search page with debounced input, results list, empty/loading/error states
- **`app/(user)/search/loading.tsx`** — Route loading skeleton
- **`app/(user)/search/error.tsx`** — Route error boundary
- **`lib/links.ts`** — Added `API_ROUTES.searchProfessionals`, `ROUTES.search`

---

## 4. Data Flow (Search)

```
Page (search/page.tsx)
  → useSearchProfessionals hook
    → searchClient.searchProfessionals(query)
      → GET /api/search/professionals?q=...
        → searchService.searchProfessionals
          → searchRepository.searchProfessionals
            → toSearchProfessionalResultDto (mapper)
```

---

## 5. Verification

- [ ] Typecheck: `pnpm exec tsc --noEmit` in `apps/client`
- [ ] Tests: `reviews.service.test.ts`, `reviews/route.test.ts`, `search.service.test.ts`, `search.test.ts`
- [ ] Manual: Reviews page loads; search page loads and returns professionals
