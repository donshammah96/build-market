import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
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
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { UpdateStoreSchema } from "@/app/lib/validation/stores-validation";
import { Prisma, ConsentType } from "@prisma/client";
import { STORE_CONFIG } from "@/app/lib/config/store.config";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { StoreEventService } from "@/app/lib/services/store-event.service";
import {
  checkBodySize,
  checkImageCount,
  isValidId,
} from "@/app/lib/api/api-guards";
import {
  type StoreOperationContext,
  buildConflictResponse,
  isOptimisticRetryEnabled,
} from "@/app/lib/services/store-operations.service";
import { getStoreById, updateStore, deleteStore } from "@/lib/services/stores";

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
 * Helper to extract optimistic locking version from either header or body
 */
function extractExpectedVersion(
  req: NextRequest,
  body: unknown,
): number | null {
  const ifMatch = req.headers.get("If-Match");
  if (ifMatch) {
    return parseInt(ifMatch.replace(/"/g, ""), 10);
  }
  if (body && typeof body === "object" && "version" in body) {
    return parseInt(String((body as Record<string, unknown>).version), 10);
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
      const store = await getStoreById(id);

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

  const data = result.data!.data as { version: number; [key: string]: unknown };
  const response = apiSuccess(data, HttpStatus.OK, correlationId);
  response.headers.set("ETag", `"${data.version}"`);
  return response;
}

/**
 * PATCH /api/stores/[id]
 * Update a store (owner only)
 */
export const PATCH = withAuth<StoreParams>(
  async (
    req: NextRequest,
    context: { dbUserId: string },
    params?: { id: string },
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { ipAddress, userAgent } = getRequestMetadata(req);
    const { dbUserId } = context;

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Store ID is required", HttpStatus.BAD_REQUEST);
    }
    const { id: storeId } = params;

    const rateLimitError = await checkStoreRateLimit(req, "write");
    if (rateLimitError) return rateLimitError;

    const sizeError = checkBodySize(req);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const expectedVersion = extractExpectedVersion(req, body);
    if (expectedVersion === null || isNaN(expectedVersion)) {
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

    const updateData = validation.data;
    const imageError = checkImageCount(updateData.images);
    if (imageError) return imageError;

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
      let result;
      const maxRetries = isOptimisticRetryEnabled(req)
        ? STORE_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES
        : 1;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        result = await updateStore(
          storeId,
          dbUserId,
          updateData,
          operationContext,
          expectedVersion + attempt,
        );

        if (result.success || result.error !== "conflict") break;

        if (attempt < maxRetries - 1) {
          await new Promise((r) =>
            setTimeout(
              r,
              STORE_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
            ),
          );
        }
      }

      if (!result) throw new Error("Result undefined after retries");

      // Strict Union Narrowing (Architecture Doc Step 7)
      if (!result.success) {
        await IdempotencyService.fail(idempotencyKey);
        switch (result.error) {
          case "not_found":
            return apiError("Store not found", HttpStatus.NOT_FOUND);
          case "forbidden":
            return apiError(
              "You do not have permission to update this store",
              HttpStatus.FORBIDDEN,
            );
          case "conflict":
            return await buildConflictResponse(
              "Store was modified. Retry with the latest version.",
              storeId,
            );
          default:
            return apiError("Update failed", HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } else {
        // Success Path
        const responseData = {
          data: result.data.store,
          meta: {
            version: result.newVersion,
            eventVersion: result.data.eventVersion,
          },
        };

        await IdempotencyService.complete(idempotencyKey, responseData);

        const response = apiSuccess(responseData, HttpStatus.OK, correlationId);
        response.headers.set("ETag", `"${result.newVersion}"`);
        return response;
      }
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error(
        "Failed to update store",
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

/**
 * DELETE /api/stores/[id]
 * Soft delete a store (owner only)
 */
export const DELETE = withAuth<StoreParams>(
  async (req, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { dbUserId } = context;
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Store ID is required", HttpStatus.BAD_REQUEST);
    }
    const storeId = params.id;

    const rateLimitError = await checkStoreRateLimit(req, "write");
    if (rateLimitError) return rateLimitError;

    // Soft delete payloads are often stripped by fetch; catch the parse error
    let body: unknown = null;
    try {
      body = await req.json().catch(() => null);
    } catch {
      // ignore
    }

    const expectedVersion = extractExpectedVersion(req, body);
    if (expectedVersion === null || isNaN(expectedVersion)) {
      return apiError(
        "Missing or invalid version for optimistic locking. Provide 'If-Match' header or 'version' in body.",
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }

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
      const result = await deleteStore(
        storeId,
        dbUserId,
        operationContext,
        expectedVersion,
      );

      // Strict Union Narrowing (Architecture Doc Step 7)
      if (!result.success) {
        await IdempotencyService.fail(idempotencyKey);
        switch (result.error) {
          case "not_found":
            return apiError("Store not found", HttpStatus.NOT_FOUND);
          case "forbidden":
            return apiError(
              "You do not have permission to delete this store",
              HttpStatus.FORBIDDEN,
            );
          case "conflict":
            return await buildConflictResponse(
              "Store was modified. Retry with the latest version.",
              storeId,
            );
          default:
            return apiError(
              "Failed to delete store",
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
      } else {
        // Success Path
        const responseData = {
          message: "Store deleted successfully",
          storeId,
          deletedAt: new Date().toISOString(),
          version: result.newVersion,
        };

        await IdempotencyService.complete(idempotencyKey, responseData);
        return apiSuccess(responseData, HttpStatus.OK, correlationId);
      }
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error(
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
