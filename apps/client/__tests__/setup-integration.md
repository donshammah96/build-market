# Integration Test Setup Guide

This document provides instructions for setting up and running integration tests against real Redis and PostgreSQL instances for the GDPR/Compliance module.

## Overview

While the unit tests use mocked dependencies for fast, isolated testing, integration tests verify full workflows against real infrastructure to catch issues that only appear in production-like environments.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and pnpm
- At least 2GB free disk space for Docker containers

## Quick Start

### 1. Start Test Infrastructure

Create a `docker-compose.test.yml` file in the project root:

```yaml
version: "3.8"

services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: testuser
      POSTGRES_PASSWORD: testpass
      POSTGRES_DB: buildmarket_test
    ports:
      - "5433:5432"
    volumes:
      - postgres-test-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U testuser"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres-test-data:
```

Start the containers:

```bash
docker-compose -f docker-compose.test.yml up -d
```

Wait for health checks to pass:

```bash
docker-compose -f docker-compose.test.yml ps
```

### 2. Configure Test Environment

Create a `.env.test` file:

```bash
# Database
DATABASE_URL="postgresql://testuser:testpass@localhost:5433/buildmarket_test"

# Redis
REDIS_URL="redis://localhost:6380"

# S3 (use LocalStack or MinIO for local S3)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
S3_BUCKET_NAME=test-bucket
S3_ENDPOINT=http://localhost:4566  # LocalStack endpoint

# Email (use MailHog or similar for local SMTP)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=test
SMTP_PASS=test
FROM_EMAIL=noreply@buildmarket.test

# SMS (mock provider)
SMS_PROVIDER_URL=http://localhost:8080/sms
SMS_API_KEY=test-key
```

### 3. Initialize Test Database

Run Prisma migrations on the test database:

```bash
DATABASE_URL="postgresql://testuser:testpass@localhost:5433/buildmarket_test" \
  pnpm --filter @build/db prisma migrate deploy
```

Seed with test data:

```bash
DATABASE_URL="postgresql://testuser:testpass@localhost:5433/buildmarket_test" \
  pnpm --filter @build/db prisma db seed
```

### 4. Run Integration Tests

```bash
# Run all integration tests
pnpm --filter client test:integration

# Run specific integration test suite
pnpm --filter client test __tests__/integration/gdpr/export-workflow.integration.test.ts

# Run with coverage
pnpm --filter client test:integration --coverage
```

## Integration Test Workflows

### Export Workflow Integration Test

Tests the complete data export lifecycle:

1. **User requests export** → API creates database record
2. **Job queued** → BullMQ adds job to export queue
3. **Worker processes** → Fetches data from Prisma, creates ZIP
4. **Upload to S3** → Uploads archive with encryption
5. **Generate signed URL** → Creates time-limited download link
6. **Update database** → Marks export as completed
7. **Cleanup job** → Deletes expired exports after 7 days

```typescript
// Example: __tests__/integration/gdpr/export-workflow.integration.test.ts
describe('Export Workflow Integration', () => {
  it('should complete full export workflow', async () => {
    // Create user
    const user = await prisma.user.create({...});

    // Request export via API
    const response = await fetch('/api/gdpr/export', {
      method: 'POST',
      headers: { userId: user.id },
    });

    // Wait for job completion
    await waitForJobCompletion(response.jobId);

    // Verify database record
    const exportRecord = await prisma.dataExport.findFirst({
      where: { userId: user.id },
    });
    expect(exportRecord.status).toBe('COMPLETED');

    // Verify S3 file exists
    const s3Object = await s3Client.send(
      new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: exportRecord.fileKey,
      })
    );
    expect(s3Object.$metadata.httpStatusCode).toBe(200);

    // Verify signed URL works
    const downloadResponse = await fetch(exportRecord.fileUrl);
    expect(downloadResponse.ok).toBe(true);
  });
});
```

### Breach Notification Workflow Integration Test

Tests the complete security incident response:

