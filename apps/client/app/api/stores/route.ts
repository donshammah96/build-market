import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
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
import {
  CreateStoreSchema,
  BatchCreateStoresSchema,
  StoreQuerySchema,
  storeListSelect,
  generateSlug,
} from "@/app/lib/stores-validation";
import { Prisma, UserStatus, ConsentType } from "@prisma/client";

// Extracted services
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { checkBodySize } from "@/app/lib/api-guards";

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

  // Parse query parameters
  const { searchParams } = new URL(req.url);
  const queryParams = {
    category: searchParams.get("category") || undefined,
    storeType: searchParams.get("storeType") || undefined,
    city: searchParams.get("city") || undefined,
    verified: searchParams.get("verified") || undefined,
    featured: searchParams.get("featured") || undefined,
    page: searchParams.get("page") || "1",
    limit: searchParams.get("limit") || "20",
  };

  const queryValidation = StoreQuerySchema.safeParse(queryParams);
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

  const { category, storeType, city, verified, featured, page, limit } =
    queryValidation.data;
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 50); // Max 50 per page
  const skip = (pageNum - 1) * limitNum;

  logger.info("Fetching stores", {
    correlationId,
    filters: { category, storeType, city, verified, featured },
  });

  const resilientExecutor = getResilientExecutor();
  return resilientExecutor.execute(
    async () => {
      // Build where clause dynamically with soft delete support
      const where: Prisma.StoreWhereInput = {
        deletedAt: null, // Respect soft delete
      };

      if (category) {
        where.categories = { has: category };
      }
      if (storeType) {
        where.storeType = storeType;
      }
      if (city) {
        where.city = { contains: city, mode: "insensitive" };
      }
      if (verified !== undefined) {
        where.verified = verified === "true";
      }
      if (featured !== undefined) {
        where.featured = featured === "true";
      }

      const [stores, total] = await Promise.all([
        prisma.store.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
          select: storeListSelect,
        }),
        prisma.store.count({ where }),
      ]);

      logger.info("Stores fetched successfully", {
        correlationId,
        count: stores.length,
        total,
      });

      return {
        stores,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    },
    {
      operationName: "get_stores",
    },
  );
}

