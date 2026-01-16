# Admin Verification System

## Overview

A comprehensive, enterprise-grade verification system for Build Market that enables admins to verify professionals, stores, and properties with complete audit trails, automated notifications, and fault-tolerant architecture.

## Features

### ✅ Unified Verification Workflow

- Single API endpoint for all entity types (professionals, stores, properties)
- Finite State Machine (FSM) pattern for status transitions
- Support for multiple verification actions: VERIFY, REJECT, REQUEST_CORRECTION

### ✅ Complete Audit Trail

- Centralized `AdminAuditLog` table tracking all verification actions
- Tracks who performed the action, when, and why
- IP address and user agent logging for security
- Audit history accessible via API

### ✅ Document Verification

- Individual and batch document verification
- Support for professional documents, certificates, and property attachments
- Document-level approval with admin notes

### ✅ Automated Notifications

- In-database notifications for verification outcomes
- Optional integration with external notification service
- Kafka event publishing for email notifications
- Context-aware notification messages and links

### ✅ Admin Dashboard Endpoints

- Pending verifications with filters and pagination
- Detailed entity review with all documents and history
- Comprehensive statistics and metrics
- Real-time activity tracking

### ✅ Enterprise-Grade Architecture

- Resilience patterns (circuit breakers, retries, timeouts)
- Rate limiting (20 verifications/minute)
- Structured logging with correlation IDs
- Comprehensive error handling
- Transaction safety for batch operations

### ✅ Comprehensive Test Coverage

- Unit tests for all services
- Integration tests for API endpoints
- Mock-based testing with Vitest
- Test coverage for state transitions and edge cases

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Dashboard UI                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Admin API Routes                           │
│  • /api/admin/verify (unified verification)                  │
│  • /api/admin/verify-document (document verification)        │
│  • /api/admin/pending-verifications (list pending)           │
│  • /api/admin/verification-details/[id] (entity details)     │
│  • /api/admin/verification-stats (metrics)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Verification Services                        │
│  • ProfessionalVerificationService                           │
│  • StoreVerificationService                                  │
│  • PropertyVerificationService                               │
│  • AuditService                                              │
│  • NotificationService                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
│  • ProfessionalProfile (with audit fields)                   │
│  • Store (with audit fields)                                 │
│  • Property (with audit fields)                              │
│  • AdminAuditLog (centralized audit trail)                   │
│  • Notification (in-app notifications)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│  • Notification Service (port 3011)                          │
│  • Email Service (via Kafka)                                 │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
apps/client/
├── app/api/admin/
│   ├── verify/
│   │   └── route.ts                    # Unified verification endpoint
│   ├── verify-document/
│   │   └── route.ts                    # Document verification endpoint
│   ├── pending-verifications/
│   │   └── route.ts                    # List pending items
│   ├── verification-details/
│   │   └── [id]/route.ts               # Entity details
│   └── verification-stats/
│       └── route.ts                    # Metrics and statistics
├── lib/services/verification/
│   ├── types.ts                        # Type definitions and FSM
│   ├── professional-verification.service.ts
│   ├── store-verification.service.ts
│   ├── property-verification.service.ts
│   ├── audit-service.ts
│   ├── notification.service.ts
│   └── index.ts                        # Centralized exports
└── __tests__/admin-verification/
    ├── verification-types.test.ts      # FSM and validation tests
    ├── verify-api.test.ts              # Unified endpoint tests
    ├── verify-document-api.test.ts     # Document verification tests
    ├── audit-service.test.ts           # Audit logging tests
    └── notification-service.test.ts    # Notification dispatch tests

packages/db/prisma/
└── schema.prisma                       # Enhanced schema with audit fields

Documentation:
├── VERIFICATION_MIGRATION_GUIDE.md     # Migration instructions
├── VERIFICATION_API_DOCS.md            # API reference
└── README.md                           # This file
```

## Quick Start

### 1. Apply Database Migration

```powershell
cd packages/db
pnpm prisma migrate dev --name add_verification_audit_trail
```

### 2. Configure Environment Variables (Optional)

```bash
# .env
ENABLE_NOTIFICATION_SERVICE=false
NOTIFICATION_SERVICE_URL=http://localhost:3011
```

### 3. Run Tests

```powershell
cd apps/client
pnpm test admin-verification
```

### 4. Start the Application

```powershell
# Terminal 1: Start main app
cd apps/client
pnpm dev

# Terminal 2: Start notification service (optional)
cd apps/notification-service
pnpm dev
```

### 5. Test the API

```bash
# Verify a professional
curl -X POST http://localhost:3500/api/admin/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <clerk-token>" \
  -d '{
    "entityType": "professional",
    "entityId": "prof_uuid",
    "action": "VERIFY",
    "notes": "All documents verified"
  }'
```

## Usage Examples

### Verify a Professional

```typescript
import { verifyProfessional } from "@/lib/services/verification";

const result = await verifyProfessional({
  entityType: "professional",
  entityId: "prof_uuid",
  action: "VERIFY",
  notes: "All documents verified",
  adminId: "admin_uuid",
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0",
});

