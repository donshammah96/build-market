import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  mockPrismaSuccess,
  mockS3Success,
  mockS3WithUploadFailure,
  generateMockUser,
  generateTestUUID,
  generateTestDate,
} from "../../../mocks";

vi.mock("@build/db", () => ({
  prisma: mockPrismaSuccess(),
}));

describe("AssetCleanupService", () => {
  let AssetCleanupService: any;
  let service: any;
  let mockPrisma: ReturnType<typeof mockPrismaSuccess>;
  let mockS3: ReturnType<typeof mockS3Success>;

  beforeEach(async () => {
    mockPrisma = mockPrismaSuccess();
    mockS3 = mockS3Success();
    vi.doMock("@build/db", () => ({
      prisma: mockPrisma,
    }));
    const serviceModule =
      await import("@/app/lib/gdpr/services/asset-cleanup.service");
    AssetCleanupService = serviceModule.AssetCleanupService;
    service = new AssetCleanupService();
  });

  describe("scheduleAssetsForDeletion", () => {
    it("should schedule all user assets for deletion", async () => {
      const userId = "user_123";
      const scheduledAt = generateTestDate(30);

      (mockPrisma.asset.updateMany as Mock).mockResolvedValue({ count: 10 });

      const result = await service.scheduleAssetsForDeletion(
        userId,
        scheduledAt,
      );

      expect(result.count).toBe(10);
      expect(mockPrisma.asset.updateMany).toHaveBeenCalledWith({
        where: { uploadedBy: userId },
        data: {
          scheduledForDeletion: scheduledAt,
        },
      });
    });

    it("should return zero for users with no assets", async () => {
      const userId = "user_456";

      (mockPrisma.asset.updateMany as Mock).mockResolvedValue({ count: 0 });

      const result = await service.scheduleAssetsForDeletion(userId);

      expect(result.count).toBe(0);
    });
  });

  describe("restoreScheduledAssets", () => {
    it("should clear scheduled deletion flag for user assets", async () => {
      const userId = "user_123";

      (mockPrisma.asset.updateMany as Mock).mockResolvedValue({ count: 5 });

      const result = await service.restoreScheduledAssets(userId);

      expect(result.count).toBe(5);
      expect(mockPrisma.asset.updateMany).toHaveBeenCalledWith({
        where: { uploadedBy: userId },
        data: {
          scheduledForDeletion: null,
        },
      });
    });
  });

  describe("executeScheduledDeletions", () => {
    it("should delete orphaned assets from S3 and database", async () => {
      const assets = [
        {
          id: "asset_1",
          fileKey: "uploads/file1.jpg",
          uploadedBy: "user_123",
        },
      ];

      (mockPrisma.asset.findMany as Mock).mockResolvedValue(assets);
      (mockPrisma.project.count as Mock).mockResolvedValue(0);
      (mockPrisma.order.count as Mock).mockResolvedValue(0);
      (mockPrisma.user.count as Mock).mockResolvedValue(0);
      (mockS3.send as Mock).mockResolvedValue({});
      (mockPrisma.asset.delete as Mock).mockResolvedValue(assets[0]);

      const result = await service.executeScheduledDeletions();

      expect(result.deletedCount).toBe(1);
      expect(mockS3.send).toHaveBeenCalledTimes(1);
      expect(mockPrisma.asset.delete).toHaveBeenCalledWith({
        where: { id: "asset_1" },
      });
    });

    it("should keep assets that are still referenced", async () => {
      const assets = [
        {
          id: "asset_1",
          fileKey: "uploads/file1.jpg",
          uploadedBy: "user_123",
        },
      ];

      (mockPrisma.asset.findMany as Mock).mockResolvedValue(assets);
      (mockPrisma.project.count as Mock).mockResolvedValue(1); // Still referenced
      (mockPrisma.asset.update as Mock).mockResolvedValue({
        ...assets[0],
        uploadedBy: "system-user",
      });

      const result = await service.executeScheduledDeletions();

      expect(result.retainedCount).toBe(1);
      expect(result.deletedCount).toBe(0);
      expect(mockS3.send).not.toHaveBeenCalled();
      expect(mockPrisma.asset.update).toHaveBeenCalledWith({
        where: { id: "asset_1" },
        data: {
          uploadedBy: "system-user",
          scheduledForDeletion: null,
        },
      });
    });

    it.concurrent("should handle S3 deletion failures gracefully", async () => {
      const mockS3Error = mockS3WithUploadFailure();
      const assets = [
        {
          id: "asset_1",
          fileKey: "uploads/file1.jpg",
          uploadedBy: "user_123",
        },
      ];

      (mockPrisma.asset.findMany as Mock).mockResolvedValue(assets);
      (mockPrisma.project.count as Mock).mockResolvedValue(0);
      (mockPrisma.order.count as Mock).mockResolvedValue(0);
      (mockPrisma.user.count as Mock).mockResolvedValue(0);

      vi.doMock("@build/db", () => ({
        prisma: mockPrisma,
      }));
      const serviceModule =
        await import("@/app/lib/gdpr/services/asset-cleanup.service");
      const errorService = new serviceModule.AssetCleanupService();

      const result = await errorService.executeScheduledDeletions();

      expect(result.failedDeletions).toHaveLength(1);
      expect(result.deletedCount).toBe(0);
    });
  });

  describe("countReferences", () => {
    it("should count references across all related tables", async () => {
      const assetId = "asset_123";

      (mockPrisma.project.count as Mock).mockResolvedValue(2);
      (mockPrisma.order.count as Mock).mockResolvedValue(1);
      (mockPrisma.user.count as Mock).mockResolvedValue(0);

      const count = await service.countReferences(assetId);

      expect(count).toBe(3); // 2 + 1 + 0
    });

    it("should return zero for unreferenced assets", async () => {
      const assetId = "asset_456";

      (mockPrisma.project.count as Mock).mockResolvedValue(0);
      (mockPrisma.order.count as Mock).mockResolvedValue(0);
      (mockPrisma.user.count as Mock).mockResolvedValue(0);

      const count = await service.countReferences(assetId);

      expect(count).toBe(0);
    });
  });

  describe("Batch processing", () => {
    it("should process assets in batches of 100", async () => {
      const assets = Array.from({ length: 250 }, (_, i) => ({
        id: `asset_${i}`,
        fileKey: `uploads/file${i}.jpg`,
        uploadedBy: "user_123",
      }));

      (mockPrisma.asset.findMany as Mock).mockResolvedValue(assets);
      (mockPrisma.project.count as Mock).mockResolvedValue(0);
      (mockPrisma.order.count as Mock).mockResolvedValue(0);
      (mockPrisma.user.count as Mock).mockResolvedValue(0);
      (mockS3.send as Mock).mockResolvedValue({});
      (mockPrisma.asset.delete as Mock).mockResolvedValue({});

      const result = await service.executeScheduledDeletions();

      expect(result.deletedCount).toBe(250);
      expect(mockS3.send).toHaveBeenCalledTimes(250);
    });
  });
});
