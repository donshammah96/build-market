import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  mockPrismaSuccess,
  generateMockConsent,
  generateMockUser,
} from "../../../mocks";

vi.mock("@build/db", () => ({
  prisma: mockPrismaSuccess(),
}));

describe("ConsentService", () => {
  let ConsentService: any;
  let service: any;
  let mockPrisma: ReturnType<typeof mockPrismaSuccess>;

  beforeEach(async () => {
    vi.resetModules();
    mockPrisma = mockPrismaSuccess();
    vi.doMock("@build/db", () => ({
      prisma: mockPrisma,
    }));
    const serviceModule =
      await import("@/app/lib/gdpr/services/consent.service");
    ConsentService = serviceModule.ConsentService;
    service = new ConsentService();
  });

  describe("updateConsent", () => {
    it("should create new consent record when none exists", async () => {
      const userId = "user_123";
      const consentType = "MARKETING_EMAIL";
      const user = generateMockUser({ id: userId });

      (mockPrisma.consentRecord.findFirst as Mock).mockResolvedValue(null);
      (mockPrisma.consentRecord.create as Mock).mockResolvedValue(
        generateMockConsent({ userId, type: consentType, granted: true }),
      );
      (mockPrisma.user.update as Mock).mockResolvedValue(user);

      const result = await service.updateConsent(
        userId,
        consentType,
        true,
        "v1.0",
      );

      expect(result.granted).toBe(true);
      expect(mockPrisma.consentRecord.create).toHaveBeenCalledWith({
        data: {
          userId,
          type: consentType,
          granted: true,
          documentVersion: "v1.0",
          grantedAt: expect.any(Date),
        },
      });
    });

    it("should update existing consent record", async () => {
      const userId = "user_123";
      const consentType = "MARKETING_EMAIL";
      const existingConsent = generateMockConsent({
        userId,
        type: consentType,
        granted: true,
      });

      (mockPrisma.consentRecord.findFirst as Mock).mockResolvedValue(
        existingConsent,
      );
      (mockPrisma.consentRecord.update as Mock).mockResolvedValue({
        ...existingConsent,
        granted: false,
        grantedAt: null,
      });

      const result = await service.updateConsent(
        userId,
        consentType,
        false,
        "v1.0",
      );

      expect(result.granted).toBe(false);
      expect(mockPrisma.consentRecord.update).toHaveBeenCalledWith({
        where: { id: existingConsent.id },
        data: {
          granted: false,
          grantedAt: undefined,
        },
      });
    });

    it("should update user legacy consent flags", async () => {
      const userId = "user_123";
      const consentType = "MARKETING_EMAIL";
      const user = generateMockUser({ id: userId });

      (mockPrisma.consentRecord.findFirst as Mock).mockResolvedValue(null);
      (mockPrisma.consentRecord.create as Mock).mockResolvedValue(
        generateMockConsent({ userId, type: consentType, granted: true }),
      );
      (mockPrisma.user.update as Mock).mockResolvedValue(user);

      await service.updateConsent(userId, consentType, true, "v1.0");

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          emailMarketingConsent: true,
        },
      });
    });

    it("should handle database errors during consent update", async () => {
      (mockPrisma.consentRecord.findFirst as Mock).mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        service.updateConsent("user_123", "MARKETING_EMAIL", true),
      ).rejects.toThrow("Database connection failed");
    });

    it("should rollback on transaction failure", async () => {
      (mockPrisma.$transaction as Mock).mockRejectedValue(
        new Error("Transaction rollback"),
      );

      await expect(
        service.updateConsent("user_123", "MARKETING_EMAIL", true),
      ).rejects.toThrow("Transaction rollback");
    });
  });

  describe("getConsents", () => {
    it("should retrieve all consents for a user", async () => {
      const userId = "user_123";
      const consents = [
        generateMockConsent({ userId, type: "MARKETING_EMAIL", granted: true }),
        generateMockConsent({ userId, type: "MARKETING_SMS", granted: false }),
      ];

      (mockPrisma.consentRecord.findMany as Mock).mockResolvedValue(consents);

      const result = await service.getConsents(userId);

      expect(result).toHaveLength(2);
      expect(mockPrisma.consentRecord.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { grantedAt: "desc" },
      });
    });

    it("should return empty array for user with no consents", async () => {
      const userId = "user_456";

      (mockPrisma.consentRecord.findMany as Mock).mockResolvedValue([]);

      const result = await service.getConsents(userId);

      expect(result).toEqual([]);
    });

    it("should handle database errors during consent retrieval", async () => {
      (mockPrisma.consentRecord.findMany as Mock).mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(service.getConsents("user_123")).rejects.toThrow(
        "Database connection failed",
      );
    });
  });

  describe("getConsentHistory", () => {
    it("should retrieve consent change history", async () => {
      const userId = "user_123";
      const consentType = "MARKETING_EMAIL";
      const history = [
        generateMockConsent({ userId, type: consentType, granted: true }),
        generateMockConsent({
          userId,
          type: consentType,
          granted: false,
          grantedAt: null,
        }),
      ];

      (mockPrisma.consentRecord.findMany as Mock).mockResolvedValue(history);

      const result = await service.getConsentHistory(userId, consentType);

      expect(result).toHaveLength(2);
      expect(mockPrisma.consentRecord.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          type: consentType,
        },
        orderBy: { grantedAt: "desc" },
      });
    });
  });

  describe("revokeAllConsents", () => {
    it("should revoke all active consents for a user", async () => {
      const userId = "user_123";
      const activeConsents = [
        generateMockConsent({ userId, type: "MARKETING_EMAIL", granted: true }),
        generateMockConsent({
          userId,
          type: "ANALYTICS_COOKIES",
          granted: true,
        }),
      ];

      (mockPrisma.consentRecord.findMany as Mock).mockResolvedValue(
        activeConsents,
      );
      (mockPrisma.consentRecord.updateMany as Mock).mockResolvedValue({
        count: 2,
      });

      const result = await service.revokeAllConsents(userId);

      expect(result.count).toBe(2);
      expect(mockPrisma.consentRecord.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          granted: true,
        },
        data: {
          granted: false,
          grantedAt: undefined,
        },
      });
    });

    it("should return zero count if no active consents exist", async () => {
      const userId = "user_456";

      (mockPrisma.consentRecord.findMany as Mock).mockResolvedValue([]);
      (mockPrisma.consentRecord.updateMany as Mock).mockResolvedValue({
        count: 0,
      });

      const result = await service.revokeAllConsents(userId);

      expect(result.count).toBe(0);
    });

    it("should handle transaction rollback during bulk revoke", async () => {
      (mockPrisma.$transaction as Mock).mockRejectedValue(
        new Error("Transaction rollback"),
      );

      await expect(service.revokeAllConsents("user_123")).rejects.toThrow(
        "Transaction rollback",
      );
    });
  });
});
