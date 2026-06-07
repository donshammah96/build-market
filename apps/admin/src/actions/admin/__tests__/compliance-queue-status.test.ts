import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/actions/admin/compliance/queue-status/route";

const incidentQueueMock = vi.hoisted(() => ({
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 1,
    active: 2,
    completed: 3,
    failed: 4,
    delayed: 5,
  }),
  getFailed: vi.fn().mockResolvedValue([
    {
      id: "job-1",
      name: "test-job",
      finishedOn: 1716300000000,
      failedReason: "Some error",
      data: { incidentId: "inc-1" },
    },
  ]),
}));

const userNotificationQueueMock = vi.hoisted(() => ({
  getJobCounts: vi
    .fn()
    .mockResolvedValue({ waiting: 0, active: 1, completed: 2, failed: 0 }),
}));

const auditQueueMock = vi.hoisted(() => ({
  getJobCounts: vi
    .fn()
    .mockResolvedValue({ waiting: 0, active: 0, completed: 10, failed: 0 }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/infrastructure/env", () => ({
  adminEnvConfig: {
    NODE_ENV: "test",
    DEV_ADMIN_BYPASS: false,
  },
}));

vi.mock("@/lib/queues/compliance.queue", () => ({
  incidentQueue: incidentQueueMock,
  userNotificationQueue: userNotificationQueueMock,
  auditQueue: auditQueueMock,
}));

vi.mock("@/lib/infrastructure/correlation", () => ({
  initializeAdminCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
}));

vi.mock("@/lib/infrastructure/logger", () => ({
  getAdminLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

const TEST_UUIDS = {
  ADMIN_CLERK: "a0000000-0000-4000-8000-000000000001",
  ADMIN_DB: "a0000000-0000-4000-8000-000000000002",
};

describe("GET /api/admin/compliance/queue-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 Forbidden when unauthorized (no clerk session)", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);

    const request = new NextRequest(
      "http://localhost:3500/api/admin/compliance/queue-status",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("returns 403 Forbidden when user is not found in database", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@build/db");

    vi.mocked(auth).mockResolvedValue({
      userId: TEST_UUIDS.ADMIN_CLERK,
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);

    const request = new NextRequest(
      "http://localhost:3500/api/admin/compliance/queue-status",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("returns 403 Forbidden when user is not ADMIN or has no active profile", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@build/db");

    vi.mocked(auth).mockResolvedValue({
      userId: TEST_UUIDS.ADMIN_CLERK,
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "USER",
      id: TEST_UUIDS.ADMIN_DB,
      adminProfile: null,
    } as any);

    const request = new NextRequest(
      "http://localhost:3500/api/admin/compliance/queue-status",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("returns 200 OK and queue counts on success", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@build/db");

    vi.mocked(auth).mockResolvedValue({
      userId: TEST_UUIDS.ADMIN_CLERK,
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "ADMIN",
      id: TEST_UUIDS.ADMIN_DB,
      adminProfile: {
        role: "SUPER_ADMIN",
        isActive: true,
      },
    } as any);

    // Mock initial return values
    incidentQueueMock.getJobCounts.mockResolvedValue({
      waiting: 1,
      active: 2,
      completed: 3,
      failed: 4,
      delayed: 5,
    });
    incidentQueueMock.getFailed.mockResolvedValue([
      {
        id: "job-1",
        name: "test-job",
        finishedOn: 1716300000000,
        failedReason: "Some error",
        data: { incidentId: "inc-1" },
      },
    ]);

    const request = new NextRequest(
      "http://localhost:3500/api/admin/compliance/queue-status",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.queues.incidents).toEqual({
      waiting: 1,
      active: 2,
      completed: 3,
      failed: 4,
      delayed: 5,
    });
    expect(data.recentFailures).toHaveLength(1);
    expect(data.recentFailures[0]).toEqual({
      id: "job-1",
      name: "test-job",
      failedAt: 1716300000000,
      reason: "Some error",
      incidentId: "inc-1",
    });
    expect(data.health.status).toBe("HEALTHY");
  });

  it("returns WARNING health status when there are too many failures", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@build/db");

    vi.mocked(auth).mockResolvedValue({
      userId: TEST_UUIDS.ADMIN_CLERK,
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "ADMIN",
      id: TEST_UUIDS.ADMIN_DB,
      adminProfile: {
        role: "SUPER_ADMIN",
        isActive: true,
      },
    } as any);

    incidentQueueMock.getFailed.mockResolvedValue(
      new Array(15).fill({
        id: "job-1",
        name: "test-job",
        finishedOn: 1716300000000,
        failedReason: "Some error",
        data: { incidentId: "inc-1" },
      }),
    );

    const request = new NextRequest(
      "http://localhost:3500/api/admin/compliance/queue-status",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.health.status).toBe("WARNING");
    expect(data.health.message).toBe("High number of failed compliance jobs");
  });
});
