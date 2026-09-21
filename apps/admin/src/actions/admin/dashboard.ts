"use server";

import { safeAction } from "@/_core/safe-action";
import { dashboardService } from "@/lib/domains/dashboard/service";

/**
 * Fetches platform-wide statistics for the admin dashboard.
 * Delegates to dashboardService (VIEW_FINANCIALS capability gate).
 * Uses Promise.all for parallel queries to minimize latency.
 */
export async function getDashboardStats() {
  return safeAction("getDashboardStats", async ({ actor }) => {
    const result = await dashboardService.getDashboardStats(actor);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
  });
}
