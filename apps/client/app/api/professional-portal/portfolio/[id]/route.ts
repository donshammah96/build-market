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
  id: z.string().uuid().optional(), // Existing image ID (for updates)
  url: z.string().url(),
  key: z.string().optional(),
  caption: z.string().optional(),
  isMain: z.boolean().optional().default(false),
  isBefore: z.boolean().optional().default(false),
  isAfter: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});

const updatePortfolioSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  projectType: z.string().optional(),
  clientTestimonial: z.string().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  // Images as array of PortfolioImage data (replaces all images)
  images: z
    .array(portfolioImageSchema)
    .min(1, "At least one image is required")
    .optional(),
});

export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

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

    logger.info("Fetching portfolio", {
      correlationId,
      portfolioId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const portfolio = await prisma.portfolio.findUnique({
          where: {
            id,
            professionalId: dbUserId,
          },
          include: {
            // Include portfolio images
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
                createdAt: true,
              },
            },
            professional: {
              select: {
                companyName: true,
                licenseNumber: true,
                portfolioUrl: true,
                yearsExperience: true,
                website: true,
                bio: true,
                city: true,
                county: true,
                country: true,
                // Include services relation properly
                services: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        });

        if (!portfolio) {
          logger.warn("Portfolio not found", {
            correlationId,
            portfolioId: id,
            userId: dbUserId,
          });
          return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
        }

        logger.info("Portfolio fetched successfully", {
          correlationId,
          portfolioId: id,
        });
        return portfolio;
      },
      {
        operationName: "get_professional_portfolio",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `portfolio_update:${identifier}`,
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
    const validation = updatePortfolioSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Portfolio update validation failed", {
        correlationId,
        portfolioId: id,
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

    logger.info("Updating portfolio", {
      correlationId,
      portfolioId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const existingPortfolio = await prisma.portfolio.findUnique({
          where: {
            id,
            professionalId: dbUserId,
          },
        });

        if (!existingPortfolio) {
          logger.warn("Portfolio not found for update", {
            correlationId,
            portfolioId: id,
            userId: dbUserId,
          });
          return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
        }

        // Build update data
        const updateData: Record<string, unknown> = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (projectType !== undefined) updateData.projectType = projectType;
        if (clientTestimonial !== undefined)
          updateData.clientTestimonial = clientTestimonial;
        if (completedAt !== undefined)
          updateData.completedAt = completedAt ? new Date(completedAt) : null;

        // Handle images update - replace all images if provided
        if (images !== undefined) {
          // Ensure exactly one image is marked as main
          const hasMainImage = images.some((img) => img.isMain);
          const processedImages = images.map((img, index) => ({
            url: img.url,
            key: img.key,
            caption: img.caption,
            isMain: hasMainImage ? img.isMain : index === 0,
            isBefore: img.isBefore ?? false,
            isAfter: img.isAfter ?? false,
            sortOrder: img.sortOrder ?? index,
          }));

          // Use transaction to delete old images and create new ones
          const updatedPortfolio = await prisma.$transaction(async (tx) => {
            // Delete existing images
            await tx.portfolioImage.deleteMany({
              where: { portfolioId: id },
            });

            // Update portfolio with new images
            return tx.portfolio.update({
              where: { id },
              data: {
                ...updateData,
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
          });

          logger.info("Portfolio updated successfully with new images", {
            correlationId,
            portfolioId: id,
          });
          return updatedPortfolio;
        }

        // Update without changing images
        const updatedPortfolio = await prisma.portfolio.update({
          where: { id },
          data: updateData,
          include: {
            images: {
              orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
            },
          },
        });

        logger.info("Portfolio updated successfully", {
          correlationId,
          portfolioId: id,
        });
        return updatedPortfolio;
      },
      {
        operationName: "update_professional_portfolio",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `portfolio_delete:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    logger.info("Deleting portfolio", {
      correlationId,
      portfolioId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const existingPortfolio = await prisma.portfolio.findUnique({
          where: {
            id,
            professionalId: dbUserId,
          },
          include: {
            images: { select: { key: true } },
          },
        });

        if (!existingPortfolio) {
          logger.warn("Portfolio not found for deletion", {
            correlationId,
            portfolioId: id,
            userId: dbUserId,
          });
          return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
        }

        // Note: PortfolioImage records will be cascade deleted due to onDelete: Cascade
        // If you need to clean up storage (S3/Uploadthing), collect keys here:
        const imageKeys = existingPortfolio.images
          .map((img) => img.key)
          .filter(Boolean);

        await prisma.portfolio.delete({
          where: { id },
        });

        logger.info("Portfolio deleted successfully", {
          correlationId,
          portfolioId: id,
          deletedImageKeys: imageKeys.length,
        });

        return {
          message: "Portfolio deleted successfully",
          // Return keys for potential storage cleanup on client side
          deletedImageKeys: imageKeys,
        };
      },
      {
        operationName: "delete_professional_portfolio",
        successStatus: HttpStatus.OK,
      }
    );
  }
);
