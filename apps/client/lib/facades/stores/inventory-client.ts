import type { ApiResponse } from "@build/types";
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import { API_ROUTES } from "@/lib/links";
import type {
  SellerInventoryAlert,
  SellerInventoryAlertsResult,
} from "@/domains/seller-insights";

export type InventoryAlertsResponse = SellerInventoryAlertsResult;

class InventoryClient {
  private readonly bulkhead = new ConcurrencyLimiter(3);

  async getAlerts(): Promise<ApiResponse<InventoryAlertsResponse>> {
    return this.bulkhead.run(async () => {
      const response = await apiFetch<SellerInventoryAlertsResult>(
        API_ROUTES.professionalPortalInventoryAlerts,
      );

      if (!response.success) {
        return {
          success: false,
          error: response.error,
        };
      }

      const value = response.data;
      if (!value || typeof value !== "object") {
        return {
          success: true,
          data: { data: [], summary: { outOfStock: 0, lowStock: 0 } },
        };
      }

      const data = Array.isArray(value.data) ? value.data : [];
      const summary = value.summary ?? { outOfStock: 0, lowStock: 0 };

      return {
        success: true,
        data: {
          data: data as SellerInventoryAlert[],
          summary: {
            outOfStock:
              typeof summary.outOfStock === "number" ? summary.outOfStock : 0,
            lowStock:
              typeof summary.lowStock === "number" ? summary.lowStock : 0,
          },
        },
      };
    });
  }
}

export const inventoryClient = new InventoryClient();
export default inventoryClient;
