# Build Market — Copilot Instructions

## Architecture Overview

Turborepo monorepo for a **Kenya-focused construction marketplace** connecting primarily homeowners and related entities with verified professionals, vendors, and suppliers. Two Next.js 15 App Router frontends (`apps/client` on port 3500, `apps/admin` on port 3005) with shared packages under `packages/`. Package manager: **pnpm 10.20**.

**Shared packages** (imported as `@build/<name>`):

- `@build/db` — Prisma client + re-exported types/enums (PostgreSQL with `citext`, full-text search)
- `@build/types` — Zod schemas mirroring Prisma models for client-side validation
- `@build/resilience` — `ResilientExecutor` (timeout → retry → circuit breaker → cache → fallback)
- `@build/redis` — `RedisCache<T>` with `getOrSet()` cache-aside pattern
- `@build/nats` — NATS JetStream event-driven messaging (see [Event Messaging](#event-messaging-nats-jetstream) below)
- `@build/ui` — Shared UI components (shadcn/ui based)

## Key Commands

```bash
pnpm install                          # Install all workspace deps
pnpm run dev:client                   # Client app only (fastest)
pnpm run dev:admin                    # Admin app only
cd packages/db && npx prisma migrate deploy  # Run DB migrations
cd apps/client && pnpm vitest --run   # Run all tests
cd apps/client && pnpm vitest --run __tests__/api/stores/route.test.ts  # Single test
```

## API Route Pattern (apps/client/app/api/)

Every route handler follows this structure — **do not deviate**:

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";
import { getRequestMetadata } from "@/app/lib/request-utils";
// For mutations — import extracted services (do NOT define inline):
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { checkBodySize, isValidId } from "@/app/lib/api-guards";
import { STORE_CONFIG } from "@/app/lib/config/store.config"; // or domain-specific config

// Public GET — no withAuth wrapper
export async function GET(req: NextRequest) {
  const correlationId = initializeCorrelationId(req);
  const identifier = getRateLimitIdentifier(req);
  const rateLimit = await checkRateLimit(
    identifier,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );
  if (!rateLimit.success)
    return apiError("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
  // Zod validation → resilientExecutor.execute(() => prisma.xxx.findMany(...)) → apiSuccess(data)
}

// Protected mutation — withAuth provides { clerkId, dbUserId, userEmail, userRole }
export const POST = withAuth(async (req, { dbUserId }) => {
  // Same flow: correlationId → rateLimit → validate → execute → respond
});
```

- **Response format**: `apiSuccess(data)` → `{ success, data, timestamp, correlationId }`; `apiError(msg, status)` → `{ success, error, timestamp }`
- **Validation schemas** live in `app/lib/` (e.g., `stores-validation.ts`) — use `z.nativeEnum()` with Prisma enums. Keep schemas pure (no business logic, no service imports)
- **Dynamic routes** receive `params` as an awaited Promise: `(req, authCtx, params) => { const { id } = await params; }`
- **Repository pattern** exists in `app/lib/repositories/` for complex data access
- **Resilience**: Always use `getResilientExecutor().execute(fn, { operationName })` — this is the preferred pattern. `executeResilient(fn)` exists but is legacy; use the executor form for new code. The executor returns `OperationResult<T>` with `{ success, data, fromCache, error, attempts, duration }`
- **Guards**: Use `checkBodySize()`, `checkImageCount()`, `isValidId()` from `app/lib/api-guards.ts` — do not redefine inline
- **Idempotency**: For mutations, use `IdempotencyService` from `app/lib/services/idempotency.service.ts` — do not define inline
- **Constants**: Use `STORE_CONFIG` from `app/lib/config/store.config.ts` — do not define local `CONFIG` objects in route files

## Service Layer vs API Routes

**API routes** (`app/api/`) are thin HTTP adapters — they handle auth, rate limiting, validation, and response formatting. **Domain logic and reusable services** live in `app/lib/services/` and are imported by routes. **Server-only data access** (`lib/services/`) is for server components.

| Use case                      | Pattern                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| Client-side data fetching     | React Query hook → `fetch("/api/...")` → API route               |
| Server component data         | Direct import from `lib/services/` or Prisma                     |
| Complex queries in API routes | `app/lib/repositories/` (e.g., `store.repository.ts`)            |
| Mutation deduplication        | `IdempotencyService` from `app/lib/services/idempotency.service` |
| Optimistic locking / events   | `StoreEventService` + `store-operations.service`                 |
| Request validation guards     | `checkBodySize`, `checkImageCount`, `isValidId` from `app/lib/api-guards` |
| Shared constants              | `app/lib/config/store.config.ts` (or domain-specific config)     |
| Cross-service events          | NATS JetStream producer (see below)                              |

Service files export plain async functions with typed inputs — see `lib/services/projects.ts`, `lib/services/upload.ts`.

## Extracted API Services (app/lib/services/)

Domain logic is extracted from route handlers into dedicated service files. **Route files should remain thin HTTP adapters** — they compose services, not implement business logic inline.

### Configuration (`app/lib/config/store.config.ts`)

Shared constants for store routes. Import and use `STORE_CONFIG` instead of defining local `CONFIG` objects:

```typescript
import { STORE_CONFIG } from "@/app/lib/config/store.config";
// STORE_CONFIG.MAX_BODY_SIZE, STORE_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES, etc.
```

When adding new API domains, create a similar `<domain>.config.ts` file if multiple routes share constants.

### Idempotency (`app/lib/services/idempotency.service.ts`)

Mutation deduplication via SHA-256 key hashing and the `IdempotencyKey` Prisma model. **Use for all POST/PATCH/DELETE mutations** that should be safe to retry:

```typescript
import { IdempotencyService } from "@/app/lib/services/idempotency.service";

// Generate or accept client-provided key
const key = req.headers.get("Idempotency-Key") ||
  IdempotencyService.generateKey(userId, "POST", payload);

// Check-or-create (returns "new" | "pending" | "completed")
const check = await IdempotencyService.checkOrCreate(key, "store", userId, "POST", entityId?);
if (check?.status === "completed") return apiSuccess(check.response, HttpStatus.OK);
if (check?.status === "pending") return apiError("Request in progress", HttpStatus.CONFLICT);

// After success:
await IdempotencyService.complete(key, responseData);
// On failure:
await IdempotencyService.fail(key);
```

### Store Event Sourcing (`app/lib/services/store-event.service.ts`)

Append-only event log with version-based optimistic locking for the `Store` model:

```typescript
import { StoreEventService } from "@/app/lib/services/store-event.service";

// Inside a $transaction:
const newVersion = await StoreEventService.append(tx, storeId, StoreEventType.STORE_UPDATED, payload, metadata, userId, expectedVersion);

// Outside transactions:
const version = await StoreEventService.getCurrentVersion(storeId);
const events = await StoreEventService.replay(storeId);
```

### Store Operations (`app/lib/services/store-operations.service.ts`)

Domain logic for store mutations — ownership verification, Prisma update payload building, and transactional optimistic-locking operations:

```typescript
import {
  type StoreOperationContext,
  updateStoreWithOptimisticLock,
  deleteStoreWithOptimisticLock,
  buildConflictResponse,
  buildUpdatePayload,
  verifyStoreOwnership,
  isOptimisticRetryEnabled,
} from "@/app/lib/services/store-operations.service";
```

Exported types: `StoreOperationContext`, `OptimisticLockResult<T>`, `StoreOperationResult<T>`, `UpdateStoreData`.

### API Guards (`app/lib/api-guards.ts`)

Reusable validation guards that return `null` (pass) or `NextResponse` (fail). Use these instead of defining inline guards in route files:

```typescript
import { checkBodySize, checkImageCount, isValidId } from "@/app/lib/api-guards";

const sizeError = checkBodySize(req);           // uses STORE_CONFIG.MAX_BODY_SIZE default
const imgError = checkImageCount(data.images);  // uses STORE_CONFIG.MAX_IMAGES_PER_REQUEST default
if (!isValidId(params?.id)) return apiError("Invalid ID", HttpStatus.BAD_REQUEST);
```

## Auth (Clerk)

- **Middleware** (`apps/client/middleware.ts`): Clerk session → role from JWT claims → DB fallback via `/api/internal/user-status` with `INTERNAL_API_SECRET`
- **API auth**: `withAuth(handler)` calls `auth()` from `@clerk/nextjs/server`, looks up DB user by `clerkId`, returns `AuthContext`
- **Role gating**: `withRole(["ADMIN"])` composes on top of `withAuth`
- **Admin app**: All routes require `admin` or `verification_admin` role
- API routes under `/api/` are public in middleware — they self-authenticate with `withAuth`

## Database (Prisma)

- Schema: `packages/db/prisma/schema.prisma` (~2900 lines)
- **All models use UUID PKs** (`@id @default(uuid())`), explicit table mapping (`@@map("table_name")`)
- **Soft delete**: `deletedAt DateTime?` — always filter with `deletedAt: null`
- **Enums**: SCREAMING_SNAKE_CASE, Kenya-specific (`County` with 47 counties, `LicenseAuthority` for NCA/EBK/BORAQS)
- **GDPR**: Consent records on data access, encryption flags, anonymization, data retention fields
- Import prisma: `import { prisma } from "@build/db"` (or `from "@/lib/db"` in client app)
- Import types/enums: `import { UserRole, StoreCategory } from "@prisma/client";` (re-exported from `@build/db`)

## Testing (Vitest)

Tests in `apps/client/__tests__/`. Globals enabled — no need to import `describe`/`it`/`expect`.

**Required mocking pattern** (use `vi.hoisted()` for logger):

```typescript
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/app/lib/api-middleware", () => ({
  withAuth: (handler: any) => async (req: NextRequest) =>
    handler(req, {
      clerkId: "clerk_123",
      dbUserId: "db_user_123",
      userEmail: "test@example.com",
      userRole: "professional",
    }),
}));

