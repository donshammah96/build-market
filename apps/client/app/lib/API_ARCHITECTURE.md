# API Architecture

**Last Updated:** May 2026  
**Canonical authority:** `.agent/API-TO-FRONTEND-ARCHITECTURE.md`  
**Status:** Aligned with properties domain reference implementation

This document is the staff-level reference for `apps/client` API surfaces. It is derived from `.agent/API-TO-FRONTEND-ARCHITECTURE.md` and the properties domain, which serves as the canonical reference implementation. When this document and the architecture guide disagree, the architecture guide wins.

---

## Executive Summary

`apps/client` uses a **thin-adapter, domain-core** architecture.

- `app/api/**` — HTTP adapters only. No business logic.
- `app/actions/**` — Server-action adapters only. No business logic.
- `app/lib/domains/**` — Canonical business logic, actor-aware authorization, DTO shaping.
- `app/lib/domains/**/repository.ts` — Persistence only. No authorization or HTTP semantics.
- `app/lib/infrastructure/env.ts` — **Single canonical boundary** for all `process.env` reads.
- `lib/*-client.ts` — Browser-safe facades. No server-only imports.

The central rule: **adapters own transport concerns, domains own business decisions.**

---

## Canonical Layers

### 1. Transport Adapters (`app/api/**`, `app/actions/**`)

**Responsibilities:**

- Capture `startedAt = now()` as the absolute first statement (before auth, parsing, validation)
- Initialize correlation ID via `initializeCorrelationId(req)`
- Extract actor context from `withAuth` (`dbUserId`, `userRole`, `clerkId`)
- Apply rate limiting via `checkRateLimit()` or `getActorRateLimitIdentifier()`
- Validate request shape with `schema.safeParse()` — **never** `.parse()` (a thrown ZodError escapes as 500)
- Enforce `If-Match` / `ETag` for versioned entities on PATCH and DELETE
- Call `IdempotencyService.checkOrCreate()` for idempotent mutations
- Execute via `getResilientExecutor().execute()`
- Map `Result<T, DomainError>` outcomes to HTTP responses
- Emit one structured log event per request at the point of response (ADR-005)
- Trigger cache revalidation in server actions

**Non-responsibilities:**

- Prisma query logic for domain behavior
- Role or ownership policy
- Resource-specific state transitions
- Route-local business-rule sentinels
- Raw `process.env` reads (use `envConfig` from `app/lib/infrastructure/env.ts`)

### 2. Domain Layer (`app/lib/domains/**`)

**Responsibilities:**

- Actor-aware authorization (role + ownership + admin override)
- Business rules and invariants
- Orchestration across repositories and side effects
- Normalized `Result<T, DomainError>` outcomes for all expected failures
- Canonical DTO shaping — `Date → string` normalization happens **here**, not in adapters

**Must not:**

