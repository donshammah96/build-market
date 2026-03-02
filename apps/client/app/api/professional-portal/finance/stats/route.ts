import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import { getFinanceStats } from "@/lib/services/finance";

/**
 * GET /api/professional-portal/finance/stats
 * Get financial statistics for the authenticated professional.
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "finance-stats",
  handler: async ({ dbUserId }) => getFinanceStats(dbUserId),
  operationName: "get_finance_stats",
  errorMessage: "Failed to fetch finance stats",
});
