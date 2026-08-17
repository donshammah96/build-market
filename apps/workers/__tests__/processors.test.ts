process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/buildmarket";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.NATS_URL = "nats://localhost:4222";
process.env.S3_DISABLED = "true";

import { describe, it, expect, vi, beforeEach } from "vitest";
import { processMaintenanceJob } from "../src/processors/maintenance.processor";
import { processNotificationRetryJob } from "../src/processors/notification.processor";
import { processDataExportJob } from "../src/processors/export.processor";
import { processIncidentJob } from "../src/processors/incident.processor";
import { processComplianceNotificationJob } from "../src/processors/compliance-notification.processor";
import type { Job } from "bullmq";
import type {
  MaintenanceJobData,
  MaintenanceJobName,
  NotificationRetryJobData,
  ExportJobData,
  IncidentJobData,
  UserNotificationJobData,
} from "@build/queue-server";

// Mock @build/mail-server
vi.mock("@build/mail-server", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "msg_123" }),
}));

// Mock @build/queue-server queues
vi.mock("@build/queue-server", () => ({
  ComplianceJobs: {
    TRIGGER_EMERGENCY: "trigger-emergency",
    NOTIFY_ODPC: "notify-odpc",
    NOTIFY_USERS_BATCH: "notify-users-batch",
    LOG_AUDIT: "log-audit",
    ESCALATE_INCIDENT: "escalate-incident",
  },
  incidentQueue: {
    add: vi.fn().mockResolvedValue({ id: "inc_job_1" }),
  },
  userNotificationQueue: {
    add: vi.fn().mockResolvedValue({ id: "notif_job_1" }),
  },
}));

// Mock @build/db prisma
vi.mock("@build/db", () => ({
  NotificationChannel: {
    IN_APP: "IN_APP",
    EMAIL: "EMAIL",
    SMS: "SMS",
    PUSH: "PUSH",
  },
  prisma: {
    dataExport: {
      findUnique: vi.fn().mockResolvedValue({
        id: "exp_1",
        userId: "user_123",
        status: "PENDING",
      }),
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "exp_1", userId: "usr_1", s3Key: "key_1" }]),
      update: vi.fn().mockResolvedValue({ id: "exp_1", status: "READY" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "user_123",
          email: "test@example.com",
          phone: "+254700000000",
          firstName: "John",
        },
      ]),
      findUnique: vi.fn().mockResolvedValue({
        id: "user_123",
        email: "test@example.com",
        firstName: "John",
        projects: [],
        orders: [],
        auditLogs: [],
      }),
      update: vi.fn().mockResolvedValue({ id: "user_123" }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    securityIncident: {
      findUnique: vi.fn().mockResolvedValue({
        id: "inc_123",
        severity: "CRITICAL",
        description: "Test incident breach",
        createdAt: new Date(),
        odpcNotified: false,
        usersNotified: false,
      }),
      update: vi.fn().mockResolvedValue({ id: "inc_123" }),
    },
    asset: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    onboardingUpload: {
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    newsletterSubscriber: {
      deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
    },
    professionalLicense: {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    mpesaTransaction: {
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue({ id: "tx_1" }),
    },
    mpesaTransactionArchive: {
      create: vi.fn().mockResolvedValue({ id: "tx_1" }),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notif_1" }),
    },
    failedNotification: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn().mockImplementation(async (fns) => Promise.all(fns)),
  },
}));