- Import `HttpStatus`, `NextResponse`, or any route/action semantics
- Call `getClientLogger()` (logging is the adapter's responsibility)
- Import from other domain services or repositories directly — cross-domain reads go through the owning domain's `index.ts`

**Pattern in production (properties slice):**

```typescript
// app/lib/domains/properties/service.ts
export async function updateProperty(
  actor: PropertyActor,
  command: UpdatePropertyInput,
  context: PropertyOperationContext,
  expectedVersion: number,
): Promise<PropertyResult<PropertyUpdateResultDto>> {
  const property = await propertyRepository.findById(command.id);
  if (!property) return err({ error: "not_found" });
  if (property.agentId !== actor.userId && actor.role !== "ADMIN") {
    return err({ error: "forbidden" });
  }
  // ... orchestration, optimistic-lock update, DTO mapping
  return ok(toPropertyUpdateResultDto(updated));
}
```

### 3. Repositories (`app/lib/domains/**/repository.ts`)

**Responsibilities:**

- Execute Prisma reads and writes
- Expose persistence-oriented helpers
- Keep soft-delete guards (`deletedAt: null`) in every `findFirst`/`findMany`

**Must not:**

- Enforce role checks
- Return HTTP-shaped structures or error messages
- Import from route or action modules

### 4. Mappers (`app/lib/domains/**/mappers.ts`)

Mappers are pure functions responsible for transforming raw Prisma shapes into explicit browser-safe DTOs. They are the canonical place for:

- `Decimal → number` normalization via `toNumber()`
- `Date → ISO string` normalization via `toIsoString()`
- Null coalescing for optional fields
- Nested shape normalization (assets, agents, images)

They take a loose raw input type and return a strict domain DTO. They have no side effects and no imports from infrastructure.

**Pattern (properties slice):**

```typescript
// app/lib/domains/properties/mappers.ts
export function toPropertyListItemDto(raw: {
  /* loose Prisma shape */
}): PropertyListItem {
  return {
    id: raw.id,
    price: toNumber(raw.price), // Decimal → number
    createdAt: toIsoString(raw.createdAt) ?? new Date(0).toISOString(), // Date → string
    // ... all fields normalized
  };
}
```

### 5. Shared Route Utilities (`app/api/<domain>/shared.ts`)

For domain route families with multiple handlers (collection + item + attachments, etc.), extract shared adapter utilities into a co-located `shared.ts`:

- ADR-005 structured logging helper (`logPropertiesRouteOutcome`)
- Domain-error-to-HTTP-status mapping (`domainErrorCodeToStatus`)
- Domain-error-to-response mapping (`domainErrorToResponse`)
- Client-safe message mapping (`propertyDomainErrorToClientMessage`)
- Timing and role label helpers (`now()`, `actorRoleLabel()`)
- Idempotency-conflict response builder (`conflictResponse()`)

This keeps handlers thin and ensures error mapping is consistent across all operations on the same resource.

### 6. Browser Facades (`lib/*-client.ts`)

**Responsibilities:**

- Browser-safe HTTP access via `fetch` or `apiFetch` against `/api/...`
- `ApiResponse<T>` envelope parsing
- Explicit DTO interfaces — no `ReturnType<>` inference from server-only types
- Concurrency limiting when appropriate

**Must not:**

- Import `app/actions/**`, `app/lib/domains/**`, or any server-only modules
- Rely on implicit Prisma or server-action return types across boundaries

---

## Dependency Direction

```
UI Component / Page
  → React Query hook  (hooks/use*.ts)
  → Browser facade    (lib/<domain>-client.ts)
  → API route         (app/api/<domain>/**)
  → Domain service    (app/lib/domains/<domain>/service.ts)
  → Repository        (app/lib/domains/<domain>/repository.ts)
  → @build/db
```

Server-side form / mutation:

```
Server Component / form
  → Server action     (app/actions/<domain>.ts)
  → secureAction wrapper
  → Domain service    (app/lib/domains/<domain>/service.ts)
  → Repository
  → @build/db
```

**Disallowed flows:**

```
domains → route handlers or server actions
browser code → app/lib/domains/** or server-only modules
repositories → authorization policy or HTTP response shaping
route handlers → process.env directly (use envConfig)
```

---

## Canonical Route Handler Pattern

The properties `[id]/route.ts` is the reference implementation. Key invariants:

### 1. `startedAt` is always first

```typescript
export const PATCH = withAuth(async (req, context, params) => {
  // ✅ First statement — covers full request lifecycle including auth resolution
  const startedAt = now();
  const correlationId = initializeCorrelationId(req);
  // ...
});
```

### 2. Actor context construction

Destructure `clerkId` and include it for verification/identity-transition routes. For standard property mutations, the minimal actor shape is:

```typescript
const actor: PropertyActor = {
  userId: context.dbUserId,
  role: context.userRole ?? "unknown",
};
```

For verification, onboarding, and identity-transition routes, include `clerkId`:

```typescript
const actor = {
  userId: context.dbUserId,
  clerkId: context.clerkId, // required when domain contract accepts it
  role: normalizeRole(context.userRole),
};
```

### 3. Rate limiting — actor-scoped for authenticated routes

```typescript
// ✅ For authenticated high-risk routes: actor-scoped
const rateKey = getActorRateLimitIdentifier(context.dbUserId, "property-write");
const rateLimitResult = await checkRateLimit(rateKey, limit, window);

// ✅ For public routes: IP-scoped
const rateKey = getRateLimitIdentifier(req);
```

### 4. `If-Match` for versioned mutations — header-only

PATCH and DELETE on versioned entities require `If-Match`. Body-version fallback is prohibited (GAP-017).

```typescript
const ifMatch = req.headers.get("If-Match");
if (!ifMatch) {
  return apiError(
    'Missing If-Match header. Include the property version as: If-Match: "N"',
    HttpStatus.PRECONDITION_REQUIRED,
    undefined,
    correlationId,
  );
}

const expectedVersion = extractExpectedVersionFromIfMatch(req);
if (expectedVersion === null) {
  return apiError(
    "Invalid If-Match header value",
    HttpStatus.BAD_REQUEST,
    undefined,
    correlationId,
  );
}
```

### 5. Zod validation — always `safeParse`, never `parse`

```typescript
const validation = UpdatePropertySchema.safeParse(body);
if (!validation.success) {
  logRouteOutcome({ outcome: "validation_error", httpStatus: 400, ... });
  return apiError("Invalid update data", HttpStatus.BAD_REQUEST, validation.error.issues, correlationId);
}
```

### 6. Idempotency — `complete()` must be wrapped

`IdempotencyService.complete()` can throw after a successful domain mutation. The handler must not rethrow — the domain operation succeeded and the client must receive the success response.

```typescript
// ✅ Correct — isolated try-catch, does NOT rethrow
try {
  await IdempotencyService.complete(idempotencyKey, result.data);
} catch (completionError) {
  await IdempotencyService.fail(idempotencyKey).catch(() => undefined);
  logger.error(
    "Idempotency completion failed",
    completionError instanceof Error
      ? completionError
      : new Error(String(completionError)),
    {
      correlationId,
      operationName,
      outcome: "idempotency_complete_failed",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
    },
  );
  // Do NOT rethrow. Mutation succeeded.
}
return apiSuccess(result.data, HttpStatus.OK, correlationId);
```

### 7. ETag on success

```typescript
const response = apiSuccess(result.data, HttpStatus.OK, correlationId);
response.headers.set("ETag", `"${result.data.version}"`);
return response;
```

### 8. Structured logging — one event per request

Every outcome path emits exactly one structured log event at the point of response. The log function lives in `shared.ts` and is called consistently:

```typescript
logPropertiesRouteOutcome({
  correlationId,
  operationName, // stable snake_case join key, e.g. "update_property"
  actorRole, // safe enum value — never userId, clerkId, or email
  outcome: "success", // "success" | "domain_error" | "validation_error" | "rate_limited" | "internal_error"
  httpStatus: HttpStatus.OK,
  durationMs: now() - startedAt,
  resourceType: "property",
  resourceId: propertyId, // UUID only — never user-controlled slugs
});
```

**PII exclusions (hard rules, ADR-005 + ADR-006):**

- Never log `userId`, `clerkId`, `userEmail`, `phone`, or any natural-person identifier
- Never log request body values or response body content
- `actorRole` (enum) and `resourceId` (UUID) are safe

### 9. `apiError()` first argument — always a static string

Never pass domain result message fields to `apiError()`. All of these forms are violations:

```typescript
// ❌ All prohibited — variable name does not matter
apiError(error.message ?? "fallback", status);
apiError(err.message ?? "fallback", status);
apiError(data.message ?? "fallback", status);
apiError(result.data.message ?? "fallback", status);
```

Use a static string constant and log the domain error code at `warn` level:

```typescript
// ✅ Correct
return apiError("Forbidden", HttpStatus.FORBIDDEN, undefined, correlationId);
```

### Complete annotated PATCH handler (reference)

```typescript
export const PATCH = withAuth(
  async (req: NextRequest, context: { dbUserId: string; userRole?: string }, params?: { id: string }) => {
    // ① Timing — first statement always
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "update_property";
    const actorRole = actorRoleLabel(context.userRole);

    // ② Input guards
    if (!params?.id || !isValidId(params.id)) {
      logRouteOutcome({ correlationId, operationName, actorRole, outcome: "validation_error",
        httpStatus: 400, durationMs: now() - startedAt, resourceType: "property" });
      return apiError("Property ID is required", HttpStatus.BAD_REQUEST, undefined, correlationId);
    }

    const propertyId = params.id;

    // ③ Rate limiting
    const rateLimitResult = await checkPropertyRateLimit(req, "write");
    if (!rateLimitResult.success) {
      logRouteOutcome({ ..., outcome: "rate_limited", httpStatus: 429, ... });
      return apiError("Too many requests. Please try again later.", HttpStatus.TOO_MANY_REQUESTS, undefined, correlationId);
    }

    // ④ Body size guard
    const sizeError = checkBodySize(req, PROPERTY_CONFIG.MAX_BODY_SIZE);
    if (sizeError) { /* log + return */ }

    // ⑤ If-Match (header-only, no body fallback)
    const ifMatch = req.headers.get("If-Match");
    if (!ifMatch) { /* 428 + log */ }
    const expectedVersion = extractExpectedVersionFromIfMatch(req);
    if (expectedVersion === null) { /* 400 + log */ }

    // ⑥ JSON parse + Zod validation (safeParse — never parse())
    const validation = UpdatePropertySchema.safeParse(await req.json());
    if (!validation.success) { /* 400 + log */ }

    // ⑦ Idempotency check
    const idempotencyKey = req.headers.get("Idempotency-Key")
      || IdempotencyService.generateKey(context.dbUserId, `PATCH:${propertyId}`, body);
    const check = await IdempotencyService.checkOrCreate(idempotencyKey, ...);
    if (check?.status === "completed") { /* return cached response */ }
    if (check?.status === "pending")   { /* 409 conflict */ }

    // ⑧ Domain call
    const result = await propertiesService.updatePropertyWithRetry(
      propertyId,
      { userId: context.dbUserId, role: context.userRole ?? "unknown" },
      validation.data, operationContext, expectedVersion, { maxRetries, retryDelayMs },
    );

    // ⑨ Domain error mapping
    if (!result.ok) {
      await IdempotencyService.fail(idempotencyKey);
      if (result.error === "conflict") { return conflictResponse(...); }
      logRouteOutcome({ ..., outcome: "domain_error", ... });
      return domainResultToErrorResponse(result, correlationId)!;
    }

    // ⑩ Idempotency completion — isolated try-catch, never rethrows
    try {
      await IdempotencyService.complete(idempotencyKey, result.data);
    } catch (err) {
      await IdempotencyService.fail(idempotencyKey).catch(() => undefined);
      logger.error("Idempotency completion failed", err, { correlationId, outcome: "idempotency_complete_failed", ... });
      // fall through — mutation succeeded
    }

    // ⑪ Success response + ETag
    const response = apiSuccess(result.data, HttpStatus.OK, correlationId);
    response.headers.set("ETag", `"${result.data.version}"`);
    logRouteOutcome({ ..., outcome: "success", httpStatus: 200, ... });
    return response;
  },
);
```

---

## Result and Error Contracts

### Canonical `Result<T, E>` type

Import from `app/lib/errors/result.ts` — do not re-define locally:

```typescript
import type { Result, DomainError } from "@/app/lib/errors/result";

// Shape: { ok: true; data: T } | ({ ok: false } & E)
```

Domain errors are domain-oriented, never HTTP-oriented:

```typescript
export type PropertyDomainErrorCode =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "invalid_input"
  | "internal_error"
  | "suspended_account"
  | "not_professional"
  | "slug_conflict"
  | "asset_not_found"
  | "asset_unauthorized"
  | "document_not_found"
  | "attachment_not_found"
  | "attachment_mismatch";

export type PropertyDomainError = DomainError<PropertyDomainErrorCode>;
export type PropertyResult<T> = Result<T, PropertyDomainError>;
```

Adapters map these codes to HTTP status via a single `domainErrorCodeToStatus()` function in `shared.ts`.

### `ok()` / `err()` helpers

```typescript
import { ok, err } from "@/app/lib/errors/result";

// In domain service
if (!property) return err({ error: "not_found" });
if (!authorized) return err({ error: "forbidden" });
return ok(toPropertyDetailDto(property));
```

### Two-level Result unwrap from `getResilientExecutor()`

The resilient executor wraps the domain result in its own success/failure envelope:

```typescript
// getResilientExecutor().execute() returns Result<DomainResult, InfraError>
// Two levels of narrowing are required:
const result = await getResilientExecutor().execute(() => domainService.doThing(...), { operationName });

if (!result.success || !result.data) {
  // Infrastructure failure (circuit open, timeout, etc.)
  return apiError("Failed to fetch resource", HttpStatus.INTERNAL_SERVER_ERROR, undefined, correlationId);
}

const domainResult = result.data;
if (!domainResult.ok) {
  // Expected domain failure
  return domainResultToErrorResponse(domainResult, correlationId);
}

// domainResult.data is the success payload
return apiSuccess(domainResult.data, HttpStatus.OK, correlationId);
```

---

## Response Envelope Contract

All routes use `apiSuccess()` and `apiError()` from `app/lib/api/api-response.ts`.

### Success

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-01-01T00:00:00.000Z",
  "correlationId": "req_abc123"
}
```

### Error

```json
{
  "success": false,
  "error": "Property not found",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "correlationId": "req_abc123"
}
```

The `error` field must always be a **pre-approved static string**. Never a domain message field.

---

## Actor Model

The minimum actor shape for authorization-sensitive operations:

```typescript
type PropertyActor = {
  userId: string; // dbUserId from withAuth
  role: AppRole; // normalized role — never raw Clerk claim
};
```

For verification and identity-transition routes, forward `clerkId`:

```typescript
type VerificationActor = {
  userId: string;
  clerkId: string; // required when domain contract accepts it
  role: AppRole;
};
```

**Rules:**

- Construct the actor from `withAuth` context — never from request body or query params
- Pass the full actor to the domain service — never just `dbUserId`
- The domain service enforces ownership and role policy using the actor

---

## Observability Contract (ADR-005)

Every adapter layer log event must carry:

| Field           | Description                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `correlationId` | From `initializeCorrelationId(req)`                                                               |
| `operationName` | Stable `<verb>_<resource>` identifier, e.g. `update_property`                                     |
| `httpMethod`    | `"PATCH"`, `"GET"`, etc.                                                                          |
| `routePattern`  | `"/api/properties/[id]"` — never the raw URL (exposes IDs in path params)                         |
| `actorRole`     | Role enum value — never `userId`, `clerkId`, or email                                             |
| `outcome`       | `"success"` \| `"domain_error"` \| `"validation_error"` \| `"rate_limited"` \| `"internal_error"` |
| `httpStatus`    | Actual status code returned                                                                       |
| `durationMs`    | From `now() - startedAt` — startedAt **must** be the absolute first statement                     |

Optional safe fields: `domainError` (the error code), `resourceType`, `resourceId` (UUID only).

**Log levels follow ADR-005:**

- `info` — success
- `warn` — domain_error, validation_error, rate_limited
- `error` — internal_error, infrastructure failures

**`operationName` stability rule:** Renaming an `operationName` is a breaking observability change. It requires a coordinated dashboard/alert update in the same deploy window and a changelog entry.

**Domain services must not call `getClientLogger()`.** They return `Result<T, DomainError>`; the adapter logs the outcome.

---

## Idempotency

`IdempotencyService` lives at `app/lib/services/idempotency.service.ts`. It is an **adapter-layer concern** — never called from domain services or repositories.

```typescript
// Generate key — use Class C/D fields only (ADR-006)
const idempotencyKey = req.headers.get("Idempotency-Key")
  || IdempotencyService.generateKey(dbUserId, `PATCH:${resourceId}`, {
    domain: "property",
    resourceId,
    fieldsUpdated: Object.keys(validationData).length,  // Class C summary, not full payload
  });

