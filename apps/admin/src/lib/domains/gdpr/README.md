# GDPR & Data Protection Implementation Guide

## Overview

This module implements compliance with **GDPR (General Data Protection Regulation)** and the **Kenya Data Protection Act 2019 (DPA)**. It handles user consent, data encryption, data portability (export), right to erasure (anonymization), security breach notifications, and comprehensive audit logging.

## Architecture

### Module Structure

```text
apps/client/app/
├── lib/
│   ├── gdpr/
│   │   ├── services/                    # Core business logic
│   │   │   ├── compliance.service.ts    # Audit logging & reporting
│   │   │   ├── consent.service.ts       # Consent management
│   │   │   ├── anonymization.service.ts # Right to erasure
│   │   │   ├── asset-cleanup.service.ts # Asset lifecycle management
│   │   │   └── export.service.ts        # Data export orchestration
│   │   ├── encryption/                  # Field-level encryption
│   │   │   ├── field-encryption.ts      # AES-256-GCM utilities
│   │   │   └── prisma-extension.ts      # Transparent encryption middleware
│   │   └── README.md                    # This file
│   ├── queues/                          # BullMQ job queues
│   │   ├── redis-connection.ts          # Shared Redis connection
│   │   ├── export.queue.ts              # Export job definitions
│   │   └── compliance.queue.ts          # Incident & notification queues
│   └── notifications/                   # Email & SMS services
│       ├── email.service.ts             # Email templates & sending
│       ├── sms.service.ts               # SMS templates & sending
│       └── index.ts
├── workers/                             # Background job processors
│   ├── export/
│   │   ├── index.ts                     # Module exports
│   │   ├── worker.ts                    # BullMQ worker wrapper
│   │   └── processor.ts                 # Core export business logic
│   └── compliance/
│       ├── incident.worker.ts           # Security incident response
│       └── notification.worker.ts       # Batch user notifications
└── jobs/
    └── export-cleanup.ts                # CRON job for expired exports
```

### Service Dependencies

```mermaid
graph TB
    API[API Routes] --> ExportService[Export Service]
    API --> ConsentService[Consent Service]
    API --> AnonymizationService[Anonymization Service]
    API --> ComplianceService[Compliance Service]

    ExportService --> ExportQueue[Export Queue]
    ExportQueue --> ExportWorker[Export Worker]
    ExportWorker --> ExportProcessor[Export Processor]
    ExportProcessor --> S3[AWS S3]
    ExportProcessor --> EmailService[Email Service]
    ExportProcessor --> Prisma[(Prisma DB)]

    AnonymizationService --> AssetCleanupService[Asset Cleanup Service]
    AssetCleanupService --> S3

    IncidentQueue[Incident Queue] --> IncidentWorker[Incident Worker]
    IncidentWorker --> EmailService
    IncidentWorker --> SMSService[SMS Service]
    IncidentWorker --> NotificationQueue[Notification Queue]
    NotificationQueue --> NotificationWorker[Notification Worker]
    NotificationWorker --> EmailService
    NotificationWorker --> SMSService

    ConsentService --> Prisma
    ComplianceService --> Prisma
    IncidentWorker --> Prisma
    NotificationWorker --> Prisma

    FieldEncryption[Field Encryption] --> PrismaExtension[Prisma Extension]
    PrismaExtension --> Prisma

    ExportQueue -.Redis.-> RedisConnection[Redis Connection]
    IncidentQueue -.Redis.-> RedisConnection
    NotificationQueue -.Redis.-> RedisConnection
```

---

## 1. Consent Management

**Goal**: Granular tracking of user consent for lawful compliance (GDPR Art. 7, DPA Section 30).

### Happy Path Sequence

