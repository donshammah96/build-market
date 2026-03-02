# API Architecture Documentation

## Overview

The Build Market API layer is built with a modular, composable architecture that prioritizes **resilience**, **observability**, and **developer experience**. This document explains the relationship between the core API utility files and how to use them effectively.

---

## Core Files & Responsibilities

```
apps/client/app/lib/
├── api-middleware.ts      # Authentication & Authorization
├── api-response.ts        # Response types & utilities (backward compat)
├── api-utils.ts          # Request parsing & helper wrappers
├── resilient-api.ts      # Resilience patterns & response functions
└── rate-limit.ts         # Rate limiting logic
```

### 1. **api-middleware.ts** - Authentication & Authorization

**Purpose:** Ensures requests are authenticated and authorized before reaching handlers.

**Exports:**

- `withAuth<T>(handler)` - Wraps route handlers with Clerk authentication
- `withRole(allowedRoles)` - Checks user roles for authorization
- `AuthContext` - Type definition for authenticated context

**Features:**

- Automatic Clerk user lookup
- Database user resolution with timeout protection
- Role-based access control (RBAC)
- Correlation ID tracking
- Structured logging

**Usage Example:**

```typescript
import { withAuth, withRole } from "@/app/lib/api-middleware";

// Basic authentication
export const GET = withAuth(async (req, context) => {
  const { dbUserId, userEmail, userRole } = context;
  // Your logic here
});

// Role-based authorization
export const POST = withRole(["ADMIN", "PROFESSIONAL"])(async (
  req,
  context,
) => {
  // Only admins and professionals can access
});
```

---

### 2. **resilient-api.ts** - Resilience Patterns & Response Functions

**Purpose:** Single source of truth for API responses with built-in resilience patterns.

**Exports:**

- `apiSuccess(data, status?, headers?)` - Build success responses with correlation ID
- `apiError(message, status?, details?)` - Build error responses with logging
- `executeResilient(operation, options)` - Execute with retry, circuit breaker, cache
- `resilientFetch(url, options)` - Resilient HTTP client
- `initializeCorrelationId(req)` - Extract or generate correlation ID
- `getClientLogger()` - Get shared logger instance
- `getResilientExecutor()` - Get shared executor instance
- `healthCheck(serviceName, checks)` - Health check endpoint helper

**Features:**

- Automatic retry with exponential backoff
- Circuit breaker pattern
- Request/response caching
- Timeout protection
- Correlation ID propagation
- Comprehensive metrics collection

**Usage Example:**

```typescript
import {
  apiSuccess,
  apiError,
  executeResilient,
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/resilient-api";

const logger = getClientLogger();

export const GET = withAuth(async (req, context) => {
  const correlationId = initializeCorrelationId(req);

  return executeResilient(
    async () => {
      const data = await prisma.item.findMany();
      logger.info("Items fetched", { correlationId, count: data.length });
      return { items: data };
    },
    {
      operationName: "fetch-items",
      timeout: 5000,
      retry: { maxAttempts: 3 },
      cache: { ttl: 60000 },
      metrics: true,
    },
  );
});
```

---

### 3. **api-response.ts** - Response Types & Constants

**Purpose:** Provides TypeScript types, constants, and legacy response builders.

**Exports:**

- **Types:** `ApiSuccessResponse<T>`, `ApiErrorResponse`, `ApiListResponse<T>`
- **Constants:** `HttpStatus`, `ErrorCodes`
- **Utilities:** `buildSuccessResponse()`, `buildListResponse()`, `buildErrorResponse()`
- **Legacy:** `apiSuccess()`, `apiError()` (deprecated - use resilient-api.ts instead)

**Features:**

- Strong type safety for API responses
- Standardized HTTP status codes
- Business error codes for client-side handling
- Pagination types

**Usage Example:**

```typescript
import {
  HttpStatus,
  ErrorCodes,
  ApiSuccessResponse,
} from "@/app/lib/api-response";
import { apiSuccess, apiError } from "@/app/lib/resilient-api";

// Use types for better intellisense
type ItemResponse = ApiSuccessResponse<{ items: Item[] }>;

// Use constants for consistency
if (!authorized) {
  return apiError("Forbidden", HttpStatus.FORBIDDEN);
}
```

---

### 4. **api-utils.ts** - Request Parsing & Helper Wrappers

**Purpose:** Provides utilities for parsing requests and composing middleware patterns.

**Exports:**

- `parsePaginationParams(searchParams, options?)` - Extract page/limit from query
- `buildPaginationResponse(page, limit, total)` - Build pagination metadata
- `parseStatusFilter(statusParam, statusMap)` - Parse comma-separated statuses
- `createStatusMapper(statusMap)` - Generic status enum mapper
- `withRateLimitedExecution(req, userId, options, handler)` - Composite wrapper

**Constants:**

- `LEAD_STATUS_MAP`, `ORDER_STATUS_MAP`, `INQUIRY_STATUS_MAP`, `PROJECT_STATUS_MAP`

**Features:**

- Type-safe pagination helpers
- Status enum conversions
- Composable middleware patterns
- Rate limiting integration

**Usage Example:**

```typescript
import {
  parsePaginationParams,
  buildPaginationResponse,
  withRateLimitedExecution,
} from "@/app/lib/api-utils";

export const GET = withAuth(async (req, { dbUserId }) => {
  return withRateLimitedExecution(
    req,
    dbUserId,
    {
      operationName: "list-items",
      rateLimit: "read",
    },
    async (correlationId) => {
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

---

### 5. **rate-limit.ts** - Rate Limiting

**Purpose:** In-memory rate limiter for API protection (production: use Redis).

**Exports:**

- `checkRateLimit(identifier, limit, window)` - Check and increment rate limit
- `getRateLimitIdentifier(req)` - Extract IP from request
- `RateLimits` - Predefined rate limit configurations

**Configurations:**

- `AUTH`: 5 req/min - Strict for authentication
- `EXPORT`: 5 req/hour - Very strict for heavy operations
- `WRITE`: 10 req/min - Moderate for mutations
- `READ`: 100 req/min - Relaxed for queries
- `WEBHOOK`: 100 req/min - Generous for external services

**Usage Example:**

```typescript
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";
import { apiError, HttpStatus } from "@/app/lib/resilient-api";

export const POST = withAuth(async (req, context) => {
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  // Continue with operation
});
```

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
