import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import { checkBodySize, isValidId } from "@/app/lib/api/api-guards";
import {
  getResilientExecutor,
  initializeCorrelationId,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { PROPERTY_CONFIG } from "@/app/lib/config/property.config";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  propertiesService,
  UpdatePropertySchema,
} from "@/app/lib/domains/properties";
import {
  actorRoleLabel,
  conflictResponse,
  domainErrorCodeToStatus,
  domainResultToErrorResponse,
  extractExpectedVersion,
  isOptimisticRetryEnabled,
  logPropertiesRouteOutcome,
  now,
} from "@/app/api/properties/shared";

type PropertyParams = {
  id: string;
};

async function checkPropertyRateLimit(
  req: NextRequest,
  operation: "read" | "write",
) {
  const identifier = getRateLimitIdentifier(req);
  const config = RateLimits[operation.toUpperCase() as keyof typeof RateLimits];
  return checkRateLimit(
    `property-${operation}:${identifier}`,
    config.limit,
    config.window,
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<PropertyParams> },
) {
  const startedAt = now();
  const correlationId = initializeCorrelationId(request);
  const operationName = "get_property_detail";
  const { ipAddress, userAgent } = getRequestMetadata(request);
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

  const rateLimitResult = await checkPropertyRateLimit(request, "read");
  if (!rateLimitResult.success) {
    const response = apiError(
      "Too many requests. Please try again later.",
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

  const { userId: clerkId } = await auth().catch(() => ({ userId: null }));
  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () =>
      propertiesService.getPropertyDetail(id, {
        clerkId,
        ipAddress,
        userAgent,
      }),
    { operationName },
  );

  if (!result.success || !result.data) {
    const response = apiError(
      "Failed to fetch property",
      HttpStatus.INTERNAL_SERVER_ERROR,
      undefined,
      correlationId,
    );
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole: clerkId ? "authenticated" : "anonymous",
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
    const errorResponse = domainResultToErrorResponse(
      domainResult,
      correlationId,
    );
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole: clerkId ? "authenticated" : "anonymous",
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
  response.headers.set("ETag", `"${domainResult.data.property.version}"`);
  logPropertiesRouteOutcome({
    correlationId,
    operationName,
    actorRole: clerkId ? "authenticated" : "anonymous",
    outcome: "success",
    httpStatus: HttpStatus.OK,
    durationMs: now() - startedAt,
    resourceType: "property",
    resourceId: id,
  });
  return response;
}

export const PATCH = withAuth(
  async (
    req: NextRequest,
    context: { dbUserId: string; userRole?: string },
    params?: { id: string },
  ): Promise<NextResponse> => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "update_property";
    const actorRole = actorRoleLabel(context.userRole);
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id || !isValidId(params.id)) {
      const response = apiError(
        "Property ID is required",
        HttpStatus.BAD_REQUEST,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "property",
        resourceId: params?.id,
      });
      return response;
    }

    const propertyId = params.id;
    const rateLimitResult = await checkPropertyRateLimit(req, "write");
    if (!rateLimitResult.success) {
      const response = apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
        domainError: "limit_exceeded",
        resourceType: "property",
        resourceId: propertyId,
      });
      return response;
    }

    const sizeError = checkBodySize(req, PROPERTY_CONFIG.MAX_BODY_SIZE);
    if (sizeError) {
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: sizeError.status,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "property",
        resourceId: propertyId,
      });
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      const response = apiError(
        "Invalid JSON body",
        HttpStatus.BAD_REQUEST,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "property",
        resourceId: propertyId,
      });
      return response;
    }

    const expectedVersion = extractExpectedVersion(req, body);
    if (expectedVersion === null) {
      const response = apiError(
        "Missing or invalid version for optimistic locking. Provide 'If-Match' header or legacy body 'version'.",
        HttpStatus.PRECONDITION_REQUIRED,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: HttpStatus.PRECONDITION_REQUIRED,
        durationMs: now() - startedAt,
        domainError: "conflict",
        resourceType: "property",
        resourceId: propertyId,
      });
      return response;
    }

    const validation = UpdatePropertySchema.safeParse(body);
    if (!validation.success) {
      const response = apiError(
        "Invalid update data",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "property",
        resourceId: propertyId,
      });
      return response;
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(
        context.dbUserId,
        `PATCH:${propertyId}`,
        body,
      );

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "property",
      context.dbUserId,
      "PATCH",
      propertyId,
      PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
    );

    if (idempotencyCheck?.status === "completed") {
      const response = apiSuccess(
        idempotencyCheck.response,
        HttpStatus.OK,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "success",
        httpStatus: HttpStatus.OK,
        durationMs: now() - startedAt,
        resourceType: "property",
        resourceId: propertyId,
      });
      return response;
    }

    if (idempotencyCheck?.status === "pending") {
      const response = apiError(
        "A request with this idempotency key is already being processed",
        HttpStatus.CONFLICT,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: HttpStatus.CONFLICT,
        durationMs: now() - startedAt,
        domainError: "conflict",
        resourceType: "property",
        resourceId: propertyId,
      });
      return response;
    }

    const shouldRetry = isOptimisticRetryEnabled(req);
    const maxRetries = shouldRetry
      ? PROPERTY_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES
      : 1;

    const operationContext = {
      correlationId,
      userId: context.dbUserId,
      propertyId,
      ipAddress,
      userAgent,
      idempotencyKey,
    };

    const latestResult = await propertiesService.updatePropertyWithRetry(
      propertyId,
      { userId: context.dbUserId, role: context.userRole ?? "unknown" },
      validation.data,
      operationContext,
      expectedVersion,
      {
        maxRetries,
        retryDelayMs: PROPERTY_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS,
      },
    );

    if (!latestResult.ok) {
      await IdempotencyService.fail(idempotencyKey);

      if (latestResult.error === "conflict") {
        const response = conflictResponse(
          latestResult.message ??
            "Property has been modified. Retry with the latest version.",
          (latestResult.details as { currentVersion?: number } | undefined)
            ?.currentVersion,
          correlationId,
        );
        logPropertiesRouteOutcome({
          correlationId,
          operationName,
          actorRole,
          outcome: "domain_error",
          httpStatus: HttpStatus.CONFLICT,
          durationMs: now() - startedAt,
          domainError: latestResult.error,
          resourceType: "property",
          resourceId: propertyId,
        });
        return response;
      }

      const errorResponse = domainResultToErrorResponse(
        latestResult,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: domainErrorCodeToStatus(latestResult.error),
        durationMs: now() - startedAt,
        domainError: latestResult.error,
        resourceType: "property",
        resourceId: propertyId,
      });
      return errorResponse!;
    }

    await IdempotencyService.complete(idempotencyKey, latestResult.data);
    const response = apiSuccess(
      latestResult.data,
      HttpStatus.OK,
      correlationId,
    );
    response.headers.set("ETag", `"${latestResult.data.version}"`);
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      resourceType: "property",
      resourceId: propertyId,
    });
    return response;
  },
);

