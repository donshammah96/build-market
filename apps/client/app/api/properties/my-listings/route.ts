import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  RateLimits,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { propertiesService } from "@/app/lib/domains/properties";

const logger = getClientLogger();

const querySchema = z.object({
  limit: z.string().regex(/^\d+$/).optional().default("10"),
  status: z
    .enum(["all", "active", "pending", "sold"])
    .optional()
    .default("active"),
});

/**
 * GET /api/properties/my-listings
 * Get property listings owned by the authenticated user.
 * Returns property data formatted for dashboard widget.
 * Excludes soft-deleted properties.
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    `my-listings:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const { searchParams } = new URL(req.url);
  const queryParams = {
    limit: searchParams.get("limit") || "10",
    status: searchParams.get("status") || "active",
  };

  const queryValidation = querySchema.safeParse(queryParams);
  if (!queryValidation.success) {
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues,
    );
  }

  const { limit, status } = queryValidation.data;
  const limitNum = Math.min(parseInt(limit), 50);

  logger.info("Fetching user property listings", {
    correlationId,
    userId: dbUserId,
    limit: limitNum,
    status,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () =>
      propertiesService.getMyListings(dbUserId, {
        limit: limitNum,
        status,
      }),
    { operationName: "get_my_listings" },
  );

  if (result.success && result.data?.ok) {
    return apiSuccess(result.data.data, HttpStatus.OK, correlationId);
  }

  if (result.success && result.data && !result.data.ok) {
    return apiError(result.data.message, result.data.status);
  }

  logger.error("Failed to fetch listings", result.error, {
    correlationId,
    userId: dbUserId,
  });
  return apiError("Failed to fetch listings", HttpStatus.INTERNAL_SERVER_ERROR);
});
