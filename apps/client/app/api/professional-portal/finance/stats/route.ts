import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import { financeService } from "@/app/lib/domains/finance";

/**
 * GET /api/professional-portal/finance/stats
 * Get financial statistics for the authenticated professional.
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "finance-stats",
  handler: async ({ dbUserId, userRole }) => {
    const result = await financeService.getFinanceStats({
      userId: dbUserId,
      role: userRole,
    });

    if (!result.ok) {
      throw new Error(result.message ?? "Failed to fetch finance stats");
    }

    return result.data;
  },
  operationName: "get_finance_stats",
  errorMessage: "Failed to fetch finance stats",
});