// Check before execution
const check = await IdempotencyService.checkOrCreate(key, scope, dbUserId, method, resourceId, ttlHours);
if (check?.status === "completed") return apiSuccess(check.response, HttpStatus.OK, correlationId);
if (check?.status === "pending")   return apiError("Already processing", HttpStatus.CONFLICT, ...);

// ... domain execution ...

// Complete — always in isolated try-catch
try {
  await IdempotencyService.complete(idempotencyKey, result.data);
} catch (err) {
  await IdempotencyService.fail(idempotencyKey).catch(() => undefined);
  logger.error("Idempotency completion failed", err, { correlationId, outcome: "idempotency_complete_failed", ... });
  // Do NOT rethrow
}
```

**Replay payload policy (ADR-006):** Default replay storage allows only Class C and Class D data. Class B fields require explicit scope registration in `IdempotencyService`. Class A data is never allowed in replay persistence.

---

## Optimistic Locking

For versioned entities:

- `GET` and successful mutations return `ETag: "N"` where `N` is the version
- `PATCH` and `DELETE` require `If-Match: "N"`
- Missing `If-Match` → `428 Precondition Required`
- Invalid `If-Match` value → `400 Bad Request`
- Version conflict → `409 Conflict` with `X-{Resource}-Version: current` header
- **DELETE handlers use `extractExpectedVersionFromIfMatch()` exclusively** — `extractExpectedVersion()` body-fallback form is prohibited (GAP-017)

---

## Rate Limiting

Use `app/lib/api/rate-limit.ts`.

```typescript
// Authenticated routes: actor-scoped (prevents per-IP bypass via proxies)
const key = getActorRateLimitIdentifier(dbUserId, "property-write");

