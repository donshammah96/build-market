# Architecture Compliance Plan

## `apps/client` — All Domains, Adapters, and Browser Facades

**Authority:** `.agent/API-TO-FRONTEND-ARCHITECTURE.md` (updated 2026-05-08) and ADRs 001–009  
**Reference implementation:** `app/lib/domains/properties/` + `app/api/properties/`  
**Verification baseline required before any phase:** `pnpm run client:report-security-drift:strict` → 0, `pnpm run client:tsc-noemit` → exit 0  
**Completion criterion per phase:** all stated checks green, CHANGELOG entry written, PROGRESS-SUMMARY updated in the same commit

---

## How to Use This Document

This plan is sequenced by risk tier and dependency order. Each phase is self-contained: it states exactly what files to touch, which rubric checks to satisfy, and what verification commands to run. A phase is not complete until verification passes — not when the code changes are written.

**Rubric key** (from Section 14.1 of the architecture guide):

| Layer | Checks | Scope                                                                                       |
| ----- | ------ | ------------------------------------------------------------------------------------------- |
| A     | A1–A7  | Domain: contracts, service, repository, index, Result usage, DTO dates, ADR-006 annotations |
| B     | B1–B12 | API route adapters                                                                          |
| C     | C1–C6  | Server actions                                                                              |
| D     | D1–D3  | Browser client facades                                                                      |
| E     | E1–E5  | React Query hooks                                                                           |
| F     | F1–F9  | Tests                                                                                       |
| G     | G1–G4  | Observability                                                                               |

**New checks added by the 2026-05-08 architecture doc update** (all now fully integrated into the drift script):

| ID  | Check                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A8  | `mappers.ts` exists and owns all `Decimal→number` and `Date→string` normalization; service calls mapper functions before returning DTOs                    |
| A9  | `operations.ts` exists for any domain with complex Prisma input builders (>~30 lines of field mapping); builders are not inline in the service             |
| A10 | `index.ts` exports contracts, service singleton, repository singleton only — no mapper or operations internals                                             |
| B13 | `shared.ts` exists for any route family with ≥2 handlers; owns `logRouteOutcome`, `domainErrorCodeToStatus`, client-safe message table, `conflictResponse` |
| B14 | `now()` from `shared.ts` used for all timing — not `Date.now()` inline in handlers                                                                         |
| B15 | `safeIdempotencyComplete()` from `idempotency-helpers.ts` used at all idempotency completion call sites (or inline try-catch with identical contract)      |
| B16 | `result.data.ok` used as the domain result discriminant — not `result.data.success` (which is `undefined` on `Result<T,E>`)                                |
| B17 | Idempotency key generation uses Class C/D summary fields only — no full body spread, no Class B field values in key derivation input                       |
| B18 | `getClientLogger()` called inside the handler function body — never at module level                                                                        |

---

## Current State Snapshot

From the Section 14.3 audit registry (PROGRESS-SUMMARY.md as of 2026-04-22):

| Slice                     | Tier | Overall               | New checks (A8–B18)             |
| ------------------------- | ---- | --------------------- | ------------------------------- |
| finance                   | T1   | ✅                    | Unaudited                       |
| user-rights               | T1   | ✅ (Tests ⚠️, Obs ⚠️) | Unaudited                       |
| professional-verification | T2   | ✅ (Obs ⚠️)           | Unaudited                       |
| onboarding                | T2   | ✅                    | Unaudited                       |
| messaging                 | T2   | ✅ (Obs ⚠️)           | Unaudited                       |
| properties                | T3   | ✅                    | **Reference — fully compliant** |
| projects                  | T3   | ✅                    | Unaudited                       |
| professionals             | T3   | ✅ (Obs ⚠️)           | Unaudited                       |
| portfolio                 | T3   | ✅ (Obs ⚠️)           | Unaudited                       |
| user-profile              | T3   | ✅                    | Unaudited                       |
| crm                       | T3   | ✅                    | Unaudited                       |
| idea-books                | T3   | ✅ (Obs ⚠️)           | Unaudited                       |
| documents/licenses/certs  | T3   | ✅ (Obs ⚠️)           | Unaudited                       |
| reviews/search            | T3   | ✅ (Obs ⚠️)           | Unaudited                       |
| client-dashboard          | T3   | ✅ (Obs ⚠️)           | Unaudited                       |
| calendar                  | T3   | ✅ (Obs ⚠️)           | Unaudited                       |
| notifications             | T3   | ⚠️ (all layers)       | Unaudited                       |
| seller-insights           | T3   | ⚠️ (all layers)       | Unaudited                       |

