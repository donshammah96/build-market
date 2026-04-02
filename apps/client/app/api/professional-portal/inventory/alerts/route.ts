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
import { sellerInsightsService } from "@/app/lib/domains/seller-insights";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/inventory/alerts
 * Get inventory alerts for the professional's stores.
 */
export const GET = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    initializeCorrelationId(req);

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `inventory-alerts:${identifier}`,
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
        sellerInsightsService.getInventoryAlerts({
          userId: dbUserId,
          role: normalizeRole(String(userRole)),
        }),
      { operationName: "get_inventory_alerts" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch inventory alerts", result.error);
      return apiError(
        "Failed to fetch inventory alerts",
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
