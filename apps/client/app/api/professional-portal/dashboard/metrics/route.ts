import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import { getDashboardMetrics } from "@/lib/dashboard/dashboardMetrics.service";

/**
 * GET /api/professional-portal/dashboard/metrics
 * Get dashboard metrics based on user's profession
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "dashboard-metrics-read",
  handler: async ({ dbUserId }) => getDashboardMetrics(dbUserId),
  operationName: "get_dashboard_metrics",
  errorMessage: "Failed to fetch dashboard metrics",
});