// Public/unauthenticated routes: IP-scoped
const key = getRateLimitIdentifier(req);
```

Standard tiers: `RateLimits.READ`, `RateLimits.WRITE`, `RateLimits.AUTH`, `RateLimits.EXPORT`.

Namespace convention: `{resourceType}-{operation}` — consistent within a resource family (e.g. `property-read`, `property-write`, not mixed singular/plural).

---

## Contracts and DTO Boundaries

Define explicit DTO types in `app/lib/domains/<domain>/contracts.ts`. Rules:

- All `Date` fields are `string` in DTOs (ISO 8601) — normalization happens in mappers
- All `Decimal`/`Prisma.Decimal` fields are `number` in DTOs — normalization happens in mappers
- DTOs exposed to browser consumers must be serialization-safe — no raw Prisma types
- Browser facades use `ApiResponse<T>` with the explicit DTO generic — no `ReturnType<>` inference from server types

```typescript
// ✅ Correct — explicit DTO in contracts.ts
export type PropertyCreateResultDto = {
  id: string;
  title: string;
  slug: string;
  price: number; // not Decimal
  createdAt: string; // not Date
  version: number;
};

// ✅ Correct — mapper in mappers.ts normalizes before crossing boundary
export function toPropertyCreateResultDto(
  raw: PrismaProperty,
): PropertyCreateResultDto {
  return {
    ...raw,
    price: toNumber(raw.price),
    createdAt: toIsoString(raw.createdAt) ?? new Date(0).toISOString(),
  };
}
```

---

## Environment Variable Access (ADR-004)

**All `process.env` reads in `apps/client` go through `app/lib/infrastructure/env.ts`.**

```typescript
// ✅ Correct
import { envConfig } from "@/app/lib/infrastructure/env.ts";
const client = new StripeClient(envConfig.stripeSecretKey);

