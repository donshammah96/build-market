import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET as inventoryAlertsGet } from "@/app/api/professional-portal/inventory/alerts/route";
import { GET as ordersGet } from "@/app/api/professional-portal/orders/route";
import { GET as topProductsGet } from "@/app/api/professional-portal/products/top/route";
import { sellerInsightsService } from "@/app/lib/domains/seller-insights";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (
      handler: (
        req: NextRequest,
        context: { dbUserId: string; userRole: string },
      ) => Promise<unknown>,
    ) =>
    async (req: NextRequest) =>
      handler(req, { dbUserId: "db_user_123", userRole: "PROFESSIONAL" }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/api-response", () => ({
  apiError: vi
    .fn()
    .mockImplementation((message: string, status: number, details?: unknown) =>
      NextResponse.json(
        { success: false, error: message, details },
        { status },
      ),
    ),
  apiSuccess: vi
    .fn()
    .mockImplementation((data: unknown, status: number = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
  HttpStatus: {
    BAD_REQUEST: 400,
    FORBIDDEN: 403,
    OK: 200,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        return { success: true, data: await fn() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  }),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
}));

vi.mock("@/app/lib/domains/seller-insights", () => ({
  sellerInsightsService: {
    getInventoryAlerts: vi.fn(),
    getOrders: vi.fn(),
    getTopProducts: vi.fn(),
  },
}));

describe("seller insights route adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires inventory alerts through seller-insights domain", async () => {
    vi.mocked(sellerInsightsService.getInventoryAlerts).mockResolvedValue({
      ok: true,
      data: {
        data: [],
        summary: { outOfStock: 0, lowStock: 0 },
      },
    });

    const response = await inventoryAlertsGet(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/inventory/alerts",
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({
      data: [],
      summary: { outOfStock: 0, lowStock: 0 },
    });
    expect(sellerInsightsService.getInventoryAlerts).toHaveBeenCalledWith({
      userId: "db_user_123",
      role: "professional",
    });
  });

  it("maps forbidden to 403", async () => {
    vi.mocked(sellerInsightsService.getInventoryAlerts).mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });

    const response = await inventoryAlertsGet(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/inventory/alerts",
      ),
    );

    expect(response.status).toBe(403);
  });

  it("parses orders query and delegates to seller-insights domain", async () => {
    vi.mocked(sellerInsightsService.getOrders).mockResolvedValue({
      ok: true,
      data: {
        data: [],
        pagination: { page: 2, limit: 50, total: 0, totalPages: 0 },
      },
    });

    const response = await ordersGet(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/orders?page=2&limit=50&status=PENDING",
      ),
    );

    expect(response.status).toBe(200);
    expect(sellerInsightsService.getOrders).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "professional" },
      expect.objectContaining({ page: 2, limit: 50, status: "PENDING" }),
    );
  });

  it("parses top-products query and delegates to seller-insights domain", async () => {
    vi.mocked(sellerInsightsService.getTopProducts).mockResolvedValue({
      ok: true,
      data: [
        {
          id: "product_123",
          name: "Steel Beam",
          imageUrl: null,
          price: 1000,
          soldCount: 4,
          revenue: 4000,
        },
      ],
    });

    const response = await topProductsGet(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/products/top?limit=3",
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([
      {
        id: "product_123",
        name: "Steel Beam",
        imageUrl: null,
        price: 1000,
        soldCount: 4,
        revenue: 4000,
      },
    ]);
    expect(sellerInsightsService.getTopProducts).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "professional" },
      { limit: 3 },
    );
  });
});
