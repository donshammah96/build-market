import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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
import {
  getRequestMetadata,
  extractExpectedVersion,
  extractExpectedVersionFromIfMatch,
} from "@/app/lib/api/request-utils";
import { STORE_CONFIG } from "@/app/lib/config/store.config";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  checkBodySize,
  checkImageCount,
  isValidId,
} from "@/app/lib/api/api-guards";
import { storesService, UpdateStoreSchema } from "@/app/lib/domains/stores";
import type { StoreOperationContext } from "@/app/lib/domains/stores";

type StoreParams = { id: string };

async function checkStoreRateLimit(
  req: NextRequest,
  operation: "read" | "write",
): Promise<NextResponse | null> {
  const identifier = getRateLimitIdentifier(req);
  const config = RateLimits[operation.toUpperCase() as keyof typeof RateLimits];

  const result = await checkRateLimit(
    `store-${operation}:${identifier}`,
    config.limit,
    config.window,
  );

  if (!result.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<StoreParams> },
): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(req);
  const { ipAddress, userAgent } = getRequestMetadata(req);
  const { id } = await params;

  if (!isValidId(id)) {
    return apiError("Invalid store ID", HttpStatus.BAD_REQUEST);
  }

  const rateLimitError = await checkStoreRateLimit(req, "read");
  if (rateLimitError) {
    return rateLimitError;
  }

  const { userId: viewerClerkId } = await auth().catch(() => ({
    userId: null,
  }));

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () =>
      storesService.getStoreById(id, {
        viewerClerkId: viewerClerkId ?? undefined,
        ipAddress,
        userAgent,
      }),
    { operationName: "get_store_by_id" },
  );

  if (!result.success) {
    getClientLogger().error("Store fetch failed", result.error, {
      correlationId,
      storeId: id,
    });
    return apiError("Failed to fetch store", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  const domainResult = result.data;
  if (!domainResult) {
    return apiError("Failed to fetch store", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  if (!domainResult.ok) {
    return apiError(
      domainResult.message || "Store not found",
      domainResult.status || HttpStatus.NOT_FOUND,
    );
  }

  const response = apiSuccess(domainResult.data, HttpStatus.OK, correlationId);
  const store = domainResult.data as { version?: number };
  if (typeof store.version === "number") {
    response.headers.set("ETag", `"${store.version}"`);
  }

  return response;
}

export const PATCH = withAuth<StoreParams>(
  async (
    req: NextRequest,
    context: { dbUserId: string },
    params?: { id: string },
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { dbUserId } = context;
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Store ID is required", HttpStatus.BAD_REQUEST);
    }

    const storeId = params.id;

    const rateLimitError = await checkStoreRateLimit(req, "write");
    if (rateLimitError) return rateLimitError;

    const sizeError = checkBodySize(req, STORE_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const expectedVersion = extractExpectedVersion(req, body);
    if (expectedVersion === null) {
      return apiError(
        "Missing or invalid version for optimistic locking. Provide 'If-Match' header or 'version' in body.",
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }

    const validation = UpdateStoreSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const imageError = checkImageCount(
      validation.data.images,
      STORE_CONFIG.MAX_IMAGES_PER_REQUEST,
    );
    if (imageError) return imageError;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        storeId,
        ...validation.data,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "store",
      dbUserId,
      "PATCH",
      {
        entityConnect: { store: { connect: { id: storeId } } },
        ttlHours: STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      },
    );

    if (idempotencyCheck?.status === "completed") {
      return apiSuccess(
        idempotencyCheck.response,
        HttpStatus.OK,
        correlationId,
      );
    }

    if (idempotencyCheck?.status === "pending") {
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const operationContext: StoreOperationContext = {
      correlationId,
      userId: dbUserId,
      storeId,
      ipAddress,
      userAgent,
      idempotencyKey,
    };

    try {
      const maxRetries = storesService.isOptimisticRetryEnabled(req)
        ? STORE_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES
        : 1;

      let result:
        | Awaited<ReturnType<typeof storesService.updateStoreOptimistic>>
        | undefined;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        result = await storesService.updateStoreOptimistic({
          storeId,
          actor: { userId: dbUserId, role: "professional" },
          data: validation.data,
          context: operationContext,
          expectedVersion: expectedVersion + attempt,
        });

        if (result.ok || result.error !== "conflict") break;

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              STORE_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
            ),
          );
        }
      }

      if (!result) {
        throw new Error("Update result missing after retries");
      }

      if (!result.ok) {
        await IdempotencyService.fail(idempotencyKey);

        if (result.error === "not_found") {
          return apiError("Store not found", HttpStatus.NOT_FOUND);
        }

        if (result.error === "forbidden") {
          return apiError(
            "You do not have permission to update this store",
            HttpStatus.FORBIDDEN,
          );
        }

        if (result.error === "conflict") {
          return storesService.buildConflictResponse(
            "Store was modified. Retry with the latest version.",
            storeId,
          );
        }

        return apiError(
          result.message || "Failed to update store",
          result.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      await safeIdempotencyComplete(idempotencyKey, result.data);

      const response = apiSuccess(result.data, HttpStatus.OK, correlationId);
      response.headers.set("ETag", `"${result.data.meta.version}"`);
      return response;
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey);
      getClientLogger().error(
        "Store update failed",
        error instanceof Error ? error : new Error(String(error)),
        { correlationId, storeId },
      );
      return apiError(
        "Failed to update store",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

export const DELETE = withAuth<StoreParams>(
  async (
    req: NextRequest,
    context: { dbUserId: string },
    params?: { id: string },
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { dbUserId } = context;
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Store ID is required", HttpStatus.BAD_REQUEST);
    }

    const storeId = params.id;

    const rateLimitError = await checkStoreRateLimit(req, "write");
    if (rateLimitError) return rateLimitError;

    const ifMatch = req.headers.get("If-Match");
    if (!ifMatch) {
      return apiError(
        'Missing If-Match header. Include the store version as: If-Match: "N"',
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }

    const expectedVersion = extractExpectedVersionFromIfMatch(req);
    if (expectedVersion === null) {
      return apiError("Invalid If-Match header value", HttpStatus.BAD_REQUEST);
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      req.headers.get("idempotency-key") ||
      IdempotencyService.generateKey(dbUserId, "DELETE", { storeId });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "store",
      dbUserId,
      "DELETE",
      {
        entityConnect: { store: { connect: { id: storeId } } },
        ttlHours: STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      },
    );

    if (idempotencyCheck?.status === "completed") {
      return apiSuccess(
        idempotencyCheck.response,
        HttpStatus.OK,
        correlationId,
      );
    }

    if (idempotencyCheck?.status === "pending") {
      return apiError("Request already in progress", HttpStatus.CONFLICT);
    }

    const operationContext: StoreOperationContext = {
      correlationId,
      userId: dbUserId,
      storeId,
      ipAddress,
      userAgent,
      idempotencyKey,
    };

    try {
      const result = await storesService.deleteStoreOptimistic({
        storeId,
        actor: { userId: dbUserId, role: "professional" },
        context: operationContext,
        expectedVersion,
      });

      if (!result.ok) {
        await IdempotencyService.fail(idempotencyKey);

        if (result.error === "not_found") {
          return apiError("Store not found", HttpStatus.NOT_FOUND);
        }

        if (result.error === "forbidden") {
          return apiError(
            "You do not have permission to delete this store",
            HttpStatus.FORBIDDEN,
          );
        }

        if (result.error === "conflict") {
          return storesService.buildConflictResponse(
            "Store was modified. Retry with the latest version.",
            storeId,
          );
        }

        return apiError(
          result.message || "Failed to delete store",
          result.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      await safeIdempotencyComplete(idempotencyKey, result.data);
      return apiSuccess(result.data, HttpStatus.OK, correlationId);
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey);
      getClientLogger().error(
        "Store deletion failed",
        error instanceof Error ? error : new Error(String(error)),
        { correlationId, storeId },
      );
      return apiError(
        "Failed to delete store",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
);