```mermaid
sequenceDiagram
    participant User
    participant API as /api/user/consent
    participant ConsentService
    participant Prisma as Database
    participant AuditLog as Audit Trail

    User->>API: POST { type: "MARKETING", granted: true }
    API->>ConsentService: updateConsent(userId, "MARKETING", true)
    ConsentService->>Prisma: findFirst (check existing)
    Prisma-->>ConsentService: null (no existing record)
    ConsentService->>Prisma: create ConsentRecord
    Prisma-->>ConsentService: ConsentRecord
    ConsentService->>Prisma: update User flags (legacy support)
    Prisma-->>ConsentService: Updated User
    ConsentService->>AuditLog: log(CONSENT_GRANTED)
    AuditLog-->>ConsentService: Audit entry created
    ConsentService-->>API: ConsentRecord
    API-->>User: 200 OK { type, granted, grantedAt }
```

### Error Path Sequence

```mermaid
sequenceDiagram
    participant User
    participant API as /api/user/consent
    participant ConsentService
    participant Prisma as Database

    User->>API: POST { type: "MARKETING", granted: true }
    API->>ConsentService: updateConsent(userId, "MARKETING", true)
    ConsentService->>Prisma: findFirst (check existing)
    Prisma--xConsentService: Database connection error
    ConsentService-->>API: throw Error("DB unavailable")
    API-->>User: 500 Internal Server Error
```

### API Reference

#### `GET /api/user/consent`

Retrieves all active consent records for the authenticated user.

**Response**:

```json
[
  {
    "id": "consent_123",
    "type": "MARKETING_EMAIL",
    "granted": true,
    "grantedAt": "2024-01-29T10:00:00Z",
    "revokedAt": null,
    "version": "v1.0",
    "metadata": {}
  }
]
```

#### `POST /api/user/consent`

Updates a specific consent preference.

**Request**:

```json
{
  "type": "MARKETING_EMAIL",
  "granted": true,
  "version": "v1.2"
}
```

**Implementation**: [lib/gdpr/services/consent.service.ts](services/consent.service.ts)

---

## 2. Data Portability (Data Export)

**Goal**: Allow users to download their personal data (GDPR Art. 20, DPA Section 39).

### Happy Path: Complete Export Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant API as /api/user/export
    participant ExportService
    participant Prisma as Database
    participant ExportQueue as BullMQ Queue
    participant ExportWorker as Worker
    participant ExportProcessor as Processor
    participant S3 as AWS S3
    participant EmailService

    User->>API: POST /api/user/export
    API->>ExportService: requestExport(userId)

    ExportService->>Prisma: findFirst (check existing pending)
    Prisma-->>ExportService: null
    ExportService->>Prisma: findFirst (check rate limit - 1/day)
    Prisma-->>ExportService: null

    ExportService->>Prisma: create DataExport (PENDING)
    Prisma-->>ExportService: DataExport { id, status: PENDING }

    ExportService->>ExportQueue: addJob({ exportId, userId })
    ExportQueue-->>ExportService: Job { id: "job-123" }

    ExportService-->>API: { success, exportId, jobId, status: PENDING }
    API-->>User: 202 Accepted

    Note over ExportQueue,ExportWorker: Async Processing

    ExportQueue->>ExportWorker: Job { exportId, userId }
    ExportWorker->>Prisma: findUnique DataExport
    Prisma-->>ExportWorker: DataExport
    ExportWorker->>Prisma: update (status: PROCESSING)

    ExportWorker->>ExportProcessor: processExport(exportId)

    ExportProcessor->>Prisma: findUnique User
    Prisma-->>ExportProcessor: User data
    ExportProcessor->>Prisma: findMany Professional
    Prisma-->>ExportProcessor: Professional data
    ExportProcessor->>Prisma: findMany Project
    Prisma-->>ExportProcessor: Projects
    ExportProcessor->>Prisma: findMany Order
    Prisma-->>ExportProcessor: Orders
    ExportProcessor->>Prisma: findMany Transaction
    Prisma-->>ExportProcessor: Transactions
    ExportProcessor->>Prisma: findMany Asset
    Prisma-->>ExportProcessor: Assets

    ExportProcessor->>ExportProcessor: Create ZIP (metadata.json, profile.json, ...)

    ExportProcessor->>S3: PutObject (upload ZIP)
    S3-->>ExportProcessor: { ETag, Location }

    ExportProcessor->>S3: GetSignedUrl (7-day expiry)
    S3-->>ExportProcessor: Signed URL

    ExportProcessor->>Prisma: update DataExport (READY, fileUrl, fileKey)
    Prisma-->>ExportProcessor: Updated DataExport

    ExportProcessor->>ExportProcessor: Clean up local temp files

    ExportProcessor-->>ExportWorker: { fileSize, fileUrl }
    ExportWorker->>EmailService: sendExportReadyEmail(user, downloadUrl)
    EmailService-->>ExportWorker: Email sent

    ExportWorker-->>ExportQueue: Job complete
