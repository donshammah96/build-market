/**
 * Shared Mock Factories for GDPR/Compliance Tests
 *
 * Provides isolated, deterministic mock instances for testing services and workers.
 * Each factory returns a fresh mock instance to prevent state bleed between tests.
 */

import { vi, type Mock } from "vitest";
import type { PrismaClient } from "@build/db";
import type { Worker, Queue, Job } from "bullmq";
import type { S3Client } from "@aws-sdk/client-s3";

// ============================================================================
// Deterministic Test Data Generators
// ============================================================================

/**
 * Generates deterministic UUIDs for consistent snapshot testing
 */
export function generateTestUUID(prefix: string, index: number = 1): string {
  const paddedIndex = index.toString().padStart(12, "0");
  return `${prefix}-0000-4000-8000-${paddedIndex}`;
}

/**
 * Generates deterministic timestamps for consistent snapshot testing
 */
export function generateTestDate(daysOffset: number = 0): Date {
  const baseDate = new Date("2026-01-01T00:00:00.000Z");
  baseDate.setDate(baseDate.getDate() + daysOffset);
  return baseDate;
}

/**
 * Generates mock user data with deterministic values
 */
export function generateMockUser(overrides: Record<string, any> = {}) {
  return {
    id: generateTestUUID("user", 1),
    clerkId: "clerk_" + generateTestUUID("user", 1),
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    phoneNumber: "+254700000000",
    role: "CLIENT",
    isActive: true,
    createdAt: generateTestDate(0),
    updatedAt: generateTestDate(0),
    ...overrides,
  };
}

/**
 * Generates mock export record with deterministic values
 */
export function generateMockExport(overrides: Record<string, any> = {}) {
  return {
    id: generateTestUUID("export", 1),
    userId: generateTestUUID("user", 1),
    status: "PENDING",
    requestedAt: generateTestDate(0),
    format: "JSON",
    fileUrl: null,
    fileKey: null,
    expiresAt: null,
    completedAt: null,
    error: null,
    jobId: null,
    ...overrides,
  };
}

/**
 * Generates mock security incident with deterministic values
 */
export function generateMockIncident(overrides: Record<string, any> = {}) {
  return {
    id: generateTestUUID("incident", 1),
    type: "DATA_BREACH",
    severity: "CRITICAL",
    affectedUserIds: [generateTestUUID("user", 1), generateTestUUID("user", 2)],
    description: "Test security incident",
    detectedAt: generateTestDate(0),
    notifiedAt: null,
    resolvedAt: null,
    notificationsSent: false,
    createdAt: generateTestDate(0),
    updatedAt: generateTestDate(0),
    ...overrides,
  };
}

/**
 * Generates mock consent record with deterministic values
 */
export function generateMockConsent(overrides: Record<string, any> = {}) {
  return {
    id: generateTestUUID("consent", 1),
    userId: generateTestUUID("user", 1),
    consentType: "MARKETING",
    granted: true,
    grantedAt: generateTestDate(0),
    revokedAt: null,
    version: "1.0",
    metadata: {},
    ...overrides,
  };
}

/**
 * Generates mock audit log entry with deterministic values
 */
export function generateMockAuditLog(overrides: Record<string, any> = {}) {
  return {
    id: generateTestUUID("audit", 1),
    userId: generateTestUUID("user", 1),
    action: "DATA_EXPORT_REQUESTED",
    entityType: "USER",
    entityId: generateTestUUID("user", 1),
    metadata: {},
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    timestamp: generateTestDate(0),
    ...overrides,
  };
}

// ============================================================================
// Prisma Mock Factories
// ============================================================================

/**
 * Creates a mock Prisma client with successful operations
 */
export function mockPrismaSuccess() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    dataExport: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    professionalProfile: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    professional: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    consent: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    consentRecord: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    securityIncident: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    asset: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((callback) =>
      callback({
        user: { update: vi.fn() },
        professional: { update: vi.fn() },
        professionalProfile: { updateMany: vi.fn() },
        asset: { updateMany: vi.fn() },
        auditLog: { create: vi.fn() },
        consentRecord: {
          create: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
        },
      }),
    ),
  } as unknown as PrismaClient;
}