Properties is the baseline. Every other slice is measured against it.

---

## Phase 0 — Tooling: Extend Drift Script for New Checks

**Priority: Do this first.** The new checks (A8–B18) are currently manual-review-only. Automating them makes every subsequent phase's verification meaningful and prevents regressions after this pass closes.

**Implementation delivered:** `drift-checks-phase0.mjs` (in this same deliverable set).

**Checks implemented:**

| New drift category             | What it scans for                                                                                                         | Check ID |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| `resultDiscriminantDrift`      | `result.data.success` or `domainResult.success` used as discriminant in `app/api/**` and `app/actions/**` — must be `.ok` | B16      |
| `inlineLoggerAtModuleLevel`    | `const logger = getClientLogger()` at module scope (depth 0) in `app/api/**`                                              | B18      |
| `missingSharedTs`              | Directory under `app/api/**` with ≥2 route files but no `shared.ts`                                                       | B13      |
| `idempotencyKeyBodySpread`     | `IdempotencyService.generateKey()` third-arg spread or raw `body`/`updateData` variable                                   | B17      |
| `inlineDateNow`                | `Date.now()` in a handler file that already imports `now()` from `shared.ts`                                              | B14      |
| `mapperInfraImport`            | `mappers.ts` importing from `app/lib/infrastructure/**`, `app/api/**`, or `app/actions/**`                                | A8       |
| `safeIdempotencyCompleteDrift` | `IdempotencyService.complete()` calls without immediate try-catch or not using `safeIdempotencyComplete()`                | B15      |
| `mapperNormalizationDrift`     | `Decimal` or `Date` normalization (`.toNumber()`, `.toISOString()`) leaked into `service.ts`/`repository.ts`              | A8       |
| `operationsBuilderDrift`       | Inline Prisma builder inputs in `service.ts` >~30 lines long                                                              | A9       |
| `indexExportDrift`             | `index.ts` exporting internal `mappers` or `operations`                                                                   | A10      |

**Integration steps:**

