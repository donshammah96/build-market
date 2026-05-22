# ADR-004: Canonical Environment Variable Access Boundary

## Status

Accepted

## Context

`apps/client` has accumulated direct `process.env` reads scattered across route handlers, domain services, config modules, and browser facades. This has three concrete failure modes:

1. **Silent runtime failures.** Missing environment variables are not caught at startup — they produce `undefined` values that propagate silently until the affected code path is hit in production.
2. **No single inventory surface.** Auditing which secrets the app uses requires grep-hunting across the codebase rather than reading one module.
3. **Test isolation cost.** Tests that need to control env values must stub `process.env` globally rather than mocking a single import boundary.

A validated env module pattern already exists in the repo (`envConfig` references appear in `copilot-instructions.md` and in several domain config files), but there is no ADR binding it to a canonical location and no lint rule enforcing it.

## Decision

Establish `apps/client/app/lib/infrastructure/env.ts` as the single canonical environment variable access boundary for `apps/client`.

### Rules

**New code** must import env config from `app/lib/infrastructure/env.ts`. Raw `process.env` access in new route handlers, domain services, config modules, or client facades is a boundary violation and must be rejected in review.

**Existing direct `process.env` reads** must be migrated in batches, prioritizing:

1. Domain services and repositories (highest risk — these are the canonical business layer).
2. Route handlers and server actions (adapter layer — catches bad values before domain calls).
3. Config modules under `app/lib/config/` (consolidated secondarily to domain and route work).
4. `lib/*-client.ts` browser facades (lowest risk for server-only vars; migrate after domain and routes are clean).

**Bootstrap-only exceptions.** Some callsites cannot use the env module because they execute before the Next.js module graph is initialized:

- `next.config.ts`
- `instrumentation.ts`
- `sentry.*.config.ts`
- `middleware.ts` (if it executes at edge runtime before module initialization)

Each exception must carry a co-located comment:

```typescript
// bootstrap-only: module graph not initialized at this callsite
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
```

Bootstrap exceptions must be listed in `app/lib/infrastructure/env.ts` as a comment block at the top of the file so the inventory remains complete even for values that cannot be validated there.

### Shape of the canonical module

`env.ts` must:

- Validate all values at module load time (e.g., using Zod or `t3-env`).
- Throw a descriptive error at startup when a required variable is missing, not at the callsite.
- Export a single `envConfig` object — no named re-exports that allow partial access.
- Distinguish `NEXT_PUBLIC_*` (client-safe) from server-only variables and export them in separate objects or with explicit safety annotations if needed.

```typescript
// app/lib/infrastructure/env.ts — illustrative shape
import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  // ... all server-only variables
});

const clientSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // ... all NEXT_PUBLIC_ variables
});

const _server = serverSchema.parse(process.env);
const _client = clientSchema.parse(process.env);

export const envConfig = {
  ..._server,
  ..._client,
} as const;
```

### Import direction rule

`app/lib/infrastructure/env.ts` is a leaf-level infrastructure module. It may be imported by:

- `app/lib/domains/*` (services and repositories)
- `app/api/**` (route handlers)
- `app/actions/**` (server actions)
- `app/lib/config/*` (domain config files)
- `app/lib/services/*` (legacy slices, during migration)

It must not import from presentation or domain layers. It has no dependencies inside `apps/client`.

### Lint enforcement

Add a `no-restricted-syntax` or `no-restricted-imports` rule to `apps/client/.eslintrc` (or the equivalent flat config) that:

- Flags `process.env` access outside of `app/lib/infrastructure/env.ts`, `next.config.ts`, `instrumentation.ts`, and `sentry.*.config.ts`.
- Produces an error-level diagnostic with a message pointing to the canonical module path.

## Consequences

### Positive

- Missing variables fail fast at startup with a clear error, not silently at the call site.
- Secret inventory is auditable from one file.
- Tests can mock `app/lib/infrastructure/env.ts` as a single import rather than patching `process.env` globally.
- Lint rule prevents new violations without requiring manual review.

### Negative

- Migration cost: existing direct reads must be found and moved in batches.
- Bootstrap exceptions require discipline to document; without enforcement they can accumulate.

## Migration Notes

1. Add the lint rule before migrating existing callsites — this prevents regressions during the migration window.
2. Migrate domain services and repositories first (highest risk).
3. Migrate route handlers and server actions second.
4. Migrate config modules under `app/lib/config/` third.
5. Migrate `lib/*-client.ts` facades last (server-only vars are not accessible in browser code anyway; this pass primarily catches `NEXT_PUBLIC_*` reads).
6. Document each bootstrap exception inline at the callsite and in the inventory comment block in `env.ts`.
7. After migration is complete, enable the lint rule as `error` (it may start as `warn` during migration).
