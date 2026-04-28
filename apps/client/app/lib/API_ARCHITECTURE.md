# API Architecture

## Purpose

This document describes the canonical server-side architecture for `apps/client`.

It is the staff-level reference for how API routes, server actions, domain services, repositories, and shared transport utilities should fit together after the current migration work. If a route, action, or service disagrees with this document, treat the domain-first pattern described here as the target state.

## Executive Summary

`apps/client` uses a thin-adapter, domain-core architecture.

- `app/api/**` contains HTTP adapters only.
- `app/actions/**` contains server-action adapters only.
- `app/lib/domains/**` contains canonical business logic.
- repositories inside `app/lib/domains/**` are persistence-only.
- shared transport and policy utilities live under `app/lib/**`.
- browser consumers use `lib/*-client.ts` facades and hooks, never server-only modules directly.

The central rule is simple: adapters own transport concerns, domains own business decisions.

## Canonical Layers

### 1. Transport Adapters

Folders:

- `app/api/**`
- `app/actions/**`

Responsibilities:

- extract actor context from Clerk and database identity
- apply rate limits
- validate request shape
- enforce idempotency at the adapter boundary where required
- call resilient executors for route-side work
- translate domain `Result<T, DomainError>` outcomes into HTTP or action responses
- trigger cache revalidation in server actions

Non-responsibilities:

- Prisma query orchestration for domain behavior
- role or ownership policy logic
- resource-specific state transitions
- route-local business-rule sentinels

### 2. Domain Layer

Folder:

- `app/lib/domains/**`

Responsibilities:

- business rules
- actor and ownership checks
- domain orchestration across repositories and side effects
- normalized `Result<T, DomainError>` outcomes
- DTO shaping for client-safe or public-safe consumers

Patterns already established in migrated slices:

- messaging
- projects
- properties
- stores
- portfolio
- CRM (`leads`, `inquiries`, `pipeline`)
- user-profile and compliance

### 3. Repositories

Usually colocated inside each domain folder.

Responsibilities:

- execute Prisma reads and writes
- expose persistence-oriented helpers to services
- keep query composition and transactional primitives out of adapters

Repositories must not:

- enforce role checks
- encode HTTP semantics
- shape transport envelopes
- assume caller authorization already happened unless the service guarantees it

### 4. Shared Cross-Cutting Utilities

Key folders:

- `app/lib/security/**`
- `app/lib/actions/**`
- `app/lib/errors/**`
- `app/lib/api-*`
- `app/lib/resilient-api.ts`
- `app/lib/rate-limit.ts`

These modules provide the stable transport and policy primitives used across adapters and domains.

### 5. Browser Facades

Examples:

- `lib/projects-client.ts`
- `lib/messaging-client.ts`
- `lib/properties-client.ts`

Responsibilities:

- browser-safe request construction
- response envelope normalization
- rollout-gate enforcement where applicable
- keeping client components and hooks decoupled from server-only runtime code

## Dependency Direction

Preferred flow:

```text
app/api or app/actions -> app/lib/domains -> repositories / shared infrastructure
app/api or app/actions -> app/lib/security and transport helpers
client hooks/components -> lib/*-client facades
```

Disallowed flow:

```text
domains -> route handlers
domains -> server actions
browser code -> app/api internals or server-only app/lib modules
repositories -> authorization policy logic
```

## Canonical Route Pattern

API routes are thin HTTP adapters.

### Public GET

```typescript
export async function GET(req: NextRequest) {
  const correlationId = initializeCorrelationId(req);
  const identifier = getRateLimitIdentifier(req);

  const rateLimit = await checkRateLimit(
    identifier,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!rateLimit.success) {
    return apiError("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
  }

  const executor = getResilientExecutor();
  const result = await executor.execute(() => domainService.listSomething(), {
    operationName: "list-something",
  });

  if (!result.success || !result.data) {
    return apiError(
      "Failed to fetch resources",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  return apiSuccess(result.data, HttpStatus.OK);
}
```

### Authenticated Mutation

```typescript
export const POST = withAuth(async (req, actor) => {
  const correlationId = initializeCorrelationId(req);
  const identifier = getRateLimitIdentifier(req);

  const rateLimit = await checkRateLimit(
    identifier,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );

  if (!rateLimit.success) {
    return apiError("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
  }

  const payload = await schema.parseAsync(await req.json());
  const domainResult = await someDomainService.createSomething(actor, payload);

  if (!domainResult.success) {
    return mapDomainErrorToResponse(domainResult.error, correlationId);
  }

  return apiSuccess(domainResult.data, HttpStatus.CREATED);
});
```