// ❌ Prohibited in routes, domain services, repositories, config modules
const client = new StripeClient(process.env.STRIPE_SECRET_KEY!);
```

Bootstrap-only exceptions (`next.config.ts`, `instrumentation.ts`, `sentry.*.config.ts`) must carry:

```typescript
// bootstrap-only: module graph not initialized at this callsite
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
```

---

## High-Risk Routes and `secureAction`

### Tiered recentAuth windows (ADR-001 Amendment)

| Tier                          | Operations                             | `maxAgeSeconds` |
| ----------------------------- | -------------------------------------- | --------------- |
| Tier 1 — Critical financial   | Payout, escrow fund/release/dispute    | `180`           |
| Tier 1 — Identity destruction | User export, deletion, rectification   | `180`           |
| Tier 2 — Verification         | Document/license/certificate mutations | `300`           |
| Tier 2 — Account transitions  | Onboarding submit and skip             | `300`           |
| Tier 3 — Profile mutations    | Profile and contact updates            | `300` (default) |

```typescript
// Tier 1 routes must explicitly use 180, not default
export const POST = withAuth(
  async (req, auth, params) => { ... },
  { recentAuth: { maxAgeSeconds: 180 }, csrf: {} }
);
```

### `secureAction` for server actions

```typescript
export const submitOnboarding = secureAction(
  inputSchema,
  async ({ actor, input }) => {
    const result = await onboardingService.submitOnboarding(actor, input);
    if (!result.ok) return createActionFailure(result.error);
    revalidatePath("/onboarding");
    return { success: true, data: result.data };
  },
  {
    recentAuth: { maxAgeSeconds: 300 },
    rateLimit: { key: (actor) => actor.userId },
  },
);
```

---

## Server Actions

Server actions are not the browser data-fetching layer. Use them for:

- Server component form submissions
- Mutation flows that need `revalidatePath()` / `revalidateTag()`
- Authenticated workflows that stay server-side

**Requirements:**

- Wrap with `secureAction` for authenticated flows
- Validate input with `schema.safeParse()` — never `.parse()`
- Pass full actor context into domain
- Keep cache revalidation in the action layer
- Define explicit serialization-safe return types — no `ReturnType<typeof action>` inference

---

## Hooks

Hooks own cache keys, invalidation, and mutation lifecycle composition.

```typescript
export function useUpdateProperty(options?: UseMutationOptions<...>) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await propertiesClient.updateProperty(input)),
    // TanStack Query v5: onSuccess receives (data, variables, context) — 3 args only
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      options?.onSuccess?.(data, variables, context);
    },
  });
}
```

**`staleTime` defaults:**

- Read-heavy, slow-changing data (properties, profiles): `staleTime: 60_000` at `QueryClient` level
- Real-time data (messaging, notifications): `staleTime: 0` at the query level

---

## Security Boundaries

### Mass assignment protection

All mutation route schemas use `.strict()` or explicit `.pick()`:

```typescript
// ✅ Correct
const UpdatePropertySchema = z.object({ title: z.string(), ... }).strict();

