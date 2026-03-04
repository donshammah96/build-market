# GDPR/Compliance Test Plan

This document outlines the comprehensive test coverage for the consolidated GDPR/compliance module.

## Test Coverage Summary

Target: **80%+ coverage** on all services and workers (lines, functions, branches, statements)

## Test Files Structure

```
__tests__/
├── mocks/
│   └── index.ts ✅ (Created - all mock factories)
├── lib/
│   ├── gdpr/
│   │   └── services/
│   │       ├── export.test.ts ✅ (Created)
│   │       ├── compliance.test.ts (TODO)
│   │       ├── consent.test.ts (TODO)
│   │       ├── anonymization.test.ts (TODO)
│   │       └── asset-cleanup.test.ts (TODO)
│   └── notifications/
│       ├── email.test.ts (TODO)
│       └── sms.test.ts (TODO)
└── workers/
    ├── export/
    │   ├── processor.test.ts (TODO)
    │   └── worker.test.ts (TODO)
    └── compliance/
        ├── incident.test.ts (TODO)
        └── notification.test.ts (TODO)
```

## Remaining Tests to Generate

### 1. Compliance Service Tests (`compliance.test.ts`)

- ✓ Get audit logs with filters
- ✓ Create audit log entries
- ✓ Get compliance dashboard statistics
- ✓ Handle DB errors gracefully
- ✓ Filter by date range
- ✓ Filter by action type
- ✓ Pagination

### 2. Consent Service Tests (`consent.test.ts`)

- ✓ Grant new consent
- ✓ Update existing consent
- ✓ Revoke consent
- ✓ Get consent history
- ✓ Sync to legacy User table
- ✓ Create audit trail
- ✓ Handle concurrent updates
- ✓ Transaction rollback scenarios

### 3. Anonymization Service Tests (`anonymization.test.ts`)

- ✓ Request deletion (Phase 1: Deactivate)
- ✓ Cancel deletion within grace period
- ✓ Complete anonymization after grace period
- ✓ Check legal holds (block deletion)
- ✓ Handle disputes/financial records
- ✓ PII replacement with ANONYMIZED-{UUID}
- ✓ Store closure for professionals
- ✓ Audit logging for all actions

### 4. Asset Cleanup Service Tests (`asset-cleanup.test.ts`)

- ✓ Schedule assets for deletion
- ✓ Restore assets on reactivation
- ✓ Reference counting (prevent deletion of shared assets)
- ✓ Transfer orphaned assets to system user
- ✓ S3 file deletion
- ✓ Handle S3 errors gracefully
- ✓ Batch processing for CRON job

### 5. Export Processor Tests (`processor.test.ts`)

- ✓ Fetch complete user data from DB
- ✓ Create ZIP archive with metadata
- ✓ Upload to S3 with encryption
- ✓ Generate signed URL (7-day expiry)
- ✓ Clean up temporary local files
- ✓ Handle S3 timeout
- ✓ Handle S3 upload failure
- ✓ Handle S3 eventual consistency
- ✓ Handle missing user data
- ✓ Progress callback updates
- **Snapshot**: ZIP file structure

### 6. Export Worker Tests (`worker.test.ts`)

- ✓ Process export job successfully
- ✓ Update job progress (0-100%)
- ✓ Handle job cancellation
- ✓ Update database on completion
- ✓ Update database on failure
- ✓ Concurrency control (2 simultaneous)
- ✓ Rate limiting (10 per minute)

### 7. Incident Worker Tests (`incident.test.ts`)

- ✓ Execute emergency protocol
- ✓ Notify ODPC within 72 hours
- ✓ Escalate to DPO
- ✓ Apply protective measures (password resets, session revocation)
- ✓ Queue user notifications
- ✓ Handle CRITICAL incidents
- ✓ Handle email delivery failures with retries
- ✓ Update incident status after notification
- **Snapshot**: ODPC notification email body

### 8. Notification Worker Tests (`notification.test.ts`)