### Notes

- Use `withAuth` or `withRole` only for identity extraction and coarse entry checks.
- Keep resource authorization in the domain service.
- When collection GET routes need precise `403` versus `404` mapping, inline them instead of hiding domain errors behind a generic wrapper.

## Canonical Server Action Pattern

Server actions follow the same adapter rule.

Use `secureAction` for:

- actor resolution
- input validation
- structured failure mapping

Server actions should:

- call domain services with full actor context
- keep `revalidatePath()` in the action layer
- avoid direct Prisma access unless the slice has not yet been migrated and the work is explicitly transitional

Example shape:

```typescript
export const updateThing = secureAction(
  inputSchema,
  async ({ actor, input }) => {
    const result = await thingService.updateThing(actor, input);

    if (!result.success) {
      return mapDomainErrorToActionFailure(result.error);
    }

    revalidatePath("/dashboard/things");
    return { success: true, data: result.data };
  },
);
```

## Actor Model

Routes and actions should pass full actor context into the domain, not bare user IDs.

The minimum useful actor shape is:

- `clerkId`
- `dbUserId`
- `userEmail`
- `userRole`

Why:

- role-bearing actors let the domain keep authorization local
- ownership and admin override rules stay testable inside services
- detail and collection routes can preserve `forbidden` versus `not_found` semantics without caller discipline

## Result and Error Contracts

Migrated domains should prefer a shared result contract:

```typescript
type Result<T, E> = { success: true; data: T } | { success: false; error: E };
```

`DomainError` values should be domain-oriented, not HTTP-oriented.

Examples:

- `forbidden`
- `not_found`
- `conflict`
- `validation_error`
- `rate_limited`
- `external_dependency_failed`

Adapters then map those outcomes into:

- HTTP status codes for routes
- structured action failures for server actions

## Response Contract

The canonical route envelope is:

### Success

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-03-11T00:00:00.000Z",
  "correlationId": "..."
}
```

### Error

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2026-03-11T00:00:00.000Z",
  "correlationId": "..."
}
```

Use `apiSuccess()` and `apiError()` from `resilient-api.ts` as the canonical builders.

`api-response.ts` remains important for types and constants, but new route code should not treat its legacy helpers as the primary response layer.

## Resilience and Observability

Routes should use `getResilientExecutor().execute(...)` for durable operations.

Standard expectations:

- initialize a correlation ID at the start of each request
- use shared structured logging
- guard external or slow database work with the resilient executor
- keep fallback and error mapping in the adapter layer

Avoid using route-local retry, cache, or timeout logic when the shared executor already covers the case.

## Rate Limiting

Use `rate-limit.ts` consistently.

Primary tiers:

- `READ`
- `WRITE`
- `AUTH`
- `EXPORT`
- `WEBHOOK`

Do not create route-local ad hoc rate buckets when an existing family is sufficient. If a vertical needs a new bucket, add it centrally.

## Generic Projects Surface

The generic projects API is now always enabled after rollout completion.

Current rule:

- keep canonical behavior aligned between the domain client (`app/lib/domains/projects/client`) and the public facade (`lib/projects-client.ts`)
- enforce stability through contract and API suites rather than env-based rollout toggles

## What Good Looks Like

Use this checklist before adding or refactoring an API surface.

- route or action is thin and transport-only
- domain service owns policy and business rules
- repository stays persistence-only
- actor context is full and role-bearing
- domain returns structured results instead of throwing transport-specific errors for expected control flow
- adapter maps domain errors explicitly
- tests cover both boundary and direct domain behavior where risk justifies it

## Anti-Patterns

Avoid these patterns in new work:

- route-local Prisma authorization checks
- server actions that resolve auth, validate input, and persist data manually when `secureAction` is available
- passing only `dbUserId` into an authorization-sensitive service
- hiding meaningful domain failures behind generic `500` handling
- browser code importing `app/lib/domains/**` or other server-only modules directly

## Reference Documents

