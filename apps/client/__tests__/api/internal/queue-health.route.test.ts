import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/internal/queue-health/route";

const mockQueue = {
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 2,
    active: 1,
    completed: 10,
    failed: 0,
  }),
  getWorkers: vi.fn().mockResolvedValue([{ id: "worker-1" }]),
  getCompleted: vi.fn().mockResolvedValue([]),
};

vi.mock("@build/queue-server", () => ({
  getPaymentsQueue: vi.fn(() => mockQueue),
  getQueueBackendType: vi.fn(() => "redis"),
  MPESA_QUEUE_NAMES: { PAYMENTS: "payments" },
}));

vi.mock("@/app/lib/security/internal-secret", () => ({
  ensureValidInternalSecret: vi.fn((secret: string | null) => {
    if (secret === "valid-secret") return null;
    return { error: "INVALID_SECRET", status: 401 };
  }),
  timingSafeEqualStrings: vi.fn((a: string, b: string) => a === b),
}));

describe("GET /api/internal/queue-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REDIS_URL;
  });

  it("returns 403 when x-internal-secret is missing or invalid", async () => {
    const req = new NextRequest(
      "http://localhost:3500/api/internal/queue-health",
      {
        headers: { "x-internal-secret": "bad-secret" },
      },
    );

    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("reports disconnected when REDIS_URL is not configured", async () => {
    const req = new NextRequest(
      "http://localhost:3500/api/internal/queue-health",
      {
        headers: { "x-internal-secret": "valid-secret" },
      },
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(false);
    expect(body.backend).toBe("redis");
    expect(body.error).toBe("REDIS_URL is not configured");
  });

  it("returns connected queue health and active consumer stats when healthy", async () => {
    process.env.REDIS_URL = "rediss://:token@localhost:6379";

    const req = new NextRequest(
      "http://localhost:3500/api/internal/queue-health",
      {
        headers: { "x-internal-secret": "valid-secret" },
      },
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.backend).toBe("redis");
    expect(body.queueName).toBe("payments");
    expect(body.waiting).toBe(2);
    expect(body.active).toBe(1);
    expect(body.consumerCount).toBe(1);
    expect(body.consumerSeenAt).toBeDefined();
  });

  it("handles queue inspection failures gracefully without crashing", async () => {
    process.env.REDIS_URL = "rediss://:token@localhost:6379";
    mockQueue.getJobCounts.mockRejectedValueOnce(
      new Error("Redis connection refused"),
    );

    const req = new NextRequest(
      "http://localhost:3500/api/internal/queue-health",
      {
        headers: { "x-internal-secret": "valid-secret" },
      },
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(false);
    expect(body.error).toContain("Redis connection refused");
  });
});
