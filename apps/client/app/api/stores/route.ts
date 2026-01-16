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

const createStoreSchema = z.object({
  name: z.string().min(1, "Store name is required").max(100),
  description: z.string().max(1000).optional(),
  slug: z.string().max(100).optional(), // Auto-generated if not provided
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  county: CountyEnum,
  zipCode: z.string().optional(), // Optional in Prisma schema
  categories: z
    .array(StoreCategoryEnum)
    .min(1, "At least one category is required"),
  storeType: StoreTypeEnum,
  images: z.array(z.string().url()).optional().default([]),
});

// Schema for batch creating multiple stores
const batchCreateStoresSchema = z.object({
  stores: z
    .array(createStoreSchema)
    .min(1)
    .max(5, "Maximum 5 stores per request"),
});

// Optimized select for store list queries (minimal data needed)
const storeListSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  address: true,
  city: true,
  county: true,
  zipCode: true,
  categories: true,
  storeType: true,
  verified: true,
  featured: true,
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
    orderBy: { sortOrder: "asc" as const },
  },
  createdAt: true,
  updatedAt: true,
  professional: {
    select: {
      userId: true,
      companyName: true,
      user: {
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
} as const;

const querySchema = z.object({
  category: StoreCategoryEnum.optional(),
  storeType: StoreTypeEnum.optional(),
  city: z.string().optional(),
  verified: z.enum(["true", "false"]).optional(),
  featured: z.enum(["true", "false"]).optional(),
  page: z.string().regex(/^\d+$/).optional().default("1"),
  limit: z.string().regex(/^\d+$/).optional().default("20"),
});

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
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS
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

  const queryValidation = querySchema.safeParse(queryParams);
  if (!queryValidation.success) {
    logger.warn("Store query validation failed", {
      correlationId,
      errors: queryValidation.error.issues,
    });
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues
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

  return executeResilient(
    async () => {
      // Build where clause dynamically
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

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
      successStatus: HttpStatus.OK,
    }
  );
}

/**
 * POST /api/stores
 * Create store(s) for the authenticated professional
 *
 * Supports two modes:
 * 1. Single store: { name, address, ... }
 * 2. Batch stores: { stores: [{ name, address, ... }, ...] }
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `stores-write:${identifier}`,
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

  // Detect batch mode by checking for 'stores' array
  const isBatchMode = "stores" in body && Array.isArray(body.stores);

  if (isBatchMode) {
    // Batch create mode
    const batchValidation = batchCreateStoresSchema.safeParse(body);

    if (!batchValidation.success) {
      logger.warn("Batch store creation validation failed", {
        correlationId,
        userId: dbUserId,
        errors: batchValidation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        batchValidation.error.issues
      );
    }

    const { stores: storeDataList } = batchValidation.data;

    logger.info("Creating stores (batch)", {
      correlationId,
      userId: dbUserId,
      count: storeDataList.length,
    });

    return executeResilient(
      async () => {
        // Verify user has a professional profile
        const professional = await prisma.professionalProfile.findUnique({
          where: { userId: dbUserId },
          select: { userId: true },
        });

        if (!professional) {
          logger.warn("Non-professional tried to create stores", {
            correlationId,
            userId: dbUserId,
          });
          return apiError(
            "Only professionals can create stores",
            HttpStatus.FORBIDDEN
          );
        }

        // Generate unique slugs for each store
        const storesWithSlugs = await Promise.all(
          storeDataList.map(async (storeData, index) => {
            const baseSlug = storeData.slug || generateSlug(storeData.name);
            // Add timestamp suffix to ensure uniqueness in batch
            const uniqueSlug = `${baseSlug}-${Date.now()}-${index}`;
            return { ...storeData, slug: uniqueSlug };
          })
        );

        // Create all stores atomically in a transaction
        // Note: slug field will be available after running `npx prisma generate`
        const createdStores = await prisma.$transaction(
          storesWithSlugs.map((storeData) =>
            prisma.store.create({
              data: {
                professionalId: dbUserId,
                name: storeData.name,
                slug: storeData.slug,
                description: storeData.description,
                address: storeData.address,
                city: storeData.city,
                county: storeData.county,
                zipCode: storeData.zipCode,
                categories: storeData.categories,
                storeType: storeData.storeType,
                images: storeData.images?.length
                  ? {
                      create: storeData.images.map((url, index) => ({
                        url,
                        isMain: index === 0,
                        sortOrder: index,
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
            })
          )
        );

        logger.info("Stores created successfully (batch)", {
          correlationId,
          userId: dbUserId,
          storeIds: createdStores.map((s) => s.id),
        });

        return apiSuccess(
          { stores: createdStores, count: createdStores.length },
          HttpStatus.CREATED
        );
      },
      {
        operationName: "create_stores_batch",
        successStatus: HttpStatus.CREATED,
      }
    );
  }

  // Single store mode (original behavior)
  const validation = createStoreSchema.safeParse(body);

  if (!validation.success) {
    logger.warn("Store creation validation failed", {
      correlationId,
      userId: dbUserId,
      errors: validation.error.issues,
    });
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues
    );
  }

  const {
    name,
    description,
    slug: providedSlug,
    address,
    city,
    county,
    zipCode,
    categories,
    storeType,
    images,
  } = validation.data;

  logger.info("Creating store", {
    correlationId,
    userId: dbUserId,
    name,
    storeType,
  });

  return executeResilient(
    async () => {
      // Verify user has a professional profile
      const professional = await prisma.professionalProfile.findUnique({
        where: { userId: dbUserId },
        select: { userId: true }, // Optimized: only need to check existence
      });

      if (!professional) {
        logger.warn("Non-professional tried to create store", {
          correlationId,
          userId: dbUserId,
        });
        return apiError(
          "Only professionals can create stores",
          HttpStatus.FORBIDDEN
        );
      }

      // Generate unique slug if not provided
      const baseSlug = providedSlug || generateSlug(name);
      let slug = baseSlug;
      let slugSuffix = 0;

      // Ensure slug uniqueness
      while (true) {
        const existingStore = await prisma.store.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (!existingStore) break;
        slugSuffix++;
        slug = `${baseSlug}-${slugSuffix}`;
      }

      const store = await prisma.store.create({
        data: {
          professionalId: dbUserId,
          name,
          slug,
          description,
          address,
          city,
          county,
          zipCode,
          categories,
          storeType,
          images: images?.length
            ? {
                create: images.map((url, index) => ({
                  url,
                  isMain: index === 0,
                  sortOrder: index,
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
          categories: true,
          storeType: true,
          images: {
            select: {
              id: true,
              url: true,
              isMain: true,
              isLogo: true,
              sortOrder: true,
            },
            orderBy: { sortOrder: "asc" },
          },
          createdAt: true,
        },
      });

      logger.info("Store created successfully", {
        correlationId,
        userId: dbUserId,
        storeId: store.id,
      });
      return apiSuccess(store, HttpStatus.CREATED);
    },
    {
      operationName: "create_store",
      successStatus: HttpStatus.CREATED,
    }
  );
});
