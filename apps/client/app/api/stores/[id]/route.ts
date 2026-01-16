import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

// Store Category enum matching Prisma schema
const StoreCategoryEnum = z.enum([
  "hardware",
  "building_materials",
  "tiles_and_ceramics",
  "electrical",
  "plumbing",
  "paints_and_finishes",
  "roofing",
  "timber_and_wood",
  "glass_and_aluminum",
  "kitchen_and_bath",
  "landscaping",
  "steel_and_metals",
  "safety_and_tools",
  "hvac",
]);

// Store Type enum matching Prisma schema
const StoreTypeEnum = z.enum([
  "retail",
  "wholesale",
  "manufacturer",
  "distributor",
  "online_only",
]);

// County enum matching Prisma schema
const CountyEnum = z.enum([
  "MOMBASA",
  "KWALE",
  "KILIFI",
  "TANA_RIVER",
  "LAMU",
  "TAITA_TAVETA",
  "GARISSA",
  "WAJIR",
  "MANDERA",
  "MARSABIT",
  "ISIOLO",
  "MERU",
  "THARAKA_NITHI",
  "EMBU",
  "KITUI",
  "MACHAKOS",
  "MAKUENI",
  "NYANDARUA",
  "NYERI",
  "KIRINYAGA",
  "MURANGA",
  "KIAMBU",
  "TURKANA",
  "WEST_POKOT",
  "SAMBURU",
  "TRANS_NZOIA",
  "UASIN_GISHU",
  "ELGEYO_MARAKWET",
  "NANDI",
  "BARINGO",
  "LAIKIPIA",
  "NAKURU",
  "NAROK",
  "KAJIADO",
  "KERICHO",
  "BOMET",
  "KAKAMEGA",
  "VIHIGA",
  "BUNGOMA",
  "BUSIA",
  "SIAYA",
  "KISUMU",
  "HOMA_BAY",
  "MIGORI",
  "KISII",
  "NYAMIRA",
  "NAIROBI",
]);

// Helper function to generate URL-safe slug from store name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .substring(0, 100); // Limit length
}

const updateStoreSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    slug: z.string().max(100).optional(),
    description: z.string().max(1000).optional(),
    address: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    county: CountyEnum.optional(),
    zipCode: z.string().optional(), // Optional in Prisma schema
    categories: z.array(StoreCategoryEnum).min(1).optional(),
    storeType: StoreTypeEnum.optional(),
    images: z
      .array(
        z.object({
          url: z.string().url(),
          key: z.string().optional(),
          caption: z.string().optional(),
          isMain: z.boolean().optional(),
          isLogo: z.boolean().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.images) {
        return data.images.every(
          (image) =>
            image.url.startsWith("https://") || image.url.startsWith("http://")
        );
      }
      return true;
    },
    {
      message: "All image URLs must be valid URLs",
    }
  );

/**
 * GET /api/stores/[id]
 * Get a single store by ID
 * Public endpoint - no authentication required
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = initializeCorrelationId(req);
  const { id } = await params;

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `store-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  logger.info("Fetching store by ID", { correlationId, storeId: id });

  return executeResilient(
    async () => {
      const store = await prisma.store.findUnique({
        where: { id },
        include: {
          images: {
            select: {
              id: true,
              url: true,
              key: true,
              caption: true,
              isMain: true,
              isLogo: true,
              sortOrder: true,
            },
            orderBy: { sortOrder: "asc" },
          },
          professional: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
          products: {
            where: { inStock: true, deletedAt: null },
            take: 10,
            orderBy: { createdAt: "desc" },
            include: {
              images: {
                select: {
                  id: true,
                  url: true,
                  isMain: true,
                  sortOrder: true,
                },
                orderBy: { sortOrder: "asc" },
                take: 1,
              },
            },
          },
          reviews: {
            where: { approved: true },
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
              reviewer: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          _count: {
            select: {
              products: true,
              reviews: true,
              orders: true,
            },
          },
        },
      });

      if (!store) {
        logger.warn("Store not found", { correlationId, storeId: id });
        return apiError("Store not found", HttpStatus.NOT_FOUND);
      }

      // Calculate average rating
      const reviews = await prisma.review.findMany({
        where: { storeId: id, approved: true },
        select: { rating: true },
      });
      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;

      logger.info("Store fetched successfully", { correlationId, storeId: id });

      return {
        ...store,
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: reviews.length,
      };
    },
    {
      operationName: "get_store_by_id",
      successStatus: HttpStatus.OK,
    }
  );
}

/**
 * PATCH /api/stores/[id]
 * Update a store (owner only)
 */
