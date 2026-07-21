# Build Market User Data Management API

This folder contains API routes for managing user data in compliance with **GDPR (EU General Data Protection Regulation)** and **Kenya Data Protection Act 2019**.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Available Endpoints](#available-endpoints)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Compliance](#compliance)
- [Development Guidelines](#development-guidelines)

## Overview

These routes implement the core GDPR user rights:

| Right                      | Endpoint                  | Description                                    |
| -------------------------- | ------------------------- | ---------------------------------------------- |
| **Right to Access**        | `/api/user/export`        | Request and download personal data             |
| **Right to Rectification** | `/api/user/rectification` | Correct inaccurate personal data               |
| **Right to Erasure**       | `/api/user/deletion`      | Request account deletion (30-day grace period) |
| **Consent Management**     | `/api/user/consent`       | Manage GDPR consent preferences                |
| **Profile Management**     | `/api/user/profile`       | Update user profile information                |

## Architecture

### Design Patterns

All routes follow these architectural patterns:

```text
┌─────────────────┐
│  withAuth()     │  ← Authentication middleware
└────────┬────────┘
         │
┌────────▼────────┐
│ Correlation ID  │  ← Request tracing
└────────┬────────┘
         │
┌────────▼────────┐
│ Rate Limiting   │  ← Request throttling
└────────┬────────┘
         │
┌────────▼────────┐
│ Safe JSON Parse │  ← Input validation
└────────┬────────┘
         │
┌────────▼────────┐
│ Zod Validation  │  ← Schema validation
└────────┬────────┘
         │
┌────────▼────────┐
│ Resilient       │  ← Retry + Circuit Breaker
│ Executor        │     + Timeout handling
└────────┬────────┘
         │
┌────────▼────────┐
│ Prisma          │  ← Database transaction
│ Transaction     │
└────────┬────────┘
         │
┌────────▼────────┐
│ Audit Logging   │  ← Compliance trail
└────────┬────────┘
         │
┌────────▼────────┐
│ API Response    │  ← Structured response
└─────────────────┘
```

### Shared Utilities

- **`request-utils.ts`**: JSON parsing, UUID validation, request metadata extraction
- **`resilient-api.ts`**: Resilient executor, logging, error handling
- **`rate-limit.ts`**: In-memory rate limiting (upgrade to Redis for production)
- **`api-response.ts`**: Standardized response formats and HTTP status codes

## Available Endpoints

### 1. Export (Data Portability)

**POST /api/user/export** - Request data export

```bash
curl -X POST https://buildmarket.com/api/user/export \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"format": "json"}'
```

**Response** (202 Accepted):

```json
{
  "success": true,
  "exportId": "uuid",
  "status": "PROCESSING",
  "message": "Export queued for processing"
}
```

**GET /api/user/export** - List all exports or get export status

```bash
# List all exports
curl https://buildmarket.com/api/user/export \
  -H "Authorization: Bearer <token>"

# Get specific export status
curl https://buildmarket.com/api/user/export?id=<exportId> \
  -H "Authorization: Bearer <token>"
```

**Rate Limits:**

- POST: 1 request per 24 hours
- GET: 100 requests per minute

---

### 2. Deletion (Right to Erasure)

**POST /api/user/deletion** - Request account deletion

```bash
curl -X POST https://buildmarket.com/api/user/deletion \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "No longer using the platform",
    "emailConfirmation": "user@example.com"
  }'
```

**Response**:

```json
{
  "success": true,
  "scheduledDeletionAt": "2026-03-07T10:00:00Z",
  "gracePeriodDays": 30,
  "message": "Deletion scheduled. You have 30 days to cancel."
}
```

**PATCH /api/user/deletion** - Cancel deletion (within grace period)

```bash
curl -X PATCH https://buildmarket.com/api/user/deletion \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "cancel"}'
```

**GET /api/user/deletion** - Check deletion status

```bash
curl https://buildmarket.com/api/user/deletion \
  -H "Authorization: Bearer <token>"
```

**Rate Limits:**

- POST: 10 requests per minute
- PATCH: 10 requests per minute
- GET: 100 requests per minute

---

### 3. Consent Management

**POST /api/user/consent** - Grant consent

```bash
curl -X POST https://buildmarket.com/api/user/consent \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MARKETING_EMAIL",
    "granted": true,
    "documentVersion": "v1.0"
  }'
```

**PUT /api/user/consent** - Bulk consent update (onboarding)

```bash
curl -X PUT https://buildmarket.com/api/user/consent \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "consents": [
      {"type": "MARKETING_EMAIL", "granted": true},
      {"type": "ANALYTICS_COOKIES", "granted": false}
    ]
  }'
```

**GET /api/user/consent** - Retrieve consent history

```bash
curl https://buildmarket.com/api/user/consent \
  -H "Authorization: Bearer <token>"
```

**Rate Limits:**

- POST: 10 requests per minute
- PUT: 10 requests per minute
- GET: 100 requests per minute

---

### 4. Rectification (Data Correction)

**POST /api/user/rectification** - Request data correction

```bash
curl -X POST https://buildmarket.com/api/user/rectification \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Don",
    "lastName": "Shammah",
    "phone": "+254798798770",
    "clientProfile": {
      "companyName": "Titan Nexus",
      "kraPin": "A123456789Z"
    },
    "reason": "Legal name change",
    "supportingDocumentUrls": ["https://..."]
  }'
```

**Response**:

```json
{
  "success": true,
  "rectificationId": "uuid",
  "updatedFields": ["firstName", "lastName"],
  "auditLogId": "uuid"
}
```

**GET /api/user/rectification** - Get rectification history

```bash
curl https://buildmarket.com/api/user/rectification?limit=10 \
  -H "Authorization: Bearer <token>"
```

**Rate Limits:**

- POST: 10 requests per minute
- GET: 100 requests per minute

---

### 5. Profile Management

**GET /api/user/profile** - Get comprehensive profile

```bash
curl https://buildmarket.com/api/user/profile \
  -H "Authorization: Bearer <token>"
```

**Response**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "don@titan.com",
      "firstName": "Don",
      "role": "CLIENT",
      "isProfileComplete": true
    },
    "profile": {/* Client/Professional profile */},
    "completion": {
      "percentage": 85,
      "missingRequired": [],
      "requiredPercentage": 100
    },
    "alerts": {
      "accountLocked": false,
      "scheduledForDeletion": false
    }
  }
}
```

**PATCH /api/user/profile** - Update profile

```bash
curl -X PATCH https://buildmarket.com/api/user/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Evans",
    "phone": "+254712345678",
    "emailMarketingConsent": true,
    "profileData": {
      "city": "Nairobi",
      "county": "NAIROBI"
    }
  }'
