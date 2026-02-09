import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import { auth } from "@clerk/nextjs/server";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";
import { getRequestMetadata } from "@/app/lib/request-utils";
import { storeDetailSelect } from "@/app/lib/stores-validation";
import { UpdateStoreSchema } from "@/app/lib/stores-validation";
import { Prisma, ConsentType } from "@prisma/client";

// Extracted services
import { STORE_CONFIG } from "@/app/lib/config/store.config";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { StoreEventService } from "@/app/lib/services/store-event.service";
import { checkBodySize, checkImageCount, isValidId } from "@/app/lib/api-guards";
import {
  type StoreOperationContext,
  updateStoreWithOptimisticLock,
  deleteStoreWithOptimisticLock,
  buildConflictResponse,
  isOptimisticRetryEnabled,
} from "@/app/lib/services/store-operations.service";

const logger = getClientLogger();

type StoreParams = { id: string };

// Rate Limiting helper (thin wrapper, route-specific)
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
    ) as NextResponse;
  }
  return null;
}

/**
 * GET /api/stores/[id]
 * Get detailed information about a specific store
 * Public endpoint - no authentication required
 */
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

  logger.info("Fetching store by ID", { correlationId, storeId: id });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () => {
      const store = await prisma.store.findUnique({
        where: { id, deletedAt: null },
        select: {
          ...storeDetailSelect,
          version: true, // For optimistic locking
        },
      });

      if (!store) {
        logger.warn("Store not found or deleted", {
          correlationId,
          storeId: id,
        });
        return { error: "not_found" as const };
      }

      logger.info("Store fetched successfully", {
        correlationId,
        storeId: id,
        storeName: store.name,
      });

      try {
        const { userId: clerkId } = await auth();
        if (clerkId) {
          const user = await prisma.user.findUnique({
            where: { clerkId },
            select: { id: true },
          });

          if (user?.id && user.id === store.professional.userId) {
            await prisma.consentRecord.create({
              data: {
                userId: store.professional.userId,
                type: ConsentType.PRIVACY_POLICY,
                granted: true,
                grantedAt: new Date(),
                documentVersion: "v1.0",
                metadata: {
                  storeId: store.id,
                  storeName: store.name,
                  action: "read",
                  ipAddress,
                  userAgent,
                } as Prisma.InputJsonValue,
              },
            });
          }
        }
      } catch (error) {
        logger.warn("Failed to record store read access", {
          correlationId,
          storeId: store.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return { data: store, success: true };
    },
    { operationName: "fetch_store" },
  );

  if (!result.success) {
    logger.error("Store fetch failed", result.error, {
      correlationId,
      storeId: id,
    });
    return apiError("Failed to fetch store", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  if (result.data!.error === "not_found") {
    return apiError("Store not found", HttpStatus.NOT_FOUND);
  }

  return apiSuccess(result.data, HttpStatus.OK);
}

/**
 * PATCH /api/stores/[id]
 * Update a store (owner only)
 *
 * Features:
 * - Owner-only access
 * - Partial updates supported
 * - Asset-based image handling
 * - Request metadata logging
 * - Soft delete support
 */
export const PATCH = withAuth<StoreParams>(
  async (
    req: NextRequest,
    context: { dbUserId: string },
    params?: { id: string },
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const resilientExecutor = getResilientExecutor();
    const { ipAddress, userAgent } = getRequestMetadata(req);

    const { dbUserId } = context;

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Store ID is required", HttpStatus.BAD_REQUEST);
    }
    const { id: storeId } = params;

    // Check body size before parsing
    const sizeError = checkBodySize(req);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }
    const validation = UpdateStoreSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Store update validation failed", {
        correlationId,
        userId: dbUserId,
        storeId,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const updateData = validation.data;

    logger.info("Updating store", {
      correlationId,
      userId: dbUserId,
      storeId,
      ipAddress,
      userAgent,
      fields: Object.keys(updateData),
    });

    // Check image limits
    const imageError = checkImageCount(updateData.images);
    if (imageError) return imageError;

    // Idempotency check
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        storeId,
        ...updateData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "store",
      dbUserId,
      "PATCH",
      storeId,
    );

    if (!idempotencyCheck) {
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (idempotencyCheck.status === "completed") {
      logger.info("Returning cached idempotent response", {
        correlationId,
        idempotencyKey,
      });
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }

    if (idempotencyCheck.status === "pending") {
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    // Check rate limit
    const rateLimitError = await checkStoreRateLimit(req, "write");
    if (rateLimitError) {
      await IdempotencyService.fail(idempotencyKey);
      return rateLimitError;
    }

    // Get expected version from header (optimistic locking)
    const expectedVersion = parseInt(req.headers.get("If-Match") || "0", 10);
    if (isNaN(expectedVersion)) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Invalid version specified in If-Match header",
        HttpStatus.BAD_REQUEST,
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

    logger.info("Updating store with optimistic locking", {
      correlationId,
      userId: dbUserId,
      storeId,
      expectedVersion,
      fields: Object.keys(updateData),
    });

    // Execute with retry logic for optimistic lock conflicts
    let lastError: Error | undefined;

    const allowOptimisticRetry = isOptimisticRetryEnabled(req);
    for (
      let attempt = 0;
      attempt < STORE_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES;
      attempt++
    ) {
      try {
        const effectiveVersion =
          attempt === 0
            ? expectedVersion
            : await StoreEventService.getCurrentVersion(storeId);
        const result = await resilientExecutor.execute(
          () =>
            updateStoreWithOptimisticLock(
              storeId,
              dbUserId,
              updateData,
              operationContext,
              effectiveVersion,
            ),
          {
            operationName: "update_store",
          },
        );

        if (!result.success) {
          throw result.error || new Error("Unknown error");
        }

        if (result.data?.success) {
          // Success - cache response and return
          const response = {
            data: result.data.data.store,
            meta: {
              version: result.data.newVersion,
              eventVersion: result.data.data.eventVersion,
            },
          };

          await IdempotencyService.complete(idempotencyKey, response);

          logger.info("Store updated successfully", {
            correlationId,
            storeId,
            newVersion: result.data.newVersion,
          });

          return apiSuccess(response, HttpStatus.OK);
        }

        // Handle specific errors
        if (result.data?.error === "conflict") {
          if (!allowOptimisticRetry) {
            await IdempotencyService.fail(idempotencyKey);
            return await buildConflictResponse(
              "Store was modified by another request. Please refresh and try again.",
              storeId,
            );
          }
          if (attempt >= STORE_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) {
            break;
          }
          logger.info("Retrying optimistic lock conflict", {
            correlationId,
            attempt: attempt + 1,
            maxRetries: STORE_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES,
          });
          // Wait before retry
          await new Promise((r) =>
            setTimeout(
              r,
              STORE_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
            ),
          );
          continue;
        }

        if (result.data?.error === "not_found") {
          await IdempotencyService.fail(idempotencyKey);
          return apiError("Store not found", HttpStatus.NOT_FOUND);
        }

        if (result.data?.error === "forbidden") {
          await IdempotencyService.fail(idempotencyKey);
          return apiError("Forbidden", HttpStatus.FORBIDDEN);
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt === STORE_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) break;
      }
    }

    // All retries exhausted
    await IdempotencyService.fail(idempotencyKey);

    logger.error("Failed to update store after retries", lastError, {
      correlationId,
      storeId,
      attempts: STORE_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES,
    });

    return await buildConflictResponse(
      "Failed to update store due to concurrent modifications. Please retry.",
      storeId,
    );
  },
);

/**
 * DELETE /api/stores/[id]
 * Soft delete a store (owner only)
 *
 * Features:
 * - Soft delete (sets deletedAt timestamp)
 * - GDPR consent tracking
 * - Owner-only access
 * - Request metadata logging
 */
export const DELETE = withAuth<StoreParams>(
  async (req, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { dbUserId } = context;
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id) {
      return apiError("Store ID is required", HttpStatus.BAD_REQUEST);
    }
    const storeId = params.id;

    // Idempotency
    const idempotencyKey =
      req.headers.get("idempotency-key") ||
      IdempotencyService.generateKey(dbUserId, "DELETE", { storeId });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "store",
      dbUserId,
      "DELETE",
      storeId,
    );

    if (idempotencyCheck?.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck?.status === "pending") {
      return apiError("Request already in progress", HttpStatus.CONFLICT);
    }

    // Rate limiting
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `store-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const expectedVersion = parseInt(req.headers.get("if-match") || "0", 10);
    if (isNaN(expectedVersion)) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Invalid version in If-Match header",
        HttpStatus.BAD_REQUEST,
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

    logger.info("Deleting store with optimistic locking", {
      correlationId,
      userId: dbUserId,
      storeId,
      expectedVersion,
    });

    const resilientExecutor = getResilientExecutor();

    const result = await resilientExecutor.execute(
      () =>
        deleteStoreWithOptimisticLock(
          storeId,
          dbUserId,
          operationContext,
          expectedVersion,
        ),
      { operationName: "delete_store" },
    );

    if (!result.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to delete store",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data?.success) {
      await IdempotencyService.fail(idempotencyKey);
      if (result.data?.error === "not_found") {
        return apiError("Store not found", HttpStatus.NOT_FOUND);
      }
      if (result.data?.error === "forbidden") {
        return apiError("Forbidden", HttpStatus.FORBIDDEN);
      }
      if (result.data?.error === "conflict") {
        return await buildConflictResponse(
          "Store was modified by another request. Please refresh and try again.",
          storeId,
        );
      }
    }

    const successData = result.data as {
      success: true;
      data: { storeId: string; storeName: string; eventVersion: number };
      newVersion: number;
    };
    const response = {
      message: "Store deleted successfully",
      storeId,
      deletedAt: new Date().toISOString(),
      version: successData.newVersion,
    };

    await IdempotencyService.complete(idempotencyKey, response);

    logger.info("Store deleted successfully", {
      correlationId,
      storeId,
      version: successData.newVersion,
    });

    return apiSuccess(response, HttpStatus.OK);
  },
);
