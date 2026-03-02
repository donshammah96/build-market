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
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import {
  CreatePropertySchema,
  BatchCreatePropertiesSchema,
  PropertyQuerySchema,
} from "@/app/lib/validation/properties-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { PROPERTY_CONFIG } from "@/app/lib/config/property.config";
import {
  getProperties,
  createProperty,
  createPropertiesBatch,
} from "@/lib/services/properties";

const logger = getClientLogger();

/**
 * GET /api/properties
 * Get all properties with optional filtering, sorting, and pagination.
 * Public endpoint — no authentication required.
 */
export async function GET(req: NextRequest) {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `properties-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // Parse query parameters
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
    logger.warn("Property query validation failed", {
      correlationId,
      errors: queryValidation.error.issues,
    });
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues,
    );
  }

  logger.info("Fetching properties", {
    correlationId,
    filters: queryValidation.data,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () => getProperties(queryValidation.data),
    { operationName: "list_properties" },
  );

  if (result.success && result.data) {
    return apiSuccess(result.data, HttpStatus.OK, correlationId);
  }

  logger.error("Failed to fetch properties", result.error, { correlationId });
  return apiError(
    "Failed to fetch properties",
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}

/**
 * POST /api/properties
 * Create one or more properties.
 * Authenticated endpoint — requires professional (agent) role.
 * Supports idempotency via Idempotency-Key header.
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
  const { ipAddress, userAgent } = getRequestMetadata(req);

  // Rate limiting
  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `properties-write:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // Body size guard
  const sizeError = checkBodySize(req, PROPERTY_CONFIG.MAX_BODY_SIZE);
  if (sizeError) return sizeError;

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  // Determine structural intent to provide accurate validation errors
  const isBatchPayload =
    typeof body === "object" && body != null && "properties" in body;

  let validatedData;
  if (isBatchPayload) {
    const validation = BatchCreatePropertiesSchema.safeParse(body);
    if (!validation.success) {
      logger.warn("Batch property creation validation failed", {
        correlationId,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid batch property data",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }
    validatedData = {
      type: "batch" as const,
      data: validation.data.properties,
    };
  } else {
    const validation = CreatePropertySchema.safeParse(body);
    if (!validation.success) {
      logger.warn("Single property creation validation failed", {
        correlationId,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid property data",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }
    validatedData = { type: "single" as const, data: validation.data };
  }

  // Idempotency
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
    logger.info("Returning cached idempotent response", {
      correlationId,
      idempotencyKey,
    });
    return apiSuccess(idempotencyCheck.response, HttpStatus.OK, correlationId);
  }

  if (idempotencyCheck?.status === "pending") {
    return apiError(
      "A request with this idempotency key is already being processed",
      HttpStatus.CONFLICT,
    );
  }

  try {
    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const options = { ipAddress, userAgent };
        if (validatedData.type === "batch") {
          return createPropertiesBatch(dbUserId, validatedData.data, options);
        } else {
          return createProperty(dbUserId, validatedData.data, options);
        }
      },
      { operationName: "create_property" },
    );
    if (result.success && result.data) {
      const responseData = result.data;
      await IdempotencyService.complete(idempotencyKey, responseData);

      logger.info("Property created successfully", {
        correlationId,
        userId: dbUserId,
        isBatch: validatedData.type === "batch",
        count: validatedData.type === "batch" ? validatedData.data.length : 1,
      });

      return apiSuccess(responseData, HttpStatus.CREATED, correlationId);
    }

    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Failed to create property",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  } catch (error) {
    await IdempotencyService.fail(idempotencyKey);

    const err = error instanceof Error ? error : new Error(String(error));
    if (
      err.message.includes("suspended") ||
      err.message.includes("professionals")
    ) {
      return apiError(err.message, HttpStatus.FORBIDDEN);
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      logger.warn("Property creation uniqueness conflict", {
        correlationId,
        error: err.message,
      });
      return apiError(
        "A property with this slug or title deed number already exists",
        HttpStatus.CONFLICT,
      );
    }

    logger.error("Property creation failed", err, { correlationId });

    return apiError(
      "Failed to create property",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
