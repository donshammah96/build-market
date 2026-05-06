import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  getResilientExecutor,
  initializeCorrelationId,
} from "@/app/lib/api/resilient-api";
import { checkBodySize } from "@/app/lib/api/api-guards";
import {
  checkRateLimit,
  getActorRateLimitIdentifier,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { PROPERTY_CONFIG } from "@/app/lib/config/property.config";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  BatchCreatePropertiesSchema,
  CreatePropertySchema,
  PropertyQuerySchema,
  propertiesService,
} from "@/app/lib/domains/properties";
import {
  actorRoleLabel,
  domainErrorCodeToStatus,
  domainResultToErrorResponse,
  logPropertiesRouteOutcome,
  now,
} from "@/app/api/properties/shared";

export async function GET(req: NextRequest) {
  const startedAt = now();
  const correlationId = initializeCorrelationId(req);
  const operationName = "list_properties";

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `properties-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

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
    });
    return response;
  }

  const { searchParams } = new URL(req.url);
  const rawParams = Object.fromEntries(searchParams.entries());
  const queryParams = {
    ...rawParams,
    type: rawParams.type || undefined,
    category: rawParams.category || undefined,
    county: rawParams.county || undefined,
    status: rawParams.status || undefined,
    verified: rawParams.verified || undefined,
    featured: rawParams.featured || undefined,
    furnishing: rawParams.furnishing || undefined,
    minPrice: rawParams.minPrice || undefined,
    maxPrice: rawParams.maxPrice || undefined,
    minBedrooms: rawParams.minBedrooms || rawParams.beds || undefined,
    maxBedrooms: rawParams.maxBedrooms || undefined,
    minBathrooms: rawParams.minBathrooms || rawParams.baths || undefined,
    search: rawParams.search || undefined,
    sortBy: rawParams.sortBy || "createdAt",
    sortOrder: rawParams.sortOrder || "desc",
    page: rawParams.page || "1",
    limit: rawParams.limit || "20",
  };

  const queryValidation = PropertyQuerySchema.safeParse(queryParams);
  if (!queryValidation.success) {
    const response = apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues,
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
    });
    return response;
  }

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () => propertiesService.listProperties(queryValidation.data),
    { operationName },
  );

  if (!result.success || !result.data) {
    const response = apiError(
      "Failed to fetch properties",
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
      actorRole: "anonymous",
      outcome: "domain_error",
      httpStatus: domainErrorCodeToStatus(domainResult.error),
      durationMs: now() - startedAt,
      domainError: domainResult.error,
      resourceType: "property",
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
  });
  return response;
}

export const POST = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "create_property";
    const actorRole = actorRoleLabel(userRole);
    const { ipAddress, userAgent } = getRequestMetadata(req);

    const identifier = getActorRateLimitIdentifier(dbUserId, "property-write");
    const rateLimitResult = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );

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
      });
      return response;
    }

    const isBatchPayload =
      typeof body === "object" && body !== null && "properties" in body;

    const validatedData = (() => {
      if (isBatchPayload) {
        const validation = BatchCreatePropertiesSchema.safeParse(body);
        if (!validation.success) {
          return {
            ok: false as const,
            response: apiError(
              "Invalid batch property data",
              HttpStatus.BAD_REQUEST,
              validation.error.issues,
              correlationId,
            ),
          };
        }
        return {
          ok: true as const,
          value: {
            type: "batch" as const,
            data: validation.data.properties,
          },
        };
      }

      const validation = CreatePropertySchema.safeParse(body);
      if (!validation.success) {
        return {
          ok: false as const,
          response: apiError(
            "Invalid property data",
            HttpStatus.BAD_REQUEST,
            validation.error.issues,
            correlationId,
          ),
        };
      }

      return {
        ok: true as const,
        value: {
          type: "single" as const,
          data: validation.data,
        },
      };
    })();

    if (!validatedData.ok) {
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "property",
      });
      return validatedData.response;
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "POST", body);

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "property",
      dbUserId,
      "POST",
      undefined,
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
      });
      return response;
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const actor = { userId: dbUserId, role: userRole };
        const options = { ipAddress, userAgent };

        if (validatedData.value.type === "batch") {
          return propertiesService.createPropertiesBatch(
            actor,
            validatedData.value.data,
            options,
          );
        }

        return propertiesService.createProperty(
          actor,
          validatedData.value.data,
          options,
        );
      },
      { operationName },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      const response = apiError(
        "Failed to create property",
        HttpStatus.INTERNAL_SERVER_ERROR,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
        resourceType: "property",
      });
      return response;
    }

    const domainResult = result.data;
    if (!domainResult.ok) {
      const errorResponse = domainResultToErrorResponse(
        domainResult,
        correlationId,
      );
      await IdempotencyService.fail(idempotencyKey);
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: domainErrorCodeToStatus(domainResult.error),
        durationMs: now() - startedAt,
        domainError: domainResult.error,
        resourceType: "property",
      });
      return errorResponse!;
    }

    try {
      await IdempotencyService.complete(idempotencyKey, domainResult.data);
    } catch (completionError) {
      await IdempotencyService.fail(idempotencyKey).catch(() => undefined);
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "internal_error",
        httpStatus: HttpStatus.CREATED,
        durationMs: now() - startedAt,
        domainError: "idempotency_complete_failed",
        resourceType: "property",
      });
      // Do NOT rethrow — domain mutation already succeeded
    }
    const response = apiSuccess(
      domainResult.data,
      HttpStatus.CREATED,
      correlationId,
    );
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "success",
      httpStatus: HttpStatus.CREATED,
      durationMs: now() - startedAt,
      resourceType: "property",
    });
    return response;
  },
);