```bash
# 1. Copy the patch module into the scripts directory
cp drift-checks-phase0.mjs apps/client/scripts/

# 2. Create empty exception files (add entries after calibration)
echo "[]" > apps/client/scripts/drift-exceptions-result-discriminant.json
echo "[]" > apps/client/scripts/drift-exceptions-inline-logger.json
echo "[]" > apps/client/scripts/drift-exceptions-idempotency-key-spread.json
echo "[]" > apps/client/scripts/drift-exceptions-inline-date-now.json
echo "[]" > apps/client/scripts/drift-exceptions-mapper-infra-import.json
echo "[]" > apps/client/scripts/drift-exceptions-safe-idempotency-complete.json
echo "[]" > apps/client/scripts/drift-exceptions-mapper-normalization.json
echo "[]" > apps/client/scripts/drift-exceptions-operations-builder.json
echo "[]" > apps/client/scripts/drift-exceptions-index-export.json

# 3. Preview findings BEFORE wiring as blocking — review all output
APP_ROOT=$(pwd)/apps/client node apps/client/scripts/drift-checks-phase0.mjs

# 4. Add to report-security-drift.mjs (see integration comment at top of the patch file)

# 5. After integration, confirm the strict run still exits 0
#    (or exits non-zero only on real violations — fix those before enabling as blocking)
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

**Calibration rule:** If `missingSharedTs` reports findings on single-file route families (routes with only one handler that happen to live in a directory with a sub-route), add the directory to an inline exception array in `collectMissingSharedTs`. Review each finding manually before treating it as blocking.

**CHANGELOG:** `Added` — ten new drift categories for 2026-05-08 architecture alignment checks.

---

## Phase 1 — Tier 1: Finance and User-Rights Remaining Gaps

These are the highest-risk slices. Their open items are tests (user-rights) and observability annotations. The new A8–B18 checks must also be audited here first since these slices handle financial mutations and identity destruction.

### 1.1 Finance

**Open from existing rubric:** G (observability annotations incomplete)  
**New checks to audit:** A8, A9, A10, B13–B18

**Read:**

- `app/lib/domains/finance/contracts.ts` — check A1, A6, A7, A8
- `app/lib/domains/finance/service.ts` — check A2, A5, A8, A9
- `app/lib/domains/finance/repository.ts` — check A3
- `app/lib/domains/finance/index.ts` — check A4, A10
- `app/api/professional-portal/finance/**` — check B1–B18
- `app/actions/finance.ts` — check C1–C6

**Expected findings to address:**

1. `operationName` inventory: add to `contracts.ts` as a JSDoc block documenting all stable operation names (G1).
2. Audit for `Date.now()` inline in route handlers → replace with `now()` from a `shared.ts` (B14). If `shared.ts` doesn't exist for the finance route family, create it (B13).
3. Audit idempotency key generation for body-spread violations (B17).
4. Confirm `result.data.ok` discriminant used throughout (B16).
5. Confirm `safeIdempotencyComplete()` used or inline try-catch matches the contract (B15).
6. Confirm mappers.ts exists and owns all `Decimal→number`/`Date→string` normalization for finance DTOs (A8).

**Verification:**

```bash
pnpm -C apps/client exec vitest run __tests__/actions/finance.test.ts __tests__/api/professional-portal/finance-routes.test.ts __tests__/lib/domains/finance.service.test.ts --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

### 1.2 User-Rights

**Open from existing rubric:** Tests (F — ⚠️), Observability (G — ⚠️)  
**New checks to audit:** A8–B18

**Read:**

- `app/api/user/export/route.ts`, `deletion/route.ts`, `rectification/route.ts`
- `app/lib/domains/user-profile/compliance.ts` (owns user-rights domain logic)

**Expected findings to address:**

1. Add missing policy tests for `user-rights` operations (F1–F3).
2. Add `operationName` inventory annotation (G1).
3. Audit and fix any `Date.now()` inline → `now()` (B14).
4. Confirm `result.data.ok` discriminant (B16).

**Verification:**

```bash
pnpm -C apps/client exec vitest run __tests__/policy/user-rights/ __tests__/api/user/ --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

**CHANGELOG entry:** `Security`, `Fixed`

---

## Phase 2 — Tier 2: Professional-Verification, Messaging

Both slices have observability annotations outstanding. Professional-verification also needs new-check audit for mapper layer and shared.ts pattern.

### 2.1 Professional-Verification (documents, licenses, certificates)

**Open from existing rubric:** G (observability ⚠️)  
**New checks to audit:** A8–B18

**Read:**

- `app/lib/domains/documents/`, `licenses/`, `certificates/` — all five layer files each
- `app/api/professional-portal/documents/**`, `licenses/**`, `certificates/**`

**Expected findings to address:**

1. `operationName` inventory in each domain's contracts file (G1).
2. Confirm or create `shared.ts` for each route family; if a family has ≥2 handlers, `shared.ts` is mandatory (B13).
3. Audit `Date.now()` → `now()` (B14).
4. Audit mappers: confirm `documents/mappers.ts`, `licenses/mappers.ts`, `certificates/mappers.ts` exist and own all normalization (A8).
5. Confirm idempotency key generation uses only Class C/D summaries (B17).

**Verification:**

```bash
pnpm -C apps/client exec vitest run __tests__/api/professional-portal/documents.route.test.ts __tests__/api/professional-portal/certificates.route.test.ts __tests__/api/professional-portal/licenses.route.test.ts --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

### 2.2 Messaging

**Open from existing rubric:** G (observability ⚠️)  
**New checks to audit:** A8–B18

**Read:**

- `app/lib/domains/messaging/contracts.ts`, `service.ts`, `repository.ts`
- `app/api/messaging/**`

**Expected findings to address:**

1. `operationName` inventory annotation (G1).
2. Confirm `shared.ts` exists for the messaging route family (B13).
3. Confirm `result.data.ok` discriminant throughout (B16).
4. Confirm no `Date.now()` inline in handlers (B14).

**Verification:**

```bash
pnpm -C apps/client exec vitest run __tests__/api/messaging/route-auth-mapping.test.ts --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

**CHANGELOG entry:** `Security`, `Docs`

---

## Phase 3 — Tier 3 Sweep A: Projects, Professionals, Portfolio, User-Profile, CRM

These slices are marked overall ✅ in the existing rubric but have not been audited against the new A8–B18 checks. This phase is a read-first audit followed by targeted fixes.

**For each slice, the audit sequence is:**

1. Read `contracts.ts` → check A1, A6, A7, A8 (mapper exists?)
2. Read `service.ts` → check A2, A5, A8 (mapper called before return?), A9 (operations.ts if needed?)
3. Read `repository.ts` → check A3
4. Read `index.ts` → check A4, A10
5. Read each route handler → check B1–B12, B13–B18
6. Read facade → check D1–D3
7. Read hooks → check E1–E5
8. Read tests → check F1–F9

**Assign pass/fail per check. Fix all failures before closing the phase.**

### 3.1 Projects

**Files:**

- `app/lib/domains/projects/` — all layer files
- `app/api/projects/**`, `app/api/professional-portal/projects/**`
- `lib/projects-client.ts`, `hooks/useProjects.ts`

**Likely findings based on known history:**

- `operationName` inventory may be partially documented (G1 — verify)
- Confirm `mappers.ts` exists and is called from service (A8)
- Confirm `operations.ts` appropriately scoped (A9)
- Confirm `shared.ts` for route families (B13)

### 3.2 Professionals

**Files:**

- `app/lib/domains/professionals/` — all layer files
- `app/api/professionals/**`
- `lib/professionals-client.ts`, `hooks/useProfessionals.ts`

**Likely findings:**

- `operationName` inventory incomplete in contracts (G1 — known ⚠️)
- Audit mapper layer (A8)

### 3.3 Portfolio

**Files:**

- `app/lib/domains/portfolio/` — all layer files
- `app/api/professional-portal/portfolio/**`
- `lib/portfolio-client.ts`, hooks

**Likely findings:**

- `operationName` inventory incomplete (G1 — known ⚠️)
- Audit mapper layer (A8)

### 3.4 User-Profile

**Files:**

- `app/lib/domains/user-profile/` — all layer files (profile, onboarding, compliance, completion, remediation)
- `app/api/user/**`
- `lib/user-profile-client.ts`, hooks

**Likely findings:**

- All major rubric checks known-green; focus on A8–B18 new checks

### 3.5 CRM (leads, inquiries, pipeline)

**Files:**

- `app/lib/domains/leads/`, `inquiries/`, `pipeline/` — all layer files
- `app/api/leads/**`, `app/api/professional-portal/inquiries/**`, `app/api/professional-portal/pipeline/**`
- `lib/leads-client.ts`, etc.

**Likely findings:**

- All major rubric checks known-green; focus on A8–B18 new checks

**Verification for the whole Phase 3 block:**

```bash
pnpm -C apps/client exec vitest run __tests__/api/projects/ __tests__/api/professionals/ __tests__/api/professional-portal/portfolio* __tests__/api/user/ __tests__/api/leads/ __tests__/api/inquiries/ __tests__/api/pipeline/ --maxWorkers=1
pnpm -C apps/client exec vitest run __tests__/policy/projects/ __tests__/policy/professionals/ __tests__/policy/portfolio/ __tests__/policy/user-rights/ --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

**CHANGELOG entry:** `Fixed`, `Docs` (one entry per slice that has actual code changes)

---

## Phase 4 — Tier 3 Sweep B: Idea-Books, Documents/Licenses/Certificates, Reviews/Search, Client-Dashboard, Calendar

Same audit-first approach as Phase 3. These slices are all ✅ in the existing rubric except observability.

### 4.1 Idea-Books

**Files:**

- `app/lib/domains/idea-books/` — all layer files
- `app/api/idea-books/**`
- `lib/idea-books-client.ts`, `hooks/useIdeaBooks.ts`

**Known outstanding:** G1 (operationName inventory added in R10 sweep — verify completeness)

### 4.2 Documents / Licenses / Certificates (domain layer audit only)

Route adapters covered in Phase 2. This phase focuses on domain completeness.

**Files:**

- `app/lib/domains/documents/`, `licenses/`, `certificates/` — contracts, service, repository, index

**Checks:** A1–A10

### 4.3 Reviews / Search

**Files:**

- `app/lib/domains/reviews/`, `search/` — all layer files
- `app/api/reviews/`, `app/api/search/`
- `lib/search-client.ts`, hooks

### 4.4 Client-Dashboard

**Files:**

- `app/lib/domains/client-dashboard/` — all layer files
- `app/api/client/dashboard/route.ts`
- `lib/dashboard-client.ts`, hooks

### 4.5 Calendar

**Files:**

- `app/lib/domains/calendar/` — all layer files
- `app/api/professional-portal/calendar/**`
- `lib/calendar-client.ts`, `hooks/useCalendar.ts`

**Known outstanding:** G1 (operationName inventory added in R10 sweep — verify completeness)

**Verification for Phase 4 block:**

```bash
pnpm -C apps/client exec vitest run __tests__/api/idea-books/ __tests__/api/reviews/ __tests__/api/search/ __tests__/api/client/ __tests__/api/professional-portal/calendar* --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

---

## Phase 5 — Notifications and Seller-Insights: Full Compliance Pass

These are the only slices still marked ⚠️ overall. They require a complete read-pass and targeted remediation.

### 5.1 Notifications

**Status:** Domain ⚠️, Adapters ⚠️, Tests ⚠️, Observability ⚠️

**Files to read and audit against full A1–G4 + A8–B18:**

- `app/lib/domains/notifications/contracts.ts`, `service.ts`, `repository.ts`, `index.ts`
- `app/api/notifications/route.ts`, `app/api/notifications/[id]/route.ts`
- `lib/notifications-client.ts`, `hooks/useNotifications.ts` (if exists)

**Expected work items:**

1. Domain: confirm `contracts.ts` has explicit actor type, `PropertyResult<T>`-style alias, no raw `Date` in DTOs (A1, A5, A6).
2. Domain: confirm or create `mappers.ts` (A8).
3. Domain: confirm `service.ts` has no HTTP/response imports (A2).
4. Domain: confirm `index.ts` exports only public surface (A4, A10).
5. Adapters: confirm `shared.ts` exists for the notifications route family (B13).
6. Adapters: confirm `withAuth` on all authenticated handlers (B2).
7. Adapters: confirm actor-scoped rate limiting (B5).
8. Adapters: confirm `apiError()` uses static strings from message table (B6).
9. Adapters: confirm structured log event emitted per request (B7).
10. Adapters: confirm `safeIdempotencyComplete()` or correct inline try-catch (B8, B15).
11. Adapters: confirm `result.data.ok` discriminant (B16).
12. Tests: add policy matrix covering owner/non-owner/admin for each sensitive operation (F1–F3).
13. Tests: add route tests for validation failure path returning 400 not 500 (F5).
14. Tests: `AuthContext` mock fidelity check — no `userEmail` field (F6).
15. Observability: `operationName` inventory in contracts file (G1).
16. Observability: no `console.log` in adapters (G2).
17. Observability: no PII in log events (G3).

**Verification:**

```bash
pnpm -C apps/client exec vitest run __tests__/api/notifications/ __tests__/policy/notifications/ --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

### 5.2 Seller-Insights

**Status:** Domain ⚠️, Adapters ⚠️, Tests ⚠️, Observability ⚠️

**Files to read and audit against full A1–G4 + A8–B18:**

- `app/lib/domains/seller-insights/contracts.ts`, `service.ts`, `repository.ts`, `index.ts`
- `app/api/professional-portal/inventory/alerts/route.ts`
- `app/api/professional-portal/orders/route.ts`
- `app/api/professional-portal/products/top/route.ts`
- `lib/inventory-client.ts`, `lib/orders-client.ts`, `lib/products-client.ts`
- `hooks/useDashboardData.ts` (seller-insights consumer)

**Expected work items** (mirror of notifications but for seller-insights):
1–17: Same audit categories as notifications. The route family consists of three separate read-only adapters — confirm `shared.ts` covers all three (B13).

Additional seller-insights specific:

- Confirm `SellerInventoryAlert`, `SellerOrderListResult`, `SellerTopProduct` are fully normalized DTOs with `string` dates and `number` decimals (A6, A8).
- Confirm no Prisma types leak through to browser facades (D3).

**Verification:**

```bash
pnpm -C apps/client exec vitest run __tests__/api/professional-portal/seller-insights-adapters.route.test.ts __tests__/policy/seller-insights/ --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

**CHANGELOG entry:** `Fixed`, `Security`, `Added` (new tests)

---

## Phase 6 — Browser Facades and Hooks: Full Surface Audit

Phases 1–5 focus on domain + adapter layers. This phase audits the browser-facing layer independently, since facade drift is structurally hidden from server-side tests.

### Audit target: every `lib/*-client.ts` and `hooks/use*.ts`

**For each facade file, check D1–D3:**

| Check | What to verify                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------- |
| D1    | Imports only `fetch` or `apiFetch` against `/api/...`; no `app/lib/domains/**` or `app/actions/**`             |
| D2    | Return type is `Promise<ApiResponse<ExplicitDtoType>>` with an explicit generic — not `ReturnType<>` inference |
| D3    | DTO interface has `string` date fields (not `Date`) and `number` decimal fields (not `Decimal`)                |

**For each hook file, check E1–E5:**

| Check | What to verify                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------- |
| E1    | Uses React Query (`useQuery`, `useMutation`) for all server state — no `useState` + `useEffect` + `fetch`        |
| E2    | `unwrapApiResponse()` called in hook body — not scattered across component callbacks                             |
| E3    | Query keys use a factory function or stable array literal — not inline ad-hoc strings                            |
| E4    | Mutation `onSuccess` invalidates detail + list keys; calls `options?.onSuccess?.(data, variables, context)` last |
| E5    | `onSuccess(data, variables, context)` — three arguments only; no fourth `mutation` argument                      |

**Priority order** (highest-risk facades first):

1. `lib/properties-client.ts` (reference — verify, don't change unless broken)
2. `lib/messaging-client.ts`
3. `lib/projects-client.ts`
4. `lib/user-profile-client.ts`
5. `lib/idea-books-client.ts`
6. `lib/calendar-client.ts`
7. `lib/notifications-client.ts`
8. `lib/inventory-client.ts`, `orders-client.ts`, `products-client.ts`
9. All remaining facades

**Verification:**

```bash
pnpm -C apps/client exec vitest run __tests__/lib/ --maxWorkers=1
pnpm run client:tsc-noemit
```

**CHANGELOG entry:** `Fixed` per facade that has actual changes.

---

## Phase 7 — Test Coverage Completeness Pass

This phase closes all remaining F-layer gaps across slices that have code changes from Phases 1–6 but incomplete test coverage.

### 7.1 Policy matrix completeness

Every domain with actor-sensitive operations must have `__tests__/policy/<domain>/` coverage. Run the check:

```bash
# List domains that have policy-sensitive operations but no policy test directory
ls app/lib/domains/ | while read d; do
  if [ ! -d "__tests__/policy/$d" ]; then
    echo "MISSING: __tests__/policy/$d"
  fi
done
```

For each missing directory: create the policy test file with the full matrix (F1–F3):

- Owner access → `expectOk`
- Non-owner same-role → `expectNotFound` (not `expectForbidden` unless documented)
- Cross-role non-participant → `expectNotFound`
- Admin override → `expectOk`
- Non-admin elevated role → `expectNotFound` or `expectForbidden`

### 7.2 Repository contract test completeness

Every domain must have `__tests__/contracts/<domain>/` with:

- `deletedAt: null` guard on every `findFirst`/`findMany` (F4)
- `version: { increment: 1 }` on optimistic-lock writes (F4)

### 7.3 Route test correctness sweep

For every route test file, verify (F5–F9):

- Validation failure path returns 400 with structured log (F5)
- `AuthContext` mock typed as `AuthContext` — no `userEmail` (F6)
- Error assertions use static strings — not domain message text (F7)
- Domain service call assertions include `clerkId` when forwarded (F8)
- `IdempotencyService.complete()` throw case tested (F9)

**Verification:**

```bash
pnpm -C apps/client exec vitest run __tests__/policy/ __tests__/contracts/ --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

---

## Phase 8 — Observability Annotation Completeness

This is the final sweep. Every slice with `⚠️` observability status in the audit registry needs `operationName` inventory documented.

### Required annotation format

In the domain's `contracts.ts` or a `README.md`:

```typescript
/**
 * ADR-005 Observable Operation Names
 *
 * These operationName values are stable join keys for observability dashboards.
 * Renaming any of these requires a coordinated dashboard update and CHANGELOG entry.
 *
 * list_<resource>       — public or authenticated list query
 * get_<resource>        — single resource fetch
 * create_<resource>     — POST creation mutation
 * update_<resource>     — PATCH update mutation
 * delete_<resource>     — DELETE soft-delete mutation
 */