export const DELETE = withAuth(
  async (
    req: NextRequest,
    context: { dbUserId: string; userRole?: string },
    params?: { id: string },
  ): Promise<NextResponse> => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "delete_property";
    const actorRole = actorRoleLabel(context.userRole);
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id || !isValidId(params.id)) {
      const response = apiError(
        "Property ID is required",
        HttpStatus.BAD_REQUEST,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "property",
        resourceId: params?.id,
      });
      return response;
    }

    const propertyId = params.id;
    const rateLimitResult = await checkPropertyRateLimit(req, "write");
    if (!rateLimitResult.success) {
      const response = apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
        domainError: "limit_exceeded",
        resourceType: "property",
        resourceId: propertyId,
      });
      return response;
    }

    let body: unknown = null;
    try {
      body = await req.json().catch(() => null);
    } catch {
      body = null;
    }

    const expectedVersion = extractExpectedVersion(req, body);
    if (expectedVersion === null) {
      const response = apiError(
        "Missing or invalid version for optimistic locking. Provide 'If-Match' header or legacy body 'version'.",
        HttpStatus.PRECONDITION_REQUIRED,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: HttpStatus.PRECONDITION_REQUIRED,
        durationMs: now() - startedAt,
        domainError: "conflict",
        resourceType: "property",
        resourceId: propertyId,
      });
      return response;
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(
        context.dbUserId,
        `DELETE:${propertyId}`,
        {},
      );

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "property",
      context.dbUserId,
      "DELETE",
      propertyId,
      PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
    );

    if (idempotencyCheck?.status === "completed") {
      const response = apiSuccess(
        idempotencyCheck.response,
        HttpStatus.OK,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "success",
        httpStatus: HttpStatus.OK,
        durationMs: now() - startedAt,
        resourceType: "property",
        resourceId: propertyId,
      });
      return response;
    }

    if (idempotencyCheck?.status === "pending") {
      const response = apiError(
        "A request with this idempotency key is already being processed",
        HttpStatus.CONFLICT,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: HttpStatus.CONFLICT,
        durationMs: now() - startedAt,
        domainError: "conflict",
        resourceType: "property",
        resourceId: propertyId,
      });
      return response;
    }

    const result = await propertiesService.deleteProperty(
      propertyId,
      { userId: context.dbUserId, role: context.userRole ?? "unknown" },
      {
        correlationId,
        userId: context.dbUserId,
        propertyId,
        ipAddress,
        userAgent,
        idempotencyKey,
      },
      expectedVersion,
    );

    if (!result.ok) {
      await IdempotencyService.fail(idempotencyKey);

      if (result.error === "conflict") {
        const response = conflictResponse(
          result.message ??
            "Property has been modified. Retry with the latest version.",
          (result.details as { currentVersion?: number } | undefined)
            ?.currentVersion,
          correlationId,
        );
        logPropertiesRouteOutcome({
          correlationId,
          operationName,
          actorRole,
          outcome: "domain_error",
          httpStatus: HttpStatus.CONFLICT,
          durationMs: now() - startedAt,
          domainError: result.error,
          resourceType: "property",
          resourceId: propertyId,
        });
        return response;
      }

      const errorResponse = domainResultToErrorResponse(result, correlationId);
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: domainErrorCodeToStatus(result.error),
        durationMs: now() - startedAt,
        domainError: result.error,
        resourceType: "property",
        resourceId: propertyId,
      });
      return errorResponse!;
    }

    await IdempotencyService.complete(idempotencyKey, result.data);
    const response = apiSuccess(result.data, HttpStatus.OK, correlationId);
    response.headers.set("ETag", `"${result.data.version}"`);
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      resourceType: "property",
      resourceId: propertyId,
    });
    return response;
  },
);
