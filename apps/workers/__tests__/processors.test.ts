import { describe, it, expect, vi, beforeEach } from "vitest";
import { processMaintenanceJob } from "../src/processors/maintenance.processor";
import { processNotificationRetryJob } from "../src/processors/notification.processor";
import type { Job } from "bullmq";
import type {
  MaintenanceJobData,
  MaintenanceJobName,
  NotificationRetryJobData,
} from "@build/queue-server";

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
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "exp_1", userId: "usr_1", s3Key: "key_1" }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "user_123", email: "test@example.com" }),
      update: vi.fn().mockResolvedValue({ id: "user_123" }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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
});
