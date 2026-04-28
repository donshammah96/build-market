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
import { checkBodySize } from "@/app/lib/api/api-guards";
import {
  storesService,
  CreateStoreSchema,
  BatchCreateStoresSchema,
  StoreQuerySchema,
} from "@/app/lib/domains/stores";

const logger = getClientLogger();

/**
 * GET /api/stores
 * Get all stores with optional filtering
 * Public endpoint - no authentication required
 */
export async function GET(req: NextRequest) {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `stores-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!rateLimitResult.success) {
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
    logger.warn("Store query validation failed", {
      correlationId,
      errors: queryValidation.error.issues,
    });
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues,
    );
  }

  logger.info("Fetching stores", {
    correlationId,
    filters: queryValidation.data,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () => storesService.listStores(queryValidation.data),
    { operationName: "get_stores" },
  );

  if (result.success && result.data?.ok) {
    return apiSuccess(result.data.data, HttpStatus.OK);
  }

  logger.error("Failed to fetch stores", result.error, { correlationId });
  return apiError("Failed to fetch stores", HttpStatus.INTERNAL_SERVER_ERROR);
}

/**
 * POST /api/stores
 * Create store(s) for the authenticated professional
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
  const { ipAddress, userAgent } = getRequestMetadata(req);

  const rateLimitResult = await checkRateLimit(
    `stores-write:${getRateLimitIdentifier(req)}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );

  if (!rateLimitResult.success) {
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
      logger.warn("Batch store validation failed", {
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
      logger.warn("Single store validation failed", {
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
      await IdempotencyService.complete(idempotencyKey, responseData);

      logger.info(`Store(s) created successfully`, {
        correlationId,
        actorRole: "professional",
        mode: validatedPayload.type,
      });

      return apiSuccess(responseData, HttpStatus.CREATED);
    }

    if (result.success && result.data && !result.data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        result.data.message || "Failed to create store(s)",
        result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await IdempotencyService.fail(idempotencyKey);
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

    logger.error("Store creation failed", err, {
      correlationId,
      actorRole: "professional",
    });
    return apiError("Failed to create store", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});
