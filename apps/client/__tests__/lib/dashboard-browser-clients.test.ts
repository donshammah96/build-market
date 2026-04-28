import { afterEach, describe, expect, it, vi } from "vitest";
import { dashboardMetricsClient } from "@/lib/dashboard-metrics-client";
import { inventoryClient } from "@/lib/inventory-client";
import { leadsClient } from "@/lib/leads-client";
import { ordersClient } from "@/lib/orders-client";
import { pipelineClient } from "@/lib/pipeline-client";
import { portfolioClient } from "@/lib/portfolio-client";
import { productsClient } from "@/lib/products-client";

function expectSuccess<T>(result: {
  success: boolean;
  data?: T;
  error?: string;
}): T {
  expect(result.success).toBe(true);

  if (!result.success || result.data === undefined) {
    throw new Error(result.error || "Expected successful result");
  }

  return result.data;
}

describe("dashboard browser clients", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes portfolio list envelopes into items", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            portfolios: [
              {
                id: "portfolio-1",
                title: "Ridgeview Townhouses",
                projectType: "RESIDENTIAL",
                images: ["https://cdn.example.com/portfolio-1.jpg"],
                createdAt: "2026-03-10T12:00:00.000Z",
                updatedAt: "2026-03-10T12:05:00.000Z",
              },
            ],
            pagination: { page: 1, limit: 4, total: 1, totalPages: 1 },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await portfolioClient.getPortfolios({ limit: 4 });
    const data = expectSuccess(result);

    expect(data).toHaveLength(1);
    expect(data[0]?.title).toBe("Ridgeview Townhouses");
  });

  it("normalizes professional orders into dashboard-safe order items", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            data: [
              {
                id: "order-1",
                status: "PROCESSING",
                totalAmount: 12500,
                itemCount: 3,
                paymentMethod: "MPESA",
                client: { id: "client-1", name: "Jane Doe" },
                store: { id: "store-1", name: "Build Mart" },
                createdAt: "2026-03-10T12:00:00.000Z",
                updatedAt: "2026-03-10T12:05:00.000Z",
              },
            ],
            pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await ordersClient.getOrders({ limit: 5 });
    const data = expectSuccess(result);

    expect(data.items[0]?.customerName).toBe("Jane Doe");
    expect(data.items[0]?.status).toBe("processing");
    expect(data.pagination.total).toBe(1);
  });

  it("normalizes inventory alerts list payloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            data: [
              {
                id: "product-1",
                productName: "PVC Pipes",
                slug: "pvc-pipes",
                sku: "PVC-001",
                currentStock: 2,
                threshold: 10,
                status: "low_stock",
                store: { id: "store-1", name: "Build Mart" },
              },
            ],
            summary: { outOfStock: 0, lowStock: 1 },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await inventoryClient.getAlerts();
    const data = expectSuccess(result);

    expect(data.data[0]?.productName).toBe("PVC Pipes");
    expect(data.summary.lowStock).toBe(1);
  });

  it("serializes dashboard lead filters and preserves the list envelope", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            leads: [
              {
                id: "lead-1",
                clientName: "Jane Doe",
                clientEmail: "jane@example.com",
                clientPhone: "+254700000000",
                projectType: "RESIDENTIAL",
                location: "Nairobi",
                budget: "1250000",
                status: "NEW",
                createdAt: "2026-03-10T12:00:00.000Z",
                updatedAt: "2026-03-10T12:05:00.000Z",
              },
            ],
            pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await leadsClient.getLeads({
      limit: 5,
      status: ["NEW", "CONTACTED"],
    });
    const data = expectSuccess(result);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);

    expect(requestUrl).toContain("/api/professional-portal/leads?");
    expect(requestUrl).toContain("limit=5");
    expect(requestUrl).toContain("status=NEW%2CCONTACTED");
    expect(data.leads[0]?.clientName).toBe("Jane Doe");
    expect(data.pagination.total).toBe(1);
  });

  it("returns normalized pipeline summaries for dashboard consumers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            stages: [
              { id: "viewing", count: 2, value: 10000000 },
              { id: "offer", count: 1, value: 5000000 },
            ],
            totalValue: 15000000,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await pipelineClient.getPipelineSummary();
    const data = expectSuccess(result);

    expect(data).toEqual({
      stages: [
        { id: "viewing", count: 2, value: 10000000 },
        { id: "offer", count: 1, value: 5000000 },
      ],
      totalValue: 15000000,
    });
  });

  it("returns dashboard metrics and top products from normalized clients", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { totalSales: 120000, pendingOrders: 3 },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "product-1",
                name: "Cement Bag",
                imageUrl: null,
                price: 750,
                soldCount: 42,
                revenue: 31500,
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const metrics = expectSuccess(await dashboardMetricsClient.getMetrics());
    const products = expectSuccess(
      await productsClient.getTopProducts({ limit: 5 }),
    );

    expect(metrics.totalSales).toBe(120000);
    expect(products[0]?.soldCount).toBe(42);
  });
});
