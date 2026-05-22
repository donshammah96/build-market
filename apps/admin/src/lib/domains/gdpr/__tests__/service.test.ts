import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
  } as const,
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
}));

vi.mock("../repository");

import { gdprService } from "../service";
import { gdprRepository } from "../repository";
import type { GdprActor } from "../contracts";
import { AdminRole } from "@build/db";

const mockLogs = [
  {
    id: "log-1",
    actorId: "actor-1",
    actorType: "ADMIN",
    action: "DATA_ACCESS_BY_ADMIN",
    entityType: "AuditLog",
    entityId: "report",
    metadata: {},
    createdAt: new Date("2026-05-01"),
    actor: null,
  },
];

function makeActor(adminRole: AdminRole): GdprActor {
  return { dbUserId: "actor-1", clerkId: "clerk-1", adminRole };
}

describe("gdprService.getComplianceQueue", () => {
  beforeEach(() => {
    vi.mocked(gdprRepository.findAuditLogs).mockResolvedValue(mockLogs);
  });

  it("returns audit logs for SUPER_ADMIN", async () => {
    const result = await gdprService.getComplianceQueue(
      makeActor(AdminRole.SUPER_ADMIN),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it("denies access for CONTENT_MODERATOR (no EXPORT_DATA)", async () => {
    const result = await gdprService.getComplianceQueue(
      makeActor(AdminRole.CONTENT_MODERATOR),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GDPR_POLICY_DENIED");
  });

  it("denies access for SUPPORT_AGENT", async () => {
    const result = await gdprService.getComplianceQueue(
      makeActor(AdminRole.SUPPORT_AGENT),
    );
    expect(result.ok).toBe(false);
  });

  it("returns GDPR_FETCH_FAILED on repository error", async () => {
    vi.mocked(gdprRepository.findAuditLogs).mockRejectedValue(
      new Error("DB error"),
    );
    const result = await gdprService.getComplianceQueue(
      makeActor(AdminRole.SUPER_ADMIN),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GDPR_FETCH_FAILED");
  });
});

describe("gdprService.logAdminDataAccess", () => {
  beforeEach(() => {
    vi.mocked(gdprRepository.logAdminAction).mockResolvedValue(undefined);
  });

  it("writes audit entry for SUPER_ADMIN", async () => {
    const result = await gdprService.logAdminDataAccess(
      makeActor(AdminRole.SUPER_ADMIN),
      {
        action: "DATA_ACCESS_BY_ADMIN",
        entityType: "AuditLog",
        entityId: "report",
      },
    );
    expect(result.ok).toBe(true);
  });

  it("returns GDPR_AUDIT_WRITE_FAILED on repository error", async () => {
    vi.mocked(gdprRepository.logAdminAction).mockRejectedValue(
      new Error("DB error"),
    );
    const result = await gdprService.logAdminDataAccess(
      makeActor(AdminRole.SUPER_ADMIN),
      {
        action: "DATA_ACCESS_BY_ADMIN",
        entityType: "AuditLog",
        entityId: "report",
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GDPR_AUDIT_WRITE_FAILED");
  });
});