```

### Error Path: S3 Upload Failure

```mermaid
sequenceDiagram
    participant ExportQueue as BullMQ Queue
    participant ExportWorker as Worker
    participant ExportProcessor as Processor
    participant S3 as AWS S3
    participant Prisma as Database

    ExportQueue->>ExportWorker: Job { exportId, userId }
    ExportWorker->>ExportProcessor: processExport(exportId)

    ExportProcessor->>Prisma: Fetch user data
    Prisma-->>ExportProcessor: Data
    ExportProcessor->>ExportProcessor: Create ZIP

    ExportProcessor->>S3: PutObject (upload)
    S3--xExportProcessor: Timeout (30s exceeded)

    ExportProcessor--xExportWorker: throw Error("S3 upload timeout")

    ExportWorker->>Prisma: update DataExport (FAILED, error message)
    Prisma-->>ExportWorker: Updated

    ExportWorker-->>ExportQueue: Job failed

    Note over ExportQueue: Retry with exponential backoff<br/>(3 attempts: 1min, 2min, 4min)

    ExportQueue->>ExportWorker: Job retry attempt 2
```

### API Reference: Data Export

#### `POST /api/user/export`

Initiates a data export request.

**Rate Limiting**: 1 export per user per 24 hours.

**Response**:

```json
{
  "success": true,
  "exportId": "export_abc123",
  "status": "PENDING",
  "message": "Your data export is being prepared. You will receive an email when ready.",
  "jobId": "job_xyz789"
}
```

#### `GET /api/user/export/:id`

Checks the status of an export request.

**Response**:

```json
{
  "id": "export_abc123",
  "status": "READY",
  "fileUrl": "https://s3.amazonaws.com/...",
  "fileSize": 1048576,
  "requestedAt": "2024-01-29T10:00:00Z",
  "expiresAt": "2024-02-05T10:00:00Z",
  "downloadedAt": null
}
```

**Statuses**: `PENDING` | `PROCESSING` | `READY` | `EXPIRED` | `FAILED` | `CANCELLED`

**Implementation**: [lib/gdpr/services/export.service.ts](services/export.service.ts) + [workers/export/](../../workers/export/)

---

## 3. Right to Erasure (Anonymization)

**Goal**: Implement user deletion with legal safeguards (GDPR Art. 17, DPA Section 38).

### 3-Phase Deletion Process

```mermaid
stateDiagram-v2
    [*] --> Active: User account created
    Active --> Deactivated: requestDeletion()
    Deactivated --> Active: reactivateAccount() (within 30 days)
    Deactivated --> Anonymized: anonymizeExpiredAccounts() (after 30 days)
    Deactivated --> LegalHold: checkLegalHolds() (dispute/financial)
    LegalHold --> Deactivated: Hold released
    Anonymized --> [*]: PII scrubbed permanently