1. **Incident detected** → Creates security incident record
2. **Emergency protocol** → Queues incident processing job
3. **ODPC notification** → Sends email to Data Protection Commissioner
4. **DPO escalation** → Notifies internal Data Protection Officer
5. **User notifications** → Queues batch notification jobs
6. **Protective measures** → Resets passwords, revokes sessions
7. **Batch processing** → Sends emails/SMS to affected users
8. **Delivery tracking** → Logs notification delivery status

```typescript
// Example: __tests__/integration/compliance/breach-workflow.integration.test.ts
describe('Breach Notification Workflow Integration', () => {
  it('should process critical breach incident', async () => {
    // Create affected users
    const users = await Promise.all([
      prisma.user.create({...}),
      prisma.user.create({...}),
    ]);

    // Create security incident
    const incident = await prisma.securityIncident.create({
      data: {
        type: 'DATA_BREACH',
        severity: 'CRITICAL',
        affectedUserIds: users.map(u => u.id),
        description: 'Test breach',
      },
    });

    // Queue emergency protocol
    await queueEmergencyProtocol({ incidentId: incident.id });

    // Wait for incident worker to complete
    await waitForWorkerCompletion('incident');

    // Verify ODPC notification sent
    const odpcEmail = await getEmailBySubject('CRITICAL: Data Breach Notification');
    expect(odpcEmail.to).toBe('dpo@odpc.go.ke');

    // Wait for user notifications
    await waitForWorkerCompletion('notification');

    // Verify all users notified
    for (const user of users) {
      const userEmail = await getEmailByRecipient(user.email);
      expect(userEmail.subject).toContain('Security Notice');
    }

    // Verify protective measures applied
    for (const user of users) {
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser.passwordResetRequired).toBe(true);
    }

    // Verify incident marked as notified
    const updatedIncident = await prisma.securityIncident.findUnique({
      where: { id: incident.id },
    });
    expect(updatedIncident.notificationsSent).toBe(true);
  });
});
```

### Anonymization Workflow Integration Test

Tests the right to erasure implementation:

1. **Deletion requested** → User initiates account deletion
2. **Legal hold check** → Verifies no blocking conditions
3. **Deactivation phase** → Soft delete, 30-day grace period
4. **Asset scheduling** → Marks assets for deletion
5. **Grace period recovery** → Allows reactivation within 30 days
6. **Anonymization phase** → Replaces PII with anonymized data
7. **Asset cleanup** → Deletes S3 files, orphaned references
8. **Audit logging** → Records all actions for compliance

```typescript
// Example: __tests__/integration/gdpr/anonymization-workflow.integration.test.ts
describe('Anonymization Workflow Integration', () => {
  it('should complete full anonymization after grace period', async () => {
    // Create user with data
    const user = await prisma.user.create({...});
    const project = await prisma.project.create({
      data: { userId: user.id, ... },
    });
    const asset = await prisma.asset.create({
      data: { uploadedBy: user.id, ... },
    });

    // Request deletion
    await anonymizationService.requestDeletion(user.id, 'admin-id');

    // Verify deactivation
    const deactivatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(deactivatedUser.isActive).toBe(false);
    expect(deactivatedUser.deactivatedAt).toBeTruthy();

    // Verify assets scheduled for deletion
    const scheduledAsset = await prisma.asset.findUnique({
      where: { id: asset.id },
    });
    expect(scheduledAsset.scheduledForDeletion).toBeTruthy();

    // Simulate grace period expiry (30 days)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        deactivatedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      },
    });

    // Run anonymization
    await anonymizationService.anonymizeExpiredAccounts();

    // Verify PII anonymized
    const anonymizedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(anonymizedUser.email).toMatch(/^ANONYMIZED-[a-f0-9-]+@deleted\.local$/);
    expect(anonymizedUser.firstName).toMatch(/^ANONYMIZED-/);
    expect(anonymizedUser.phoneNumber).toMatch(/^ANONYMIZED-/);

    // Verify S3 assets deleted
    await expect(
      s3Client.send(new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: asset.fileKey,
      }))
    ).rejects.toThrow('NoSuchKey');

    // Verify audit trail
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: user.id },
    });
    expect(auditLogs).toContainEqual(
      expect.objectContaining({ action: 'ACCOUNT_ANONYMIZED' })
    );
  });
});
```

