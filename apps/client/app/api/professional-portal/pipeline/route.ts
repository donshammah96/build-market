import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import { getProfessionalPipeline } from "@/lib/services/pipeline";

/**
 * GET /api/professional-portal/pipeline
 * Get sales pipeline data for property professionals.
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "pipeline-read",
  handler: async ({ dbUserId }) => getProfessionalPipeline(dbUserId),
  operationName: "get_sales_pipeline",
  errorMessage: "Failed to fetch sales pipeline",
});