/**
 * POST /api/stores
 * Create store(s) for the authenticated professional
 *
 * Features:
 * - Single or batch store creation
 * - GDPR consent tracking
 * - Account suspension checks
 * - Asset-based image handling
 * - Request metadata logging
 * - Resilient execution
 *
 * Supports two modes:
 * 1. Single store: { name, address, ..., images: [{ assetId, category, ... }] }
 * 2. Batch stores: { stores: [{ name, address, ... }, ...] }
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
  const resilientExecutor = getResilientExecutor();
  const { ipAddress, userAgent } = getRequestMetadata(req);

  const sizeError = checkBodySize(req);
  if (sizeError) return sizeError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  // Detect batch mode by checking for 'stores' array
  const isBatchMode =
    typeof body === "object" &&
    body !== null &&
    "stores" in body &&
    Array.isArray((body as { stores?: unknown }).stores);

  const batchValidation = isBatchMode
    ? BatchCreateStoresSchema.safeParse(body)
    : undefined;
  const singleValidation = !isBatchMode
    ? CreateStoreSchema.safeParse(body)
    : undefined;

  const batchData = batchValidation?.success ? batchValidation.data : null;
  const singleData = singleValidation?.success ? singleValidation.data : null;

  if (isBatchMode && !batchValidation?.success) {
    logger.warn("Batch store creation validation failed", {
      correlationId,
      userId: dbUserId,
      errors: batchValidation?.error.issues,
    });
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      batchValidation?.error.issues,
    );
  }

  if (!isBatchMode && !singleValidation?.success) {
    logger.warn("Store creation validation failed", {
      correlationId,
      userId: dbUserId,
      errors: singleValidation?.error.issues,
    });
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      singleValidation?.error.issues,
    );
  }

  const validatedPayload = isBatchMode
    ? { mode: "batch", ...batchData! }
    : { mode: "single", ...singleData! };

  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(dbUserId, "POST", validatedPayload);

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

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `stores-write:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );

  if (!rateLimitResult.success) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  if (isBatchMode) {
    const { stores: storeDataList } = batchData!;

    logger.info("Creating stores (batch)", {
      correlationId,
      userId: dbUserId,
      count: storeDataList.length,
      ipAddress,
    });

    // Check user account status
    const user = await prisma.user.findUnique({
      where: { id: dbUserId },
      select: {
        status: true,
        professionalProfile: {
          select: { userId: true },
        },
      },
    });

    if (!user) {
      logger.error("User not found", new Error("User not found"), {
        correlationId,
        userId: dbUserId,
      });
      await IdempotencyService.fail(idempotencyKey);
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    if (user.status === UserStatus.SUSPENDED) {
      logger.warn("Suspended user tried to create stores", {
        correlationId,
        userId: dbUserId,
      });
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Account suspended. Cannot create stores.",
        HttpStatus.FORBIDDEN,
      );
    }

    if (!user.professionalProfile) {
      logger.warn("Non-professional tried to create stores", {
        correlationId,
        userId: dbUserId,
      });
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Only professionals can create stores",
        HttpStatus.FORBIDDEN,
      );
    }

    // Generate unique slugs for each store (timestamp-based for batch uniqueness)
    const timestamp = Date.now();
    const storesWithSlugs = storeDataList.map((storeData, index) => {
      const baseSlug = storeData.slug || generateSlug(storeData.name);
      const uniqueSlug = `${baseSlug}-${timestamp}-${index}`;
      return { ...storeData, slug: uniqueSlug };
    });

    const result = await resilientExecutor.execute(
      async () => {
        // Create all stores atomically in a transaction
        const createdStores = await prisma.$transaction(
          storesWithSlugs.map((storeData) =>
            prisma.store.create({
              data: {
                professionalId: dbUserId,
                name: storeData.name,
                slug: storeData.slug,
                description: storeData.description,
                contactPhone: storeData.contactPhone,
                whatsappNumber: storeData.whatsappNumber,
                email: storeData.email,
                website: storeData.website,
                address: storeData.address,
                city: storeData.city,
                county: storeData.county,
                neighborhood: storeData.neighborhood,
                zipCode: storeData.zipCode,
                latitude: storeData.latitude,
                longitude: storeData.longitude,
                categories: storeData.categories,
                storeType: storeData.storeType,
                mpesaTillNumber: storeData.mpesaTillNumber,
                mpesaPaybill: storeData.mpesaPaybill,
                acceptsCard: storeData.acceptsCard,
                acceptsCash: storeData.acceptsCash,
                deliveryRadiusKm: storeData.deliveryRadiusKm,
                baseDeliveryFee: storeData.baseDeliveryFee,
                minOrderValue: storeData.minOrderValue,
                operatingHours:
                  storeData.operatingHours as Prisma.InputJsonValue,
                businessRegNo: storeData.businessRegNo,
                kraPin: storeData.kraPin,
                images: storeData.images?.length
                  ? {
                      create: storeData.images.map((img) => ({
                        assetId: img.assetId,
                        category: img.category,
                        caption: img.caption,
                        isMain: img.isMain,
                        sortOrder: img.sortOrder,
                        uploadedBy: { connect: { id: dbUserId } },
                      })),
                    }
                  : undefined,
              },
              select: {
                id: true,
                name: true,
                slug: true,
                city: true,
                county: true,
                storeType: true,
                categories: true,
                createdAt: true,
              },
            }),
          ),
        );

        // Record GDPR consent for each store
        await prisma.consentRecord.createMany({
          data: createdStores.map((store) => ({
            userId: dbUserId,
            type: ConsentType.PRIVACY_POLICY,
            documentVersion: "1.0",
            granted: true,
            grantedAt: new Date(),
            ipAddress,
            userAgent,
            metadata: {
              storeId: store.id,
              storeName: store.name,
            } as Prisma.InputJsonValue,
          })),
        });

        logger.info("Stores created successfully (batch)", {
          correlationId,
          userId: dbUserId,
          storeIds: createdStores.map((s) => s.id),
        });

        return { stores: createdStores, count: createdStores.length };
      },
      {
        operationName: "create_stores_batch",
      },
    );

    if (!result.success || !result.data) {
      logger.error(
        "Batch store creation failed",
        result.error || new Error("Unknown error"),
        { correlationId, userId: dbUserId },
      );
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to create stores",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await IdempotencyService.complete(idempotencyKey, result.data);
    return apiSuccess(result.data, HttpStatus.CREATED);
  }

  // Single store mode
  const storeData = singleData!;

  logger.info("Creating store", {
    correlationId,
    userId: dbUserId,
    name: storeData.name,
    storeType: storeData.storeType,
    ipAddress,
  });

  // Check user account status
  const user = await prisma.user.findUnique({
    where: { id: dbUserId },
    select: {
      status: true,
      professionalProfile: {
        select: { userId: true },
      },
    },
  });

  if (!user) {
    logger.error("User not found", new Error("User not found"), {
      correlationId,
      userId: dbUserId,
    });
    await IdempotencyService.fail(idempotencyKey);
    return apiError("User not found", HttpStatus.NOT_FOUND);
  }

  if (user.status === UserStatus.SUSPENDED) {
    logger.warn("Suspended user tried to create store", {
      correlationId,
      userId: dbUserId,
    });
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Account suspended. Cannot create stores.",
      HttpStatus.FORBIDDEN,
    );
  }

  if (!user.professionalProfile) {
    logger.warn("Non-professional tried to create store", {
      correlationId,
      userId: dbUserId,
    });
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Only professionals can create stores",
      HttpStatus.FORBIDDEN,
    );
  }

  // Generate unique slug
  const baseSlug = storeData.slug || generateSlug(storeData.name);
  let slug = baseSlug;
  const attempt = 0;

  const result = await resilientExecutor.execute(
    async () => {
      // Try to create with unique slug (database-level constraint will catch duplicates)
      try {
        const store = await prisma.store.create({
          data: {
            professionalId: dbUserId,
            name: storeData.name,
            slug,
            description: storeData.description,
            contactPhone: storeData.contactPhone,
            whatsappNumber: storeData.whatsappNumber,
            email: storeData.email,
            website: storeData.website,
            address: storeData.address,
            city: storeData.city,
            county: storeData.county,
            neighborhood: storeData.neighborhood,
            zipCode: storeData.zipCode,
            latitude: storeData.latitude,
            longitude: storeData.longitude,
            categories: storeData.categories,
            storeType: storeData.storeType,
            mpesaTillNumber: storeData.mpesaTillNumber,
            mpesaPaybill: storeData.mpesaPaybill,
            acceptsCard: storeData.acceptsCard,
            acceptsCash: storeData.acceptsCash,
            deliveryRadiusKm: storeData.deliveryRadiusKm,
            baseDeliveryFee: storeData.baseDeliveryFee,
            minOrderValue: storeData.minOrderValue,
            operatingHours: storeData.operatingHours as Prisma.InputJsonValue,
            businessRegNo: storeData.businessRegNo,
            kraPin: storeData.kraPin,
            images: storeData.images?.length
              ? {
                  create: storeData.images.map((img) => ({
                    assetId: img.assetId,
                    category: img.category,
                    caption: img.caption,
                    isMain: img.isMain,
                    sortOrder: img.sortOrder,
                    uploadedBy: { connect: { id: dbUserId } },
                  })),
                }
              : undefined,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            address: true,
            city: true,
            county: true,
            zipCode: true,
            latitude: true,
            longitude: true,
            categories: true,
            storeType: true,
            images: {
              select: {
                id: true,
                category: true,
                caption: true,
                isMain: true,
                sortOrder: true,
                asset: {
                  select: {
                    id: true,
                    cdnUrl: true,
                    thumbnailUrl: true,
                    blurHash: true,
                  },
                },
              },
              orderBy: { sortOrder: "asc" },
            },
            createdAt: true,
          },
        });

        // Record GDPR consent
        await prisma.consentRecord.create({
          data: {
            userId: dbUserId,
            type: ConsentType.PRIVACY_POLICY,
            documentVersion: "1.0",
            granted: true,
            grantedAt: new Date(),
            metadata: {
              storeId: store.id,
              storeName: store.name,
            } as Prisma.InputJsonValue,
          },
        });

        logger.info("Store created successfully", {
          correlationId,
          userId: dbUserId,
          storeId: store.id,
        });

        return store;
      } catch (error: unknown) {
        // Handle slug uniqueness constraint violation
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2002"
        ) {
          // Prisma unique constraint violation
          logger.warn("Slug already exists, retrying with suffix", {
            correlationId,
            slug,
            attempt,
          });

          // Retry with timestamp suffix
          slug = `${baseSlug}-${Date.now()}`;

          const store = await prisma.store.create({
            data: {
              professionalId: dbUserId,
              name: storeData.name,
              slug,
              description: storeData.description,
              contactPhone: storeData.contactPhone,
              whatsappNumber: storeData.whatsappNumber,
              email: storeData.email,
              website: storeData.website,
              address: storeData.address,
              city: storeData.city,
              county: storeData.county,
              neighborhood: storeData.neighborhood,
              zipCode: storeData.zipCode,
              latitude: storeData.latitude,
              longitude: storeData.longitude,
              categories: storeData.categories,
              storeType: storeData.storeType,
              mpesaTillNumber: storeData.mpesaTillNumber,
              mpesaPaybill: storeData.mpesaPaybill,
              acceptsCard: storeData.acceptsCard,
              acceptsCash: storeData.acceptsCash,
              deliveryRadiusKm: storeData.deliveryRadiusKm,
              baseDeliveryFee: storeData.baseDeliveryFee,
              minOrderValue: storeData.minOrderValue,
              operatingHours: storeData.operatingHours as Prisma.InputJsonValue,
              businessRegNo: storeData.businessRegNo,
              kraPin: storeData.kraPin,
              images: storeData.images?.length
                ? {
                    create: storeData.images.map((img) => ({
                      assetId: img.assetId,
                      category: img.category,
                      caption: img.caption,
                      isMain: img.isMain,
                      sortOrder: img.sortOrder,
                      uploadedBy: { connect: { id: dbUserId } },
                    })),
                  }
                : undefined,
            },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              address: true,
              city: true,
              county: true,
              zipCode: true,
              latitude: true,
              longitude: true,
              categories: true,
              storeType: true,
              images: {
                select: {
                  id: true,
                  category: true,
                  caption: true,
                  isMain: true,
                  sortOrder: true,
                  asset: {
                    select: {
                      id: true,
                      cdnUrl: true,
                      thumbnailUrl: true,
                      blurHash: true,
                    },
                  },
                },
                orderBy: { sortOrder: "asc" },
              },
              createdAt: true,
            },
          });

          // Record GDPR consent
          await prisma.consentRecord.create({
            data: {
              userId: dbUserId,
              type: ConsentType.PRIVACY_POLICY,
              documentVersion: "1.0",
              granted: true,
              grantedAt: new Date(),
              metadata: {
                storeId: store.id,
                storeName: store.name,
              } as Prisma.InputJsonValue,
            },
          });

          logger.info("Store created successfully (with slug retry)", {
            correlationId,
            userId: dbUserId,
            storeId: store.id,
          });

          return store;
        }

        // Re-throw other errors
        throw error;
      }
    },
    {
      operationName: "create_store",
    },
  );

  if (!result.success || !result.data) {
    logger.error(
      "Store creation failed",
      result.error || new Error("Unknown error"),
      { correlationId, userId: dbUserId },
    );
    await IdempotencyService.fail(idempotencyKey);
    return apiError("Failed to create store", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  await IdempotencyService.complete(idempotencyKey, result.data);
  return apiSuccess(result.data, HttpStatus.CREATED);
});