vi.mock("@build/db", () => ({
  prisma: { store: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() } },
}));

vi.mock("@/app/lib/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn) => {
      try {
        return { success: true, data: await fn() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  }),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
}));

vi.mock("@/app/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
  },
}));
```

- Test handlers directly: `const response = await GET(request)` — no HTTP server
- Dynamic route params: `{ params: Promise.resolve({ id: "store_1" }) }`
- Naming: `route.test.ts` (collection), `store-id.route.test.ts` (dynamic `[id]`)

## Client-Side Patterns

- **Data fetching**: React Query (`@tanstack/react-query`) — all hooks marked `"use client"`
- **API response unwrap**: `json.data.data` (success envelope wraps actual data array)
- **Route constants**: `ROUTES` and `API_ROUTES` objects in `lib/links.ts`
- **Styling**: Tailwind CSS with `cn()` utility (`clsx` + `tailwind-merge`) from `lib/utils.ts`
- **URL helpers**: `withQueryParams()`, `withPagination()`, `toSlug()`/`fromSlug()` in `lib/links.ts`

## Event Messaging (NATS JetStream)

The `@build/nats` package provides event-driven messaging between services. All cross-service communication should use NATS rather than direct HTTP calls.

**Core components** (all in `packages/nats/src/`):

- `JetStreamProducer` — publish typed events with deduplication and delivery guarantees
- `JetStreamConsumer` — subscribe with durable consumers, explicit ack/nak/term
- `StreamManager` — create/update streams via `ensureStream(options)`
- `createServiceClient(name)` — per-service NATS connection

**Predefined streams** (`StreamPresets`):
| Stream | Subjects | Retention | Max Age |
|---|---|---|---|
| `VERIFICATION` | `verification.>` | limits | 7 days |
| `USERS` | `user.>` | limits | 30 days |
| `ORDERS` | `order.>` | limits | 90 days |
| `PROJECTS` | `project.>` | limits | 90 days |
| `NOTIFICATIONS` | `notification.>` | workqueue | 24 hours |

**Typed event payloads**: `VerificationEvent`, `UserEvent`, `OrderEvent`, `ProjectEvent`, `NotificationEvent` — always use these types when publishing.

**Publishing pattern:**

```typescript
import { JetStreamProducer } from "@build/nats";
const producer = new JetStreamProducer("my-service");
await producer.connect();
await producer.publish<VerificationEvent>("verification.approved", {
  entityType: "professional", entityId: "...", newStatus: "APPROVED", ...
});
```

**Consuming pattern:**

```typescript
import { JetStreamConsumer } from "@build/nats";
const consumer = new JetStreamConsumer("my-service", "my-group");
await consumer.connect();
await consumer.subscribe([
  {
    subject: "verification.>",
    handler: async (msg) => {
      /* process msg.data */ msg.ack();
    },
  },
]);
```

## Admin App (`apps/admin`)

Runs on port 3005 with `src/` directory layout (unlike client app). All routes require `admin` or `verification_admin` role.

**Key architectural differences from client app:**

- Uses **Server Actions** (`src/actions/admin/`) instead of API routes for data mutations
- **No resilience/redis/nats** — simpler stack with direct Prisma access
- Role sync via `syncUserRole()` from `src/lib/auth-sync.ts` (Clerk metadata → DB)

**Server Actions structure** (`src/actions/admin/`):

- `shared.ts` — `assertAdmin()` middleware, `safeAction(name, fn)` wrapper for error handling
- Domain files: `users.ts`, `professionals.ts`, `stores.ts`, `projects.ts`, `verification.ts`, `settings.ts`, `analytics.ts`, `audit.ts`, `leads.ts`, `properties.ts`, `services.ts`
- `types.ts` — `ActionResponse<T>`, pagination schemas, input types (non-"use server" file for Zod schemas)

**Action pattern:**

```typescript
"use server";
import { safeAction } from "./shared";
export async function getUsers(page = 1, limit = 10, search = "") {
  return safeAction("getUsers", async () => {
    // Prisma query → return { users, meta: { total, page, ... } }
  });
}
```

**Dashboard sections**: `analytics`, `audit`, `leads`, `professionals`, `projects`, `properties`, `services`, `settings`, `stores`, `users`, `verifications`

**UI stack**: `@tanstack/react-table` for data tables, `recharts` for charts, `lucide-react` icons, `@build/ui` components

## Project-Specific Conventions

- **Kenya context**: Counties (not states), M-Pesa payments, NCA/EBK/BORAQS license authorities, KRA tax compliance
- **Admin app uses `src/`** directory; client app does **not**
- **Env validation**: `lib/env.ts` exports `envConfig` with grouped, validated env vars — use it instead of raw `process.env`
- **Event sourcing**: `StoreEventService` in `app/lib/services/store-event.service.ts` — append-only events with version-based optimistic locking
- **Idempotency**: `IdempotencyService` in `app/lib/services/idempotency.service.ts` — SHA-256 key hashing for mutation deduplication
- **Store operations**: `app/lib/services/store-operations.service.ts` — ownership checks, payload building, transactional update/delete with optimistic locking
- **API guards**: `app/lib/api-guards.ts` — reusable `checkBodySize`, `checkImageCount`, `isValidId`
- **Route config**: `app/lib/config/store.config.ts` — shared constants; create `<domain>.config.ts` for new API domains
- **No inline services**: Do not define service classes (e.g., `IdempotencyService`, `EventStore`) inside route files — import from `app/lib/services/`