// ❌ Prohibited on mutation bodies
const schema = z.object({ ... }).passthrough();
```

System-owned fields (`id`, `createdAt`, `updatedAt`, `deletedAt`, `version`, `isVerified`, `role`) must not appear in mutation input schemas.

### CORS

Apply through shared adapter helper only. `Access-Control-Allow-Origin: *` is prohibited on authenticated routes.

### Anti-caching

Authenticated and user-specific responses return `Cache-Control: no-store, private`.

### Rendering safety

`dangerouslySetInnerHTML` is prohibited for user-generated content without documented server-side sanitization.

---

## Testing

Testing is risk-centric, not layer-centric. See Section 7 of `.agent/API-TO-FRONTEND-ARCHITECTURE.md` for full coverage requirements.

### Required test types by change

| Change type               | Contract tests | Policy tests | Layer tests       | Journey E2E                        |
| ------------------------- | -------------- | ------------ | ----------------- | ---------------------------------- |
| New domain slice          | Required       | Required     | Required          | Add if new protected route         |
| Authorization rule change | —              | Required     | Required (route)  | Required if high-traffic auth gate |
| Repository shape change   | Required       | —            | Required (domain) | —                                  |
| New protected route       | —              | —            | Required (route)  | **Required**                       |

### `withAuth` mock fidelity

Test mocks must match the **exact** production `AuthContext` shape. Extra fields mask dead code.

```typescript
import type { AuthContext } from "@/app/lib/api/api-middleware";

