import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { mockPrismaSuccess } from "../../../mocks";

vi.mock("@build/db", () => ({
  prisma: mockPrismaSuccess(),
}));

describe("AssetCleanupService", () => {
  let AssetCleanupService: any;
  let service: any;
  let mockPrisma: ReturnType<typeof mockPrismaSuccess>;

  beforeEach(async () => {
    vi.resetModules();
    mockPrisma = mockPrismaSuccess();
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

      (mockPrisma.asset.updateMany as Mock).mockResolvedValue({ count: 10 });

      const result = await service.scheduleAssetsForDeletion(userId, 30);

      expect(result.count).toBe(10);
      expect(mockPrisma.asset.updateMany).toHaveBeenCalledWith({
        where: { uploaderId: userId },
        data: {
          deleteAfter: expect.any(Date),
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
        where: { uploaderId: userId },
        data: {
          deleteAfter: null,
        },
      });
    });
  });

  describe("executeScheduledDeletions", () => {
    it("should delete orphaned assets from S3 and database", async () => {
      const assets = [
        {
          id: "asset_1",
          key: "uploads/file1.jpg",
          uploaderId: "user_123",
        },
      ];

      (mockPrisma.asset.findMany as Mock).mockResolvedValue(assets);
      (mockPrisma.project.count as Mock).mockResolvedValue(0);
      (mockPrisma.user.count as Mock).mockResolvedValue(0);
      (mockPrisma.asset.delete as Mock).mockResolvedValue(assets[0]);

      const result = await service.executeScheduledDeletions();

      expect(result.deletedCount).toBe(1);
      expect(result.failedDeletions).toEqual([]);
      expect(mockPrisma.asset.delete).toHaveBeenCalledWith({
        where: { id: "asset_1" },
      });
    });

    it("should keep assets that are still referenced", async () => {
      const assets = [
        {
          id: "asset_1",
          key: "uploads/file1.jpg",
          uploaderId: "user_123",
        },
      ];

      (mockPrisma.asset.findMany as Mock).mockResolvedValue(assets);
      (mockPrisma.project.count as Mock).mockResolvedValue(1); // Still referenced
      (mockPrisma.user.count as Mock).mockResolvedValue(0);
      (mockPrisma.asset.update as Mock).mockResolvedValue({
        ...assets[0],
        uploaderId: "system",
      });

      const result = await service.executeScheduledDeletions();

      expect(result.deletedCount).toBe(0);
      expect(result.failedDeletions).toEqual([]);
      expect(mockPrisma.asset.update).toHaveBeenCalledWith({
        where: { id: "asset_1" },
        data: {
          uploaderId: "system",
          deleteAfter: null,
        },
      });
    });

    it("should handle per-asset failures gracefully", async () => {
      const assets = [
        {
          id: "asset_1",
          key: "uploads/file1.jpg",
          uploaderId: "user_123",
        },
      ];

      (mockPrisma.asset.findMany as Mock).mockResolvedValue(assets);
      (mockPrisma.project.count as Mock).mockRejectedValue(
        new Error("Count failure"),
      );

      const result = await service.executeScheduledDeletions();

      expect(result.failedDeletions).toEqual(["asset_1"]);
      expect(result.deletedCount).toBe(0);
    });
  });

  describe("countReferences", () => {
    it("should count references across all related tables", async () => {
      const assetId = "asset_123";

      (mockPrisma.project.count as Mock).mockResolvedValue(2);
      (mockPrisma.user.count as Mock).mockResolvedValue(1);

      const count = await service.countReferences(assetId);

      expect(count).toBe(3);
    });

    it("should return zero for unreferenced assets", async () => {
      const assetId = "asset_456";

      (mockPrisma.project.count as Mock).mockResolvedValue(0);
      (mockPrisma.user.count as Mock).mockResolvedValue(0);

      const count = await service.countReferences(assetId);

      expect(count).toBe(0);
    });
  });

  describe("Batch processing", () => {
    it("should process all discovered assets", async () => {
      const assets = Array.from({ length: 20 }, (_, i) => ({
        id: `asset_${i}`,
        key: `uploads/file${i}.jpg`,
        uploaderId: "user_123",
      }));

      (mockPrisma.asset.findMany as Mock).mockResolvedValue(assets);
      (mockPrisma.project.count as Mock).mockResolvedValue(0);
      (mockPrisma.user.count as Mock).mockResolvedValue(0);
      (mockPrisma.asset.delete as Mock).mockResolvedValue({});

      const result = await service.executeScheduledDeletions();

      expect(result.deletedCount).toBe(20);
      expect(mockPrisma.asset.delete).toHaveBeenCalledTimes(20);
    });
  });
});
