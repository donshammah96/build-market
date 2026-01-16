/**
 * Audit Service Test Suite
 * Tests for audit logging functionality
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAuditLog,
  getAuditHistory,
  getAdminActivityLog,
} from "@/lib/services/verification/audit-service";

const TEST_UUIDs = {
    ADMIN_1: "a0000000-0000-4000-8000-000000000001",
    ADMIN_2: "a0000000-0000-4000-8000-000000000002",
    LOG_ID_1: "d0000000-0000-4000-8000-000000000001",
    LOG_ID_2: "d0000000-0000-4000-8000-000000000002",
}

vi.mock("@repo/db", () => ({
  prisma: {
    adminAuditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("Audit Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAuditLog", () => {
    it("should create audit log with all fields", async () => {
      const { prisma } = await import("@repo/db");

      vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({
        id: TEST_UUIDs.LOG_ID_1,
        adminId: TEST_UUIDs.ADMIN_1,
        action: "VERIFY_PROFESSIONAL",
        entityType: "ProfessionalProfile",
        entityId: "prof_123",
        oldStatus: "PENDING",
        newStatus: "VERIFIED",
        reason: "All documents verified",
        metadata: { companyName: "Test Co" },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        createdAt: new Date(),
      } as any);

      await createAuditLog({
        adminId: TEST_UUIDs.ADMIN_1,
        action: "VERIFY_PROFESSIONAL",
        entityType: "ProfessionalProfile",
        entityId: "prof_123",
        oldStatus: "PENDING",
        newStatus: "VERIFIED",
        reason: "All documents verified",
        metadata: { companyName: "Test Co" },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: TEST_UUIDs.ADMIN_1,
          action: "VERIFY_PROFESSIONAL",
          entityType: "ProfessionalProfile",
          entityId: "prof_123",
          oldStatus: "PENDING",
          newStatus: "VERIFIED",
        }),
      });
    });

    it("should handle audit log creation failure gracefully", async () => {
      const { prisma } = await import("@repo/db");

      vi.mocked(prisma.adminAuditLog.create).mockRejectedValue(
        new Error("Database error")
      );

      // Should not throw
      await expect(
        createAuditLog({
          adminId: TEST_UUIDs.ADMIN_1,
          action: "VERIFY_PROFESSIONAL",
          entityType: "ProfessionalProfile",
          entityId: "prof_123",
          newStatus: "VERIFIED",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("getAuditHistory", () => {
    it("should fetch audit history for an entity", async () => {
      const { prisma } = await import("@repo/db");

      const mockLogs = [
        {
          id: TEST_UUIDs.LOG_ID_1,
          action: "VERIFY_PROFESSIONAL",
          createdAt: new Date("2026-01-06"),
          admin: { id: TEST_UUIDs.ADMIN_1, firstName: "Don", lastName: "Shammah" },
        },
        {
          id: TEST_UUIDs.LOG_ID_2,
          action: "REJECT_PROFESSIONAL",
          createdAt: new Date("2026-01-05"),
          admin: { id: TEST_UUIDs.ADMIN_2, firstName: "Evans", lastName: "Ndegwa" },
        },
      ];

      vi.mocked(prisma.adminAuditLog.findMany).mockResolvedValue(
        mockLogs as any
      );

      const result = await getAuditHistory("ProfessionalProfile", "prof_123");

      expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entityType: "ProfessionalProfile",
            entityId: "prof_123",
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      );

      expect(result).toEqual(mockLogs);
    });

    it("should respect limit parameter", async () => {
      const { prisma } = await import("@repo/db");

      vi.mocked(prisma.adminAuditLog.findMany).mockResolvedValue([] as any);

      await getAuditHistory("Store", "store_123", 10);

      expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });
  });

  describe("getAdminActivityLog", () => {
    it("should fetch activity log for an admin", async () => {
      const { prisma } = await import("@repo/db");

      const mockActivity = [
        {
          id: TEST_UUIDs.LOG_ID_1,
          action: "VERIFY_PROFESSIONAL",
          entityType: "ProfessionalProfile",
          createdAt: new Date(),
        },
        {
          id: TEST_UUIDs.LOG_ID_2,
          action: "APPROVE_DOCUMENT",
          entityType: "Certificate",
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.adminAuditLog.findMany).mockResolvedValue(
        mockActivity as any
      );

      const result = await getAdminActivityLog(TEST_UUIDs.ADMIN_1);

      expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adminId: TEST_UUIDs.ADMIN_1 },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      );

      expect(result).toEqual(mockActivity);
    });
  });
});
