# ADR-003: Domain Structure and Import Direction

Status: Accepted
Owner: Client Architecture
Next review: 2026-12-03

## Status

Accepted

**Last Updated:** 2026-05-07 (Phase 2: canonical Result import; Phase 6: shared/repositories; Phase 7: TypeScript alias enforcement)

## Context

`apps/client` has grown with overlapping responsibilities across `lib/*` and `app/lib/*`.
This led to import-direction drift, duplicated business logic, and unclear ownership boundaries.

The migration work since messaging has established a repeatable pattern: canonical domain logic now lives under `app/lib/domains/*`, with thin adapters above it and browser-safe facades below it. This ADR formalizes that evolved shape.

## Decision

Adopt and enforce these direction rules:

- `app/api/*` and `app/actions/*` are adapters only.
- Domain logic lives in canonical domain modules under `app/lib/domains/*`.
- `lib/*` should not import route handlers or action modules.
- UI and hooks must not import server-only runtime modules.
- Domain services should map persistence rows into explicit serialized DTOs before those payloads cross HTTP or action boundaries.
- Browser facades should not be the canonical place where migrated slices repair server-owned DTO shape.

Preferred dependency flow:

- presentation -> domains -> infrastructure
- presentation -> shared
- domains -> shared
- browser consumers -> `lib/facades/<domain>/*-client` facades -> API routes
- browser consumers -> `lib/facades/<domain>/use<Domain>` hooks -> facades -> API routes

### Staff-Level Example: Projects Vertical

The projects slice is the clearest end-to-end example of the intended flow because it includes shared routes, professional-portal compatibility aliases, a canonical domain service, a repository, and browser-facing client facades.

Allowed flow:

```text
React hook or component
  -> lib/projects-client.ts
  -> /api/projects/**
  -> app/lib/domains/projects/service.ts
  -> app/lib/domains/projects/repository.ts
  -> @build/db
```

Route and action examples:

- `app/api/projects/**` and the aliased `app/api/professional-portal/projects/**` handlers stay transport-only.
- They may perform auth extraction, rate limiting, validation, optimistic-lock and idempotency header handling, and HTTP mapping.
- They should delegate project read, mutation, milestone, document, image, and escrow rules to `app/lib/domains/projects/service.ts`.

Domain examples:

- `app/lib/domains/projects/service.ts` owns participant and owner policy checks, optimistic-lock conflict handling, and project-specific business transitions.
- `app/lib/domains/projects/repository.ts` owns Prisma reads and writes only.

Browser-consumer examples:

- hooks and components consume `lib/projects-client.ts` or the canonical domain-backed client facade under `app/lib/domains/projects/client/**` through browser-safe entrypoints.
- browser code must not import `app/lib/domains/projects/service.ts` directly.

Disallowed shortcuts:

```text
component or hook -> app/lib/domains/projects/service.ts
app/api/projects/** -> @build/db for project business logic
repository -> route handler or server action module
hooks/useSomething.ts -> importing a domain-specific facade (must be colocated in lib/facades/<domain>/)
```

What this example proves:

- presentation stays thin
- the domain is the canonical source of truth
- persistence is isolated behind the repository
- browser consumers reach server behavior through facades and API routes, not server-only imports

## Constraints

- API routes should not directly import Prisma (`@build/db`) for domain behavior.
- Domain services should own policy checks and core business rules.
- Request/response validation should be centralized in domain contracts.
- Domains should prefer structured `Result<T, DomainError>` outcomes for expected control flow so adapters can map HTTP or action failures explicitly.
- **`Result<T, E>` must be imported from `@/app/lib/errors/result`.** Local redefinitions of `DomainResult<T>`, `ServiceResult<T>`, or custom `{ success: boolean }` shapes are boundary violations. The canonical discriminant is `ok` (not `success`).
- **Cross-domain repositories** that are consumed by more than one domain service (e.g., a `NotificationRepository` used by leads, projects, and stores) must live in `app/lib/domains/shared/repositories/` and be explicitly named as shared infrastructure. They must not be duplicated per-domain.
- Authorization-sensitive services should prefer full actor context over bare user IDs.
- Route-level resilience is part of the presentation contract: meaningful route segments should ship with `loading.tsx` and `error.tsx`, and heavy optional client-only UI should be considered for route-local `next/dynamic` splits.

## Migration Notes

1. Messaging is the first vertical slice and acts as the reference pattern.
2. Boundary lint rules are required before and during migration.
3. Remaining high-leak domains (stores, properties, projects, portfolio, CRM, user-profile) follow the same pattern.
4. `lib/services/*` remains legacy or compatibility-oriented where still present; new domain ownership should land under `app/lib/domains/*`.
5. Once a slice is migrated, run a refinement pass for DTO serialization ownership, bundle review, hydration risk, and route-segment resilience before treating the slice as stable.

## TypeScript Alias Enforcement (Phase 7)

Path aliases in `tsconfig.json` are a machine-verifiable enforcement layer for import direction. The following aliases are canonical:

| Alias                     | Resolves to                             | Enforces               |
| ------------------------- | --------------------------------------- | ---------------------- |
| `@/app/lib/domains/*`     | Domain services, contracts, repos       | Domain boundary        |
| `@/lib/facades/*`         | Browser-facing facade + colocated hooks | Client boundary        |
| `@/lib/routes/*`          | Route constants by domain               | No inline URL strings  |
| `@/app/lib/errors/result` | Canonical `Result<T,E>`                 | No local redefinitions |

Adding a new alias requires a corresponding `no-restricted-imports` rule for the module it guards, reviewed in the same PR.

## shared/repositories/ (Phase 6)

When a repository is consumed by more than one domain service:

1. Move it to `app/lib/domains/shared/repositories/<name>.repository.ts`
2. Update all import sites to `@/app/lib/domains/shared/repositories/<name>.repository`
3. Add the repository to `lib/services/*-operations.service.ts` bridge modules if they currently re-export it
4. Document the shared status in a comment at the top of the repository file: `// Shared repository: consumed by [domain-a], [domain-b]`
