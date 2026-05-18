import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
  } as const,
}));

const repositoryMock = vi.hoisted(() => ({
  listAuditLogs: vi.fn(),
  countAuditLogs: vi.fn(),
  countAllAuditLogs: vi.fn(),
  countTodayAuditLogs: vi.fn(),
  groupAuditLogsByAction: vi.fn(),
  groupAuditLogsByTargetType: vi.fn(),
  listRecentAuditLogs: vi.fn(),
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
}));

vi.mock("../repository", () => ({
  auditRepository: repositoryMock,
}));

import type { AuditActor } from "../contracts";
import { buildAuditLogQuery, getAuditLogStats, listAuditLogPage } from "../service";

function actor(
  adminRole: (typeof dbMock.AdminRole)[keyof typeof dbMock.AdminRole],
): AuditActor {
  return {
    clerkId: "clerk_admin",
    dbUserId: "admin_1",
    adminRole,
  };
}

describe("audit domain service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes audit log filters and pagination", () => {
    const result = buildAuditLogQuery({
      page: 2,
      limit: 500,
      search: "  user_deleted ",
      targetType: "user",
      dateFrom: "2026-05-01T00:00:00.000Z",
      sortOrder: "asc",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      page: 2,
      limit: 100,
      skip: 100,
      sortOrder: "asc",
      search: "user_deleted",
      targetType: "user",
      dateFrom: new Date("2026-05-01T00:00:00.000Z"),
    });
  });

  it("rejects invalid dates before repository access", async () => {
    const result = await listAuditLogPage(actor(dbMock.AdminRole.AUDITOR), {
      dateFrom: "not-a-date",
    });

    expect(result).toEqual({
      ok: false,
      code: "AUDIT_INVALID_FILTER",
      message: "Invalid from date",
    });
    expect(repositoryMock.listAuditLogs).not.toHaveBeenCalled();
  });

  it("requires audit/export capability for audit reads", async () => {
    const result = await listAuditLogPage(
      actor(dbMock.AdminRole.CONTENT_MODERATOR),
    );

    expect(result).toEqual({
      ok: false,
      code: "AUDIT_POLICY_DENIED",
      message: "Admin capability denied",
    });
    expect(repositoryMock.listAuditLogs).not.toHaveBeenCalled();
  });

  it("returns a paginated audit log page for allowed roles", async () => {
    repositoryMock.listAuditLogs.mockResolvedValue([{ id: "log_1" }]);
    repositoryMock.countAuditLogs.mockResolvedValue(1);

    const result = await listAuditLogPage(actor(dbMock.AdminRole.AUDITOR), {
      page: 1,
      limit: 10,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        logs: [{ id: "log_1" }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
        filters: {
          page: 1,
          limit: 10,
          skip: 0,
          sortOrder: "desc",
        },
      },
    });
  });

  it("returns grouped audit stats", async () => {
    repositoryMock.countAllAuditLogs.mockResolvedValue(10);
    repositoryMock.countTodayAuditLogs.mockResolvedValue(2);
    repositoryMock.groupAuditLogsByAction.mockResolvedValue([
      { action: "VERIFY_ENTITY", _count: { id: 3 } },
    ]);
    repositoryMock.groupAuditLogsByTargetType.mockResolvedValue([
      { targetType: "verification", _count: { id: 4 } },
    ]);
    repositoryMock.listRecentAuditLogs.mockResolvedValue([{ id: "log_1" }]);

    const result = await getAuditLogStats(
      actor(dbMock.AdminRole.SUPER_ADMIN),
      new Date("2026-05-18T12:00:00.000Z"),
    );

    expect(result).toEqual({
      ok: true,
      data: {
        totalLogs: 10,
        todayLogs: 2,
        byAction: [{ action: "VERIFY_ENTITY", count: 3 }],
        byTargetType: [{ targetType: "verification", count: 4 }],
        recentActivity: [{ id: "log_1" }],
      },
    });
    const expectedToday = new Date("2026-05-18T12:00:00.000Z");
    expectedToday.setHours(0, 0, 0, 0);
    expect(repositoryMock.countTodayAuditLogs).toHaveBeenCalledWith(expectedToday);
  });
});