```

### Happy Path: Complete Anonymization Workflow

```mermaid
sequenceDiagram
    participant User
    participant API as /api/user/delete
    participant AnonymizationService
    participant Prisma as Database
    participant AssetCleanupService
    participant S3 as AWS S3
    participant AuditLog

    User->>API: POST /api/user/delete
    API->>AnonymizationService: requestDeletion(userId, actorId)

    Note over AnonymizationService: Phase 1: Legal Hold Check
    AnonymizationService->>Prisma: findUnique User (check legalHold flag)
    Prisma-->>AnonymizationService: User { legalHold: false }
    AnonymizationService->>Prisma: findMany Order (check disputes)
    Prisma-->>AnonymizationService: [] (no disputes)
    AnonymizationService->>Prisma: findMany Transaction (check pending)
    Prisma-->>AnonymizationService: [] (no pending)

    Note over AnonymizationService: Phase 2: Deactivation (30-day grace)
    AnonymizationService->>Prisma: update User (isActive: false, deactivatedAt)
    Prisma-->>AnonymizationService: User
    AnonymizationService->>Prisma: update Professional (storeOpen: false)
    Prisma-->>AnonymizationService: Professional

    AnonymizationService->>AssetCleanupService: scheduleAssetsForDeletion(userId)
    AssetCleanupService->>Prisma: update Asset (scheduledForDeletion)
    Prisma-->>AssetCleanupService: Assets updated

    AnonymizationService->>AuditLog: log(ACCOUNT_DEACTIVATED)
    AuditLog-->>AnonymizationService: Logged

    AnonymizationService-->>API: { success, gracePeriodEnds }
    API-->>User: 200 OK (30-day grace period)

    Note over AnonymizationService,Prisma: 30 days later (CRON job)

    AnonymizationService->>Prisma: findMany User (deactivatedAt < 30 days ago)
    Prisma-->>AnonymizationService: [User]

    Note over AnonymizationService: Phase 3: Anonymization
    AnonymizationService->>Prisma: transaction START
    AnonymizationService->>Prisma: update User (email: ANONYMIZED-{UUID}@deleted.local)
    AnonymizationService->>Prisma: update User (firstName: ANONYMIZED-{UUID})
    AnonymizationService->>Prisma: update User (phoneNumber: ANONYMIZED-{UUID})
    AnonymizationService->>Prisma: update Professional (companyName: ANONYMIZED-{UUID})
    AnonymizationService->>Prisma: transaction COMMIT
    Prisma-->>AnonymizationService: User anonymized

    AnonymizationService->>AssetCleanupService: executeScheduledDeletions()
    AssetCleanupService->>Prisma: findMany Asset (scheduledForDeletion)
    Prisma-->>AssetCleanupService: [Assets]

    loop For each asset
        AssetCleanupService->>AssetCleanupService: countReferences(assetId)
        alt Asset still referenced
            AssetCleanupService->>Prisma: update Asset (uploadedBy: system-user)
        else Asset orphaned
            AssetCleanupService->>S3: DeleteObject(fileKey)
            S3-->>AssetCleanupService: Deleted
            AssetCleanupService->>Prisma: delete Asset
        end
    end

    AnonymizationService->>AuditLog: log(ACCOUNT_ANONYMIZED)
```

### Error Path: Legal Hold Blocks Deletion

```mermaid
sequenceDiagram
    participant User
    participant API as /api/user/delete
    participant AnonymizationService
    participant Prisma as Database

    User->>API: POST /api/user/delete
    API->>AnonymizationService: requestDeletion(userId, actorId)

    AnonymizationService->>Prisma: findUnique User
    Prisma-->>AnonymizationService: User { legalHold: true }

    AnonymizationService-->>API: throw Error("Cannot delete: legal hold")
    API-->>User: 403 Forbidden
