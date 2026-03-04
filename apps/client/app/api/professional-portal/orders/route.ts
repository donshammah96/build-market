import { NextRequest } from "next/server";
import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import { OrdersQuerySchema } from "@/app/lib/validation/orders-validation";
import { getProfessionalOrders } from "@/lib/services/orders";

function parseOrdersQuery(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return {
    limit: searchParams.get("limit") || undefined,
    page: searchParams.get("page") || undefined,
    status: searchParams.get("status") || undefined,
  };
}

/**
 * GET /api/professional-portal/orders
 * List orders for the authenticated professional's stores.
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "prof-orders-read",
  querySchema: OrdersQuerySchema,
  parseQuery: parseOrdersQuery,
  handler: async ({ dbUserId, query }) =>
    getProfessionalOrders(dbUserId, query),
  operationName: "get_professional_orders",
  errorMessage: "Failed to fetch orders",
});