```

### Slices requiring annotation (all with ⚠️ observability)

- `finance` — verify R10 annotations are present and complete
- `user-rights` — add to `user-profile/compliance.ts` contracts
- `professional-verification` — documents, licenses, certificates contracts
- `messaging` — messaging contracts
- `professionals` — professionals contracts
- `portfolio` — portfolio contracts
- `idea-books` — idea-books contracts
- `reviews`, `search` — respective contracts
- `client-dashboard` — client-dashboard contracts
- `calendar` — calendar contracts
- `notifications` — notifications contracts (Phase 5 should have covered this)
- `seller-insights` — seller-insights contracts (Phase 5 should have covered this)

**Verification:**

```bash
pnpm run client:report-security-drift:strict   # G1 category must be 0
pnpm run client:tsc-noemit
```

**CHANGELOG entry:** `Docs` for each slice touched.

---

## Completion Criteria

The full plan is complete when all of the following are simultaneously true:

1. `pnpm run client:report-security-drift:strict` → exit 0, all categories 0 (including all six new categories added in Phase 0)
2. `pnpm run client:tsc-noemit` → exit 0
3. The Section 14.3 audit registry shows ✅ for every slice across all columns (no ⚠️ remaining)
4. Every domain has a `mappers.ts` that owns all `Decimal→number`/`Date→string` normalization
5. Every authenticated route family with ≥2 handlers has a `shared.ts`
6. Every domain has `operationName` inventory documented in contracts or README
7. PROGRESS-SUMMARY.md Active Phase shows this plan as Completed
8. CHANGELOG.md has an entry for every phase that changed runtime code

---

## Verification Command Reference

```bash
# Full strict drift check (must be 0)
pnpm run client:report-security-drift:strict

