import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { generateUniqueSlug } from "@/lib/utils";
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

// Profession enum matching Prisma schema
const ProfessionEnum = z.enum([
  "architect",
  "interior_designer",
  "contractor",
  "civil_engineer",
  "electrician",
  "plumber",
  "carpenter",
  "mason",
  "painter",
  "roofer",
  "landscaper",
  "hvac_technician",
  "surveyor",
  "project_manager",
  "real_estate_agent",
  "quantity_surveyor",
  "structural_engineer",
  "welder",
  "tiler",
  "glazier",
  "other",
]);

// Validation schemas
const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
  professionType: ProfessionEnum.optional(),
});

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default("1"),
  limit: z.string().regex(/^\d+$/).optional().default("10"),
  sort: z.string().optional().default("createdAt:desc"),
  search: z.string().optional().default(""),
  professionType: ProfessionEnum.optional(),
});

// Optimized select for service list queries
const serviceListSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  icon: true,
  professionType: true,
  createdAt: true,
  _count: {
    select: {
      professionals: true,
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

  const identifier = getRateLimitIdentifier(request);
  const { success } = await checkRateLimit(
    `services-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS
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
      queryValidation.error.issues
    );
  }

  const { page, limit, sort, search, professionType } = queryValidation.data;
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 50);
  const skip = (pageNum - 1) * limitNum;

  // Parse sort parameter
  const [sortField = "createdAt", sortDirection] = sort.split(":");
  const orderBy = {
    [sortField]: sortDirection === "asc" ? "asc" : "desc",
  };

  return executeResilient(
    async () => {
      // Build where clause dynamically
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

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
    {
      operationName: "get_services",
      successStatus: HttpStatus.OK,
    }
  );
}

/**
 * POST /api/services
 * Create a new service category
 * Admin only endpoint
 */
export const POST = withAuth(async (request: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(request);

  const { success } = await checkRateLimit(
    getRateLimitIdentifier(request),
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

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
      validation.error.issues
    );
  }

  const { name, description, icon, professionType } = validation.data;

  logger.info("Creating service category", {
    correlationId,
    userId: dbUserId,
    name,
  });

  return executeResilient(
    async () => {
      // Check if user is admin
      const user = await prisma.user.findUnique({
        where: { id: dbUserId },
        select: { role: true },
      });

      if (!user || user.role !== "admin") {
        logger.warn("Non-admin tried to create service", {
          correlationId,
          userId: dbUserId,
        });
        return apiError(
          "Only administrators can create service categories",
          HttpStatus.FORBIDDEN
        );
      }

      // Check for duplicate name
      const existing = await prisma.serviceCategory.findUnique({
        where: { name },
        select: { id: true },
      });

      if (existing) {
        return apiError(
          "A service with this name already exists",
          HttpStatus.CONFLICT
        );
      }

      // Generate unique slug
      const slug = await generateUniqueSlug("serviceCategory", name);

      const service = await prisma.serviceCategory.create({
        data: {
          name,
          slug,
          description,
          icon,
          professionType,
        },
        select: serviceListSelect,
      });

      logger.info("Service category created successfully", {
        correlationId,
        userId: dbUserId,
        serviceId: service.id,
      });

      return apiSuccess(service, HttpStatus.CREATED);
    },
    {
      operationName: "create_service",
      successStatus: HttpStatus.CREATED,
    }
  );
});
