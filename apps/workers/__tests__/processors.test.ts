Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/buildmarket",
  REDIS_URL: "redis://localhost:6379",
  NATS_URL: "nats://localhost:4222",
  S3_DISABLED: "true",
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { processMaintenanceJob } from "../src/processors/maintenance.processor";
import { processNotificationRetryJob } from "../src/processors/notification.processor";
import { processDataExportJob } from "../src/processors/export.processor";
import { processIncidentJob } from "../src/processors/incident.processor";
import { processComplianceNotificationJob } from "../src/processors/compliance-notification.processor";
import {
  processConfirmationEmailJob,
  processEspSyncJob,
} from "../src/processors/newsletter.processor";
import { processImageUploadJob } from "../src/processors/upload.processor";
import { processLicenseVerificationJob } from "../src/processors/license-verification.processor";
import { prisma } from "@build/db";
import type { Job } from "bullmq";
import type {
  MaintenanceJobData,
  MaintenanceJobName,
  NotificationRetryJobData,
  ExportJobData,
  IncidentJobData,
  UserNotificationJobData,
  NewsletterConfirmationEmailJobData,
  NewsletterEspSyncJobData,
  ImageUploadProcessingJobData,
  LicenseVerificationJobData,
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
      create: vi.fn().mockResolvedValue({
        id: "asset_123",
        cdnUrl: "/api/uploads/download/asset_123",
      }),
      upsert: vi.fn().mockImplementation(async ({ create }) => ({
        id: create.id || "asset_123",
        ...create,
      })),
    },
    onboardingUpload: {
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    newsletterSubscriber: {
      findUnique: vi.fn().mockResolvedValue({
        id: "sub_123",
        email: "subscriber@example.com",
        status: "SUBSCRIBED",
        espSyncAttempts: 0,
      }),
      update: vi.fn().mockResolvedValue({ id: "sub_123" }),
      deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
    },
    professionalLicense: {
      update: vi.fn().mockResolvedValue({ id: "lic_1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    systemSettings: {
      findUnique: vi.fn().mockResolvedValue({
        id: "global",
        enableAutoVerifyNCA: true,
      }),
    },
    regulatorVerificationCase: {
      upsert: vi.fn().mockResolvedValue({ id: "case_1" }),
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

  describe("processConfirmationEmailJob", () => {
    it("should send confirmation email and update subscriber status", async () => {
      const mockJob = {
        id: "email-job-1",
        data: {
          subscriberId: "sub_123",
          email: "subscriber@example.com",
          confirmationToken: "conf_token_123",
          unsubscribeToken: "unsub_token_123",
        },
      } as Job<NewsletterConfirmationEmailJobData>;

      const result = await processConfirmationEmailJob(mockJob);
      expect(result.status).toBe("success");
      expect(result.subscriberId).toBe("sub_123");
    });
  });

  describe("processEspSyncJob", () => {
    it("should sync subscribed user to ESP", async () => {
      const mockJob = {
        id: "esp-job-1",
        data: {
          subscriberId: "sub_123",
          action: "subscribe",
        },
      } as Job<NewsletterEspSyncJobData>;

      const result = await processEspSyncJob(mockJob);
      expect(result.status).toBe("success");
      expect(result.subscriberId).toBe("sub_123");
      expect(result.action).toBe("subscribe");
    });
  });

  describe("processImageUploadJob", () => {
    it("should process image upload, generate thumbnails/blurhash, and persist asset record", async () => {
      // Create a valid small PNG buffer with Sharp
      const sharp = (await import("sharp")).default;
      const validImageBuffer = await sharp({
        create: {
          width: 80,
          height: 60,
          channels: 3,
          background: { r: 50, g: 150, b: 200 },
        },
      })
        .png()
        .toBuffer();

      const mockJob = {
        id: "upload-job-1",
        data: {
          uploadId: "up_123",
          fieldName: "avatar",
          actor: { userId: "user_123", correlationId: "corr_123" },
          file: {
            originalName: "avatar.png",
            mimeType: "image/png",
            size: validImageBuffer.length,
            bufferBase64: validImageBuffer.toString("base64"),
          },
          options: {
            context: "avatar" as const,
            generateThumbnail: true,
            temporary: false,
            tempExpiryHours: 24,
          },
          consent: {},
        },
      } as Job<ImageUploadProcessingJobData>;

      const result = await processImageUploadJob(mockJob);
      expect(result.status).toBe("success");
      expect(result.uploadId).toBe("up_123");
      expect(result.assetId).toBeDefined();
      expect(result.thumbnailUrl).toBeDefined();
      expect(result.blurHash).toBeDefined();
    });

    it("should fail closed on infected file (Phase 0 EICAR detection)", async () => {
      const eicarBuffer = Buffer.from(
        "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
      );

      const mockJob = {
        id: "upload-job-eicar",
        data: {
          uploadId: "up_infected",
          fieldName: "document",
          actor: { userId: "user_bad", correlationId: "corr_bad" },
          file: {
            originalName: "eicar.com",
            mimeType: "application/octet-stream",
            size: eicarBuffer.length,
            bufferBase64: eicarBuffer.toString("base64"),
          },
          options: {
            context: "default" as const,
            generateThumbnail: false,
            temporary: false,
          },
          consent: {},
        },
      } as Job<ImageUploadProcessingJobData>;

      const result = await processImageUploadJob(mockJob);
      expect(result.status).toBe("failed");
      expect(result.uploadId).toBe("up_infected");
      expect(result.error).toMatch(/Security scan failed|threat detected/i);
    });

    it("should be idempotent under retry with deterministic upsert", async () => {
      const sharp = (await import("sharp")).default;
      const validImageBuffer = await sharp({
        create: {
          width: 40,
          height: 40,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      })
        .png()
        .toBuffer();

      const mockJob = {
        id: "upload-job-retry",
        data: {
          uploadId: "up_retry_123",
          fieldName: "gallery",
          actor: { userId: "user_123", correlationId: "corr_retry" },
          file: {
            originalName: "photo.png",
            mimeType: "image/png",
            size: validImageBuffer.length,
            bufferBase64: validImageBuffer.toString("base64"),
          },
          options: {
            context: "default" as const,
            generateThumbnail: true,
            temporary: false,
          },
          consent: {},
        },
      } as Job<ImageUploadProcessingJobData>;

      // First run
      const result1 = await processImageUploadJob(mockJob);
      expect(result1.status).toBe("success");

      // Second run (simulated BullMQ retry)
      const result2 = await processImageUploadJob(mockJob);
      expect(result2.status).toBe("success");
      expect(result2.uploadId).toBe(result1.uploadId);

      // Verify deterministic upsert key and payload on both attempts
      const expectedKey = "uploads/user_123/up_retry_123/photo.png";
      expect(prisma.asset.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { key: expectedKey },
          create: expect.objectContaining({
            id: "up_retry_123",
            key: expectedKey,
            uploaderId: "user_123",
            mimeType: "image/png",
          }),
          update: expect.objectContaining({
            mimeType: "image/png",
          }),
        }),
      );
      expect(prisma.asset.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { key: expectedKey },
          create: expect.objectContaining({
            id: "up_retry_123",
            key: expectedKey,
            uploaderId: "user_123",
            mimeType: "image/png",
          }),
          update: expect.objectContaining({
            mimeType: "image/png",
          }),
        }),
      );
    });
  });

  describe("processLicenseVerificationJob", () => {
    it("should auto-verify license when authority setting is enabled", async () => {
      const mockJob = {
        id: "lic-job-1",
        data: {
          professionalId: "pro_123",
          licenseId: "lic_1",
          authority: "NCA" as const,
          licenseNumber: "NCA-9999",
          submittedName: "Jane Doe",
          correlationId: "corr_lic_1",
        },
      } as Job<LicenseVerificationJobData>;

      const result = await processLicenseVerificationJob(mockJob);
      expect(result.status).toBe("AUTO_VERIFIED");
      expect(result.professionalId).toBe("pro_123");
      expect(result.authority).toBe("NCA");
    });
  });
});
