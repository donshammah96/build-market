import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
  } as const,
  AuditStatus: {
    SUCCESS: "SUCCESS",
    FAILURE: "FAILURE",
    DENIED: "DENIED",
  } as const,
  AuditSeverity: {
    INFO: "INFO",
    WARNING: "WARNING",
    CRITICAL: "CRITICAL",
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
  findDistinctActions: vi.fn(),
  findForExport: vi.fn(),
  createAuditLog: vi.fn(),
}));

const securityRepositoryMock = vi.hoisted(() => ({
  findUserForAudit: vi.fn(),
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
  AuditStatus: dbMock.AuditStatus,
  AuditSeverity: dbMock.AuditSeverity,
}));

vi.mock("../repository", () => ({
  auditRepository: repositoryMock,
}));

vi.mock("@/lib/security/repository", () => ({
  securityRepository: securityRepositoryMock,
}));

import type { AuditActor } from "../contracts";
import {
  buildAuditLogQuery,
  exportAuditLogs,
  getAuditLogStats,
  getDistinctActions,
  listAuditLogPage,
  recordAdminAuditEvent,
} from "../service";

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

  // ---------------------------------------------------------------------------
  // buildAuditLogQuery
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // listAuditLogPage — capability
  // ---------------------------------------------------------------------------

  it("denies CONTENT_MODERATOR from reading audit logs", async () => {
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

  it("denies SUPPORT_AGENT from reading audit logs", async () => {
    const result = await listAuditLogPage(
      actor(dbMock.AdminRole.SUPPORT_AGENT),
    );
    expect(result.ok).toBe(false);
    expect(repositoryMock.listAuditLogs).not.toHaveBeenCalled();
  });

  it("returns a paginated audit log page for AUDITOR", async () => {
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
        filters: { page: 1, limit: 10, skip: 0, sortOrder: "desc" },
      },
    });
  });

  it("returns a paginated audit log page for FINANCE_MANAGER", async () => {
    repositoryMock.listAuditLogs.mockResolvedValue([]);
    repositoryMock.countAuditLogs.mockResolvedValue(0);

    const result = await listAuditLogPage(
      actor(dbMock.AdminRole.FINANCE_MANAGER),
    );
    expect(result.ok).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // getAuditLogStats
  // ---------------------------------------------------------------------------

  it("returns grouped audit stats for SUPER_ADMIN", async () => {
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
    expect(repositoryMock.countTodayAuditLogs).toHaveBeenCalledWith(
      expectedToday,
    );
  });

  // ---------------------------------------------------------------------------
  // getDistinctActions
  // ---------------------------------------------------------------------------

  it("returns distinct action strings for AUDITOR", async () => {
    repositoryMock.findDistinctActions.mockResolvedValue([
      "delete_user",
      "verify_entity",
    ]);

    const result = await getDistinctActions(actor(dbMock.AdminRole.AUDITOR));

    expect(result).toEqual({
      ok: true,
      data: ["delete_user", "verify_entity"],
    });
    expect(repositoryMock.findDistinctActions).toHaveBeenCalledOnce();
  });

  it("denies CONTENT_MODERATOR from getDistinctActions", async () => {
    const result = await getDistinctActions(
      actor(dbMock.AdminRole.CONTENT_MODERATOR),
    );
    expect(result.ok).toBe(false);
    expect(repositoryMock.findDistinctActions).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // exportAuditLogs — capability + data shape
  // ---------------------------------------------------------------------------

  it("denies FINANCE_MANAGER from exportAuditLogs (requires EXPORT_DATA)", async () => {
    const result = await exportAuditLogs(
      actor(dbMock.AdminRole.FINANCE_MANAGER),
    );
    expect(result).toEqual({
      ok: false,
      code: "AUDIT_POLICY_DENIED",
      message: "Admin capability denied",
    });
    expect(repositoryMock.findForExport).not.toHaveBeenCalled();
  });

  it("denies CONTENT_MODERATOR from exportAuditLogs", async () => {
    const result = await exportAuditLogs(
      actor(dbMock.AdminRole.CONTENT_MODERATOR),
    );
    expect(result.ok).toBe(false);
    expect(repositoryMock.findForExport).not.toHaveBeenCalled();
  });

  it("returns export page for AUDITOR", async () => {
    const now = new Date("2026-05-21T00:00:00.000Z");
    repositoryMock.findForExport.mockResolvedValue([
      {
        id: "log_export_1",
        adminName: "Admin User",
        adminRole: "AUDITOR",
        action: "export_audit_log",
        targetType: "audit_log",
        targetId: "report",
        severity: "INFO",
        status: "SUCCESS",
        reason: null,
        ipAddress: "10.0.0.1",
        createdAt: now,
      },
    ]);

    const result = await exportAuditLogs(actor(dbMock.AdminRole.AUDITOR));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.count).toBe(1);
    expect(result.data.data[0]).toMatchObject({
      id: "log_export_1",
      adminName: "Admin User",
      adminRole: "AUDITOR",
      action: "export_audit_log",
      reason: "",
      ipAddress: "10.0.0.1",
      createdAt: now.toISOString(),
    });
  });

  it("calls findForExport (AUDIT_EXPORT_MAX_ROWS is applied inside the repository, not via query.limit)", async () => {
    repositoryMock.findForExport.mockResolvedValue([]);

    const result = await exportAuditLogs(actor(dbMock.AdminRole.SUPER_ADMIN), {
      limit: 10,
    });

    // The service must always call findForExport regardless of caller limit input
    expect(result.ok).toBe(true);
    expect(repositoryMock.findForExport).toHaveBeenCalledOnce();
  });

  // ---------------------------------------------------------------------------
  // recordAdminAuditEvent
  // ---------------------------------------------------------------------------

  describe("recordAdminAuditEvent", () => {
    it("successfully creates an audit log when user exists", async () => {
      securityRepositoryMock.findUserForAudit.mockResolvedValue({
        id: "admin_user_id",
        firstName: "Test",
        lastName: "Admin",
        email: "admin@test.com",
        role: "ADMIN",
        adminProfile: { role: "SUPER_ADMIN" },
      });

      repositoryMock.createAuditLog.mockResolvedValue({ id: "log_inserted" });

      await recordAdminAuditEvent({
        actor: {
          dbUserId: "admin_user_id",
          clerkId: "clerk_123",
          adminRole: "SUPER_ADMIN",
        },
        operationName: "delete_user",
        correlationId: "correlation_123",
        targetResourceType: "user",
        targetResourceId: "target_user_id",
        outcome: "success",
        details: { foo: "bar" },
        reason: "Request by owner",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      });

      expect(securityRepositoryMock.findUserForAudit).toHaveBeenCalledWith(
        "admin_user_id",
      );
      expect(repositoryMock.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: "admin_user_id",
          adminName: "Test Admin",
          adminEmail: "admin@test.com",
          adminRole: "SUPER_ADMIN",
          action: "delete_user",
          severity: "WARNING",
          status: "SUCCESS",
          targetId: "target_user_id",
          targetType: "user",
          reason: "Request by owner",
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
          requestId: "correlation_123",
        }),
      );
    });

    it("fails silently when user is not found", async () => {
      securityRepositoryMock.findUserForAudit.mockResolvedValue(null);

      await recordAdminAuditEvent({
        actor: {
          dbUserId: "missing_user",
          clerkId: "clerk_123",
          adminRole: "SUPER_ADMIN",
        },
        operationName: "delete_user",
        correlationId: "correlation_123",
        outcome: "success",
      });

      expect(repositoryMock.createAuditLog).not.toHaveBeenCalled();
    });
  });
});
