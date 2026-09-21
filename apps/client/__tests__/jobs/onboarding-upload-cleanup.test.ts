import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQueueAdd = vi.hoisted(() => vi.fn());
const mockQueueClose = vi.hoisted(() => vi.fn());

vi.mock("@build/queue-server", () => ({
  createRedisConnection: () => ({ host: "localhost", port: 6379 }),
}));

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    add = mockQueueAdd;
    close = mockQueueClose;
    getRepeatableJobs = async () => [];
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
});