```

### API Reference: User Deletion

#### `POST /api/user/deletion`

Request account deletion (starts 30-day grace period).

**Response**:

```json
{
  "success": true,
  "gracePeriodEnds": "2024-02-29T10:00:00Z",
  "message": "Your account has been deactivated. You have 30 days to reactivate."
}
```

#### `POST /api/user/reactivate`

Cancel deletion within grace period.

**Response**:

```json
{
  "success": true,
  "message": "Your account has been reactivated."
}
```

**Implementation**: [lib/gdpr/services/anonymization.service.ts](services/anonymization.service.ts) + [lib/gdpr/services/asset-cleanup.service.ts](services/asset-cleanup.service.ts)

---

## 4. Security Breach Notifications

**Goal**: Comply with 72-hour breach notification requirement (GDPR Art. 33-34, DPA Section 43).

### Critical Incident Response Workflow

```mermaid
sequenceDiagram
    participant System as Detection System
    participant IncidentQueue as BullMQ Queue
    participant IncidentWorker as Worker
    participant Prisma as Database
    participant EmailService
    participant SMSService
    participant NotificationQueue
    participant NotificationWorker
    participant ODPC as Data Protection Commissioner

    Note over System: Security breach detected!

    System->>Prisma: create SecurityIncident (CRITICAL)
    Prisma-->>System: Incident { id, severity: CRITICAL }

    System->>IncidentQueue: queueEmergencyProtocol(incidentId)

    IncidentQueue->>IncidentWorker: Job { type: EMERGENCY_PROTOCOL }

    Note over IncidentWorker: Emergency Protocol Execution

    IncidentWorker->>Prisma: findUnique SecurityIncident
    Prisma-->>IncidentWorker: Incident

    par ODPC Notification (Priority 100)
        IncidentWorker->>IncidentQueue: add ODPC_NOTIFICATION job
        IncidentQueue->>IncidentWorker: Job { type: ODPC_NOTIFICATION }
        IncidentWorker->>Prisma: findUnique SecurityIncident
        IncidentWorker->>EmailService: sendODPCNotificationEmail(incident)
        EmailService->>ODPC: Email (dpo@odpc.go.ke)
        ODPC-->>EmailService: Delivered
        IncidentWorker->>Prisma: update SecurityIncident (odpcNotified: true)
    and DPO Escalation
        IncidentWorker->>EmailService: sendDPOEscalationEmail(incidentId)
        EmailService-->>IncidentWorker: Sent
    and Protective Measures
        IncidentWorker->>Prisma: findMany User (affectedUserIds)
        Prisma-->>IncidentWorker: [Users]
        loop For each affected user
            IncidentWorker->>Prisma: update User (passwordResetRequired: true)
            IncidentWorker->>Prisma: update Session (revoke all sessions)
        end
    end

    Note over IncidentWorker: Queue User Notifications (Batched)

    IncidentWorker->>NotificationQueue: queueUserNotifications(incidentId, userIds)

    NotificationQueue->>NotificationWorker: Job { incidentId, users: batch 1-100 }

    loop For each batch of 100 users
        NotificationWorker->>Prisma: findMany User (batch)
        Prisma-->>NotificationWorker: [Users]

        par Email Notifications
            loop For each user
                NotificationWorker->>EmailService: sendBreachNotificationEmail(user)
                EmailService-->>NotificationWorker: Sent
            end
        and SMS Notifications
            loop For each user with phone
                NotificationWorker->>SMSService: sendBreachNotificationSMS(user)
                SMSService-->>NotificationWorker: Sent
            end
        end

        NotificationWorker->>Prisma: create NotificationLog (delivery status)
        Prisma-->>NotificationWorker: Logged
    end

    NotificationWorker->>Prisma: update SecurityIncident (usersNotified: true)
    Prisma-->>NotificationWorker: Updated
