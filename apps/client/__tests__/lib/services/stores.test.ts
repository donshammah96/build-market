import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getStores,
  getStoreById,
  getMyStores,
  ensureUserCanCreateStores,
} from "@/lib/services/stores";

vi.mock("@/lib/db", () => ({
  prisma: {
    store: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    order: {
      groupBy: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

const { prisma } = await import("@/lib/db");

describe("Stores Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStores", () => {
    it("returns stores with pagination", async () => {
      vi.mocked(prisma.store.findMany).mockResolvedValue([
        { id: "store_1", name: "Store One" },
      ] as any);
      vi.mocked(prisma.store.count).mockResolvedValue(1);

      const result = await getStores({
        page: "1",
        limit: "20",
        radius: "5",
      });

      expect(result.stores).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe("getStoreById", () => {
    it("returns store when found", async () => {
      const mockStore = { id: "store_1", name: "Test Store" };
      vi.mocked(prisma.store.findUnique).mockResolvedValue(mockStore as any);

      const result = await getStoreById("store_1");

      expect(result).toEqual(mockStore);
      expect(prisma.store.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "store_1", deletedAt: null },
        }),
      );
    });

    it("returns null when not found", async () => {
      vi.mocked(prisma.store.findUnique).mockResolvedValue(null);

      const result = await getStoreById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getMyStores", () => {
    it("returns empty array when user has no stores", async () => {
      vi.mocked(prisma.store.findMany).mockResolvedValue([]);

      const result = await getMyStores("user_1");

      expect(result).toEqual([]);
    });

    it("returns stores with stats when user has stores", async () => {
      vi.mocked(prisma.store.findMany).mockResolvedValue([
        {
          id: "store_1",
          name: "Store One",
          slug: "store-one",
          description: null,
          logoUrl: null,
          verified: false,
          verificationStatus: null,
          rejectionReason: null,
          rating: null,
          reviewCount: 0,
          isOpen: true,
          featured: false,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { products: 5, orders: 10, reviews: 2 },
          products: [],
        },
      ] as any);
      vi.mocked(prisma.order.groupBy)
        .mockResolvedValueOnce([
          { storeId: "store_1", _count: { id: 2 } },
        ] as any)
        .mockResolvedValueOnce([
          { storeId: "store_1", _sum: { totalAmount: 1000 } },
        ] as any);

      const result = await getMyStores("user_1");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "store_1",
        name: "Store One",
        totalProducts: 5,
        totalOrders: 10,
        totalReviews: 2,
        pendingOrders: 2,
        totalRevenue: 1000,
      });
    });
  });

  describe("ensureUserCanCreateStores", () => {
    it("throws when user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(ensureUserCanCreateStores("user_1")).rejects.toThrow(
        "User not found",
      );
    });

    it("throws when user is suspended", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        status: "SUSPENDED",
        professionalProfile: { userId: "user_1" },
      } as any);

      await expect(ensureUserCanCreateStores("user_1")).rejects.toThrow(
        "Account suspended",
      );
    });

    it("throws when user is not a professional", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        status: "ACTIVE",
        professionalProfile: null,
      } as any);

      await expect(ensureUserCanCreateStores("user_1")).rejects.toThrow(
        "Only professionals can create stores",
      );
    });

    it("does not throw when user is active professional", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        status: "ACTIVE",
        professionalProfile: { userId: "user_1" },
      } as any);

      await expect(
        ensureUserCanCreateStores("user_1"),
      ).resolves.toBeUndefined();
    });
  });
});