console.log(result.message); // "Professional 'Company Name' has been verified"
```

### Batch Verify Documents

```typescript
const response = await fetch("/api/admin/verify-document", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    documents: [
      {
        documentType: "professional_document",
        documentId: "doc1",
        action: "APPROVE",
      },
      { documentType: "certificate", documentId: "cert1", action: "APPROVE" },
    ],
  }),
});
```

### Get Pending Verifications

```typescript
const response = await fetch(
  "/api/admin/pending-verifications?entityType=professional&status=PENDING&page=1"
);
const data = await response.json();

console.log(`${data.pagination.total} pending verifications`);
```

## State Machine

The verification system uses a Finite State Machine pattern to ensure valid status transitions:

```
UNVERIFIED ─────VERIFY──────> VERIFIED
    │                            ▲
    │                            │
    └──REJECT──> REJECTED ───────┘
    │               │
    │               └──REQUEST_CORRECTION──> NEEDS_CORRECTION
    │                                            │
    └──REQUEST_CORRECTION──> PENDING ───────────┘
                                │
                                ├──VERIFY──> VERIFIED
                                ├──REJECT──> REJECTED
                                └──REQUEST_CORRECTION──> NEEDS_CORRECTION
```

### Validation Rules

- `REJECT` and `REQUEST_CORRECTION` actions require a reason
- `VERIFY` action does not require a reason
- Invalid transitions are rejected with error message
- All transitions are logged in audit trail

## API Reference

See [VERIFICATION_API_DOCS.md](./VERIFICATION_API_DOCS.md) for complete API documentation.

## Testing

Run the test suite:

```powershell
# Run all verification tests
pnpm test admin-verification

# Run specific test file
pnpm test verification-types.test.ts

# Run with coverage
pnpm test --coverage admin-verification
```

### Test Coverage

- ✅ State machine validation (12 tests)
- ✅ Unified verification API (5 tests)
- ✅ Document verification API (4 tests)
- ✅ Audit service (3 tests)
- ✅ Notification service (6 tests)

**Total: 30 tests**

## Documentation

- **[VERIFICATION_MIGRATION_GUIDE.md](./VERIFICATION_MIGRATION_GUIDE.md)** - Database migration and setup instructions
- **[VERIFICATION_API_DOCS.md](./VERIFICATION_API_DOCS.md)** - Complete API reference and examples
- **[VERIFICATION_POLICIES_AND_SLAS.md](./VERIFICATION_POLICIES_AND_SLAS.md)** - Verification policies, SLAs, quality standards, and compliance requirements

## Performance

### Rate Limits

- **Verification endpoint**: 20 requests/minute per admin
- **Document verification**: 30 requests/minute per admin
- **Read endpoints**: 100 requests/minute per admin

### Optimizations

- Indexed queries on verification status, admin ID, submission date
- Batch operations use transactions for atomicity
- Resilience patterns prevent cascade failures
- Cache headers for read-heavy endpoints

### Monitoring

All operations are logged with:

- Correlation IDs for request tracing
- Operation duration metrics
- Success/failure rates
- Admin activity tracking

## Security

### Authentication & Authorization

- All endpoints require admin role via Clerk JWT
- Role verification at middleware level
- Optional dev bypass for testing (disable in production)

### Audit Trail

- Every verification action is logged
- IP address and user agent captured
- Immutable audit log (append-only)
- Retention policy configurable

### Data Protection

- Admin notes encrypted at rest (database-level)
- PII handling complies with GDPR
- Document URLs use secure storage
- Rate limiting prevents abuse

## Troubleshooting

### Common Issues

**Issue**: "Invalid status transition" error

- **Solution**: Check the current status and ensure the action is valid. Use `validateTransition` to verify.

**Issue**: "Reason is required" error

- **Solution**: Provide a `reason` field when using REJECT or REQUEST_CORRECTION actions.

**Issue**: "Rate limit exceeded"

- **Solution**: Wait 1 minute or reduce request frequency. Consider batch operations.

**Issue**: Notification not sent

- **Solution**: Check `ENABLE_NOTIFICATION_SERVICE` environment variable and notification service status.

### Debug Mode

Enable detailed logging:

```bash
DEBUG=verification:* pnpm dev
```

## Contributing

When adding new verification features:

1. Update the schema in `packages/db/prisma/schema.prisma`
2. Create service in `lib/services/verification/`
3. Add API route in `app/api/admin/`
4. Write tests in `__tests__/admin-verification/`
5. Update documentation

## Roadmap

### Phase 2 Enhancements

- [ ] Real-time WebSocket notifications for admins
- [ ] ML-based document verification pre-screening
- [ ] Automated certificate expiry monitoring
- [ ] Multi-admin approval workflow
- [ ] Bulk export of verification reports
- [ ] Admin performance dashboards
- [x] Verification SLA tracking (see [VERIFICATION_POLICIES_AND_SLAS.md](./VERIFICATION_POLICIES_AND_SLAS.md))

### Phase 3 Enhancements

- [ ] OCR for ID document validation
- [ ] Integration with government verification APIs
- [ ] Automated fraud detection
- [ ] Video verification for high-value entities
- [ ] Multi-language support for notifications

## License

Copyright © 2026 Build Market. All rights reserved.

## Support

For questions or issues:

- Email: dev@buildmarket.co.ke
- Slack: #verification-system
- Documentation: https://docs.buildmarket.co.ke/verification