- `app/api/API.md`
- `app/api/DESIGN.md`
- `app/lib/domains/README.md`
- `docs/adr/ADR-001-auth-model.md`
- `docs/adr/ADR-002-client-layer-boundaries.md`
- `docs/adr/ADR-003-domain-structure-and-import-direction.md`
- `docs/adr/ADR-004-cannonical-env-access-boundary.md`
- `docs/adr/ADR-005-cannonical-observability-contract.md`
- `docs/adr/ADR-006-data-classification.md`
- `docs/adr/ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md`
- `docs/adr/ADR-008-http-surface-security.md`

## Bottom Line

The target architecture is not "helpers around big route files". It is a domain-centered system where routes and actions are small transport shells over actor-aware services with explicit result contracts. That is now the established pattern across the major migrated slices, and new work should follow it by default.

---

## Architecture Principles

### 1. **Separation of Concerns (SoC)**

Each file has a single, well-defined responsibility:

- Authentication ≠ Response formatting ≠ Rate limiting ≠ Resilience

### 2. **Composition Over Inheritance**

```typescript
// ❌ Bad - tightly coupled
export const GET = authenticatedRateLimitedHandler(async (req) => { ... });

// ✅ Good - composable
export const GET = withAuth(async (req, context) => {
  return withRateLimitedExecution(req, context.dbUserId, options, handler);
});
```

### 3. **Single Source of Truth**

- **Response functions:** `resilient-api.ts` (NOT `api-response.ts`)
- **Logger:** `getClientLogger()` from `resilient-api.ts`
- **Executor:** `getResilientExecutor()` from `resilient-api.ts`

### 4. **Observability First**

- Every request gets a correlation ID
- All operations are logged with context
- Metrics are collected automatically
- Errors include full context for debugging

---

## Common Patterns

### Pattern 1: Simple Authenticated Endpoint

```typescript
import { withAuth } from "@/app/lib/api-middleware";
import { apiSuccess, initializeCorrelationId } from "@/app/lib/resilient-api";

export const GET = withAuth(async (req, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
  const data = await fetchData(dbUserId);
  return apiSuccess(data);
});
```

### Pattern 2: Paginated List with Rate Limiting

```typescript
import { withAuth } from "@/app/lib/api-middleware";
import { withRateLimitedExecution } from "@/app/lib/api-utils";
import {
  parsePaginationParams,
  buildPaginationResponse,
} from "@/app/lib/api-utils";

export const GET = withAuth(async (req, { dbUserId }) => {
  return withRateLimitedExecution(
    req,
    dbUserId,
    {
      operationName: "list-items",
      rateLimit: "read",
    },
    async () => {
      const { page, limit, skip } = parsePaginationParams(
        req.nextUrl.searchParams,
      );
      const [items, total] = await Promise.all([
        prisma.item.findMany({ skip, take: limit }),
        prisma.item.count(),
      ]);
      return {
        data: items,
        pagination: buildPaginationResponse(page, limit, total),
      };
    },
  );
});
```

### Pattern 3: Role-Based Write Operation with Resilience

```typescript
import { withRole } from "@/app/lib/api-middleware";
import {
  executeResilient,
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits } from "@/app/lib/rate-limit";

const logger = getClientLogger();

export const POST = withRole(["ADMIN"])(async (req, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  // Rate limit
  const { success } = await checkRateLimit(
    `admin:${dbUserId}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );
  if (!success) return apiError("Rate limited", 429);

  // Execute with resilience
  return executeResilient(
    async () => {
      const body = await req.json();
      const result = await createResource(body);
      logger.info("Resource created", { correlationId, resourceId: result.id });
      return result;
    },
    {
      operationName: "create-resource",
      timeout: 10000,
      retry: { maxAttempts: 3 },
      metrics: true,
      successStatus: 201,
    },
  );
});
```

---

## Migration Guide

### Eliminating Circular Dependencies

**Old Pattern (Circular Dependency):**

```typescript
// ❌ api-response.ts re-exported from resilient-api.ts
export { apiSuccess, apiError } from "./resilient-api";
```

**New Pattern:**

```typescript
// ✅ Import directly from resilient-api.ts
import { apiSuccess, apiError } from "@/app/lib/resilient-api";
import { HttpStatus, ErrorCodes } from "@/app/lib/api-response"; // Types only
```

### Standardizing Correlation IDs

**Old Pattern:**

```typescript
// ❌ Manual correlation ID generation
import { CorrelationIdManager } from "@build/resilience";

