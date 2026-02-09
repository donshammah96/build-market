import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
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

// Schema for image data matching PortfolioImage model
const portfolioImageSchema = z.object({
  url: z.string().url(),
  key: z.string().optional(),
  caption: z.string().optional(),
  isMain: z.boolean().optional().default(false),
  isBefore: z.boolean().optional().default(false),
  isAfter: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});

const createPortfolioSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  projectType: z.string(),
  clientTestimonial: z.string().optional(),
  completedAt: z.string().datetime().optional(),
  // Images as array of PortfolioImage data
  images: z
    .array(portfolioImageSchema)
    .min(1, "At least one image is required"),
});

/**
 * GET /api/professional-portal/portfolio
 * Get all portfolio items for the authenticated professional
 * Supports pagination via ?page=&limit= query params
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `portfolio:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  // Parse pagination params
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;

  logger.info("Fetching portfolio items", {
    correlationId,
    userId: dbUserId,
    page,
    limit,
  });

  return executeResilient(
    async () => {
      const [portfolioItems, total] = await Promise.all([
        prisma.portfolio.findMany({
          where: {
            professionalId: dbUserId,
          },
          include: {
            // Include related images properly
            images: {
              orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
              select: {
                id: true,
                url: true,
                key: true,
                caption: true,
                isMain: true,
                isBefore: true,
                isAfter: true,
                sortOrder: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.portfolio.count({
          where: { professionalId: dbUserId },
        }),
      ]);

      logger.info("Portfolio items fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: portfolioItems.length,
      });

      return {
        data: portfolioItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
    {
      operationName: "get_portfolio_items",
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * POST /api/professional-portal/portfolio
 * Create a new portfolio item with images
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `portfolio:${identifier}`,
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
  const validation = createPortfolioSchema.safeParse(body);

  if (!validation.success) {
    logger.warn("Portfolio creation validation failed", {
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
    title,
    description,
    projectType,
    images,
    clientTestimonial,
    completedAt,
  } = validation.data;

  logger.info("Creating portfolio item", {
    correlationId,
    userId: dbUserId,
    title,
    imageCount: images.length,
  });

  return executeResilient(
    async () => {
      // Ensure exactly one image is marked as main (first one if none specified)
      const hasMainImage = images.some((img) => img.isMain);
      const processedImages = images.map((img, index) => ({
        ...img,
        isMain: hasMainImage ? img.isMain : index === 0,
        sortOrder: img.sortOrder ?? index,
      }));

      const portfolioItem = await prisma.portfolio.create({
        data: {
          professionalId: dbUserId,
          title,
          description,
          projectType,
          clientTestimonial,
          completedAt: completedAt ? new Date(completedAt) : null,
          // Create nested PortfolioImage records
          images: {
            create: processedImages,
          },
        },
        include: {
          images: {
            orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
          },
        },
      });

      logger.info("Portfolio item created successfully", {
        correlationId,
        userId: dbUserId,
        portfolioId: portfolioItem.id,
      });
      return portfolioItem;
    },
    {
      operationName: "create_portfolio_item",
      successStatus: HttpStatus.CREATED,
    }
  );
});
