import { NextRequest } from "next/server";
import { prisma, Prisma, Profession } from "@build/db";
import { z } from "zod";
import { withRole } from "@/app/lib/api/api-middleware";
import { generateUniqueSlug } from "@/app/lib/utils/server-utils";
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
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { checkBodySize } from "@/app/lib/api/api-guards";

// Allowed sort fields to prevent arbitrary column injection
const ALLOWED_SORT_FIELDS = [
  "createdAt",
  "name",
  "sortOrder",
  "updatedAt",
] as const;
type SortField = (typeof ALLOWED_SORT_FIELDS)[number];

// Validation schemas — use z.nativeEnum() with Prisma enums per conventions
const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
  imageUrl: z.string().url().max(500).optional(),
  professionType: z.nativeEnum(Profession).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isFeatured: z.boolean().optional(),
  metaTitle: z.string().max(150).optional(),
  metaDescription: z.string().max(300).optional(),
  keywords: z.array(z.string().max(50)).max(20).optional(),
});

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default("1"),
  limit: z.string().regex(/^\d+$/).optional().default("10"),
  sort: z.string().optional().default("createdAt:desc"),
  search: z.string().optional().default(""),
  professionType: z.nativeEnum(Profession).optional(),
});

// Optimized select for service list queries
const serviceListSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  icon: true,
  imageUrl: true,
  professionType: true,
  isActive: true,
  isFeatured: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      services: true,
    },
  },
} as const;

/**
 * GET /api/services
 * Get all service categories with optional filtering and pagination
 * Public endpoint - no authentication required
 */
export async function GET(request: NextRequest) {
  const correlationId = initializeCorrelationId(request);
  const logger = getClientLogger();

  const identifier = getRateLimitIdentifier(request);
  const { success } = await checkRateLimit(
    `services-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const { searchParams } = new URL(request.url);
  const queryParams = {
    page: searchParams.get("page") || "1",
    limit: searchParams.get("limit") || "10",
    sort: searchParams.get("sort") || "createdAt:desc",
    search: searchParams.get("search") || "",
    professionType: searchParams.get("professionType") || undefined,
  };

  const queryValidation = querySchema.safeParse(queryParams);
  if (!queryValidation.success) {
    logger.warn("Service query validation failed", {
      correlationId,
      errors: queryValidation.error.issues,
    });
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues,
    );
  }

  const { page, limit, sort, search, professionType } = queryValidation.data;
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 50);
  const skip = (pageNum - 1) * limitNum;

  // Parse and validate sort parameter
  const [rawSortField = "createdAt", sortDirection] = sort.split(":");
  const sortField: SortField = ALLOWED_SORT_FIELDS.includes(
    rawSortField as SortField,
  )
    ? (rawSortField as SortField)
    : "createdAt";
  const orderBy = {
    [sortField]: sortDirection === "asc" ? "asc" : "desc",
  };

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () => {
      // Build where clause with soft-delete and active filters
      const where: Prisma.ServiceCategoryWhereInput = {
        deletedAt: null,
        isActive: true,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      if (professionType) {
        where.professionType = professionType;
      }

      const [services, total] = await Promise.all([
        prisma.serviceCategory.findMany({
          where,
          skip,
          take: limitNum,
          orderBy,
          select: serviceListSelect,
        }),
        prisma.serviceCategory.count({ where }),
      ]);

      logger.info("Services fetched successfully", {
        correlationId,
        count: services.length,
        total,
      });

      return {
        services,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    },
    { operationName: "get_services" },
  );

  if (!result.success) {
    return apiError(
      "Failed to fetch services",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  return apiSuccess(result.data);
}

/**
 * POST /api/services
 * Create a new service category
 * Admin only endpoint — protected by withRole middleware
 */
export const POST = withRole(["ADMIN"])(async (
  request: NextRequest,
  { dbUserId },
) => {
  const correlationId = initializeCorrelationId(request);
  const logger = getClientLogger();

  const { success } = await checkRateLimit(
    getRateLimitIdentifier(request),
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  // Body size guard
  const sizeError = checkBodySize(request);
  if (sizeError) return sizeError;

  const body = await request.json();
  const validation = createServiceSchema.safeParse(body);

  if (!validation.success) {
    logger.warn("Service creation validation failed", {
      correlationId,
      userId: dbUserId,
      errors: validation.error.issues,
    });
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  const {
    name,
    description,
    icon,
    imageUrl,
    professionType,
    sortOrder,
    isFeatured,
    metaTitle,
    metaDescription,
    keywords,
  } = validation.data;

  // Idempotency check
  const idempotencyKey =
    request.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(dbUserId, "POST:service", { name });
  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "service",
    dbUserId,
    "POST",
  );

  if (idempotencyCheck?.status === "completed") {
    return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
  }
  if (idempotencyCheck?.status === "pending") {
    return apiError("Request already in progress", HttpStatus.CONFLICT);
  }

  logger.info("Creating service category", {
    correlationId,
    userId: dbUserId,
    name,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () => {
      // Check for duplicate name (name is not @unique, use findFirst)
      const existing = await prisma.serviceCategory.findFirst({
        where: { name, deletedAt: null },
        select: { id: true },
      });

      if (existing) {
        return null; // Signal duplicate
      }

      // Generate unique slug
      const slug = await generateUniqueSlug("serviceCategory", name);

      const service = await prisma.serviceCategory.create({
        data: {
          name,
          slug,
          description,
          icon,
          imageUrl,
          professionType,
          sortOrder,
          isFeatured,
          metaTitle,
          metaDescription,
          keywords,
        },
        select: serviceListSelect,
      });

      return service;
    },
    { operationName: "create_service" },
  );

  if (!result.success) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Failed to create service category",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  if (result.data === null) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "A service with this name already exists",
      HttpStatus.CONFLICT,
    );
  }

  const service = result.data!;

  logger.info("Service category created successfully", {
    correlationId,
    userId: dbUserId,
    serviceId: service.id,
  });

  await IdempotencyService.complete(idempotencyKey, service);
  return apiSuccess(service, HttpStatus.CREATED);
});
