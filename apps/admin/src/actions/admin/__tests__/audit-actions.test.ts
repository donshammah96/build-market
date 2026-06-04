import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    AUDITOR: "AUDITOR",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
  } as const,
  UserRole: { ADMIN: "ADMIN" } as const,
}));

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

const clerkMock = vi.hoisted(() => ({
  auth: vi.fn(),
}));

const syncMock = vi.hoisted(() => ({
  syncUserRole: vi.fn().mockResolvedValue(undefined),
}));

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

const auditServiceMock = vi.hoisted(() => ({
  auditService: {
    listAuditLogPage: vi.fn(),
    getAuditLogStats: vi.fn(),
    getDistinctActions: vi.fn(),
    exportAuditLogs: vi.fn(),
    recordAdminAuditEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
  UserRole: dbMock.UserRole,
  prisma: prismaMock,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: clerkMock.auth,
}));

vi.mock("../../lib/auth-sync", () => syncMock);
vi.mock("@/lib/api/rate-limit", () => rateLimitMock);
vi.mock("@/lib/domains/audit/service", () => auditServiceMock);

vi.mock("@/lib/config/feature-flags", () => ({
  AdminFeatureFlag: {
    ADMIN_V2_STRUCTURED_LOGGING: "admin_v2_structured_logging",
  },
  isAdminFeatureEnabled: vi.fn().mockReturnValue(false),
}));

import {
  getAuditLogs,
  getAuditLogStats,
  getAuditLogActions,
  exportAuditLogs,
} from "../audit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockActorAs(
  role: (typeof dbMock.AdminRole)[keyof typeof dbMock.AdminRole],
) {
  clerkMock.auth.mockResolvedValue({ userId: "clerk_test", sessionClaims: {} });
  prismaMock.user.findUnique.mockResolvedValue({
    id: "user_1",
    role: dbMock.UserRole.ADMIN,
    adminProfile: { role, isActive: true },
  });
}

const okPage = {
  ok: true,
  data: {
    logs: [],
    meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    filters: { page: 1, limit: 20, skip: 0, sortOrder: "desc" },
  },
};

// ---------------------------------------------------------------------------
// getAuditLogs
// ---------------------------------------------------------------------------

describe("getAuditLogs action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to auditService.listAuditLogPage on success", async () => {
    mockActorAs(dbMock.AdminRole.AUDITOR);
    auditServiceMock.auditService.listAuditLogPage.mockResolvedValue(okPage);

    const result = await getAuditLogs({ page: 1, limit: 20 });

    expect(result.success).toBe(true);
    expect(
      auditServiceMock.auditService.listAuditLogPage,
    ).toHaveBeenCalledOnce();
  });

  it("returns action failure when service returns domain error", async () => {
    mockActorAs(dbMock.AdminRole.AUDITOR);
    auditServiceMock.auditService.listAuditLogPage.mockResolvedValue({
      ok: false,
      code: "AUDIT_POLICY_DENIED",
      message: "Admin capability denied",
    });

    const result = await getAuditLogs();

    expect(result.success).toBe(false);
    expect(result.error).toContain("Admin capability denied");
  });

  it("returns UNAUTHORIZED when not authenticated", async () => {
    clerkMock.auth.mockResolvedValue({ userId: null });

    const result = await getAuditLogs();

    expect(result.success).toBe(false);
    expect(result.errorDetails?.code).toBe("UNAUTHORIZED");
    expect(
      auditServiceMock.auditService.listAuditLogPage,
    ).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getAuditLogStats
// ---------------------------------------------------------------------------

describe("getAuditLogStats action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to auditService.getAuditLogStats on success", async () => {
    mockActorAs(dbMock.AdminRole.SUPER_ADMIN);
    auditServiceMock.auditService.getAuditLogStats.mockResolvedValue({
      ok: true,
      data: {
        totalLogs: 5,
        todayLogs: 1,
        byAction: [],
        byTargetType: [],
        recentActivity: [],
      },
    });

    const result = await getAuditLogStats();

    expect(result.success).toBe(true);
    expect(
      auditServiceMock.auditService.getAuditLogStats,
    ).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// getAuditLogActions
// ---------------------------------------------------------------------------

describe("getAuditLogActions action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to auditService.getDistinctActions on success", async () => {
    mockActorAs(dbMock.AdminRole.AUDITOR);
    auditServiceMock.auditService.getDistinctActions.mockResolvedValue({
      ok: true,
      data: ["delete_user", "verify_entity"],
    });

    const result = await getAuditLogActions();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(["delete_user", "verify_entity"]);
    }
  });
});

// ---------------------------------------------------------------------------
// exportAuditLogs
// ---------------------------------------------------------------------------

describe("exportAuditLogs action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires recentAuth — delegates to service on fresh session", async () => {
    // Provide a fresh auth_time (just now)
    const freshAuthTime = Math.floor(Date.now() / 1000);
    clerkMock.auth.mockResolvedValue({
      userId: "clerk_test",
      sessionClaims: { auth_time: freshAuthTime },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user_1",
      role: dbMock.UserRole.ADMIN,
      adminProfile: { role: dbMock.AdminRole.AUDITOR, isActive: true },
    });
    auditServiceMock.auditService.exportAuditLogs.mockResolvedValue({
      ok: true,
      data: { data: [], count: 0 },
    });

    const result = await exportAuditLogs({});

    expect(result.success).toBe(true);
    expect(
      auditServiceMock.auditService.exportAuditLogs,
    ).toHaveBeenCalledOnce();
  });

  it("rejects stale session with SESSION_STALE", async () => {
    const staleAuthTime = Math.floor(Date.now() / 1000) - 400; // > 300s
    clerkMock.auth.mockResolvedValue({
      userId: "clerk_test",
      sessionClaims: { auth_time: staleAuthTime },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user_1",
      role: dbMock.UserRole.ADMIN,
      adminProfile: { role: dbMock.AdminRole.AUDITOR, isActive: true },
    });

    const result = await exportAuditLogs({});

    expect(result.success).toBe(false);
    expect(result.errorDetails?.code).toBe("SESSION_STALE");
    expect(
      auditServiceMock.auditService.exportAuditLogs,
    ).not.toHaveBeenCalled();
  });

  it("does not call service when actor is not authenticated", async () => {
    clerkMock.auth.mockResolvedValue({ userId: null });

    const result = await exportAuditLogs({});

    expect(result.success).toBe(false);
    expect(result.errorDetails?.code).toBe("UNAUTHORIZED");
    expect(
      auditServiceMock.auditService.exportAuditLogs,
    ).not.toHaveBeenCalled();
  });
});
