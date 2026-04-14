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
  getActorRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { TopProductsQuerySchema } from "@/app/lib/validation/products-validation";
import { sellerInsightsService } from "@/app/lib/domains/seller-insights";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();
const ROUTE_PATTERN = "/api/professional-portal/products/top";

type SellerInsightsAdapterOutcome =
  | "started"
  | "succeeded"
  | "failed"
  | "rate_limited"
  | "bad_request"
  | "domain_error";

function createSellerInsightsOutcomeLogger(
  req: NextRequest,
  correlationId: string,
  actorRole: string,
  requestStartedAt: number,
  operationName: string,
) {
  return (
    outcome: SellerInsightsAdapterOutcome,
    httpStatus: number,
    details: { domainError?: string } = {},
  ) => {
    logger.info("Seller insights top products adapter outcome", {
      correlationId,
      operationName,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole,
      outcome,
      httpStatus,
      durationMs: Date.now() - requestStartedAt,
      ...(details.domainError ? { domainError: details.domainError } : {}),
    });
  };
}

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
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole)) ?? String(userRole);
    const operationName = "get_top_products";
    const logOutcome = createSellerInsightsOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    const rawQuery = parseTopProductsQuery(req);
    const validation = TopProductsQuerySchema.safeParse(rawQuery);
    if (!validation.success) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }
    const query = validation.data;

    const rateLimitKey = getActorRateLimitIdentifier(
      dbUserId,
      "seller-insights-read",
    );
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS);
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const resilientExecutor = getResilientExecutor();
    logOutcome("started", HttpStatus.OK);
    const result = await resilientExecutor.execute(
      () =>
        sellerInsightsService.getTopProducts(
          { userId: dbUserId, role: actorRole },
          { limit: query.limit },
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch top products", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR);
      return apiError(
        "Failed to fetch top products",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      logOutcome("domain_error", HttpStatus.FORBIDDEN, {
        domainError: (data as { error?: string }).error,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    logOutcome("succeeded", HttpStatus.OK);
    return apiSuccess(data.data, HttpStatus.OK);
  },
);
