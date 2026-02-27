import { NextRequest } from "next/server";
import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import { TopProductsQuerySchema } from "@/app/lib/validation/products-validation";
import { getTopProducts } from "@/lib/services/products";

function parseTopProductsQuery(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return {
    limit: searchParams.get("limit") || undefined,
  };
}

/**
 * GET /api/professional-portal/products/top
 * Get top selling products across the professional's stores.
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "top-products-read",
  querySchema: TopProductsQuerySchema,
  parseQuery: parseTopProductsQuery,
  handler: async ({ dbUserId, query }) =>
    getTopProducts(dbUserId, query.limit),
  operationName: "get_top_products",
  errorMessage: "Failed to fetch top products",
});