export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `store-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const body = await req.json();
    const validation = updateStoreSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Store update validation failed", {
        correlationId,
        storeId: id,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues
      );
    }

    logger.info("Updating store", {
      correlationId,
      storeId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify ownership
        const existingStore = await prisma.store.findUnique({
          where: { id },
          select: { professionalId: true },
        });

        if (!existingStore) {
          logger.warn("Store not found for update", {
            correlationId,
            storeId: id,
          });
          return apiError("Store not found", HttpStatus.NOT_FOUND);
        }

        if (existingStore.professionalId !== dbUserId) {
          logger.warn("Unauthorized store update attempt", {
            correlationId,
            storeId: id,
            userId: dbUserId,
          });
          return apiError(
            "You can only update your own stores",
            HttpStatus.FORBIDDEN
          );
        }

        // Separate images from other fields for proper relation handling
        const {
          images,
          name,
          slug: providedSlug,
          ...otherData
        } = validation.data;

        // Handle slug update if name changes
        // Uses timestamp suffix to guarantee uniqueness without extra queries
        let newSlug: string | undefined;
        if (name && !providedSlug) {
          // Auto-generate new slug from new name with unique suffix
          newSlug = `${generateSlug(name)}-${Date.now()}`;
        } else if (providedSlug) {
          // Use provided slug with timestamp suffix to ensure uniqueness
          newSlug = `${generateSlug(providedSlug)}-${Date.now()}`;
        }

        const updatedStore = await prisma.store.update({
          where: { id },
          data: {
            ...otherData,
            ...(name && { name }),
            ...(newSlug && { slug: newSlug }),
            // Handle images relation: delete existing and recreate if provided
            ...(images !== undefined && {
              images: {
                deleteMany: {},
                create: images.map((img, index) => ({
                  url: img.url,
                  key: img.key,
                  caption: img.caption,
                  isMain: img.isMain ?? index === 0,
                  isLogo: img.isLogo ?? false,
                  sortOrder: img.sortOrder ?? index,
                })),
              },
            }),
          },
          include: {
            professional: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            images: {
              select: {
                id: true,
                url: true,
                key: true,
                caption: true,
                isMain: true,
                isLogo: true,
                sortOrder: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        logger.info("Store updated successfully", {
          correlationId,
          storeId: id,
        });
        return apiSuccess(updatedStore);
      },
      {
        operationName: "update_store",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * DELETE /api/stores/[id]
 * Delete a store (owner only)
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `store-delete:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    logger.info("Deleting store", {
      correlationId,
      storeId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify ownership
        const existingStore = await prisma.store.findUnique({
          where: { id },
          select: { professionalId: true, name: true },
        });

        if (!existingStore) {
          logger.warn("Store not found for deletion", {
            correlationId,
            storeId: id,
          });
          return apiError("Store not found", HttpStatus.NOT_FOUND);
        }

        if (existingStore.professionalId !== dbUserId) {
          logger.warn("Unauthorized store deletion attempt", {
            correlationId,
            storeId: id,
            userId: dbUserId,
          });
          return apiError(
            "You can only delete your own stores",
            HttpStatus.FORBIDDEN
          );
        }

        await prisma.store.delete({
          where: { id },
        });

        logger.info("Store deleted successfully", {
          correlationId,
          storeId: id,
          storeName: existingStore.name,
        });
        return apiSuccess({ message: "Store deleted successfully", id });
      },
      {
        operationName: "delete_store",
        successStatus: HttpStatus.OK,
      }
    );
  }
);