# Full typecheck
pnpm run client:tsc-noemit

# Targeted slice suites
pnpm -C apps/client exec vitest run __tests__/api/<slice>/ --maxWorkers=1

# All policy tests
pnpm -C apps/client exec vitest run __tests__/policy/ --maxWorkers=1

# All contract tests
pnpm -C apps/client exec vitest run __tests__/contracts/ --maxWorkers=1

# Full test suite
pnpm run client:test:all

# Critical-journey E2E (blocking CI gate)
pnpm run cypress:run --spec "cypress/e2e/critical-journeys/**"
```

---

## Risk Register

| Risk                                                                                      | Likelihood | Impact                              | Mitigation                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------- | ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New drift categories (Phase 0) produce false positives on valid code                      | Medium     | Blocks all subsequent phases        | Calibrate each new regex against properties reference before enabling as blocking                                                                                              |
| Mapper extraction (A8) for a large service breaks existing tests                          | Medium     | Phase 3–5 delay                     | Extract mappers first, keep service calling them through the same interface — tests should not observe the difference                                                          |
| `result.data.ok` fix (B16) reveals silent domain failure paths that were masked           | Low-Medium | Unexpected 500s in tests            | These are real bugs surfaced by the fix; fix the domain result handling, do not revert                                                                                         |
| Notifications/seller-insights (Phase 5) require significant new code, not just annotation | High       | Phase 5 scope larger than estimated | Read files before estimating. If either slice needs a full domain rewrite, treat it as a migration (run Section 8 Migration Playbook) and track separately in PROGRESS-SUMMARY |
| Policy tests find real IDOR gaps in existing domains                                      | Low        | Security finding                    | Treat as a security fix — block merge of the slice until the domain service correctly returns `not_found` for non-owner access                                                 |

---

## Per-Phase Completion Checklist Template

Copy this block into PROGRESS-SUMMARY.md when starting each phase:

```markdown
### Phase N — [Name]

