import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQueueAdd = vi.hoisted(() => vi.fn());
const mockQueueClose = vi.hoisted(() => vi.fn());
const mockWorkerClose = vi.hoisted(() => vi.fn());
const mockWorkerOn = vi.hoisted(() => vi.fn());
const mockCleanupExpiredStagedUploads = vi.hoisted(() => vi.fn());
const mockCleanupExpiredDirectUploads = vi.hoisted(() => vi.fn());

let capturedProcessor:
  ((job: { name: string; id: string }) => Promise<unknown>) | null = null;

vi.mock("@build/queue-server", () => ({
  createRedisConnection: () => ({ host: "localhost", port: 6379 }),
}));

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    add = mockQueueAdd;
    close = mockQueueClose;
    getRepeatableJobs = async () => [];
  },
  Worker: class MockWorker {
    constructor(
      _name: string,
      processor: (job: unknown) => Promise<unknown>,
      _options?: unknown,
    ) {
      capturedProcessor = processor as (job: {
        name: string;
        id: string;
      }) => Promise<unknown>;
    }
    close = mockWorkerClose;
    on = mockWorkerOn;
    isRunning = () => true;
  },
}));

vi.mock("@/app/lib/domains/uploads", () => ({
  uploadService: {
    cleanupExpiredStagedUploads: mockCleanupExpiredStagedUploads,
    cleanupExpiredDirectUploads: mockCleanupExpiredDirectUploads,
  },
}));

vi.mock("@build/resilience", () => ({
  StructuredLogger: class MockStructuredLogger {
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    debug = vi.fn();
  },
  CorrelationIdManager: {
    generate: vi.fn().mockReturnValue("test-correlation-id"),
    set: vi.fn(),
  },
}));

describe("onboarding-upload-cleanup job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProcessor = null;
  });

  describe("scheduleOnboardingUploadCleanup", () => {
    it("schedules job with correct name and cron pattern", async () => {
      mockQueueAdd.mockResolvedValue({ id: "scheduled-job-1" });

      const { scheduleOnboardingUploadCleanup } =
        await import("@/app/jobs/onboarding-upload-cleanup");

      await scheduleOnboardingUploadCleanup();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        "cleanup-expired-staged-uploads",
        {},
        expect.objectContaining({
          repeat: { pattern: "0 3 * * *" },
          jobId: "daily-onboarding-upload-cleanup",
          attempts: 3,
          backoff: { type: "exponential", delay: 60000 },
        }),
      );
    });
  });

  describe("createOnboardingUploadCleanupWorker processor", () => {
    it("calls staged and direct cleanup and returns metrics", async () => {
      mockCleanupExpiredStagedUploads.mockResolvedValue({
        count: 3,
        deletedFromStorage: 3,
        failedDeletions: [],
      });
      mockCleanupExpiredDirectUploads.mockResolvedValue({
        count: 2,
        deletedFromStorage: 1,
        failedDeletions: ["direct-upload-1"],
      });

      const { createOnboardingUploadCleanupWorker } =
        await import("@/app/jobs/onboarding-upload-cleanup");

      createOnboardingUploadCleanupWorker();

      expect(capturedProcessor).toBeDefined();

      const mockJob = {
        name: "cleanup-expired-staged-uploads",
        id: "job-123",
      };

      const result = await capturedProcessor!(mockJob);

      expect(mockCleanupExpiredStagedUploads).toHaveBeenCalledTimes(1);
      expect(mockCleanupExpiredDirectUploads).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        count: 5,
        deletedFromStorage: 4,
        failedDeletions: 1,
        durationMs: expect.any(Number),
      });
    });

    it("skips unexpected job types", async () => {
      const { createOnboardingUploadCleanupWorker } =
        await import("@/app/jobs/onboarding-upload-cleanup");

      createOnboardingUploadCleanupWorker();

      const mockJob = {
        name: "other-job-type",
        id: "job-456",
      };

      await capturedProcessor!(mockJob);

      expect(mockCleanupExpiredStagedUploads).not.toHaveBeenCalled();
    });

    it("throws on cleanup failure for retry", async () => {
      mockCleanupExpiredStagedUploads.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const { createOnboardingUploadCleanupWorker } =
        await import("@/app/jobs/onboarding-upload-cleanup");

      createOnboardingUploadCleanupWorker();

      const mockJob = {
        name: "cleanup-expired-staged-uploads",
        id: "job-789",
      };

      await expect(capturedProcessor!(mockJob)).rejects.toThrow(
        "Database connection failed",
      );
    });
  });
});
