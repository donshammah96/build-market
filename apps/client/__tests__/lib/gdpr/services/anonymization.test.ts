import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  mockPrismaSuccess,
  generateMockUser,
  generateTestDate,
} from "../../../mocks";

vi.mock("@build/db", () => ({
  prisma: mockPrismaSuccess(),
}));

describe("AnonymizationService", () => {
  let AnonymizationService: any;
  let service: any;
  let mockPrisma: ReturnType<typeof mockPrismaSuccess>;

  beforeEach(async () => {
    vi.resetModules();
    mockPrisma = mockPrismaSuccess();
    vi.doMock("@build/db", () => ({
      prisma: mockPrisma,
    }));
    const serviceModule =
      await import("@/app/lib/gdpr/services/anonymization.service");
    AnonymizationService = serviceModule.AnonymizationService;
    service = new AnonymizationService();
  });

  describe("requestDeletion", () => {
    it("should successfully deactivate account without legal holds", async () => {
      const userId = "user_123";
      const user = generateMockUser({ id: userId });

      (mockPrisma.project.count as Mock).mockResolvedValue(0);
      (mockPrisma.user.update as Mock).mockResolvedValue({
        ...user,
        status: "DEACTIVATED",
      });
      (mockPrisma.auditLog.create as Mock).mockResolvedValue({});
      (mockPrisma.asset.updateMany as Mock).mockResolvedValue({ count: 5 });

      const result = await service.requestDeletion(userId, userId);

      expect(result.success).toBe(true);
      expect(result.gracePeriodEnds).toBeInstanceOf(Date);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          status: "DEACTIVATED",
          deletionRequestedAt: expect.any(Date),
          scheduledDeletionAt: expect.any(Date),
        }),
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: userId,
          action: "ACCOUNT_DEACTIVATED",
          entityId: userId,
        }),
      });
      expect(mockPrisma.asset.updateMany).toHaveBeenCalledWith({
        where: { uploaderId: userId },
        data: {
          deleteAfter: expect.any(Date),
        },
      });
    });

    it("should reject deletion when unresolved disputes exist", async () => {
      const userId = "user_123";
      (mockPrisma.project.count as Mock).mockResolvedValue(2);

      await expect(service.requestDeletion(userId, userId)).rejects.toThrow(
        "Cannot delete account: legal hold active",
      );
    });

    it("should handle database errors during deletion request", async () => {
      const userId = "user_123";
      (mockPrisma.project.count as Mock).mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(service.requestDeletion(userId, userId)).rejects.toThrow(
        "Database connection failed",
      );
    });
  });

  describe("reactivateAccount", () => {
    it("should successfully reactivate account within grace period", async () => {
      const userId = "user_123";
      const deletionRequestedAt = new Date();
      deletionRequestedAt.setDate(deletionRequestedAt.getDate() - 5);

      (mockPrisma.user.findUnique as Mock).mockResolvedValue({
        status: "DEACTIVATED",
        deletionRequestedAt,
      });
      (mockPrisma.user.update as Mock).mockResolvedValue({
        id: userId,
        status: "ACTIVE",
      });
      (mockPrisma.asset.updateMany as Mock).mockResolvedValue({ count: 5 });

      const result = await service.reactivateAccount(userId);

      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          status: "ACTIVE",
          deletionRequestedAt: null,
          scheduledDeletionAt: null,
        },
      });
      expect(mockPrisma.asset.updateMany).toHaveBeenCalledWith({
        where: { uploaderId: userId },
        data: { deleteAfter: null },
      });
    });

    it("should reject reactivation after grace period", async () => {
      const userId = "user_123";
      const deletionRequestedAt = new Date();
      deletionRequestedAt.setDate(deletionRequestedAt.getDate() - 31);

      (mockPrisma.user.findUnique as Mock).mockResolvedValue({
        status: "DEACTIVATED",
        deletionRequestedAt,
      });

      await expect(service.reactivateAccount(userId)).rejects.toThrow(
        "Grace period expired",
      );
    });

    it("should reject reactivation when account is already active", async () => {
      const userId = "user_123";

      (mockPrisma.user.findUnique as Mock).mockResolvedValue({
        status: "ACTIVE",
        deletionRequestedAt: null,
      });

      await expect(service.reactivateAccount(userId)).rejects.toThrow(
        "Account is already active",
      );
    });
  });

  describe("anonymizeExpiredAccounts", () => {
    it("should anonymize accounts past grace period", async () => {
      const userId = "user_123";
      const user = { id: userId, deletionRequestedAt: generateTestDate(-31) };

      (mockPrisma.user.findMany as Mock).mockResolvedValue([user]);
      (mockPrisma.user.update as Mock).mockResolvedValue({
        id: userId,
      });

      const result = await service.anonymizeExpiredAccounts();

      expect(result.anonymizedCount).toBe(1);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          email: expect.stringMatching(/^ANONYMIZED-.+\/deleted\.local$/),
          firstName: expect.stringMatching(/^ANONYMIZED-.+/),
          phone: expect.stringMatching(/^ANONYMIZED-.+/),
          anonymizedAt: expect.any(Date),
        }),
      });
    });

    it("should skip accounts still within grace period", async () => {
      (mockPrisma.user.findMany as Mock).mockResolvedValue([]);

      const result = await service.anonymizeExpiredAccounts();

      expect(result.anonymizedCount).toBe(0);
    });

    it("should continue when one anonymization transaction fails", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      (mockPrisma.user.findMany as Mock).mockResolvedValue([
        { id: "user_123", deletionRequestedAt: generateTestDate(-31) },
      ]);
      (mockPrisma.$transaction as Mock).mockRejectedValue(
        new Error("Transaction rollback"),
      );

      const result = await service.anonymizeExpiredAccounts();

      expect(result.anonymizedCount).toBe(0);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to anonymize user record",
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
