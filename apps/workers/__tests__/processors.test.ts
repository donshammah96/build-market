import { describe, it, expect } from "vitest";
import { processMaintenanceJob } from "../src/processors/maintenance.processor";
import { processNotificationRetryJob } from "../src/processors/notification.processor";
import type { Job } from "bullmq";
import type {
  MaintenanceJobData,
  MaintenanceJobName,
  NotificationRetryJobData,
} from "@build/queue-server";

describe("Worker Processors (apps/workers/src/processors/)", () => {
  describe("processMaintenanceJob", () => {
    it("should process known maintenance job types correctly", async () => {
      const mockJob = {
        id: "job-123",
        data: { name: "cleanup-expired-exports" },
        attemptsMade: 0,
      } as Job<MaintenanceJobData>;

      const result = await processMaintenanceJob(mockJob);
      expect(result).toEqual({
        success: true,
        processed: 0,
        job: "cleanup-expired-exports",
      });
    });

    it("should process anonymization-batch jobs correctly", async () => {
      const mockJob = {
        id: "job-456",
        data: { name: "anonymization-batch" },
        attemptsMade: 0,
      } as Job<MaintenanceJobData>;

      const result = await processMaintenanceJob(mockJob);
      expect(result).toEqual({
        success: true,
        processed: 0,
        job: "anonymization-batch",
      });
    });

    it("should handle unrecognized job types gracefully without crashing", async () => {
      const mockJob = {
        id: "job-999",
        data: { name: "unknown-job" as unknown as MaintenanceJobName },
        attemptsMade: 0,
      } as Job<MaintenanceJobData>;

      const result = await processMaintenanceJob(mockJob);
      expect(result).toEqual({
        skipped: true,
        reason: "unknown_job_type",
      });
    });
  });

  describe("processNotificationRetryJob", () => {
    it("should process notification retry job payloads", async () => {
      const mockJob = {
        id: "retry-123",
        data: {
          recipientUserId: "user_123",
          result: {
            entityId: "verif_case_456",
            entityType: "CONTRACTOR",
            decision: "VERIFIED",
          },
        },
        attemptsMade: 1,
      } as Job<NotificationRetryJobData>;

      const result = await processNotificationRetryJob(mockJob);
      expect(result.delivered).toBe(true);
      expect(result.recipientUserId).toBe("user_123");
      expect(result.entityId).toBe("verif_case_456");
      expect(result.timestamp).toBeDefined();
    });
  });
});