```

### Error Path: Email Delivery Failure with Retry

```mermaid
sequenceDiagram
    participant IncidentWorker
    participant EmailService
    participant ODPC as dpo@odpc.go.ke
    participant Prisma as Database
    participant IncidentQueue as BullMQ

    IncidentWorker->>EmailService: sendODPCNotificationEmail(incident)
    EmailService->>ODPC: SMTP connection
    ODPC--xEmailService: Connection timeout

    EmailService--xIncidentWorker: throw Error("SMTP failed")

    IncidentWorker->>Prisma: update SecurityIncident (metadata: attempt 1)
    Prisma-->>IncidentWorker: Updated

    IncidentWorker-->>IncidentQueue: Job failed (retry)

    Note over IncidentQueue: Exponential backoff<br/>10 attempts: 1min, 2min, 4min, ...

    IncidentQueue->>IncidentWorker: Retry attempt 2
    IncidentWorker->>EmailService: sendODPCNotificationEmail(incident)
    EmailService->>ODPC: SMTP connection
    ODPC-->>EmailService: 250 OK

    IncidentWorker->>Prisma: update SecurityIncident (odpcNotified: true)
```

**Implementation**: [workers/compliance/incident.worker.ts](../../workers/compliance/incident.worker.ts) + [workers/compliance/notification.worker.ts](../../workers/compliance/notification.worker.ts) + [lib/notifications/](../notifications/)

---

## 5. Field-Level Encryption

**Goal**: Transparent encryption of sensitive PII (GDPR Art. 32 - Security of Processing).

### Encryption Architecture

```mermaid
graph LR
    API[API Request] --> Prisma[Prisma Client]
    Prisma --> Extension[Prisma Extension]

    Extension --> Encrypt{Encrypt Fields?}
    Encrypt -->|Yes| FieldEncryption[Field Encryption]
    Encrypt -->|No| DB[(Database)]

    FieldEncryption --> Deterministic{Searchable?}
    Deterministic -->|Yes| HMAC[HMAC-derived IV<br/>Same input = Same output]
    Deterministic -->|No| Random[Random IV<br/>Semantic security]

    HMAC --> AES[AES-256-GCM]
    Random --> AES

    AES --> DB

    DB --> Decrypt[Decrypt on Read]
    Decrypt --> Prisma
    Prisma --> API

    style FieldEncryption fill:#4ade80
    style AES fill:#fbbf24
    style DB fill:#60a5fa
```

### Configuration

```typescript
// apps/client/app/lib/gdpr/encryption/prisma-extension.ts
const encryptionConfig = {
  User: {
    kraPIN: "deterministic", // Searchable (HMAC IV)
    phoneNumber: "randomized", // Non-searchable (random IV)
    nationalId: "deterministic",
  },
  Professional: {
    taxIdentificationNumber: "deterministic",
  },
};
```

### Encrypted Field Format

```text
enc:v1:<base64-encrypted-data>:<base64-iv>:<base64-auth-tag>
```

**Example**:

```text
enc:v1:a2V5...==:b2l2...==:c3RhZw==
```

**Implementation**: [lib/gdpr/encryption/field-encryption.ts](encryption/field-encryption.ts) + [lib/gdpr/encryption/prisma-extension.ts](encryption/prisma-extension.ts)

---

## 6. Audit Logging

**Goal**: Comprehensive audit trail for all GDPR operations (GDPR Art. 30 - Records of Processing).

### Logged Actions

```typescript
enum AuditAction {
  // Data Access
  DATA_EXPORT_REQUESTED
  DATA_EXPORT_COMPLETED
  DATA_EXPORT_DOWNLOADED

  // Consent
  CONSENT_GRANTED
  CONSENT_REVOKED

  // Deletion
  ACCOUNT_DEACTIVATED
  ACCOUNT_REACTIVATED
  ACCOUNT_ANONYMIZED

  // Breaches
  BREACH_DETECTED
  BREACH_REPORTED_ODPC
  BREACH_USERS_NOTIFIED

