import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMock = vi.hoisted(() => ({
  getInventoryAlerts: vi.fn(),
  getOrders: vi.fn(),
  getTopProducts: vi.fn(),
}));

vi.mock("@/app/lib/domains/seller-insights/repository", () => ({
  sellerInsightsRepository: repositoryMock,
}));

import { sellerInsightsService } from "@/app/lib/domains/seller-insights/service";

describe("sellerInsightsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects inventory alerts for non-professional actor", async () => {
    const result = await sellerInsightsService.getInventoryAlerts({
      userId: "user_123",
      role: "client",
    });

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
    expect(repositoryMock.getInventoryAlerts).not.toHaveBeenCalled();
  });

  it("returns inventory alerts for professional actor", async () => {
    const mockData = {
      data: [],
      summary: { outOfStock: 0, lowStock: 2 },
    };
    repositoryMock.getInventoryAlerts.mockResolvedValue(mockData);

    const result = await sellerInsightsService.getInventoryAlerts({
      userId: "pro_123",
      role: "professional",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockData);
    }
    expect(repositoryMock.getInventoryAlerts).toHaveBeenCalledWith("pro_123");
  });

  it("returns orders for professional actor", async () => {
    const mockData = {
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    };
    repositoryMock.getOrders.mockResolvedValue(mockData);

    const result = await sellerInsightsService.getOrders(
      { userId: "pro_123", role: "professional" },
      { page: 1, limit: 10 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockData);
    }
    expect(repositoryMock.getOrders).toHaveBeenCalledWith("pro_123", {
      page: 1,
      limit: 10,
    });
  });

  it("returns top products for professional actor", async () => {
    const mockData = [
      {
        id: "p1",
        name: "Product",
        imageUrl: null,
        price: 100,
        soldCount: 5,
        revenue: 500,
      },
    ];
    repositoryMock.getTopProducts.mockResolvedValue(mockData);

    const result = await sellerInsightsService.getTopProducts(
      { userId: "pro_123", role: "admin" },
      { limit: 5 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockData);
    }
    expect(repositoryMock.getTopProducts).toHaveBeenCalledWith("pro_123", 5);
  });
});
