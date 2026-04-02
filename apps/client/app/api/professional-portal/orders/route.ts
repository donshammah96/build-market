import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { OrdersQuerySchema } from "@/app/lib/validation/orders-validation";
import { sellerInsightsService } from "@/app/lib/domains/seller-insights";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();

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
export const GET = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    initializeCorrelationId(req);

    const rawQuery = parseOrdersQuery(req);
    const validation = OrdersQuerySchema.safeParse(rawQuery);
    if (!validation.success) {
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }
    const query = validation.data;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `prof-orders-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        sellerInsightsService.getOrders(
          { userId: dbUserId, role: normalizeRole(String(userRole)) },
          query,
        ),
      { operationName: "get_professional_orders" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch orders", result.error);
      return apiError(
        "Failed to fetch orders",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      return apiError(
        (data as { message?: string }).message ?? "Forbidden",
        HttpStatus.FORBIDDEN,
      );
    }

    return apiSuccess(data.data, HttpStatus.OK);
  },
);
