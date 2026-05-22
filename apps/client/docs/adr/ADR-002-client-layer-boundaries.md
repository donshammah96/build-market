# ADR-002: `apps/client` Layer Boundaries and Import Rules

## Status

Accepted

**Last Updated:** 2026-05-07 (Phase 5 — `lib/facades/<domain>/` colocation, hook colocation, lib/routes/ split, tsconfig alias enforcement)

## Context

The client app currently has overlapping responsibilities between `lib/*` and `app/lib/*`.
Older slices used `lib/services/*` as the main home for business logic, while newer slices have moved canonical logic into `app/lib/domains/*` with browser-safe facades and bridge modules under `lib/*`.

Without a clarified boundary, teams will keep re-introducing stale import direction, route-local domain logic, and confusion about whether `lib/*` or `app/lib/domains/*` owns the source of truth.

## Decision

Adopt explicit boundaries in `apps/client`:

- `app/*` — presentation adapters (routes, server actions, layouts, pages, middleware).
- `app/lib/security/*` — cross-cutting auth/authz policy and middleware collaborators.
- `app/lib/domains/*` — canonical domain services, contracts, and repositories for migrated vertical slices.
- `app/lib/infrastructure/*` — runtime adapters (SDK wrappers, database clients, validated env access). These are leaf-level modules with no dependencies inside `apps/client`. **`app/lib/infrastructure/env.ts` is the canonical boundary for all environment variable access** — see ADR-004.
- `app/lib/config/*` — domain-scoped shared constants. These modules import from `app/lib/infrastructure/env.ts` and must not read `process.env` directly.
- `lib/facades/<domain>/<name>-client.ts` — browser/client API facades for UI consumption. **This is the canonical location.** Each facade lives in a domain subdirectory alongside the hooks that consume it. Flat `lib/facades/*-client.ts` files at the root are `@deprecated` backward-compat re-export stubs.
- `lib/facades/<domain>/use<Name>.ts` — domain hooks colocated with their facade. New hooks must live in `lib/facades/<domain>/` alongside the client facade they consume, not at the `hooks/` root.
- `lib/routes/` — canonical route constants and URL helpers, split by domain: `marketplace.routes.ts`, `professional.routes.ts`, `client.routes.ts`, `admin.routes.ts`. `lib/routes/index.ts` is the barrel. `lib/links.ts` is a backward-compat re-export only.
- `lib/*` — bridge modules and facades that expose browser-safe or compatibility-safe entrypoints, but not the canonical home for new server-side business logic.

**TypeScript path alias table (enforced, see `tsconfig.json`):**

| Alias                                       | Resolves to                              | Enforced boundary     |
| ------------------------------------------- | ---------------------------------------- | --------------------- |
| `@/app/lib/domains/*` → `@/domains/*`       | Domain services, contracts, repos        | Domain layer          |
| `@/app/lib/api/*` → `@/api/*`               | HTTP adapter utilities, response helpers | Adapter layer         |
| `@/app/lib/infrastructure/*` → `@/infra/*`  | SDK wrappers, env, DB clients            | Infrastructure        |
| `@/app/lib/security/*` → `@/security/*`     | Auth/authz policy                        | Security boundary     |
| `@/app/lib/config/*` → `@/config/*`         | Domain-scoped constants                  | Config layer          |
| `@/app/lib/validation/*` → `@/validation/*` | Zod schemas                              | Validation layer      |
| `@/lib/facades/*` → `@/facades/*`           | Browser facades + colocated hooks        | Client boundary       |
| `@/lib/routes` → `@/routes`                 | Route constants barrel                   | No inline URL strings |
| `@/components/*` → `@/ui/*`                 | UI component library                     | Presentation          |

**Additional boundary rules:**