const mockAuth: AuthContext = {
  clerkId: "clerk_123",
  dbUserId: "db_user_123",
  userRole: UserRole.PROFESSIONAL,
  // No userEmail — that field does not exist in AuthContext
};
```

### Error response assertions

Assert static strings, never domain message text:

```typescript
// ✅ Correct — fails when route leaks internals
expect(payload.error).toBe("Forbidden");

// ❌ Wrong — passes when route leaks internals, fails when fixed
expect(payload.error).toBe("Not authorized to access this conversation");
```

---

## Anti-Patterns

Reject these in review:

1. Route-local Prisma authorization checks or business logic
2. Domain service imports `HttpStatus`, `NextResponse`, or route/action modules
3. `apiError(error.message, ...)` or any rebinding: `apiError(data.message ?? ...)`, `apiError(result.data.message ?? ...)`
4. `IdempotencyService.complete()` called without an isolated try-catch that does not rethrow
5. `schema.parse()` instead of `schema.safeParse()` in route handlers or server actions
6. `process.env.*` direct reads in routes, domain services, repositories, or config modules
7. Browser facades or hooks importing server actions or domain services directly
8. `extractExpectedVersion()` body-fallback form in DELETE handlers
9. Mock `AuthContext` with `userEmail` or other non-production fields
10. Test assertions that assert domain message text in error responses
11. Actor objects omitting `clerkId` for verification/identity routes when the domain contract accepts it
12. New Tier 1/Tier 2 sensitive route without a registry entry in `HIGH_VALUE_ROUTE_GUARD_RULES`
13. IP-scoped rate-limit keys (`getRateLimitIdentifier(req)`) on authenticated high-risk routes
14. Unstructured `console.log` in route handlers — use `logRouteOutcome` / `getClientLogger()`
15. Log events containing `userId`, `clerkId`, `userEmail`, or any request/response body content

---

## Reference Slice: Properties Domain

The properties domain is the canonical reference implementation. Inspect these files to understand the full pattern:

| File                                       | Purpose                                                        |
| ------------------------------------------ | -------------------------------------------------------------- |
| `app/lib/domains/properties/contracts.ts`  | Actor type, DTO types, error code union, `PropertyResult<T>`   |
| `app/lib/domains/properties/mappers.ts`    | `Decimal → number`, `Date → string`, all DTO construction      |
| `app/lib/domains/properties/repository.ts` | Prisma queries with soft-delete guards                         |
| `app/lib/domains/properties/service.ts`    | Actor-aware business logic, `ok()`/`err()` outcomes            |
| `app/lib/domains/properties/operations.ts` | Optimistic-lock update helpers, `buildPropertyUpdatePayload()` |
| `app/lib/domains/properties/index.ts`      | Public surface — exports contracts, repository, and service    |
| `app/api/properties/shared.ts`             | Route-level logging, error mapping, client-safe message table  |
| `app/api/properties/[id]/route.ts`         | Reference PATCH/DELETE with full idempotency + ETag + logging  |

---

## Related Documentation

- `.agent/API-TO-FRONTEND-ARCHITECTURE.md` — canonical authority; this document is derived from it
- `.agent/DOCUMENT-HIERARCHY.md` — conflict resolution algorithm
- `app/lib/domains/README.md` — domain-layer boundaries and CRM reference
- `docs/adr/ADR-001-auth-model.md` — Clerk-first identity, freshness windows, actor context
- `docs/adr/ADR-002-client-layer-boundaries.md` — layer ownership and import direction
- `docs/adr/ADR-003-domain-structure-and-import-direction.md` — canonical domain-first dependency flow
- `docs/adr/ADR-004-cannonical-env-access-boundary.md` — env module ownership
- `docs/adr/ADR-005-cannonical-observability-contract.md` — structured log field contract and PII exclusions
- `docs/adr/ADR-006-data-classification.md` — Class A–D data handling, replay payload policy
- `docs/adr/ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md` — role model and actor context typing
- `docs/adr/ADR-008-http-surface-security.md` — CORS, CSRF, anti-caching, webhook integrity
- `docs/CHANGELOG.md` — recent hardening work (treat as binding precedent)
- `docs/PROGRESS-SUMMARY.md` — current migration queue and slice status
