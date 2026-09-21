import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  adminAuditLog: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("@build/db", () => ({
  prisma: prismaMock,
}));

import {
  countAuditLogs,
  countTodayAuditLogs,
  groupAuditLogsByAction,
  groupAuditLogsByTargetType,
  listAuditLogs,
  listRecentAuditLogs,
} from "../repository";

const baseQuery = {
  page: 1,
  limit: 20,
  skip: 0,
  sortOrder: "desc" as const,
};

describe("audit repository contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists audit logs with caller filters and safe snapshot fields", async () => {
    await listAuditLogs({
      ...baseQuery,
      search: "delete",
      targetType: "user",
      adminId: "admin_1",
    });
    await countAuditLogs({ ...baseQuery, action: "DELETE_USER" });

    expect(prismaMock.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
          targetType: "user",
          adminId: "admin_1",
        }),
        skip: 0,
        take: 20,
        orderBy: { createdAt: "desc" },
        select: expect.objectContaining({
          adminEmail: true,
          requestId: true,
        }),
      }),
    );
    expect(prismaMock.adminAuditLog.count).toHaveBeenCalledWith({
      where: { action: "DELETE_USER" },
    });
  });

  it("counts today's logs from a caller-provided boundary", async () => {
    const today = new Date("2026-05-18T00:00:00.000Z");
    await countTodayAuditLogs(today);

    expect(prismaMock.adminAuditLog.count).toHaveBeenCalledWith({
      where: { createdAt: { gte: today } },
    });
  });

  it("groups audit stats by action and target type", async () => {
    await groupAuditLogsByAction();
    await groupAuditLogsByTargetType();

    expect(prismaMock.adminAuditLog.groupBy).toHaveBeenNthCalledWith(1, {
      by: ["action"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });
    expect(prismaMock.adminAuditLog.groupBy).toHaveBeenNthCalledWith(2, {
      by: ["targetType"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });
  });

  it("lists recent audit logs using the same snapshot select", async () => {
    await listRecentAuditLogs();

    expect(prismaMock.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: expect.objectContaining({
          adminEmail: true,
          userAgent: true,
          requestId: true,
        }),
      }),
    );
  });
});