**Status:** In progress
**Started:** YYYY-MM-DD

**Read pass:**

- [ ] All target files listed in the plan have been read
- [ ] Pass/fail assigned for every rubric check (A1–G4 + A8–B18)
- [ ] Findings list written before any code changes begin

**Code changes:**

- [ ] All ❌ findings addressed
- [ ] No unrelated changes included (scope discipline)

**Verification:**

- [ ] `pnpm run client:report-security-drift:strict` → 0 (all categories)
- [ ] `pnpm run client:tsc-noemit` → exit 0
- [ ] Targeted Vitest suite for affected slices → all pass
- [ ] CHANGELOG entry written with actual command output
- [ ] PROGRESS-SUMMARY updated (this section status → Completed)
- [ ] Section 14.3 audit registry cells updated for affected slices
```

---

## Agent Session Protocol

When an agent session begins a phase from this plan:

1. Read this plan in full to locate the active phase and its open items.
2. Read `PROGRESS-SUMMARY.md` Active Phase section for any partial work from a prior session.
3. Read CHANGELOG last 3 entries for context that may affect the phase.
4. Perform the **read pass** for all files listed in the phase before writing any code. Record findings first.
5. After each file change, run the targeted Vitest suite for that file. Do not batch all verification to the end.
6. On session end with incomplete phase: write the partial findings and remaining steps to PROGRESS-SUMMARY.md before discarding context.

**A phase is not complete until:**

- `pnpm run client:report-security-drift:strict` → exit 0, all categories including Phase 0 additions
- `pnpm run client:tsc-noemit` → exit 0
- All targeted Vitest suites for affected slices pass
- CHANGELOG entry exists with actual verification output (not planned output)
- PROGRESS-SUMMARY shows phase Completed and Section 14.3 registry is updated

**A new phase must not begin while the previous phase has an unresolved finding or unconfirmed verification result.**

---

## Document History

| Date       | Change                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-08 | Initial version. Derived from Section 14.3 audit registry, PROGRESS-SUMMARY.md (2026-04-22), and the 2026-05-08 architecture doc update. `drift-checks-phase0.mjs` delivered in the same set implementing all six Phase 0 drift categories. |
