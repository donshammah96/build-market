# Build Market API Architecture & Design

## Overview

The Build Market client API follows a layered architecture with consistent patterns for authentication, error handling, resilience, and observability.

---

## Architecture Patterns

### Middleware Chain

```
Request → Rate Limiting → Authentication → Validation → Handler → Response
```

**Key Middleware:**
- `withAuth` - Clerk authentication + database user resolution
- `withRole` - Role-based access control
- `withValidation` - Zod schema validation

### Response Utilities

All responses use centralized utilities from `resilient-api.ts`:
- `apiSuccess(data, status)` - Consistent success format
- `apiError(message, status, details?)` - Consistent error format
- Both include correlation IDs for request tracing

---

## Resilience Patterns

### ResilientExecutor

Wraps operations with:
- **Circuit Breaker** - Prevents cascade failures
- **Retry** - Automatic retries with backoff
- **Timeout** - Prevents hanging requests
- **Caching** - Reduces database load

```typescript
executeResilient(
  async () => { /* operation */ },
  {
    operationName: 'operation-name',
    criticality: 'normal',
    cache: { ttl: 30000 },
  }
);
```

### Rate Limiting

In-memory sliding window (Redis recommended for production):
```typescript
checkRateLimit(identifier, limit, window);
```

---

## Observability

### Structured Logging

All logging via `StructuredLogger`:
```typescript
logger.info('Message', { correlationId, userId, ...context });
logger.error('Error', error, { correlationId, ...context });
```

### Correlation IDs

Every request gets a correlation ID for request tracing:
```typescript
const correlationId = initializeCorrelationId(request);
```

Response headers include `X-Correlation-ID`.

---

## Repository Pattern

Data access through repository classes:
- `UserRepository` - User CRUD operations
- `ProfessionalRepository` - Professional queries

Benefits:
- Database logic isolated from handlers
- Easy to mock for testing
- Consistent query patterns

---

## Directory Structure

```
app/api/
├── health/              # Health checks
├── user/                # User profile endpoints
├── professionals/       # Public professional listings
├── professional-portal/ # Professional dashboard APIs
│   ├── profile/
│   ├── projects/
│   ├── leads/
│   ├── calendar/
│   ├── finance/
│   └── portfolio/
├── messaging/           # Conversation & message APIs
├── leads/               # Public lead submission
├── uploads/             # File uploads
├── onboarding/          # User onboarding
├── clerk-webhook/       # Clerk sync webhook
├── API.md               # This file
└── DESIGN.md            # Architecture docs
```

---

## Future Enhancements

### Short-term
1. **Redis Rate Limiting** - Replace in-memory store with Redis for production scale
2. **OpenAPI Spec** - Generate OpenAPI/Swagger documentation
3. **Input Sanitization** - Add XSS/injection protection middleware
4. **Request Logging** - Centralized access logs

### Medium-term
1. **API Versioning** - `/api/v1/` prefix for breaking changes
2. **GraphQL** - Consider for complex client queries
3. **Webhook Retries** - Queue failed webhook events for retry
4. **Batch Endpoints** - Reduce N+1 API calls

### Long-term
1. **Microservices** - Extract messaging, notifications as separate services
2. **Event Sourcing** - Audit trail for critical operations
3. **CDN Edge Functions** - Move read endpoints to edge
4. **Real-time Subscriptions** - WebSocket/SSE for live updates

---

## Testing Strategy

### Unit Tests
- Mock Prisma client
- Test individual handlers
- Validate error paths

### Integration Tests
- Test full request/response cycle
- Verify middleware chain
- Check database operations

### Location
```
__tests__/
├── api/
│   ├── professionals/
│   ├── onboarding/
│   └── clerk-webhook/
└── lib/
    ├── api-middleware.test.ts
    └── repositories/
```

Run tests: `npm run test`