- Domain services own canonical DTO serialization for HTTP and action boundaries, especially `Date -> string` normalization.
- Domain services that gate on admin capability must receive an `AdminActor` (non-null, typed `adminRole`) rather than a bare actor object; adapter layers are responsible for constructing this actor from the resolved DB user record before domain invocation.
- Browser facades may parse envelopes and perform compatibility-safe validation, but they must not become the canonical DTO shaping layer for migrated slices.
- Route segments with material UI surface must add meaningful `loading.tsx` and `error.tsx` files instead of relying only on inline query-state placeholders.
- Heavy client-only widgets and modal-only form stacks must be evaluated for route-local `next/dynamic` extraction when that reduces route-critical JS.
- All environment variable access must go through `app/lib/infrastructure/env.ts`. Direct `process.env` reads outside that module, `next.config.ts`, and documented bootstrap-only callsites are boundary violations (see ADR-004).

**Import direction rule:**

- Presentation (`app/*`) can depend on domain, infrastructure, and config.
- Domains (`app/lib/domains/*`) can depend on infrastructure and shared packages (`@build/*`).
- Domains must not depend on presentation (`app/actions/*`, route modules).
- Infrastructure (`app/lib/infrastructure/*`) has no internal `apps/client` dependencies — it only imports from `@build/*`, Node.js built-ins, or third-party packages.
- Bridge and client facade modules under `lib/*` must not back-reference presentation internals except through explicitly sanctioned boundary shims.
- Client facades, components, and hooks must not import server-only modules directly.
- **Domain hooks must be colocated with their facade.** A hook that primarily wraps a single `*-client.ts` facade belongs in `lib/facades/<domain>/`, not at the `hooks/` root. The `hooks/` root is reserved for cross-domain, infrastructure, or purely UI hooks (e.g., `use-toast.ts`, `usePerformance.ts`).
- **Route constants must be imported from `lib/routes/` domain files**, not assembled inline in components or duplicated across modules.

**Migration note on `lib/services/*`:**

- Existing legacy `lib/services/*` modules may remain temporarily where a slice has not yet been migrated.
- New staff-level work must treat `app/lib/domains/*` as the canonical destination for server-side business logic.

## Consequences

### Positive

- Faster onboarding and clearer ownership by folder.
- Reduced duplicate utilities and less accidental coupling.
- Better testability via thin adapters and service policy boundaries.
- Validated env access catches missing variables at startup; centralizes secret inventory.

### Negative

- Refactor churn while moving existing cross-imports.
- Temporary exceptions may exist until vertical slices are completed.
- Bootstrap-only exceptions to the env rule require explicit documentation discipline.

## Migration Notes

1. Add lint guardrails (`no-restricted-imports` and `no-restricted-syntax`) to prevent new boundary violations, including direct `process.env` reads outside the canonical module.
2. Migrate one slice first (messaging authz and middleware collaborators) as the reference.
3. Use bridge modules only where they protect browser-safe consumption or compatibility, not as a second domain layer.
4. Remove legacy import exceptions after slice migrations stabilize.
5. Migrate `process.env` reads to `app/lib/infrastructure/env.ts` in priority order: domain services → routes and actions → config modules → facades (per ADR-004 migration notes).
6. **Phase 5 (complete 2026-05-07):** All domain hooks colocated to `lib/facades/<domain>/`. Flat `hooks/*.ts` files converted to `@deprecated` re-export stubs. Callsites should migrate to `@/facades/<domain>/use<Name>` imports over time.
7. **Phase 5 (complete 2026-05-07):** `lib/links.ts` split into domain route files under `lib/routes/`. Flat `lib/links.ts` converted to backward-compat barrel. New code must use `@/routes` barrel or `lib/routes/<domain>.routes.ts`.
8. **Phase 5 (complete 2026-05-07):** All flat `lib/facades/*-client.ts` files colocated to `lib/facades/<domain>/`. Flat files converted to `@deprecated` re-export stubs. New facades must be created in `lib/facades/<domain>/` from the start. Import using `@/facades/<domain>/<name>-client`.
