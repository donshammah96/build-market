import type { ApiResponse } from "@build/types";
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import { API_ROUTES, withQueryParams, type QueryParams } from "@/lib/routes";
import type { SellerOrderListResult } from "@/domains/seller-insights";

export type OrdersQueryInput = {
  page?: number | string;
  limit?: number | string;
  status?: string;
};

export type ProfessionalOrderListItem = {
  id: string;
  customerName: string;
  items: number;
  total: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
  updatedAt: string;
  paymentMethod: string | null;
  store: {
    id: string;
    name: string;
  } | null;
};

export type ProfessionalOrdersPage = {
  items: ProfessionalOrderListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function normalizeOrderStatus(
  status: unknown,
): ProfessionalOrderListItem["status"] {
  switch (asString(status).toUpperCase()) {
    case "PROCESSING":
      return "processing";
    case "SHIPPED":
      return "shipped";
    case "DELIVERED":
    case "PAID":
      return "delivered";
    case "CANCELLED":
      return "cancelled";
    default:
      return "pending";
  }
}

function normalizeOrdersPage(
  payload: SellerOrderListResult | null,
): ProfessionalOrdersPage {
  const value = payload ?? {
    data: [],
    pagination: { page: 1, limit: 0, total: 0, totalPages: 0 },
  };
  const rawItems = Array.isArray(value.data) ? value.data : [];
  const items = rawItems.map((item) => {
    const order = item as {
      id?: unknown;
      totalAmount?: unknown;
      itemCount?: unknown;
      status?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
      paymentMethod?: unknown;
      client?: unknown;
      store?: unknown;
    };
    const client = (order.client ?? {}) as { name?: unknown };
    const store = order.store as { id?: unknown; name?: unknown } | null;

    return {
      id: asString(order.id),
      customerName: asString(client.name, "Unknown customer"),
      items: asNumber(order.itemCount),
      total: asNumber(order.totalAmount),
      status: normalizeOrderStatus(order.status),
      createdAt: asString(order.createdAt),
      updatedAt: asString(order.updatedAt),
      paymentMethod:
        typeof order.paymentMethod === "string" ? order.paymentMethod : null,
      store: store
        ? {
            id: asString(store.id),
            name: asString(store.name),
          }
        : null,
    } satisfies ProfessionalOrderListItem;
  });

  return {
    items,
    pagination: {
      page:
        typeof value.pagination?.page === "number" ? value.pagination.page : 1,
      limit:
        typeof value.pagination?.limit === "number"
          ? value.pagination.limit
          : items.length,
      total:
        typeof value.pagination?.total === "number"
          ? value.pagination.total
          : items.length,
      totalPages:
        typeof value.pagination?.totalPages === "number"
          ? value.pagination.totalPages
          : items.length > 0
            ? 1
            : 0,
    },
  };
}

class OrdersClient {
  private readonly bulkhead = new ConcurrencyLimiter(4);

  async getOrders(
    filters?: OrdersQueryInput,
  ): Promise<ApiResponse<ProfessionalOrdersPage>> {
    return this.bulkhead.run(async () => {
      const url = filters
        ? withQueryParams(
            API_ROUTES.professionalPortalOrders,
            filters as QueryParams,
          )
        : API_ROUTES.professionalPortalOrders;
      const response = await apiFetch<SellerOrderListResult>(url);

      if (!response.success) {
        return {
          success: false,
          error: response.error,
        };
      }

      return {
        success: true,
        data: normalizeOrdersPage(response.data ?? null),
      };
    });
  }
}

export const ordersClient = new OrdersClient();
export default ordersClient;