const correlationId = CorrelationIdManager.generate();
CorrelationIdManager.set(correlationId);
```

**New Pattern:**

```typescript
// ✅ Use helper function
import { initializeCorrelationId } from "@/app/lib/resilient-api";

const correlationId = initializeCorrelationId(req);
```

### Standardizing Loggers

**Old Pattern:**

```typescript
// ❌ Multiple logger instances
import { StructuredLogger } from "@build/resilience";
const logger = new StructuredLogger("my-service");
```

**New Pattern:**

```typescript
// ✅ Shared logger instance
import { getClientLogger } from "@/app/lib/resilient-api";
const logger = getClientLogger();
```

---

## Testing Strategies

### Unit Testing Individual Functions

```typescript
import { parsePaginationParams } from "@/app/lib/api-utils";

describe("parsePaginationParams", () => {
  it("should parse page and limit", () => {
    const params = new URLSearchParams("page=2&limit=50");
    const result = parsePaginationParams(params);
    expect(result).toEqual({ page: 2, limit: 50, skip: 50 });
  });
});
```

### Integration Testing Middleware

```typescript
import { withAuth } from "@/app/lib/api-middleware";

describe("withAuth", () => {
  it("should return 401 for unauthenticated requests", async () => {
    const handler = withAuth(async (req, context) => {
      return NextResponse.json({ success: true });
    });

    const req = new NextRequest("http://localhost/api/test");
    const res = await handler(req);

    expect(res.status).toBe(401);
  });
});
```

---

## Performance Considerations

### 1. **Caching Strategy**

- Use `executeResilient` with `cache: { ttl: 60000 }` for frequently accessed data
- Cache keys are automatically generated from operation name
- Stale-while-revalidate pattern for fresh data

### 2. **Circuit Breaker**

- Protects downstream services from cascading failures
- Automatically opens after 5 consecutive failures
- Half-open state for gradual recovery

### 3. **Timeout Management**

- Critical operations: 1s timeout
- Standard operations: 5s timeout
- Background jobs: 30s timeout
- Use `withTimeout()` for granular control

### 4. **Rate Limiting**

- In-memory for development (fast, stateless between restarts)
- Redis-based for production (distributed, persistent)
- Different limits per operation type (read vs write)

---

## Best Practices

### ✅ Do's

- Import `apiSuccess`/`apiError` from `resilient-api.ts`
- Use `initializeCorrelationId(req)` for correlation tracking
- Use `getClientLogger()` for consistent logging
- Compose middleware functions (`withAuth` + `withRateLimitedExecution`)
- Handle errors gracefully with proper status codes
- Include correlation IDs in all logs

### ❌ Don'ts

- Don't create multiple `StructuredLogger` instances
- Don't manually call `CorrelationIdManager.generate()`
- Don't import response functions from `api-response.ts`
- Don't skip rate limiting on write operations
- Don't expose internal error details to clients
- Don't forget to validate input with Zod schemas

---

## Debugging

### Viewing Correlation IDs

All responses include `X-Correlation-ID` header:

```bash
curl -i https://api.example.com/api/items
# X-Correlation-ID: abc123-def456
```

### Viewing Circuit Breaker States

```typescript
import { getResilientExecutor } from "@/app/lib/resilient-api";

const executor = getResilientExecutor();
const states = executor.getCircuitBreakerStates();
console.log("Circuit breakers:", states);
```

### Viewing Cache Statistics

```typescript
const cacheStats = executor.getCacheStats();
console.log("Cache stats:", cacheStats);
```

---

## Future Enhancements

1. **Redis Integration**
   - Replace in-memory rate limiter with Redis
   - Distributed caching with Redis
   - Circuit breaker state sharing

2. **OpenTelemetry**
   - Trace propagation across services
   - Distributed tracing visualization
   - Performance metrics dashboard

3. **GraphQL Support**
   - Adapt middleware for GraphQL resolvers
   - Field-level rate limiting
   - Query complexity analysis

4. **API Versioning**
   - URL-based versioning (`/v1/`, `/v2/`)
   - Header-based versioning
   - Backward compatibility layer

---

## Support & Questions

For questions about this architecture:

1. Check this documentation first
2. Review the inline code comments
3. Look at existing route examples in `apps/client/app/api/`
4. Ask in the team chat with correlation ID for specific issues

---

**Last Updated:** February 4, 2026  
**Version:** 2.0.0  
**Maintainer:** Build Market Engineering Team
