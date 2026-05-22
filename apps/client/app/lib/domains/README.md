# Domain Boundaries

`app/lib/domains/**` is the canonical business-logic layer for the client app.

Routes and server actions stay thin. They handle transport concerns such as auth context extraction, rate limiting, input validation, idempotency, resilience wrappers, cache revalidation, and HTTP/action response mapping. Domain services own business policy, actor and ownership checks, normalized result contracts, and orchestration across repositories and side effects.

Repositories stay persistence-only. They should not encode role checks, ownership policy, response shaping, or adapter concerns.

## CRM Boundary

The CRM slice is split across three domain folders:

- `leads/` for public lead submission and authenticated professional lead management
- `inquiries/` for property inquiry reads and mutations scoped by property agent ownership
- `pipeline/` for the professional sales pipeline read model derived from properties and inquiry stages

### Public vs Authenticated Semantics

`leads/service.ts` serves both anonymous and authenticated flows, but the contracts stay separate:

- Public adapters use `submitPublicLead()` and `getPublicLeadStatus()`
- Authenticated professional adapters use `listProfessionalLeads()`, `getProfessionalLeadById()`, `createProfessionalLead()`, `updateProfessionalLead()`, and `deleteProfessionalLead()`

Anonymous lead submission must not depend on authenticated actor context. Public lead status responses are sanitized and limited to submitter-safe fields.

Authenticated CRM adapters must pass role-bearing actor objects into the domain, not bare user IDs. The domain layer normalizes role checks and ownership rules:

- leads: professional or admin only for professional CRUD
- inquiries: professional or admin only, with ownership enforced through `property.agentId`
- pipeline: professional or admin only for the pipeline summary read model

### Service vs Repository Responsibilities

Service layer responsibilities:

- enforce actor and ownership policy
- map repository output into canonical `Result<T, DomainError>` responses
- shape public-safe or client-safe DTOs
- coordinate domain side effects such as CRM lead notifications

Repository responsibilities:

- execute Prisma reads and writes
- expose persistence-oriented helper methods for service composition
- avoid embedding authorization or HTTP/action semantics

### Adapter Expectations

API routes and server actions that call CRM domains should preserve these boundaries:

- routes: parse requests, run rate limits, call resilient executors, and map domain outcomes to HTTP
- server actions: use `secureAction`, validate action input, pass actor context into the domain, and keep `revalidatePath()` in the action layer

### Direct Coverage

Focused direct domain tests live in:

- `__tests__/lib/domains/leads.service.test.ts`
- `__tests__/lib/domains/inquiries.service.test.ts`
- `__tests__/lib/domains/pipeline.service.test.ts`

These tests complement the route and action suites by proving actor enforcement, ownership rules, DTO shaping, notification orchestration, empty-state handling, and aggregation math directly at the domain boundary.