/**
 * Creates a mock Prisma client that simulates database errors
 */
export function mockPrismaWithDBError(
  errorMessage: string = "Database connection failed",
) {
  const error = new Error(errorMessage);
  (error as any).code = "P1001";

  return {
    user: {
      findUnique: vi.fn().mockRejectedValue(error),
      findMany: vi.fn().mockRejectedValue(error),
      update: vi.fn().mockRejectedValue(error),
      delete: vi.fn().mockRejectedValue(error),
      create: vi.fn().mockRejectedValue(error),
    },
    dataExport: {
      findFirst: vi.fn().mockRejectedValue(error),
      findMany: vi.fn().mockRejectedValue(error),
      create: vi.fn().mockRejectedValue(error),
      update: vi.fn().mockRejectedValue(error),
      delete: vi.fn().mockRejectedValue(error),
    },
    professional: {
      findUnique: vi.fn().mockRejectedValue(error),
      update: vi.fn().mockRejectedValue(error),
    },
    auditLog: {
      create: vi.fn().mockRejectedValue(error),
      findMany: vi.fn().mockRejectedValue(error),
    },
    consent: {
      findFirst: vi.fn().mockRejectedValue(error),
      create: vi.fn().mockRejectedValue(error),
      update: vi.fn().mockRejectedValue(error),
    },
    $transaction: vi.fn().mockRejectedValue(error),
  } as unknown as PrismaClient;
}

/**
 * Creates a mock Prisma client that simulates transaction rollback
 */
export function mockPrismaWithTransactionRollback(
  rollbackMessage: string = "Transaction rolled back",
) {
  const prisma = mockPrismaSuccess();

  (prisma.$transaction as Mock).mockImplementation(async () => {
    throw new Error(rollbackMessage);
  });

  return prisma;
}

/**
 * Creates a mock Prisma client for testing legal hold scenarios
 */
export function mockPrismaWithLegalHold() {
  const prisma = mockPrismaSuccess();
  const user = generateMockUser({ legalHold: true });

  (prisma.user.findUnique as Mock).mockResolvedValue(user);

  return prisma;
}

// ============================================================================
// S3 Mock Factories
// ============================================================================

/**
 * Creates a mock S3 client with successful operations
 */
export function mockS3Success() {
  return {
    send: vi.fn().mockResolvedValue({
      $metadata: { httpStatusCode: 200 },
      ETag: '"mock-etag"',
      Location: "https://s3.amazonaws.com/bucket/key",
    }),
  } as unknown as S3Client;
}

/**
 * Creates a mock S3 client that simulates upload timeout
 */
export function mockS3WithTimeout(timeoutMs: number = 30000) {
  return {
    send: vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Request timeout")), timeoutMs),
          ),
      ),
  } as unknown as S3Client;
}

/**
 * Creates a mock S3 client that simulates upload failure
 */
export function mockS3WithUploadFailure(errorCode: string = "NoSuchBucket") {
  const error: any = new Error(`S3 Error: ${errorCode}`);
  error.name = errorCode;
  error.$metadata = { httpStatusCode: 404 };

  return {
    send: vi.fn().mockRejectedValue(error),
  } as unknown as S3Client;
}

/**
 * Creates a mock S3 client that simulates eventual consistency
 * (upload succeeds but immediate read fails, then succeeds on retry)
 */
export function mockS3WithEventualConsistency(
  consistencyDelayMs: number = 2000,
) {
  let uploadComplete = false;
  let attemptCount = 0;

  return {
    send: vi.fn().mockImplementation((command: any) => {
      const commandName = command.constructor.name;

      // Upload succeeds immediately
      if (commandName === "PutObjectCommand") {
        uploadComplete = true;
        return Promise.resolve({
          $metadata: { httpStatusCode: 200 },
          ETag: '"mock-etag"',
        });
      }

      // Read operations - simulate eventual consistency
      if (
        commandName === "GetObjectCommand" ||
        commandName === "HeadObjectCommand"
      ) {
        attemptCount++;

        // First attempt fails (not yet consistent)
        if (attemptCount === 1) {
          const error: any = new Error("NoSuchKey");
          error.name = "NoSuchKey";
          error.$metadata = { httpStatusCode: 404 };
          return Promise.reject(error);
        }

        // Subsequent attempts succeed after delay
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                $metadata: { httpStatusCode: 200 },
                Body: "mock-body",
              }),
            consistencyDelayMs,
          ),
        );
      }

      return Promise.resolve({ $metadata: { httpStatusCode: 200 } });
    }),
  } as unknown as S3Client;
}