describe("Worker Processors (apps/workers/src/processors/)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processMaintenanceJob", () => {
    it("should process cleanup-expired-exports with database updates", async () => {
      const mockJob = {
        id: "job-123",
        data: { name: "cleanup-expired-exports" },
        attemptsMade: 0,
      } as Job<MaintenanceJobData>;

      const result = await processMaintenanceJob(mockJob);
      expect(result.success).toBe(true);
      expect(result.job).toBe("cleanup-expired-exports");
      expect(result.processedCount).toBe(1);
    });

    it("should process onboarding-upload-cleanup correctly", async () => {
      const mockJob = {
        id: "job-upload-cleanup",
        data: { name: "onboarding-upload-cleanup" },
        attemptsMade: 0,
      } as Job<MaintenanceJobData>;

      const result = await processMaintenanceJob(mockJob);
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(3);
    });

    it("should process newsletter-sweep correctly", async () => {
      const mockJob = {
        id: "job-newsletter",
        data: { name: "newsletter-sweep" },
        attemptsMade: 0,
      } as Job<MaintenanceJobData>;

      const result = await processMaintenanceJob(mockJob);
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(5);
    });

    it("should process license-expiry correctly", async () => {
      const mockJob = {
        id: "job-lic-expiry",
        data: { name: "license-expiry" },
        attemptsMade: 0,
      } as Job<MaintenanceJobData>;

      const result = await processMaintenanceJob(mockJob);
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
    });

    it("should handle unrecognized job types gracefully without throwing", async () => {
      const mockJob = {
        id: "job-999",
        data: { name: "unknown-job" as unknown as MaintenanceJobName },
        attemptsMade: 0,
      } as Job<MaintenanceJobData>;

      const result = await processMaintenanceJob(mockJob);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("unknown_job_type");
    });
  });

  describe("processNotificationRetryJob", () => {
    it("should deliver in-app notification when user exists", async () => {
      const mockJob = {
        id: "retry-123",
        data: {
          recipientUserId: "user_123",
          result: {
            entityId: "verif_case_456",
            entityType: "CONTRACTOR",
            decision: "VERIFIED",
            reason: "Documents approved",
          },
        },
        attemptsMade: 1,
      } as Job<NotificationRetryJobData>;

      const result = await processNotificationRetryJob(mockJob);
      expect(result.delivered).toBe(true);
      expect(result.recipientUserId).toBe("user_123");
      expect(result.entityId).toBe("verif_case_456");
      expect(result.channel).toBe("IN_APP");
      expect(result.timestamp).toBeDefined();
    });
  });

  describe("processDataExportJob", () => {
    it("should process GDPR data export and send completion notification", async () => {
      const mockJob = {
        id: "exp-job-1",
        data: {
          exportId: "exp_1",
          userId: "user_123",
          ipAddress: "127.0.0.1",
          userAgent: "TestAgent",
        },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job<ExportJobData>;

      const result = await processDataExportJob(mockJob);
      expect(result.status).toBe("completed");
      expect(result.exportId).toBe("exp_1");
      expect(result.fileUrl).toBeDefined();
    });
  });

  describe("processIncidentJob", () => {
    it("should process emergency protocol and trigger ODPC and user notifications", async () => {
      const mockJob = {
        id: "inc-job-1",
        data: {
          incidentId: "inc_123",
          type: "EMERGENCY_PROTOCOL",
          severity: "CRITICAL",
        },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job<IncidentJobData>;

      const result = await processIncidentJob(mockJob);
      expect(result.status).toBe("success");
      expect(result.incidentId).toBe("inc_123");
      expect(result.type).toBe("EMERGENCY_PROTOCOL");
    });

    it("should process ODPC notification dispatch", async () => {
      const mockJob = {
        id: "inc-job-2",
        data: {
          incidentId: "inc_123",
          type: "ODPC_NOTIFICATION",
          severity: "HIGH",
        },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job<IncidentJobData>;

      const result = await processIncidentJob(mockJob);
      expect(result.status).toBe("success");
      expect(result.type).toBe("ODPC_NOTIFICATION");
    });
  });

  describe("processComplianceNotificationJob", () => {
    it("should deliver batch compliance notifications to active users", async () => {
      const mockJob = {
        id: "notif-batch-1",
        data: {
          incidentId: "inc_123",
          userIds: ["user_123"],
          template: "BREACH_NOTIFICATION",
          channel: "EMAIL",
          priority: "HIGH",
          content: {
            subject: "Security Alert",
            body: "Notice for {userName}",
          },
          batchNumber: 1,
          totalBatches: 1,
        },
      } as unknown as Job<UserNotificationJobData>;

      const result = await processComplianceNotificationJob(mockJob);
      expect(result.incidentId).toBe("inc_123");
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
    });
  });
});
