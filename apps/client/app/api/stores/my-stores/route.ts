import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  RateLimits,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { getMyStores } from "@/lib/services/stores";

const logger = getClientLogger();

/**
 * GET /api/stores/my-stores
 * Get all stores owned by the authenticated professional
 * Returns store data formatted for dashboard widget
 * 
 * Features:
 * - Optimized single-query approach (no N+1 problem)
 * - Aggregated stats for each store
 * - Soft delete support
 * - Request metadata logging
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
  const { ipAddress } = getRequestMetadata(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    `stores-my:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info("Fetching user stores", {
    correlationId,
    userId: dbUserId,
    ipAddress,
  });

  try {
    const storesWithStats = await getMyStores(dbUserId);
    logger.info("User stores fetched successfully", {
      correlationId,
      userId: dbUserId,
      count: storesWithStats.length,
    });
    return apiSuccess(storesWithStats, HttpStatus.OK);
  } catch (error) {
    logger.error(
      "Failed to fetch user stores",
      error instanceof Error ? error : new Error("Unknown error"),
      { userId: dbUserId },
    );
    return apiError("Failed to fetch stores", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});