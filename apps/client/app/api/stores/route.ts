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
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { checkBodySize } from "@/app/lib/api/api-guards";
import {
  storesService,
  CreateStoreSchema,
  BatchCreateStoresSchema,
  StoreQuerySchema,
} from "@/app/lib/domains/stores";
import {
  actorRoleLabel,
  domainErrorCodeToStatus,
  logStoresRouteOutcome,
  now,
} from "@/app/api/stores/shared";

/**
 * GET /api/stores
 * Get all stores with optional filtering
 * Public endpoint - no authentication required
 */
export async function GET(req: NextRequest) {
  const startedAt = now();
  const correlationId = initializeCorrelationId(req);
  const operationName = "get_stores";

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `stores-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!rateLimitResult.success) {
    logStoresRouteOutcome({
      correlationId,
      operationName,
      outcome: "rate_limited",
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
      durationMs: now() - startedAt,
      domainError: "limit_exceeded",
    });
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // Parse query parameters dynamically
  const { searchParams } = new URL(req.url);
  const rawParams = Object.fromEntries(searchParams.entries());

  const queryValidation = StoreQuerySchema.safeParse(rawParams);
  if (!queryValidation.success) {
    getClientLogger().warn("Store query validation failed", {
      correlationId,
      errors: queryValidation.error.issues,
    });
    logStoresRouteOutcome({
      correlationId,
      operationName,
      outcome: "validation_error",
      httpStatus: HttpStatus.BAD_REQUEST,
      durationMs: now() - startedAt,
      domainError: "invalid_input",
    });
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues,
    );
  }

  getClientLogger().info("Fetching stores", {
    correlationId,
    filters: queryValidation.data,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () => storesService.listStores(queryValidation.data),
    { operationName },
  );

  if (result.success && result.data?.ok) {
    logStoresRouteOutcome({
      correlationId,
      operationName,
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
    });
    return apiSuccess(result.data.data, HttpStatus.OK);
  }

  getClientLogger().error("Failed to fetch stores", result.error, {
    correlationId,
  });
  logStoresRouteOutcome({
    correlationId,
    operationName,
    outcome: "internal_error",
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    durationMs: now() - startedAt,
  });
  return apiError("Failed to fetch stores", HttpStatus.INTERNAL_SERVER_ERROR);
}

/**
 * POST /api/stores
 * Create store(s) for the authenticated professional
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const startedAt = now();
  const correlationId = initializeCorrelationId(req);
  const operationName = "create_store";
  const actorRole = actorRoleLabel("professional");
  const { ipAddress, userAgent } = getRequestMetadata(req);

  const rateLimitResult = await checkRateLimit(
    `stores-write:${getRateLimitIdentifier(req)}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );

  if (!rateLimitResult.success) {
    logStoresRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "rate_limited",
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
      durationMs: now() - startedAt,
      domainError: "limit_exceeded",
    });
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const sizeError = checkBodySize(req);
  if (sizeError) return sizeError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  // Determine structural intent dynamically
  const isBatchMode =
    typeof body === "object" && body !== null && "stores" in body;

  let validatedPayload;
  if (isBatchMode) {
    const validation = BatchCreateStoresSchema.safeParse(body);
    if (!validation.success) {
      getClientLogger().warn("Batch store validation failed", {
        correlationId,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid batch input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }
    validatedPayload = { type: "batch" as const, data: validation.data.stores };
  } else {
    const validation = CreateStoreSchema.safeParse(body);
    if (!validation.success) {
      getClientLogger().warn("Single store validation failed", {
        correlationId,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }
    validatedPayload = { type: "single" as const, data: validation.data };
  }

  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(dbUserId, "POST", body);

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "store",
    dbUserId,
    "POST",
  );

  if (!idempotencyCheck) {
    return apiError(
      "Failed to process idempotency key",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  if (idempotencyCheck.status === "completed") {
    return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
  }

  if (idempotencyCheck.status === "pending") {
    return apiError(
      "Request is being processed. Please wait.",
      HttpStatus.CONFLICT,
    );
  }

  try {
    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        if (validatedPayload.type === "batch") {
          return storesService.createStoresBatch(
            { userId: dbUserId, role: "professional" },
            validatedPayload.data,
            {
              ipAddress,
              userAgent,
            },
          );
        } else {
          return storesService.createStore(
            { userId: dbUserId, role: "professional" },
            validatedPayload.data,
            {
              ipAddress,
              userAgent,
            },
          );
        }
      },
      {
        operationName:
          validatedPayload.type === "batch"
            ? "create_stores_batch"
            : "create_store",
      },
    );

    if (result.success && result.data?.ok) {
      const responseData = result.data.data;
      await safeIdempotencyComplete(idempotencyKey, responseData);

      getClientLogger().info(`Store(s) created successfully`, {
        correlationId,
        actorRole: "professional",
        mode: validatedPayload.type,
      });

      logStoresRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "success",
        httpStatus: HttpStatus.CREATED,
        durationMs: now() - startedAt,
      });
      return apiSuccess(responseData, HttpStatus.CREATED);
    }

    if (result.success && result.data && !result.data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      logStoresRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: domainErrorCodeToStatus(result.data.error),
        durationMs: now() - startedAt,
        domainError: result.data.error,
      });
      return apiError(
        result.data.message || "Failed to create store(s)",
        result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await IdempotencyService.fail(idempotencyKey);
    logStoresRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "internal_error",
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      durationMs: now() - startedAt,
    });
    return apiError(
      `Failed to create store(s)`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  } catch (error) {
    await IdempotencyService.fail(idempotencyKey);
    const err = error instanceof Error ? error : new Error(String(error));

    if (err.message === "User not found")
      return apiError(err.message, HttpStatus.NOT_FOUND);
    if (
      err.message.includes("suspended") ||
      err.message.includes("professionals")
    ) {
      return apiError(err.message, HttpStatus.FORBIDDEN);
    }

    getClientLogger().error("Store creation failed", err, {
      correlationId,
      actorRole: "professional",
    });
    logStoresRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "internal_error",
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      durationMs: now() - startedAt,
    });
    return apiError("Failed to create store", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});
