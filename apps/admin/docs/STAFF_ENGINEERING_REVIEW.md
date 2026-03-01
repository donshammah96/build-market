# Admin App Staff Engineering Review

## Executive Summary

The `apps/admin` application has a solid baseline (Next.js App Router, Clerk auth, data-heavy admin pages, reusable UI primitives), but it is currently unstable in CI and incomplete from a production-readiness perspective.

Primary blockers identified:

1. **Build fragility** due to network-coupled Google font fetch in `layout.tsx`.
2. **Workspace type package resolution issues** (`@repo/types` points to non-existent dist output in fresh environments).
3. **Incomplete productization** of several admin experiences (placeholder nav sections, no explicit error/loading boundaries, limited test coverage strategy).

This review proposes a complete implementation track with phased delivery, concrete page-level scope, and a testing pyramid appropriate for an admin control plane.

---

## Current State Assessment

### What is working well

- Route grouping and role-aware middleware are in place.
- Most core admin domains already have list and detail pages:
  - Users, Professionals, Projects, Properties, Leads, Stores, Services, Verifications, Settings, Analytics, Audit.
- UI architecture is componentized with reusable primitives and domain components.

### High-risk issues found

- **Network-dependent font loading** breaks `next build` in restricted environments.
- **Monorepo package export mismatch** causes TypeScript/module resolution failures.
- **Sidebar/navigation quality gaps** (placeholder routes like Inbox/Calendar/Search/Settings `#` links and stale branding text).
- **Operational maturity gap**: no formalized quality gates around authz behavior, table interaction flows, and server action failure modes.

---

## Proposed Complete Implementation

## 1) Platform Stability (Week 1)

### Goals
- Deterministic build in local/CI.
- Deterministic type-check in monorepo fresh clone.

### Deliverables
- Remove external Google font dependency from root layout and rely on local/system fallbacks.
- Make `@repo/types` consumable directly from source in workspace.
- Ensure Next transpiles workspace package TS in admin app.

### Done criteria
- `pnpm --filter admin build` passes from clean install with no package prebuild prerequisite.
- `pnpm --filter admin check-types` passes.

## 2) Product Completeness by Page (Weeks 1-3)

### Dashboard Foundation
- Add route-level `loading.tsx` and `error.tsx` for each high-traffic route group.
- Add empty states and retry affordances for failed server actions.

### Domain Pages (complete definition of done)
For each domain page:
- List page supports filter/search/sort/pagination.
- Detail page supports status transitions with audit trail entries.
- Permission-aware UI actions (disable/hide when role disallows).
- Bulk operations where operationally needed (e.g. approve/reject batch in verification queue).

### Specific page improvements
- **Users**: Invite flow, reset credentials action, role assignment matrix.
- **Professionals**: Verification status timeline, risk flags, escalation action.
- **Projects**: Milestone timeline and payment/risk indicators.
- **Leads**: Source attribution + SLA breach marker.
- **Stores/Services/Properties**: Moderation queue integration + standardized approve/reject reasons.
- **Verifications**: Queue triage presets, reviewer assignment, rejection reason taxonomy.
- **Settings**: Feature flags, policy controls, and notification templates.
- **Analytics/Audit**: Saved views, export capability, and anomaly indicators.

## 3) Security + Governance (Weeks 2-3)

### Goals
- Enforce least privilege end-to-end.
- Improve traceability for sensitive admin actions.

### Deliverables
- Centralized authorization utility with route + action policy map.
- Strongly typed claims parsing; no `any` in auth middleware.
- Immutable audit logging contract for all mutation actions.
- Admin action idempotency keys for high-risk actions.

## 4) Testing Strategy (Weeks 1-4)

### Unit tests (fast)
- Validation schemas and claim parsing helpers.
- Table column renderers and status mapping functions.
- Server action input guards and error normalization.

### Integration tests (service boundary)
- Server actions with mocked API responses:
  - success path, auth failure, permission denied, validation error, transient upstream failure.

### End-to-end tests (critical user journeys)
- Clerk-authenticated admin login + route protection.
- Verification queue approve/reject workflow.
- User management create/edit role workflow.
- Settings update persistence + rollback on failure.

### Recommended tools
- **Vitest + React Testing Library** for unit/integration.
- **Playwright** for E2E (headless CI profile).
- **MSW** for deterministic API mocking in component/integration tests.

### Quality gates
- Required checks in CI:
  - `lint`
  - `check-types`
  - unit/integration test suite
  - Playwright smoke flow

## 5) Engineering Best-Practice Improvements

- Introduce strict domain model boundaries (`view model` vs `API DTO` mapping).
- Add `zod` parsing at API boundaries (never trust upstream shape).
- Create reusable table composition layer for consistent pagination/filter UX.
- Standardize async states:
  - loading skeleton
  - no data
  - recoverable error with retry
  - terminal error with support path
- Add observability:
  - structured logs
  - action metrics (success/fail/latency)
  - Sentry instrumentation for client/server exceptions.
- Add ADRs for authorization, data fetching, and audit requirements.

---

## Suggested Milestone Plan

- **M1 (Hardening)**: Build/type stability + authz cleanup + critical route boundaries.
- **M2 (Core Ops)**: Users, Professionals, Verifications full workflows.
- **M3 (Governance + Insights)**: Audit/analytics maturity + exports + anomaly detection.
- **M4 (Scale + DX)**: test coverage target >70% on critical domains, CI parallelization, performance budget.

---

## Immediate Next Actions (this sprint)

1. Land build/type stability changes (font + workspace types).
2. Replace placeholder sidebar items with actual route map and remove dead links.
3. Add route-level `loading.tsx`/`error.tsx` for dashboard domains.
4. Stand up baseline Vitest + Playwright pipeline with two smoke flows.
5. Draft authorization policy map and implement in middleware + server actions.
