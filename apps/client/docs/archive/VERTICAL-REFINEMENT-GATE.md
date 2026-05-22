# Vertical Refinement Gate

Last updated: 2026-03-13

This gate must be completed before starting migration work on additional vertical slices.

## Why This Gate Exists

Recent calendar refinements established a stricter post-migration quality bar:

- domain-owned DTO serialization
- thin route adapters with structured domain-result mapping
- actor-aware authorization at domain boundaries
- route-level loading and error segment resilience
- explicit browser facade contracts

This document applies that same bar to the highest-severity remaining slices.

## Priority Queue

1. Notifications
2. Idea Books
3. Seller dashboard read models (inventory, orders, products)
4. Reviews

## Severity Signals Used

- amount of route-level business logic still outside app/lib/domains
- authorization and ownership checks outside domain boundaries
- browser consumer fan-out and cache invalidation risk
- inconsistent DTO and error contract behavior

## Refinement Scope Per Slice

### Notifications

Current hotspots:

- app/api/notifications/route.ts
- app/api/notifications/[id]/route.ts
- lib/services/notifications.ts

Required refinements:

- create app/lib/domains/notifications with contracts, repository, service
- move ownership and state transition logic to domain service
- use structured Result<T, DomainError> outputs for route mapping
- align browser facade contract on explicit isRead and envelope semantics

Verification minimum:

- domain tests for user isolation and read-state transitions
- route tests for 403, 404, and list envelope mapping
- hook or client-facade test for invalidation after mark-read and delete

### Idea Books

Current hotspots:

- app/api/idea-books/route.ts
- app/api/idea-books/[id]/route.ts
- app/api/idea-books/[id]/attachments/\*\*
- lib/services/idea-books.ts

Required refinements:

- create app/lib/domains/idea-books with contracts, repository, service
- move owner and collaborator policy checks to domain layer
- split attachment lifecycle orchestration into domain-owned methods
- thin adapters to validation, resilience, and HTTP mapping only

Verification minimum:

- domain tests for owner or collaborator access and privacy rules
- route tests for attachment and idea-book error mappings
- browser consumer test for list/detail contract stability

### Seller Dashboard Read Models

Current hotspots:

- app/api/professional-portal/inventory/alerts/route.ts
- app/api/professional-portal/orders/route.ts
- app/api/professional-portal/products/top/route.ts
- lib/services/inventory.ts
- lib/services/orders.ts
- lib/services/products.ts

Required refinements:

- migrate as one coordinated wave to avoid contract fragmentation
- preferred shape: app/lib/domains/seller-insights
- unify actor boundary, error contract, and envelope semantics
- align dashboard cache keys and query invalidation behavior

Verification minimum:

- domain tests for professional scoping and summary calculations
- route tests for each endpoint with uniform error mapping
- dashboard hook test for unified consumer normalization

### Reviews

Current hotspots:

- app/api/reviews/route.ts
- lib/services/reviews.ts

Required refinements:

- create app/lib/domains/reviews for public-read DTO shaping
- keep route as thin public adapter
- add explicit public DTO contract and stable pagination semantics

Verification minimum:

- domain tests for filter and search behavior
- route test for envelope mapping and empty-state correctness

## Shared Acceptance Criteria

All refined slices must satisfy:

- no net new business logic in route adapters
- actor-aware authorization in domain methods where applicable
- explicit transport-safe DTO serialization in domain outputs
- explicit domain error mapping in adapters
- browser facade consumes normalized envelope and DTO contracts
- focused domain + adapter + consumer test coverage
- clean client typecheck before merge

## Rollout and Sequencing

1. Refine user-profile and professional-settings first (current pass)
2. Refine Notifications and Idea Books next
3. Refine Seller dashboard read models as one coordinated pass
4. Refine Reviews
5. Start new vertical migrations after this gate is green
