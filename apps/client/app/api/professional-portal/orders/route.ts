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
import { OrdersQuerySchema } from "@/app/lib/validation/orders-validation";
import { sellerInsightsService } from "@/app/lib/domains/seller-insights";
import { normalizeRole } from "@/app/lib/security/roles";

const ROUTE_PATTERN = "/api/professional-portal/orders";

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
    getClientLogger().info("Seller insights orders adapter outcome", {
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
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole)) ?? String(userRole);
    const operationName = "get_professional_orders";
    const logOutcome = createSellerInsightsOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    const rawQuery = parseOrdersQuery(req);
    const validation = OrdersQuerySchema.safeParse(rawQuery);
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
        sellerInsightsService.getOrders(
          { userId: dbUserId, role: actorRole },
          query,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      getClientLogger().error("Failed to fetch orders", result.error, {
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
        "Failed to fetch orders",
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
