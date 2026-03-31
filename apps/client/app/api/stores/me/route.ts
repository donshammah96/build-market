import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  RateLimits,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { storesService } from "@/app/lib/domains/stores";

const logger = getClientLogger();

export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
  const { ipAddress } = getRequestMetadata(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    `stores-my:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info("Fetching user stores", {
    correlationId,
    actorRole: "professional",
    ipAddress,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () =>
      storesService.listMyStores({ userId: dbUserId, role: "professional" }),
    { operationName: "get_my_stores" },
  );

  if (!result.success || !result.data) {
    logger.error(
      "Failed to fetch user stores",
      result.error instanceof Error ? result.error : new Error("Unknown error"),
      { correlationId, actorRole: "professional" },
    );
    return apiError("Failed to fetch stores", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  if (!result.data.ok) {
    return apiError(
      result.data.message || "Failed to fetch stores",
      result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  logger.info("User stores fetched successfully", {
    correlationId,
    actorRole: "professional",
    count: result.data.data.length,
  });

  return apiSuccess(result.data.data, HttpStatus.OK);
});