- ✓ Batch process user notifications (100 per chunk)
- ✓ Concurrency control (5 batches)
- ✓ Rate limiting (50 per minute)
- ✓ Log delivery status to database
- ✓ Update incident notificationsSent flag
- ✓ Handle email failures gracefully
- ✓ Handle SMS failures gracefully
- ✓ Skip deactivated users

### 9. Email Service Tests (`email.test.ts`)

- ✓ Send generic email
- ✓ Send breach notification email
- ✓ Send ODPC notification email
- ✓ Send DPO escalation email
- ✓ Send export ready email
- ✓ Handle mailer delivery failure
- ✓ Handle rate limiting
- ✓ Template rendering
- **Snapshot**: All email templates (HTML and text)

### 10. SMS Service Tests (`sms.test.ts`)

- ✓ Send generic SMS
- ✓ Send breach notification SMS
- ✓ Send password reset required SMS
- ✓ Send export ready SMS
- ✓ Send account deletion confirmation SMS
- ✓ Send consent update SMS
- ✓ Handle SMS delivery failure
- ✓ Handle invalid phone numbers
- **Snapshot**: All SMS message templates

## Critical Edge Cases (test.concurrent)

These tests run in parallel to speed up execution:

### Database Failures

- ✓ Connection timeout during export request
- ✓ Transaction rollback during consent update
- ✓ Deadlock during anonymization
- ✓ Constraint violation during audit log creation

### S3 Errors

- ✓ Upload timeout (30s)
- ✓ NoSuchBucket error
- ✓ Access denied error
- ✓ Eventual consistency (file not immediately readable)
- ✓ Partial upload failure

### Redis Failures

- ✓ Connection refused
- ✓ Timeout during job queue
- ✓ Memory exceeded

### Concurrency Issues

- ✓ Duplicate export requests (race condition)
- ✓ Concurrent deletion requests
- ✓ Multiple consent updates simultaneously

### Expired Sessions

- ✓ Export link expired during download attempt
- ✓ Grace period expired during reactivation attempt
- ✓ Consent withdrawn during processing

### Legal Holds

- ✓ Deletion blocked due to active dispute
- ✓ Deletion blocked due to pending financial records
- ✓ Override legal hold with admin privileges

### Notifications

- ✓ Breach notification to deactivated user (skip)
- ✓ Email delivery failure with retry logic
- ✓ SMS to invalid phone number
- ✓ Batch notification rate limiting

## Snapshot Tests

Snapshot tests ensure deterministic output for:

1. **Export ZIP Structure** (`export.processor.test.ts`)
   - metadata.json format
   - profile.json structure
   - projects.json array
   - orders.json array
   - transactions.json array

2. **Audit Log Entries** (`compliance.test.ts`)
   - Standard log entry format
   - Metadata structure
   - Timestamp formatting

3. **Email Templates** (`email.test.ts`)
   - Breach notification HTML/text
   - ODPC notification body
   - DPO escalation HTML
   - Export ready HTML

4. **SMS Templates** (`sms.test.ts`)
   - All SMS message formats
   - Character count validation (160 char limit)

## Test Execution

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test __tests__/lib/gdpr/services/export.test.ts

# Run tests in watch mode
pnpm test:watch

# Run only GDPR/compliance tests
pnpm test __tests__/lib/gdpr __tests__/workers
```

## Coverage Enforcement

The vitest config enforces 80% coverage thresholds:

- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

CI will fail if coverage drops below these thresholds.

## Next Steps

1. ✅ Mock factories created
2. ✅ Export service tests created (example)
3. ⏳ Generate remaining 9 test files
4. ⏳ Run tests to verify coverage
5. ⏳ Fix any failing tests
6. ⏳ Add integration test examples in `setup-integration.md`

## Notes

- All tests use deterministic data (fixed UUIDs, timestamps) for snapshot testing
- Mock factories return fresh instances per test to prevent state bleed
- Critical edge cases use `test.concurrent` for parallel execution (10s timeout)
- Integration tests documented in `setup-integration.md` but not yet implemented
