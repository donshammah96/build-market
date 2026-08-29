# Staff-Level Audit: Inquiries, Leads, Pipeline, Portfolio

**Date:** 2026-03-15  
**Scope:** `app/lib/domains/inquiries`, `app/lib/domains/leads`, `app/lib/domains/pipeline`, `app/lib/domains/portfolio`  
**Ref:** API-TO-FRONTEND-ARCHITECTURE.md §8B Refinement Checklist

---

## 1. Audit Summary

### 1.1 Inquiries

| Aspect            | Status                 | Notes                                                                                |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| **Contracts**     | Explicit DTOs          | `InquiryDetailResult` uses string for dates, clientName/clientEmail/clientPhone      |
| **Mappers**       | `inquiries/mappers.ts` | `toInquiryDetailDto` maps raw Prisma to DTO                                          |
| **Service**       | Mapper applied         | `getOwnedInquiryDetail`, `updateProfessionalInquiry` apply mapper                    |
| **Client**        | No DTO repair          | `inquiries-client.ts` passes through API response; types from domain                 |
| **loading/error** | Done                   | `inquiries/loading.tsx`, `inquiries/error.tsx`, `[id]/loading.tsx`, `[id]/error.tsx` |

### 1.2 Leads

| Aspect            | Status             | Notes                                                                                    |
| ----------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| **Contracts**     | Explicit DTOs      | `LeadListItem`, `LeadDetailResult`, etc. use string for dates, number for decimals       |
| **Mappers**       | `leads/mappers.ts` | `toLeadListItemDto`, `toLeadDetailDto`, `toPublicLeadCreateDto`, `toPublicLeadStatusDto` |
| **Service**       | Mappers applied    | All return paths apply mappers                                                           |
| **Client**        | Aligned to domain  | `leads-client.ts` uses domain DTOs; no repair                                            |
| **loading/error** | Done               | `leads/loading.tsx`, `leads/error.tsx`, `[id]/loading.tsx`, `[id]/error.tsx`             |

### 1.3 Pipeline

| Aspect            | Status        | Notes                                             |
| ----------------- | ------------- | ------------------------------------------------- |
| **Contracts**     | Explicit DTOs | `PipelineStage`, `PipelineSummary` use primitives |
| **Mappers**       | N/A           | Service builds DTOs from repository               |
| **Client**        | No repair     | `pipeline-client.ts` passes through               |
| **loading/error** | Done          | `pipeline/loading.tsx`, `pipeline/error.tsx`      |

### 1.4 Portfolio

| Aspect            | Status                 | Notes                                                                                       |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| **Contracts**     | Explicit DTOs          | `PortfolioListItemDto`, `PortfolioDetailDto`, `PortfolioListResultDto`, `PortfolioImageDto` |
| **Mappers**       | `portfolio/mappers.ts` | `toPortfolioListItemDto`, `toPortfolioDetailDto`                                            |
| **Service**       | Mappers applied        | listPortfolios, getPortfolioDetail, createPortfolio, updatePortfolio                        |
| **Client**        | No DTO repair          | `portfolio-client.ts` uses domain DTOs                                                      |
| **loading/error** | Done                   | `portfolio/loading.tsx`, `portfolio/error.tsx`, `[id]/loading.tsx`, `[id]/error.tsx`        |

---

## 2. Refinement Checklist Status

### Boundary Refinement

- [x] Remove leftover client-side DTO repair — Done (inquiries, portfolio)
- [x] Replace repository-return aliases with explicit DTO mappers — Done (inquiries, leads, portfolio)
- [x] Remove compatibility imports from `lib/services/*` — Done (none present)

### UI Refinement

- [x] Route loading/error aligned — Done for all 7 route segments

### Correctness Refinement

- [x] Hydration — Dates as ISO strings; safe
- [x] Full-page reload — No `window.location.reload()`; error uses `reset()` or `invalidateQueries`
- [x] Idempotency/actor — PATCH/DELETE use IdempotencyService; actor passed

### Documentation Refinement

- [x] CHANGELOG.md
- [x] PROGRESS-SUMMARY.md
- [x] AUDIT-CRM-PORTFOLIO.md

---

## 3. Verification

- [ ] Typecheck: `pnpm -C apps/client exec tsc --noEmit`
- [ ] Tests: inquiries, leads, pipeline, portfolio domain and route tests
- [ ] Manual: Inquiries list/detail, leads list/detail, pipeline, portfolio list/detail load; create/edit/delete flows work
