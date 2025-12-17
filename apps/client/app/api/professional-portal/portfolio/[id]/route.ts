import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, executeResilient, getClientLogger } from '@/app/lib/resilient-api';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const logger = getClientLogger();

const updatePortfolioSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  projectType: z.string(),
  images: z.array(z.string().url()).min(1),
  clientTestimonial: z.string().optional(),
});

export const GET = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id } = params!;

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `portfolio:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching portfolio', { correlationId, portfolioId: id, userId: dbUserId });

  return executeResilient(
    async () => {
      const portfolio = await prisma.portfolio.findUnique({
        where: {
          id: id as string,
          professionalId: dbUserId,
        },
        include: {
          professional: {
            select: {
              companyName: true,
              licenseNumber: true,
              portfolioUrl: true,
              servicesOffered: true,
              yearsExperience: true,
              website: true,
              certificates: true,
              projects: true,
              quotes: true,
              bio: true,
              city: true,
              county: true,
              country: true,
            }
          }
        }
      });

      if (!portfolio) {
        logger.warn('Portfolio not found', { correlationId, portfolioId: id, userId: dbUserId });
        return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
      }

      logger.info('Portfolio fetched successfully', { correlationId, portfolioId: id });
      return portfolio;
    },
    {
      operationName: 'get_professional_portfolio',
      successStatus: HttpStatus.OK,
    }
  );
});

export const PATCH = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id } = params!;

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `portfolio_update:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = updatePortfolioSchema.safeParse(body);

  if (!validation.success) {
    logger.warn('Portfolio update validation failed', { correlationId, portfolioId: id, errors: validation.error.issues });
    return apiError("Invalid input", HttpStatus.BAD_REQUEST, validation.error.issues);
  }

  const { title, description, projectType, images, clientTestimonial } = validation.data;

  logger.info('Updating portfolio', { correlationId, portfolioId: id, userId: dbUserId });

  return executeResilient(
    async () => {
      const existingPortfolio = await prisma.portfolio.findUnique({
        where: {
          id: id as string,
          professionalId: dbUserId,
        },
      });

      if (!existingPortfolio) {
        logger.warn('Portfolio not found for update', { correlationId, portfolioId: id, userId: dbUserId });
        return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
      }

      const updatedPortfolio = await prisma.portfolio.update({
        where: {
          id: id as string,
        },
        data: {
          title,
          description,
          projectType,
          images,
          clientTestimonial,
        },
      });

      logger.info('Portfolio updated successfully', { correlationId, portfolioId: id });
      return updatedPortfolio;
    },
    {
      operationName: 'update_professional_portfolio',
      successStatus: HttpStatus.OK,
    }
  );
});

export const DELETE = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id } = params!;

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `portfolio_delete:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Deleting portfolio', { correlationId, portfolioId: id, userId: dbUserId });

  return executeResilient(
    async () => {
      const existingPortfolio = await prisma.portfolio.findUnique({
        where: {
          id: id as string,
          professionalId: dbUserId,
        },
      });

      if (!existingPortfolio) {
        logger.warn('Portfolio not found for deletion', { correlationId, portfolioId: id, userId: dbUserId });
        return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
      }

      await prisma.portfolio.delete({
        where: {
          id: id as string,
        },
      });

      logger.info('Portfolio deleted successfully', { correlationId, portfolioId: id });
      return { message: "Portfolio deleted successfully" };
    },
    {
      operationName: 'delete_professional_portfolio',
      successStatus: HttpStatus.OK,
    }
  );
});