// ============================================================================
// Redis Mock Factories
// ============================================================================

/**
 * Creates a mock Redis connection with successful operations
 */
export function mockRedisSuccess(): {
  get: Mock;
  set: Mock;
  del: Mock;
  setex: Mock;
  incr: Mock;
  expire: Mock;
  on: Mock;
  quit: Mock;
} {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    setex: vi.fn().mockResolvedValue("OK"),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue("OK"),
  };
}

/**
 * Creates a mock Redis connection that simulates connection failure
 */
export function mockRedisConnectionFailure(
  errorMessage: string = "ECONNREFUSED",
): {
  get: Mock;
  set: Mock;
  del: Mock;
  setex: Mock;
  on: Mock;
  quit: Mock;
} {
  const error = new Error(`Redis connection failed: ${errorMessage}`);
  (error as any).code = errorMessage;

  return {
    get: vi.fn().mockRejectedValue(error),
    set: vi.fn().mockRejectedValue(error),
    del: vi.fn().mockRejectedValue(error),
    setex: vi.fn().mockRejectedValue(error),
    on: vi.fn(),
    quit: vi.fn().mockRejectedValue(error),
  };
}

// ============================================================================
// BullMQ Mock Factories
// ============================================================================

/**
 * Creates a mock BullMQ queue with successful operations
 */