```

#### Profile Completion Endpoints

**PATCH /api/user/profile/complete** - Generic completion redirect

**PATCH /api/user/profile/complete/client** - Client-specific completion

```bash
curl -X PATCH https://buildmarket.com/api/user/profile/complete/client \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Don",
    "lastName": "Shammah",
    "phone": "+254798798770",
    "type": "HOMEOWNER",
    "city": "Nairobi",
    "county": "NAIROBI"
  }'
```

**PATCH /api/user/profile/complete/professional** - Professional-specific completion

```bash
curl -X PATCH https://buildmarket.com/api/user/profile/complete/professional \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Evans",
    "lastName": "Ndegwa",
    "companyName": "Evannas Construction Ltd",
    "profession": "GENERAL_CONTRACTOR",
    "businessEmail": "evans@evannasconstruction.co.ke",
    "city": "Mombasa",
    "yearsExperience": 15
  }'
```

**Rate Limits:**

- GET: 100 requests per minute
- PATCH: 10 requests per minute

---

## Authentication

All endpoints require authentication via the `withAuth()` middleware.

### Required Headers

```text
Authorization: Bearer <clerk_jwt_token>
Content-Type: application/json
```

### Auth Flow

1. Client authenticates with Clerk
2. Clerk issues JWT token
3. Token sent in Authorization header
4. `withAuth()` validates token and extracts `dbUserId`
5. Request proceeds with authenticated user context

## Rate Limiting

### Default Limits

| Category         | Limit        | Window   |
| ---------------- | ------------ | -------- |
| Auth             | 5 requests   | 1 minute |
| Export (POST)    | 1 request    | 24 hours |
| Write Operations | 10 requests  | 1 minute |
| Read Operations  | 100 requests | 1 minute |

### Rate Limit Responses

**429 Too Many Requests:**

```json
{
  "success": false,
  "error": "Rate limit exceeded. Try again in 45 seconds"
}
```

### Production Upgrade

⚠️ **Important**: Current implementation uses in-memory storage. For production, upgrade to Redis-based rate limiting:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
});
```

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {/* Optional additional info */}
}
```

### HTTP Status Codes

| Code | Meaning               | When Used                |
| ---- | --------------------- | ------------------------ |
| 200  | OK                    | Successful operation     |
| 202  | Accepted              | Async operation queued   |
| 400  | Bad Request           | Validation failed        |
| 401  | Unauthorized          | Missing/invalid auth     |
| 403  | Forbidden             | Insufficient permissions |
| 404  | Not Found             | Resource doesn't exist   |
| 410  | Gone                  | Resource deleted         |
| 429  | Too Many Requests     | Rate limit exceeded      |
| 500  | Internal Server Error | Server-side error        |

### Resilience Patterns

All routes use `getResilientExecutor()` which provides:

- **Retry Logic**: 2-3 attempts with exponential backoff
- **Circuit Breaker**: Prevents cascading failures
- **Timeout Handling**:
  - `CRITICAL`: 3 seconds (auth, payments)
  - `NORMAL`: 8 seconds (standard operations)
  - `BACKGROUND`: 30 seconds (exports, batch jobs)
- **Fallback Values**: Graceful degradation

## Compliance

### GDPR Articles Implemented

- **Article 15**: Right to Access → `/api/user/export`
- **Article 16**: Right to Rectification → `/api/user/rectification`
- **Article 17**: Right to Erasure → `/api/user/deletion`
- **Article 20**: Right to Data Portability → `/api/user/export`
- **Article 7**: Consent Management → `/api/user/consent`

### Kenya Data Protection Act 2019

- **Section 38**: Data Subject Rights (Access, Rectification, Erasure)
- **Section 30**: Consent Requirements
- **Section 26**: Data Portability

### Audit Logging

All operations create audit trail entries:

```typescript
{
  action: "PROFILE_UPDATED",
  userId: "uuid",
  performedBy: "uuid",
  ipAddress: "1.2.3.4",
  userAgent: "Mozilla/5.0...",
  metadata: {
    correlationId: "uuid",
    fieldsChanged: ["firstName", "phone"],
    before: { /* snapshot */ },
    after: { /* snapshot */ }
  }
}
```

### Data Retention

- **Active Users**: Indefinite (with explicit consent)
- **Deletion Grace Period**: 30 days
- **Audit Logs**: 7 years (compliance requirement)
- **Export History**: 90 days

## Development Guidelines

### Adding New Endpoints

1. **Follow the pattern**:

   ```typescript
   export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
     const correlationId = initializeCorrelationId(req);

     try {
       // 1. Rate limiting
       const rateLimitId = `${getRateLimitIdentifier(req)}-${dbUserId}-operation`;
       const rateLimitResult = await checkRateLimit(rateLimitId, limit, window);
       if (!rateLimitResult.success) return apiError(...);

       // 2. Safe JSON parsing
       const parseResult = await safeParseJsonBody(req);
       if (!parseResult.success) return apiError(...);

       // 3. Zod validation
       const validationResult = Schema.safeParse(parseResult.data);
       if (!validationResult.success) return apiError(...);

       // 4. Resilient execution
       const result = await executor.execute(
         async () => {
           return await prisma.$transaction(async (tx) => {
             // Your business logic
           });
         },
         {
           timeout: TimeoutConfig.NORMAL,
           retry: { maxAttempts: 2 },
           circuitBreaker: true,
           operationName: "operation-name",
         },
       );

       // 5. Handle result
       if (!result.success) return apiError(...);

       return apiSuccess(result.data);
     } catch (err) {
       logger.error("Operation failed", err, { userId: dbUserId, correlationId });
       return apiError(...);
     }
   });
   ```

2. **Always include**:
   - Correlation ID for tracing
   - Rate limiting for abuse prevention
   - Safe JSON parsing
   - Zod schema validation
   - Resilient executor for DB operations
   - Comprehensive audit logging
   - Structured error handling

3. **Never**:
   - Skip authentication checks
   - Return sensitive data without authorization
   - Use `req.json()` directly (use `safeParseJsonBody()`)
   - Forget to log security-relevant operations
   - Hard-code timeout values (use `TimeoutConfig`)

### Testing

```bash
# Run tests
pnpm test apps/client/app/api/user

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Environment Variables

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Database
DATABASE_URL=postgresql://...

# Redis (for production rate limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## 📚 Related Documentation

- [GDPR Compliance Guide](../../../../../../GDPR_COMPLIANCE.md)
- [Kenya DPA Implementation](../../../../../../KENYA_DPA.md)
- [API Architecture](../../../../../../ARCHITECTURE.md)
- [Resilience Patterns](../../../../../../packages/resilience/README.md)
- [Rate Limiting Setup](../../../../../../RATE_LIMITING.md)

## 🔗 Useful Links

- [GDPR Official Text](https://gdpr-info.eu/)
- [Kenya Data Protection Act 2019](https://www.odpc.go.ke/)
- [Clerk Authentication Docs](https://clerk.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

---

**Last Updated**: February 5, 2026  
**Maintainer**: Build Market Engineering Team
