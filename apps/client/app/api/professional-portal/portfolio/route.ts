import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, executeResilient, getClientLogger } from '@/app/lib/resilient-api';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const logger = getClientLogger();

const createPortfolioSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  projectType: z.string(),
  images: z.array(z.string().url()).min(1),
  clientTestimonial: z.string().optional(),
});

/**
 * GET /api/professional-portal/portfolio
 * Get all portfolio items for the authenticated professional
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
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching portfolio items', { correlationId, userId: dbUserId });

  return executeResilient(
    async () => {
      const portfolioItems = await prisma.portfolio.findMany({
        where: {
          professionalId: dbUserId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      logger.info('Portfolio items fetched successfully', { correlationId, userId: dbUserId, count: portfolioItems.length });
      return portfolioItems;
    },
    {
      operationName: 'get_portfolio_items',
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * POST /api/professional-portal/portfolio
 * Create a new portfolio item
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
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = createPortfolioSchema.safeParse(body);

  if (!validation.success) {
    logger.warn('Portfolio creation validation failed', { correlationId, userId: dbUserId, errors: validation.error.issues });
    return apiError("Invalid input", HttpStatus.BAD_REQUEST, validation.error.issues);
  }

  const { title, description, projectType, images, clientTestimonial } = validation.data;

  logger.info('Creating portfolio item', { correlationId, userId: dbUserId, title });

  return executeResilient(
    async () => {
      const portfolioItem = await prisma.portfolio.create({
        data: {
          professionalId: dbUserId,
          title,
          description,
          projectType,
          images,
          clientTestimonial,
        },
      });

      logger.info('Portfolio item created successfully', { correlationId, userId: dbUserId, portfolioId: portfolioItem.id });
      return portfolioItem;
    },
    {
      operationName: 'create_portfolio_item',
      successStatus: HttpStatus.CREATED,
    }
  );
});