## Additional Services for Testing

### LocalStack (S3 Emulation)

```yaml
# Add to docker-compose.test.yml
localstack:
  image: localstack/localstack:latest
  ports:
    - "4566:4566"
  environment:
    - SERVICES=s3
    - DEBUG=1
    - DATA_DIR=/tmp/localstack/data
  volumes:
    - localstack-data:/tmp/localstack
```

### MailHog (SMTP Testing)

```yaml
# Add to docker-compose.test.yml
mailhog:
  image: mailhog/mailhog:latest
  ports:
    - "1025:1025" # SMTP
    - "8025:8025" # Web UI
```

Access MailHog UI at `http://localhost:8025` to view sent emails.

## Test Data Management

### Reset Database Between Tests

```typescript
// __tests__/setup-integration.ts
import { prisma } from "@build/db";

beforeEach(async () => {
  // Clear all tables in transaction
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.dataExport.deleteMany(),
    prisma.securityIncident.deleteMany(),
    prisma.consent.deleteMany(),
    prisma.project.deleteMany(),
    prisma.asset.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### Seed Test Data

```typescript
// __tests__/helpers/seed-test-data.ts
export async function seedTestUsers(count: number = 5) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const user = await prisma.user.create({
      data: {
        email: `test${i}@example.com`,
        firstName: `Test${i}`,
        lastName: `User${i}`,
        clerkId: `clerk_test${i}`,
        role: "CLIENT",
      },
    });
    users.push(user);
  }
  return users;
}
```

## Troubleshooting

### Docker Containers Won't Start

```bash
# Check container logs
docker-compose -f docker-compose.test.yml logs postgres-test
docker-compose -f docker-compose.test.yml logs redis-test

# Reset containers and volumes
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```

### Database Connection Errors

```bash
# Verify PostgreSQL is accepting connections
docker exec -it build-market-postgres-test-1 psql -U testuser -d buildmarket_test

# Check connection string
echo $DATABASE_URL
```

### Redis Connection Errors

```bash
# Verify Redis is accepting connections
docker exec -it build-market-redis-test-1 redis-cli ping

# Check connection string
echo $REDIS_URL
```

### BullMQ Jobs Not Processing

```bash
# Check Redis connection from Node
redis-cli -h localhost -p 6380 ping

# Check job queue status
redis-cli -h localhost -p 6380 keys "bull:*"
redis-cli -h localhost -p 6380 lrange "bull:exportQueue:wait" 0 -1
```

## Performance Benchmarks

Integration tests should meet these performance targets:

- **Export workflow**: < 5 seconds for small dataset (< 1MB)
- **Breach notification**: < 10 seconds for 100 users
- **Anonymization**: < 2 seconds per user
- **Consent update**: < 500ms per record

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: buildmarket_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6380:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5433/buildmarket_test
        run: pnpm --filter @build/db prisma migrate deploy

      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5433/buildmarket_test
          REDIS_URL: redis://localhost:6380
        run: pnpm --filter client test:integration --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/client/coverage/coverage-final.json
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up resources (database records, S3 files, Redis keys) after tests
3. **Timeouts**: Set appropriate timeouts for async operations (default: 10s)
4. **Deterministic**: Use fixed timestamps and UUIDs for reproducible results
5. **Parallel Execution**: Run independent tests concurrently to reduce execution time
6. **Error Scenarios**: Test failure cases (network errors, timeouts, retries)
7. **Monitoring**: Log test execution times to identify slow tests

## Future Enhancements

- [ ] Add Testcontainers for automatic Docker management
- [ ] Implement snapshot testing for API responses
- [ ] Add performance regression detection
- [ ] Create visual regression tests for email templates
- [ ] Add chaos engineering tests (random failures)
- [ ] Implement distributed tracing for debugging
