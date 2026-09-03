import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueueTestInspector } from "../test-inspection.js";

describe("QueueTestInspector (Dual Postgres/Redis Inspection)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Postgres Mode Inspection", () => {
    it("queries bullmq schema in Postgres for jobs owned by stagingTestRunId", async () => {
      const mockRows = [
        {
          id: "job-pg-1",
          name: "send-notification",
          data: { testControl: { stagingTestRunId: "run-uuid-1" } },
          attemptsMade: 1,
          failedreason: null,
          processedon: 1788400000,
          finishedon: 1788400100,
        },
      ];

      const mockPgClient = {
        query: vi.fn().mockResolvedValue({ rows: mockRows }),
      };

      const inspector = new QueueTestInspector({
        backend: "postgres",
        pgClient: mockPgClient as any,
      });

      const records = await inspector.inspectJobsByRun("run-uuid-1", "notifications");
      expect(records).toHaveLength(1);
      expect(records[0]?.id).toBe("job-pg-1");
      expect(records[0]?.stagingTestRunId).toBe("run-uuid-1");
      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining("bullmq"),
        ["notifications", "run-uuid-1"],
      );
    });
  });

  describe("Redis Mode Inspection", () => {
    it("queries BullMQ queue in Redis for jobs owned by stagingTestRunId", async () => {
      const mockJobs = [
        {
          id: "job-redis-1",
          name: "stk-callback",
          data: { testControl: { stagingTestRunId: "run-uuid-1" } },
          attemptsMade: 2,
          failedReason: "Simulated network timeout",
          getState: vi.fn().mockResolvedValue("failed"),
        },
        {
          id: "job-redis-2",
          name: "stk-callback",
          data: { testControl: { stagingTestRunId: "run-other-99" } },
          attemptsMade: 1,
          failedReason: null,
          getState: vi.fn().mockResolvedValue("completed"),
        },
      ];

      const mockQueue = {
        getJobs: vi.fn().mockResolvedValue(mockJobs),
      };

      const inspector = new QueueTestInspector({
        backend: "redis",
        queueFactory: () => mockQueue as any,
      });

      const records = await inspector.inspectJobsByRun("run-uuid-1", "mpesa-stk-callback");
      expect(records).toHaveLength(1);
      expect(records[0]?.id).toBe("job-redis-1");
      expect(records[0]?.state).toBe("failed");
      expect(records[0]?.failedReason).toBe("Simulated network timeout");
    });
  });
});