export function mockBullMQQueueSuccess() {
  return {
    add: vi.fn().mockResolvedValue({
      id: "job-" + generateTestUUID("job", 1),
      data: {},
      opts: {},
    }),
    getJob: vi.fn().mockResolvedValue(null),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as Queue;
}

/**
 * Creates a mock BullMQ worker with successful processing
 */
export function mockBullMQWorkerSuccess() {
  return {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as Worker;
}

/**
 * Creates a mock BullMQ job with cancellation capability
 */
export function mockBullMQWithCancellation() {
  const job = {
    id: "job-" + generateTestUUID("job", 1),
    data: { userId: generateTestUUID("user", 1) },
    updateProgress: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    token: "mock-token",
  };

  // Simulate job cancellation after 1 second
  let isCancelled = false;
  setTimeout(() => {
    isCancelled = true;
  }, 1000);

  return {
    ...job,
    isCancelled: () => isCancelled,
  } as unknown as Job;
}

// ============================================================================
// Mailer Mock Factories
// ============================================================================

/**
 * Creates a mock mailer with successful email delivery
 */
export function mockMailerSuccess(): {
  sendMail: Mock;
} {
  return {
    sendMail: vi.fn().mockResolvedValue({
      messageId: "msg-" + generateTestUUID("email", 1),
      accepted: ["recipient@example.com"],
      rejected: [],
      response: "250 OK",
    }),
  };
}

/**
 * Creates a mock mailer that simulates delivery failure
 */
export function mockMailerWithDeliveryFailure(
  errorMessage: string = "SMTP connection failed",
): {
  sendMail: Mock;
} {
  return {
    sendMail: vi.fn().mockRejectedValue(new Error(errorMessage)),
  };
}

/**
 * Creates a mock mailer for testing rate limiting
 */
export function mockMailerWithRateLimit(maxEmails: number = 10): {
  sendMail: Mock;
} {
  let emailCount = 0;

  return {
    sendMail: vi.fn().mockImplementation(() => {
      emailCount++;

      if (emailCount > maxEmails) {
        return Promise.reject(new Error("Rate limit exceeded"));
      }

      return Promise.resolve({
        messageId: `msg-${emailCount}`,
        accepted: ["recipient@example.com"],
        rejected: [],
        response: "250 OK",
      });
    }),
  };
}

// ============================================================================
// SMS Mock Factories
// ============================================================================

/**
 * Creates a mock SMS service with successful delivery
 */
export function mockSMSSuccess(): {
  send: Mock;
} {
  return {
    send: vi.fn().mockResolvedValue({
      messageId: "sms-" + generateTestUUID("sms", 1),
      status: "sent",
      to: "+254700000000",
    }),
  };
}

/**
 * Creates a mock SMS service that simulates delivery failure
 */
export function mockSMSWithDeliveryFailure(
  errorMessage: string = "Invalid phone number",
): {
  send: Mock;
} {
  return {
    send: vi.fn().mockRejectedValue(new Error(errorMessage)),
  };
}

// ============================================================================
// Export Archive Mock Data
// ============================================================================

/**
 * Generates mock ZIP file structure for snapshot testing
 */
export function generateMockZipStructure() {
  return {
    "metadata.json": JSON.stringify(
      {
        exportDate: generateTestDate(0).toISOString(),
        userId: generateTestUUID("user", 1),
        format: "JSON",
        version: "1.0",
      },
      null,
      2,
    ),
    "profile.json": JSON.stringify(
      {
        id: generateTestUUID("user", 1),
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        createdAt: generateTestDate(0).toISOString(),
      },
      null,
      2,
    ),
    "projects.json": JSON.stringify(
      [
        {
          id: generateTestUUID("project", 1),
          title: "Test Project",
          createdAt: generateTestDate(-30).toISOString(),
        },
      ],
      null,
      2,
    ),
    "orders.json": JSON.stringify(
      [
        {
          id: generateTestUUID("order", 1),
          total: 10000,
          createdAt: generateTestDate(-15).toISOString(),
        },
      ],
      null,
      2,
    ),
    "transactions.json": JSON.stringify(
      [
        {
          id: generateTestUUID("transaction", 1),
          amount: 10000,
          timestamp: generateTestDate(-15).toISOString(),
        },
      ],
      null,
      2,
    ),
  };
}

/**
 * Generates mock audit log entries for snapshot testing
 */
export function generateMockAuditLogEntries(count: number = 5) {
  return Array.from({ length: count }, (_, i) => ({
    id: generateTestUUID("audit", i + 1),
    userId: generateTestUUID("user", 1),
    action: [
      "LOGIN",
      "DATA_EXPORT_REQUESTED",
      "PROFILE_UPDATED",
      "CONSENT_GRANTED",
      "LOGOUT",
    ][i % 5],
    timestamp: generateTestDate(-i).toISOString(),
    metadata: {},
  }));
}

/**
 * Generates mock breach notification email template for snapshot testing
 */
export function generateMockBreachNotificationEmail() {
  return {
    to: "test@example.com",
    subject: "Important Security Notice - Data Breach Notification",
    html: `
      <html>
        <body>
          <h1>Security Incident Notification</h1>
          <p>Dear Test User,</p>
          <p>We are writing to inform you of a security incident that may have affected your personal data.</p>
          <p><strong>Incident Date:</strong> ${generateTestDate(0).toISOString()}</p>
          <p><strong>Type:</strong> Data Breach</p>
          <p><strong>Affected Data:</strong> Email, Name, Phone Number</p>
          <h2>What We're Doing</h2>
          <ul>
            <li>Investigating the incident</li>
            <li>Implementing additional security measures</li>
            <li>Notifying relevant authorities (ODPC)</li>
          </ul>
          <h2>What You Should Do</h2>
          <ul>
            <li>Reset your password immediately</li>
            <li>Enable two-factor authentication</li>
            <li>Monitor your accounts for suspicious activity</li>
          </ul>
          <p>If you have any questions, please contact our Data Protection Officer.</p>
          <p>Sincerely,<br>BuildMarket Security Team</p>
        </body>
      </html>
    `,
    text: `
Security Incident Notification

Dear Test User,

We are writing to inform you of a security incident that may have affected your personal data.

Incident Date: ${generateTestDate(0).toISOString()}
Type: Data Breach
Affected Data: Email, Name, Phone Number

What We're Doing:
- Investigating the incident
- Implementing additional security measures
- Notifying relevant authorities (ODPC)

What You Should Do:
- Reset your password immediately
- Enable two-factor authentication
- Monitor your accounts for suspicious activity

If you have any questions, please contact our Data Protection Officer.

Sincerely,
BuildMarket Security Team
    `.trim(),
  };
}
