# ADR-ADMIN-002: Admin Action Boundary and Layer Structure

Status: Accepted
Owner: Admin Architecture
Next review: 2026-12-03

## Status

Accepted

## Context

Phase 0 found 20 action-layer files with direct Prisma access and 23 action-layer `.parse()` calls. Business logic is spread across actions, services, jobs, and GDPR modules.

## Decision

`src/actions/admin/` is the adapter layer. It owns input validation, admin actor resolution, authorization checks, domain calls, cache revalidation, and serialization-safe responses.

Admin business logic lives in `src/lib/domains/` or an explicitly migrated `src/lib/services/` module. Persistence-only Prisma access lives in repository files. Import direction is actions → services/domains → repositories; nothing imports actions.

Expected control flow uses `Result<T, AdminDomainError>`. All authenticated admin mutations use `safeAction`. Zod `.safeParse()` is mandatory in action adapters; `.parse()` is prohibited there.

## Alternatives Considered

**Inline business logic in route handlers:** Keeping logic in action files avoids the ceremony of creating a domain slice for every new feature. Rejected because it collapses testability (domain logic requires mocking the Prisma client rather than testing pure functions), makes policy enforcement ad hoc, and creates an unbounded action file size problem observed in Phase 0.

**Shared service classes (OOP style):** A `UserService` class with injected dependencies is familiar from NestJS/Spring. Rejected in favour of plain module-level functions because Next.js server actions are stateless request handlers, not long-lived services; class instances add no lifecycle benefit and add coupling through constructor signatures.

**Collocating repositories with actions:** Placing `repository.ts` next to the action files that use them (rather than inside `domains/`) was considered for simpler file lookup. Rejected because it inverts the import direction — actions import repositories directly — which collapses the domain layer and prevents domain services from composing repositories independently of the action adapter.

## Consequences

Existing action files will be migrated incrementally after Phase 2. Direct Prisma in actions remains a tracked defect until the relevant domain is migrated.

## Verification

Security drift reports action Prisma imports/calls, action `.parse()`, and unwrapped authenticated mutations. Phase 3 action-boundary tests cover authentication, authorization, recent-auth rejection, actor-scoped rate limiting, and actor forwarding. Phase 4/5 will close direct Prisma and action `.safeParse()` migration debt.

## Revision History

| Date       | Author        | Change                                                                                      |
| ---------- | ------------- | ------------------------------------------------------------------------------------------- |
| 2026-05-18 | Phase 3 impl  | Initial acceptance. Branch: `feat/admin-overhaul/auth-hardening`.                           |
| 2026-05-21 | Phase 5 impl  | Users, verification, audit domain slices fully migrated off direct Prisma in actions.       |
| 2026-06-04 | Phase 12 impl | Confirmed zero remaining direct Prisma action files; zero `.parse()` call sites in actions. |
| 2026-06-05 | Autopsy impl  | Added Alternatives Considered and Revision History (F-Doc1).                                |

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/client/docs/adr/ADR-002-client-layer-boundaries.md`
- `apps/client/docs/adr/ADR-003-domain-structure-and-import-direction.md`
