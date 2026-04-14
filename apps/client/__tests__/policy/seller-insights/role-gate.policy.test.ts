import { beforeEach, describe, expect, it, vi } from "vitest";
import { sellerInsightsService } from "@/app/lib/domains/seller-insights/service";

const repositoryMock = vi.hoisted(() => ({
  getInventoryAlerts: vi.fn(),
  getOrders: vi.fn(),
  getTopProducts: vi.fn(),
}));

vi.mock("@/app/lib/domains/seller-insights/repository", () => ({
  sellerInsightsRepository: repositoryMock,
}));

const PROFESSIONAL_ACTOR = { userId: "pro-1", role: "professional" as const };
const ADMIN_ACTOR = { userId: "admin-1", role: "admin" as const };
const CLIENT_ACTOR = { userId: "client-1", role: "client" as const };

describe("Seller insights role policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permits professional inventory alerts", async () => {
    repositoryMock.getInventoryAlerts.mockResolvedValue({
      data: [],
      summary: { outOfStock: 0, lowStock: 0 },
    });

    const result =
      await sellerInsightsService.getInventoryAlerts(PROFESSIONAL_ACTOR);

    expect(result.ok).toBe(true);
  });

  it("permits admin inventory alerts", async () => {
    repositoryMock.getInventoryAlerts.mockResolvedValue({
      data: [],
      summary: { outOfStock: 0, lowStock: 0 },
    });

    const result = await sellerInsightsService.getInventoryAlerts(ADMIN_ACTOR);

    expect(result.ok).toBe(true);
  });

  it("denies client inventory alerts", async () => {
    const result = await sellerInsightsService.getInventoryAlerts(CLIENT_ACTOR);

    expect(result).toMatchObject({
      ok: false,
      error: "forbidden",
      status: 403,
    });
  });

  it("permits professional orders", async () => {
    repositoryMock.getOrders.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    const result = await sellerInsightsService.getOrders(PROFESSIONAL_ACTOR, {
      page: 1,
      limit: 10,
    });

    expect(result.ok).toBe(true);
  });

  it("denies client orders", async () => {
    const result = await sellerInsightsService.getOrders(CLIENT_ACTOR, {
      page: 1,
      limit: 10,
    });

    expect(result).toMatchObject({
      ok: false,
      error: "forbidden",
      status: 403,
    });
  });

  it("permits admin top products", async () => {
    repositoryMock.getTopProducts.mockResolvedValue([]);

    const result = await sellerInsightsService.getTopProducts(ADMIN_ACTOR, {
      limit: 5,
    });

    expect(result.ok).toBe(true);
  });

  it("denies client top products", async () => {
    const result = await sellerInsightsService.getTopProducts(CLIENT_ACTOR, {
      limit: 5,
    });

    expect(result).toMatchObject({
      ok: false,
      error: "forbidden",
      status: 403,
    });
  });
});
