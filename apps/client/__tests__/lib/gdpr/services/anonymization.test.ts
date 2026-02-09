import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  mockPrismaSuccess,
  mockPrismaWithDBError,
  mockPrismaWithTransactionRollback,
  mockPrismaWithLegalHold,
  generateMockUser,
  generateTestUUID,
  generateTestDate,
} from "../../../mocks";

vi.mock("@repo/db", () => ({
  prisma: mockPrismaSuccess(),
}));

describe("AnonymizationService", () => {
  let AnonymizationService: any;
  let service: any;
  let mockPrisma: ReturnType<typeof mockPrismaSuccess>;

  beforeEach(async () => {
    mockPrisma = mockPrismaSuccess();
    vi.doMock("@repo/db", () => ({
      prisma: mockPrisma,
    }));
    const serviceModule = await import(
      "@/app/lib/gdpr/services/anonymization.service"
    );
    AnonymizationService = serviceModule.AnonymizationService;
    service = new AnonymizationService();
  });

  describe("requestDeletion", () => {
    it("should successfully deactivate account without legal holds", async () => {
      const userId = "user_123";
      const user = generateMockUser({
        id: userId,
        legalHold: false,
        isActive: true,
      });

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(user);
      (mockPrisma.user.update as Mock).mockResolvedValue({
        ...user,
        isActive: false,
        deactivatedAt: generateTestDate(),
      });
      (mockPrisma.professionalProfile.update as Mock).mockResolvedValue({});
      (mockPrisma.asset.updateMany as Mock).mockResolvedValue({ count: 5 });

      const result = await service.requestDeletion(userId, userId);

      expect(result.success).toBe(true);
      expect(result.gracePeriodEnds).toBeDefined();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          isActive: false,
          deactivatedAt: expect.any(Date),
        },
      });
    });

    it("should reject deletion if legal hold is active", async () => {
      const userId = "user_123";
      const mockLegalHoldPrisma = mockPrismaWithLegalHold();
      vi.doMock("@repo/db", () => ({
        prisma: mockLegalHoldPrisma,
      }));
      const serviceModule = await import(
        "@/app/lib/gdpr/services/anonymization.service"
      );
      const legalHoldService = new serviceModule.AnonymizationService();

      await expect(
        legalHoldService.requestDeletion(userId, userId),
      ).rejects.toThrow("Cannot delete account: legal hold active");
    });

    it("should reject deletion if user has active disputes", async () => {
      const userId = "user_123";
      const user = generateMockUser({ id: userId, legalHold: false });

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(user);
      (mockPrisma.order.findMany as Mock).mockResolvedValue([
        { id: "order_1", status: "DISPUTED" },
      ]);

      await expect(service.requestDeletion(userId, userId)).rejects.toThrow(
        "Cannot delete: active disputes exist",
      );
    });

    it("should reject deletion if user has pending transactions", async () => {
      const userId = "user_123";
      const user = generateMockUser({ id: userId, legalHold: false });

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(user);
      (mockPrisma.order.findMany as Mock).mockResolvedValue([]);

      await expect(service.requestDeletion(userId, userId)).rejects.toThrow(
        "Cannot delete: pending transactions exist",
      );
    });

    it("should schedule assets for deletion", async () => {
      const userId = "user_123";
      const user = generateMockUser({ id: userId, legalHold: false });

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(user);
      (mockPrisma.order.findMany as Mock).mockResolvedValue([]);
      (mockPrisma.user.update as Mock).mockResolvedValue({
        ...user,
        isActive: false,
      });
      (mockPrisma.professionalProfile.update as Mock).mockResolvedValue({});
      (mockPrisma.asset.updateMany as Mock).mockResolvedValue({ count: 10 });

      await service.requestDeletion(userId, userId);

      expect(mockPrisma.asset.updateMany).toHaveBeenCalledWith({
        where: { uploadedBy: userId },
        data: {
          scheduledForDeletion: expect.any(Date),
        },
      });
    });

    it.concurrent(
      "should handle database errors during deletion request",
      async () => {
        const mockErrorPrisma = mockPrismaWithDBError();
        vi.doMock("@repo/db", () => ({
          prisma: mockErrorPrisma,
        }));
        const serviceModule = await import(
          "@/app/lib/gdpr/services/anonymization.service"
        );
        const errorService = new serviceModule.AnonymizationService();

        await expect(
          errorService.requestDeletion("user_123", "user_123"),
        ).rejects.toThrow("Database connection failed");
      },
    );
  });

  describe("reactivateAccount", () => {
    it("should successfully reactivate account within grace period", async () => {
      const userId = "user_123";
      const deactivatedAt = generateTestDate(-15); // 15 days ago
      const user = generateMockUser({
        id: userId,
        isActive: false,
        deactivatedAt,
      });

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(user);
      (mockPrisma.user.update as Mock).mockResolvedValue({
        ...user,
        isActive: true,
        deactivatedAt: null,
      });
      (mockPrisma.professionalProfile.update as Mock).mockResolvedValue({});
      (mockPrisma.asset.updateMany as Mock).mockResolvedValue({ count: 5 });

      const result = await service.reactivateAccount(userId);

      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          isActive: true,
          deactivatedAt: null,
        },
      });
    });

    it("should reject reactivation after grace period", async () => {
      const userId = "user_123";
      const deactivatedAt = generateTestDate(-31); // 31 days ago
      const user = generateMockUser({
        id: userId,
        isActive: false,
        deactivatedAt,
      });

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(user);

      await expect(service.reactivateAccount(userId)).rejects.toThrow(
        "Grace period expired",
      );
    });

    it("should restore scheduled assets", async () => {
      const userId = "user_123";
      const deactivatedAt = generateTestDate(-10);
      const user = generateMockUser({
        id: userId,
        isActive: false,
        deactivatedAt,
      });

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(user);
      (mockPrisma.user.update as Mock).mockResolvedValue({
        ...user,
        isActive: true,
      });
      (mockPrisma.professionalProfile.update as Mock).mockResolvedValue({});
      (mockPrisma.asset.updateMany as Mock).mockResolvedValue({ count: 5 });

      await service.reactivateAccount(userId);

      expect(mockPrisma.asset.updateMany).toHaveBeenCalledWith({
        where: { uploadedBy: userId },
        data: {
          scheduledForDeletion: null,
        },
      });
    });
  });

  describe("anonymizeExpiredAccounts", () => {
    it("should anonymize accounts past grace period", async () => {
      const userId = "user_123";
      const deactivatedAt = generateTestDate(-31);
      const user = generateMockUser({
        id: userId,
        isActive: false,
        deactivatedAt,
      });

      (mockPrisma.user.findMany as Mock).mockResolvedValue([user]);
      (mockPrisma.$transaction as Mock).mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      });
      (mockPrisma.user.update as Mock).mockResolvedValue({
        ...user,
        email: `ANONYMIZED-${generateTestUUID("anon")}@deleted.local`,
        firstName: `ANONYMIZED-${generateTestUUID("anon")}`,
        phoneNumber: `ANONYMIZED-${generateTestUUID("anon")}`,
      });
      (mockPrisma.professionalProfile.update as Mock).mockResolvedValue({});
      await service.anonymizeExpiredAccounts();

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          email: expect.stringMatching(/ANONYMIZED-.+@deleted\.local/),
          firstName: expect.stringMatching(/ANONYMIZED-.+/),
          phoneNumber: expect.stringMatching(/ANONYMIZED-.+/),
        },
      });
    });

    it("should skip accounts still within grace period", async () => {
      const deactivatedAt = generateTestDate(-15); // Only 15 days ago
      const user = generateMockUser({
        isActive: false,
        deactivatedAt,
      });

      (mockPrisma.user.findMany as Mock).mockResolvedValue([user]);

      const result = await service.anonymizeExpiredAccounts();

      expect(result.anonymizedCount).toBe(0);
    });

    it.concurrent(
      "should handle transaction rollback during anonymization",
      async () => {
        const mockRollbackPrisma = mockPrismaWithTransactionRollback();
        const deactivatedAt = generateTestDate(-31);
        const user = generateMockUser({ isActive: false, deactivatedAt });

        (mockRollbackPrisma.user.findMany as Mock).mockResolvedValue([user]);

        vi.doMock("@repo/db", () => ({
          prisma: mockRollbackPrisma,
        }));
        const serviceModule = await import(
          "@/app/lib/gdpr/services/anonymization.service"
        );
        const rollbackService = new serviceModule.AnonymizationService();

        await expect(
          rollbackService.anonymizeExpiredAccounts(),
        ).rejects.toThrow("Transaction rollback");
      },
    );
  });

  describe("PII replacement patterns", () => {
    it("should replace email with ANONYMIZED prefix", async () => {
      const userId = "user_123";
      const deactivatedAt = generateTestDate(-31);
      const user = generateMockUser({
        id: userId,
        email: "user@example.com",
        isActive: false,
        deactivatedAt,
      });

      (mockPrisma.user.findMany as Mock).mockResolvedValue([user]);
      (mockPrisma.$transaction as Mock).mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      });
      (mockPrisma.user.update as Mock).mockResolvedValue({
        ...user,
        email: `ANONYMIZED-${generateTestUUID("anon")}@deleted.local`,
      });
      (mockPrisma.professionalProfile.update as Mock).mockResolvedValue({});

      await service.anonymizeExpiredAccounts();

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          email: expect.stringMatching(/^ANONYMIZED-.+@deleted\.local$/),
        }),
      });
    });

    it("should replace phone number with ANONYMIZED prefix", async () => {
      const userId = "user_123";
      const deactivatedAt = generateTestDate(-31);
      const user = generateMockUser({
        id: userId,
        phoneNumber: "+254712345678",
        isActive: false,
        deactivatedAt,
      });

      (mockPrisma.user.findMany as Mock).mockResolvedValue([user]);
      (mockPrisma.$transaction as Mock).mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      });
      (mockPrisma.user.update as Mock).mockResolvedValue({
        ...user,
        phoneNumber: `ANONYMIZED-${generateTestUUID("anon")}`,
      });
      (mockPrisma.professionalProfile.update as Mock).mockResolvedValue({});

      await service.anonymizeExpiredAccounts();

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          phoneNumber: expect.stringMatching(/^ANONYMIZED-.+$/),
        }),
      });
    });
  });
});