  // Admin Actions
  ADMIN_DATA_ACCESS
  ADMIN_LEGAL_HOLD_APPLIED
  ADMIN_LEGAL_HOLD_RELEASED
}
```

### API Reference: Audit Logs

#### `GET /api/admin/audit-logs`

Query audit logs with filters.

**Query Parameters**:

- `userId` (optional): Filter by user ID
- `action` (optional): Filter by action type
- `startDate` (optional): Filter by date range
- `endDate` (optional): Filter by date range
- `page` (default: 1)
- `limit` (default: 50)

**Response**:

```json
{
  "logs": [
    {
      "id": "log_123",
      "userId": "user_456",
      "action": "DATA_EXPORT_REQUESTED",
      "timestamp": "2024-01-29T10:00:00Z",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "metadata": {
        "exportId": "export_789"
      }
    }
  ],
  "pagination": {
    "total": 1000,
    "page": 1,
    "limit": 50,
    "pages": 20
  }
}
```

**Implementation**: [lib/gdpr/services/compliance.service.ts](services/compliance.service.ts)

---

## Testing

### Unit Tests

Comprehensive test coverage (80%+ target) using Vitest with deterministic mocks.

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific module tests
pnpm test __tests__/lib/gdpr
pnpm test __tests__/workers
```

**Test Files**:

- [**tests**/lib/gdpr/services/export.test.ts](../../../__tests__/lib/gdpr/services/export.test.ts)
- [**tests**/lib/gdpr/services/compliance.test.ts](../../../__tests__/lib/gdpr/services/compliance.test.ts)
- [**tests**/lib/gdpr/services/consent.test.ts](../../../__tests__/lib/gdpr/services/consent.test.ts)
- [**tests**/lib/gdpr/services/anonymization.test.ts](../../../__tests__/lib/gdpr/services/anonymization.test.ts)
- [**tests**/workers/export/processor.test.ts](../../../__tests__/workers/export/processor.test.ts)
- [**tests**/workers/compliance/incident.test.ts](../../../__tests__/workers/compliance/incident.test.ts)

**Mock Factories**: [**tests**/mocks/index.ts](../../../__tests__/mocks/index.ts)

### Integration Tests

Full workflow testing against real Redis and PostgreSQL instances.

See [**tests**/setup-integration.md](../../../__tests__/setup-integration.md) for Docker Compose setup and instructions.

---

## Key Design Principles

1. **Privacy by Design**: Encryption and anonymization built into core architecture
2. **Data Minimization**: Collect only necessary data, delete after retention period
3. **Transparency**: Clear audit trails for all data operations
4. **Security**: AES-256-GCM encryption, signed S3 URLs, secure session handling
5. **Compliance**: GDPR Articles 7, 17, 20, 30-34 + Kenya DPA Sections 30, 38-39, 43
6. **Resilience**: Exponential backoff retries, job queues, graceful error handling
7. **Testability**: 80%+ coverage with isolated mocks and deterministic test data

---

## Compliance Checklist

- ✅ **Lawful Basis** (Art. 6): Explicit consent tracking with versioning
- ✅ **Consent** (Art. 7): Granular consent management with audit logs
- ✅ **Right of Access** (Art. 15): Audit log queries for user data access
- ✅ **Right to Rectification** (Art. 16): User profile update APIs
- ✅ **Right to Erasure** (Art. 17): 3-phase anonymization with legal holds
- ✅ **Right to Data Portability** (Art. 20): ZIP export with JSON/CSV formats
- ✅ **Records of Processing** (Art. 30): Comprehensive audit logging
- ✅ **Security of Processing** (Art. 32): AES-256-GCM encryption, access controls
- ✅ **Breach Notification to Authority** (Art. 33): 72-hour ODPC notification
- ✅ **Breach Notification to Users** (Art. 34): Batched email/SMS with retries
- ✅ **Kenya DPA Section 30**: Consent documentation and management
- ✅ **Kenya DPA Section 38-39**: Right to erasure and objection
- ✅ **Kenya DPA Section 43**: Breach notification to ODPC

---

## Support

For questions or issues:

- **Data Protection Officer**: <dpo@buildmarket.co.ke>
- **Security Team**: <security@buildmarket.co.ke>
- **Developer Documentation**: This README + inline code comments
- **Test Plan**: [**tests**/TEST_PLAN.md](../../../__tests__/TEST_PLAN.md)

Last Updated: February 2, 2026
