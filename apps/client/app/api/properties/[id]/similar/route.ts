import { NextRequest } from "next/server";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  getResilientExecutor,
  initializeCorrelationId,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { isValidId } from "@/app/lib/api/api-guards";
import { propertiesService } from "@/app/lib/domains/properties";
import {
  domainErrorCodeToStatus,
  domainResultToErrorResponse,
  logPropertiesRouteOutcome,
  now,
} from "@/app/api/properties/shared";

const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 12;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = now();
  const correlationId = initializeCorrelationId(req);
  const operationName = "get_similar_properties";
  const { id } = await params;

  if (!isValidId(id)) {
    const response = apiError(
      "Invalid property ID",
      HttpStatus.BAD_REQUEST,
      undefined,
      correlationId,
    );
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole: "anonymous",
      outcome: "validation_error",
      httpStatus: HttpStatus.BAD_REQUEST,
      durationMs: now() - startedAt,
      domainError: "invalid_input",
      resourceType: "property",
      resourceId: id,
    });
    return response;
  }

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    `property-similar:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );
  if (!success) {
    const response = apiError(
      "Too many requests",
      HttpStatus.TOO_MANY_REQUESTS,
      undefined,
      correlationId,
    );
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole: "anonymous",
      outcome: "rate_limited",
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
      durationMs: now() - startedAt,
      domainError: "limit_exceeded",
      resourceType: "property",
      resourceId: id,
    });
    return response;
  }

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () => propertiesService.getSimilarProperties(id, limit),
    { operationName },
  );

  if (!result.success || !result.data) {
    const response = apiError(
      "Failed to fetch similar properties",
      HttpStatus.INTERNAL_SERVER_ERROR,
      undefined,
      correlationId,
    );
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole: "anonymous",
      outcome: "internal_error",
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      durationMs: now() - startedAt,
      resourceType: "property",
      resourceId: id,
    });
    return response;
  }

  const domainResult = result.data;
  if (!domainResult.ok) {
    const errorResponse = domainResultToErrorResponse(domainResult, correlationId);
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole: "anonymous",
      outcome: "domain_error",
      httpStatus: domainErrorCodeToStatus(domainResult.error),
      durationMs: now() - startedAt,
      domainError: domainResult.error,
      resourceType: "property",
      resourceId: id,
    });
    return errorResponse!;
  }

  const response = apiSuccess(domainResult.data, HttpStatus.OK, correlationId);
  logPropertiesRouteOutcome({
    correlationId,
    operationName,
    actorRole: "anonymous",
    outcome: "success",
    httpStatus: HttpStatus.OK,
    durationMs: now() - startedAt,
    resourceType: "property",
    resourceId: id,
  });
  return response;
}
