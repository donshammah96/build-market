import type { ApiResponse } from "@build/types";
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import { API_ROUTES } from "@/lib/routes";
import type { DashboardMetrics } from "@/lib/dashboard";

class DashboardMetricsClient {
  private readonly bulkhead = new ConcurrencyLimiter(3);

  async getMetrics(): Promise<ApiResponse<DashboardMetrics>> {
    return this.bulkhead.run(async () => {
      const response = await apiFetch<unknown>(
        API_ROUTES.professionalPortalDashboardMetrics,
      );

      if (!response.success) {
        return {
          success: false,
          error: response.error,
        };
      }

      return {
        success: true,
        data:
          response.data && typeof response.data === "object"
            ? (response.data as DashboardMetrics)
            : {},
      };
    });
  }
}

export const dashboardMetricsClient = new DashboardMetricsClient();
export default dashboardMetricsClient;
