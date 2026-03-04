import { NextRequest } from "next/server";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { isValidId } from "@/app/lib/api/api-guards";
import { propertiesService } from "@/app/lib/domains/properties";

const logger = getClientLogger();
const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 12;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = initializeCorrelationId(req);
  const { id } = await params;

  if (!isValidId(id)) {
    return apiError(
      "Invalid property ID",
      HttpStatus.BAD_REQUEST,
      undefined,
      correlationId,
    );
  }

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    `property-similar:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );
  if (!success) {
    return apiError(
      "Too many requests",
      HttpStatus.TOO_MANY_REQUESTS,
      undefined,
      correlationId,
    );
  }

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () => propertiesService.getSimilarProperties(id, limit),
    { operationName: "get_similar_properties" },
  );

  if (!result.success || !result.data) {
    logger.error("Failed to fetch similar properties", result.error, {
      correlationId,
      propertyId: id,
    });
    return apiError(
      "Failed to fetch similar properties",
      HttpStatus.INTERNAL_SERVER_ERROR,
      correlationId,
    );
  }

  if (!result.data.ok) {
    return apiError(
      result.data.message,
      result.data.status,
      undefined,
      correlationId,
    );
  }

  return apiSuccess(result.data.data, HttpStatus.OK, correlationId);
}
