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
import { TopProductsQuerySchema } from "@/app/lib/validation/products-validation";
import { sellerInsightsService } from "@/app/lib/domains/seller-insights";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();

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
export const GET = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    initializeCorrelationId(req);

    const rawQuery = parseTopProductsQuery(req);
    const validation = TopProductsQuerySchema.safeParse(rawQuery);
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
      `top-products-read:${identifier}`,
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
        sellerInsightsService.getTopProducts(
          { userId: dbUserId, role: normalizeRole(String(userRole)) },
          { limit: query.limit },
        ),
      { operationName: "get_top_products" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch top products", result.error);
      return apiError(
        "Failed to fetch top products",
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
