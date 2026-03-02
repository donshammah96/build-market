import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import { withAuth } from "@/app/lib/api/api-middleware";
import { auth } from "@clerk/nextjs/server";
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
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { UpdatePropertySchema } from "@/app/lib/validation/properties-validation";
import { PROPERTY_CONFIG } from "@/app/lib/config/property.config";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  updatePropertyWithOptimisticLock,
  deletePropertyWithOptimisticLock,
  buildPropertyConflictResponse,
  isOptimisticRetryEnabled,
} from "@/app/lib/services/property-operations.service";
import {
  getPropertyById,
  getSimilarProperties,
} from "@/lib/services/properties";
import { ConsentType, Prisma } from "@prisma/client";

const logger = getClientLogger();

type PropertyParams = {
  id: string;
};

// Rate Limiting Helper (thin wrapper, route-specific)
async function checkPropertyRateLimit(
  req: NextRequest,
  operation: "read" | "write",
): Promise<NextResponse | null> {
  const identifier = getRateLimitIdentifier(req);
  const config = RateLimits[operation.toUpperCase() as keyof typeof RateLimits];

  const result = await checkRateLimit(
    `property-${operation}:${identifier}`,
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
 * GET /api/properties/[id]
 * Get detailed information about a specific property.
 * Public endpoint — no authentication required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<PropertyParams> },
) {
  const correlationId = initializeCorrelationId(request);
  const { ipAddress, userAgent } = getRequestMetadata(request);
  const { id } = await params;

  // Rate limiting
  const rateLimitResult = await checkPropertyRateLimit(request, "read");

  if (rateLimitResult) {
    return rateLimitResult;
  }

  // Validate ID
  if (!isValidId(id)) {
    return apiError("Invalid property ID", HttpStatus.BAD_REQUEST);
  }

  logger.info("Fetching property details", {
    correlationId,
    propertyId: id,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () => {
      const property = await getPropertyById(id);

      if (!property) {
        logger.warn("Property not found", {
          correlationId,
          propertyId: id,
        });
        return { error: "not_found" as const };
      }

      logger.info("Property details fetched successfully", {
        correlationId,
        propertyId: id,
        propertyTitle: property.title,
      });

      try {
        const { userId: clerkId } = await auth();
        if (clerkId) {
          const user = await prisma.user.findUnique({
            where: { clerkId },
            select: { id: true },
          });

          if (user?.id && user.id === property.agent.userId) {
            await prisma.consentRecord.create({
              data: {
                userId: property.agent.userId,
                type: ConsentType.PRIVACY_POLICY,
                granted: true,
                grantedAt: new Date(),
                documentVersion: "v1.0",
                metadata: {
                  propertyId: property.id,
                  propertyName: property.title,
                  action: "read",
                  ipAddress,
                  userAgent,
                } as Prisma.InputJsonValue,
              },
            });
          }
        }
      } catch (error) {
        logger.warn("Failed to record property read access", {
          correlationId,
          propertyId: property.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Increment view count (fire-and-forget)
      prisma.property
        .update({
          where: { id },
          data: { viewCount: { increment: 1 } },
        })
        .catch(() => {
          /* swallow — non-critical */
        });

      let similarProperties: unknown[] = [];
      try {
        similarProperties = await getSimilarProperties(id, 4);
      } catch {
        logger.warn("Failed to fetch similar properties", {
          correlationId,
          propertyId: id,
        });
      }

      logger.info("Property details fetched", {
        correlationId,
        propertyId: id,
      });

      return { property, similarProperties };
    },
    { operationName: "get_property_detail" },
  );

  if (!result.success) {
    logger.error("Property fetch failed", result.error, {
      correlationId,
      propertyId: id,
    });
    return apiError(
      "Failed to fetch property",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  if (
    result.data &&
    "error" in result.data &&
    result.data.error === "not_found"
  ) {
    return apiError("Property not found", HttpStatus.NOT_FOUND);
  }

  const data = result.data as {
    property: { version: number; [key: string]: unknown };
    similarProperties: unknown[];
  };
  const response = apiSuccess(
    {
      property: data.property,
      similarProperties: data.similarProperties,
    },
    HttpStatus.OK,
    correlationId,
  );
  response.headers.set("ETag", `"${data.property.version}"`);
  return response;
}

/**
 * PATCH /api/properties/[id]
 * Update a property with optimistic locking.
 * Authenticated endpoint — only the listing agent can update.
 * Requires If-Match header with current version.
 */
export const PATCH = withAuth(
  async (
    req: NextRequest,
    context: { dbUserId: string },
    params?: { id: string },
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { dbUserId } = context;
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Property ID is required", HttpStatus.BAD_REQUEST);
    }
    const { id: propertyId } = params;

    // Rate limiting
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `property-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const sizeError = checkBodySize(req, PROPERTY_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    // Parse body
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

    // Validate update data
    const validation = UpdatePropertySchema.safeParse(body);
    if (!validation.success) {
      logger.warn("Property update validation failed", {
        correlationId,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid update data",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, `PATCH:${propertyId}`, body);

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "property",
      dbUserId,
      "PATCH",
      propertyId,
      PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
    );

    if (idempotencyCheck?.status === "completed") {
      logger.info("Returning cached idempotent PATCH response", {
        correlationId,
        idempotencyKey,
      });
      return apiSuccess(
        idempotencyCheck.response,
        HttpStatus.OK,
        correlationId,
      );
    }

    if (idempotencyCheck?.status === "pending") {
      return apiError(
        "A request with this idempotency key is already being processed",
        HttpStatus.CONFLICT,
      );
    }

    const operationContext = {
      correlationId,
      userId: dbUserId,
      propertyId,
      ipAddress,
      userAgent,
      idempotencyKey,
    };

    try {
      const shouldRetry = isOptimisticRetryEnabled(req);
      const maxRetries = shouldRetry
        ? PROPERTY_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES
        : 1;

      let result;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        result = await updatePropertyWithOptimisticLock(
          propertyId,
          dbUserId,
          validation.data,
          operationContext,
          expectedVersion + attempt,
        );

        if (result.success || result.error !== "conflict") break;

        if (attempt < maxRetries - 1) {
          await new Promise((r) =>
            setTimeout(
              r,
              PROPERTY_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
            ),
          );
        }
      }

      if (!result) {
        await IdempotencyService.fail(idempotencyKey);
        return apiError(
          "Update failed after retries",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!result.success) {
        await IdempotencyService.fail(idempotencyKey);
        switch (result.error) {
          case "not_found":
            return apiError("Property not found", HttpStatus.NOT_FOUND);
          case "forbidden":
            return apiError(
              "You do not have permission to update this property",
              HttpStatus.FORBIDDEN,
            );
          case "conflict":
            return await buildPropertyConflictResponse(
              "Property has been modified. Retry with the latest version.",
              propertyId,
            );
          default:
            return apiError("Update failed", HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } else {
        // Success Path
        const responseData = {
          ...(result.data as { property: Record<string, unknown> }).property,
          _meta: { version: result.newVersion },
        };

        await IdempotencyService.complete(idempotencyKey, responseData);

        logger.info("Property updated successfully", {
          correlationId,
          propertyId,
          newVersion: result.newVersion,
        });

        const response = apiSuccess(responseData, HttpStatus.OK, correlationId);
        response.headers.set("ETag", `"${result.newVersion}"`);
        return response;
      }
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error(
        "Property update error",
        error instanceof Error ? error : new Error(String(error)),
        { correlationId, propertyId },
      );
      return apiError(
        "Failed to update property",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

/**
 * DELETE /api/properties/[id]
 * Soft-delete a property with optimistic locking.
 * Authenticated endpoint — only the listing agent can delete.
 * Requires If-Match header with current version.
 */
export const DELETE = withAuth(
  async (
    req: NextRequest,
    context: { dbUserId: string },
    params?: { id: string },
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { dbUserId } = context;
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Property ID is required", HttpStatus.BAD_REQUEST);
    }
    const { id: propertyId } = params;

    // Rate limiting
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `property-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let body: unknown = null;
    try {
      body = await req.json().catch(() => null); // Body is optional for delete
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

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, `DELETE:${propertyId}`, {});

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "property",
      dbUserId,
      "DELETE",
      propertyId,
      PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
    );

    if (idempotencyCheck?.status === "completed") {
      logger.info("Returning cached idempotent DELETE response", {
        correlationId,
        idempotencyKey,
      });
      return apiSuccess(
        idempotencyCheck.response,
        HttpStatus.OK,
        correlationId,
      );
    }

    if (idempotencyCheck?.status === "pending") {
      return apiError(
        "A request with this idempotency key is already being processed",
        HttpStatus.CONFLICT,
      );
    }

    const operationContext = {
      correlationId,
      userId: dbUserId,
      propertyId,
      ipAddress,
      userAgent,
      idempotencyKey,
    };

    try {
      const result = await deletePropertyWithOptimisticLock(
        propertyId,
        dbUserId,
        operationContext,
        expectedVersion,
      );

      if (!result.success) {
        await IdempotencyService.fail(idempotencyKey);
        switch (result.error) {
          case "not_found":
            return apiError("Property not found", HttpStatus.NOT_FOUND);
          case "forbidden":
            return apiError(
              "You do not have permission to delete this property",
              HttpStatus.FORBIDDEN,
            );
          case "conflict":
            return await buildPropertyConflictResponse(
              "Property has been modified. Retry with the latest version.",
              propertyId,
            );
          default:
            return apiError("Delete failed", HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } else {
        // Success Path
        const responseData = {
          message: "Property deleted successfully",
          propertyId: result.data.propertyId,
          propertyTitle: result.data.propertyTitle,
          _meta: {
            version: result.newVersion,
            deletedAt: new Date().toISOString(),
          },
        };

        logger.info("Property soft-deleted", {
          correlationId,
          propertyId,
          newVersion: result.newVersion,
        });
        await IdempotencyService.complete(idempotencyKey, responseData);
        return apiSuccess(responseData, HttpStatus.OK, correlationId);
      }
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error(
        "Property delete error",
        error instanceof Error ? error : new Error(String(error)),
        { correlationId, propertyId },
      );
      return apiError(
        "Failed to delete property",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
);
