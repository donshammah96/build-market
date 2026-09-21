# Staff-Level Audit: Projects Domain

**Date:** 2026-03-15  
**Scope:** `app/lib/domains/projects`, `app/professional-portal/projects`  
**Ref:** API-TO-FRONTEND-ARCHITECTURE.md §8B Refinement Checklist

---

## 1. Audit Summary

### 1.1 Domain Layer (Boundary Refinement)

| Aspect                | Status          | Notes                                                                                                                                                              |
| --------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Contracts**         | Explicit DTOs   | `ProjectListItemDto`, `ProjectDetailDto`, `ProjectListResultDto`, `ProjectDetailResultDto`, `ProjectClientDto` — domain-owned, dates as string, decimals as number |
| **Mappers**           | Present         | `app/lib/domains/projects/mappers.ts` — `toProjectListItemDto`, `toProjectDetailDto`; `toIsoString` for dates, `toNumber` for Decimal                              |
| **Service**           | Mappers applied | `listProjects` returns `{ items, pagination }`; `getProjectDetail` returns `{ item }`; repository output mapped before return                                      |
| **Client DTO repair** | Removed         | `portal-projects-client.ts` and `generic-projects-client.ts` no longer use `normalizeProjectListPayload` / `normalizeProjectDetailPayload`                         |

**Findings:**

- Domain DTOs and mappers decouple API shape from Prisma
- Client schemas (`ProjectListResponseSchema`, `ProjectDetailResponseSchema`) aligned to domain DTOs
- Milestone and escrow sub-resources remain unmapped; follow-up refinement possible

### 1.2 API Layer

| Aspect                  | Status                                                                      |
| ----------------------- | --------------------------------------------------------------------------- |
| **List route**          | `GET /api/projects` — returns `{ items, pagination }`; service returns DTOs |
| **Detail route**        | `GET /api/projects/[id]` — returns `{ item }`; service returns DTO          |
| **Professional portal** | Re-exports from `app/api/projects`                                          |
| **Actor**               | `withAuth` passes actor to service                                          |

### 1.3 UI Layer

| Aspect               | Status                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------- |
| **List page**        | `projects-page-client.tsx` — uses `data?.items ?? []`; no `normalizeProjects()`         |
| **Detail page**      | `project-details-page-client.tsx` — uses `project?.item`; `ClientDate` for dates        |
| **Route boundaries** | `loading.tsx`, `error.tsx` for list and detail                                          |
| **Hydration**        | `ClientDate` for dates; `ClientNumber` for budget (second pass)                         |
| **List error retry** | "Try again" button calls `refetch()` (second pass)                                      |
| **Hook tests**       | `useProjects.test.tsx` — refetch, error unwrapping, mutation invalidation (second pass) |
| **Page tests**       | `projects-page-client.test.tsx`, `project-details-page-client.test.tsx` (second pass)   |

---

## 2. Refinement Checklist Status

### Boundary Refinement

- [x] Add explicit DTOs — **Done** (`ProjectListItemDto`, `ProjectDetailDto`, etc.)
- [x] Add mappers — **Done** (`mappers.ts` with `toProjectListItemDto`, `toProjectDetailDto`)
- [x] Wire service to mappers — **Done** (`listProjects`, `getProjectDetail`)
- [x] Remove client DTO repair — **Done** (portal and generic clients)
- [x] Align client types to domain DTOs — **Done** (contracts, page components)

### UI Refinement

- [x] Route boundaries — **Done** (`loading.tsx`, `error.tsx` for list and detail)
- [x] Component extraction — **Optional** (plan notes ~320–344 lines; extraction deferred)

### Correctness Refinement

- [x] Hydration safety — **Done** (`ClientDate` for dates; `ClientNumber` for budget)
- [x] Full-page reload — **Done** (list error has "Try again" calling `refetch()`)
- [x] Idempotency / actor — **Done** (PATCH, DELETE, milestone approve, escrow fund/release use `IdempotencyService`)

### Documentation Refinement

- [x] CHANGELOG.md
- [x] PROGRESS-SUMMARY.md
- [x] AUDIT-PROJECTS.md (this document)

---

## 3. Second Pass (2026-03-15)

- [x] Fix `normalizedProject` → `projectItem` bug in error guard
- [x] Add `ClientNumber` component for hydration-safe budget formatting
- [x] Add "Try again" button to list error state (calls `refetch()`)
- [x] Extend `useProjects.test.tsx` — refetch, error unwrapping, `usePortalProject` enabled=false, mutation invalidation
- [x] Add `projects-page-client.test.tsx` — loading/error/success/empty, retry button
- [x] Add `project-details-page-client.test.tsx` — loading/error/success, edit mode

## 4. Verification

- [ ] Typecheck: `pnpm -C apps/client exec tsc --noEmit`
- [ ] Hooks tests: `pnpm -C apps/client test --run __tests__/hooks/useProjects.test.tsx`
- [ ] Page tests: `pnpm -C apps/client test --run __tests__/app/professional-portal/projects/`
- [ ] Manual: Projects list/detail load; budget displays; list error shows "Try again" and refetches; no hydration warnings in console

## 5. Scope Note

Projects has many sub-resources (milestones, escrows, documents, images). This refinement focuses on **project list and detail** as the primary surface. Milestone and escrow mutations can be refined in a follow-up; the same pattern (DTOs + mappers in service, remove client repair) applies.

## 6. Third Pass – Sub-Resources Refinement (2026-03-15)

Staff-level follow-up refinement of projects sub-resources:

### Completed

| Area               | Change                                                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Milestones**     | Added `MilestoneListItemDto`, `MilestoneDetailDto`, `toMilestoneListItemDto`, `toMilestoneDetailDto`; service applies mappers for list, detail, create, update, approve; removed client `normalizeMilestoneListPayload`, `normalizeMilestoneMutationPayload` |
| **Escrows**        | Added `EscrowListItemDto`, `EscrowDetailDto`, `toEscrowListItemDto`, `toEscrowDetailDto`; service applies mappers for list, detail, fund, release, dispute; removed client `normalizeEscrowMutationPayload`                                                  |
| **Documents**      | Added `ProjectDocumentListItemDto`, `toProjectDocumentListItemDto`; service applies mappers for list, get, add                                                                                                                                               |
| **Images**         | Added `ProjectImageListItemDto`, `toProjectImageListItemDto`; service applies mappers for list, get, add                                                                                                                                                     |
| **Create project** | Repository uses `projectDetailSelect`; service applies `toProjectDetailDto` to create result                                                                                                                                                                 |
| **Update project** | Service applies `toProjectDetailDto` to update result                                                                                                                                                                                                        |

### Follow-Up Items (None remaining for sub-resources)
