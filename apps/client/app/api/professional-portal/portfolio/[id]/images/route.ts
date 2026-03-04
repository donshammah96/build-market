import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import { ConsentType, Prisma } from "@prisma/client";
import { withAuth } from "@/app/lib/api/api-middleware";
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
import {
  BatchCreatePortfolioImagesSchema,
  CreatePortfolioImageSchema,
  UpdatePortfolioImageSchema,
  portfolioImageSelect,
} from "@/app/lib/validation/portfolio-validation";
import { PORTFOLIO_CONFIG } from "@/app/lib/config/portfolio.config";

const logger = getClientLogger();

type PortfolioParams = { id: string };

// ─── Helpers ─────────────────────────────────────────────────────────

async function verifyPortfolioOwnership(
  portfolioId: string,
  userId: string,
): Promise<
  { success: true } | { success: false; error: "not_found" | "forbidden" }
> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId, deletedAt: null },
    select: { professionalId: true },
  });
  if (!portfolio) return { success: false, error: "not_found" };
  if (portfolio.professionalId !== userId)
    return { success: false, error: "forbidden" };
  return { success: true };
}

async function verifyAssetOwnership(
  assetId: string,
  userId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { uploaderId: true },
  });
  if (!asset) return { success: false, error: "asset_not_found" };
  if (asset.uploaderId !== userId && asset.uploaderId !== "system") {
    return { success: false, error: "asset_forbidden" };
  }
  return { success: true };
}

/**
 * GET /api/professional-portal/portfolio/[id]/images
 * List all images for a portfolio (owner only).
 * Optional query: ?category=FINISHED_WORK
 */
export const GET = withAuth<PortfolioParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid portfolio ID", HttpStatus.BAD_REQUEST);
    }
    const portfolioId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `portfolio-images-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const { searchParams } = new URL(req.url);
    const categoryFilter = searchParams.get("category") || undefined;

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const ownership = await verifyPortfolioOwnership(portfolioId, dbUserId);
        if (!ownership.success) return { error: ownership.error };

        const images = await prisma.portfolioImage.findMany({
          where: {
            portfolioId,
            ...(categoryFilter && {
              category:
                categoryFilter as Prisma.EnumPortfolioImageCategoryFilter,
            }),
          },
          select: portfolioImageSelect,
          orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
        });

        return { data: images };
      },
      { operationName: "get_portfolio_images" },
    );

    if (!result.success) {
      return apiError(
        "Failed to fetch images",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data?.error === "not_found") {
      return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
    }
    if (result.data?.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(result.data?.data, HttpStatus.OK);
  },
);

/**
 * POST /api/professional-portal/portfolio/[id]/images
 * Add image(s) to a portfolio linked to pre-uploaded Assets (owner only).
 * Supports single image or batch via { images: [...] }.
 * Ensures exactly one image is marked as main.
 */
export const POST = withAuth<PortfolioParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid portfolio ID", HttpStatus.BAD_REQUEST);
    }
    const portfolioId = params.id;

    const sizeError = checkBodySize(req, PORTFOLIO_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    // Support both single and batch modes
    const isBatch =
      typeof body === "object" &&
      body !== null &&
      "images" in body &&
      Array.isArray((body as { images?: unknown }).images);

    let imagesToCreate: Array<{
      assetId: string;
      caption?: string;
      category?: string;
      isMain?: boolean;
      sortOrder?: number;
    }>;

    if (isBatch) {
      const batchValidation = BatchCreatePortfolioImagesSchema.safeParse(body);
      if (!batchValidation.success) {
        return apiError(
          "Invalid input",
          HttpStatus.BAD_REQUEST,
          batchValidation.error.issues,
        );
      }
      imagesToCreate = batchValidation.data.images;
    } else {
      const singleValidation = CreatePortfolioImageSchema.safeParse(body);
      if (!singleValidation.success) {
        return apiError(
          "Invalid input",
          HttpStatus.BAD_REQUEST,
          singleValidation.error.issues,
        );
      }
      imagesToCreate = [singleValidation.data];
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `portfolio-images-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Adding portfolio images", {
      correlationId,
      portfolioId,
      count: imagesToCreate.length,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const ownership = await verifyPortfolioOwnership(portfolioId, dbUserId);
        if (!ownership.success) return { error: ownership.error };

        // Check image count limit
        const currentCount = await prisma.portfolioImage.count({
          where: { portfolioId },
        });
        if (
          currentCount + imagesToCreate.length >
          PORTFOLIO_CONFIG.MAX_IMAGES_PER_PORTFOLIO
        ) {
          return { error: "limit_exceeded" as const };
        }

        // Verify all asset ownership
        for (const img of imagesToCreate) {
          const assetCheck = await verifyAssetOwnership(img.assetId, dbUserId);
          if (!assetCheck.success) return { error: assetCheck.error };
        }

        // If no main image exists yet and none specified, mark first as main
        const existingMain = await prisma.portfolioImage.findFirst({
          where: { portfolioId, isMain: true },
          select: { id: true },
        });
        const hasMainInBatch = imagesToCreate.some((img) => img.isMain);

        const processed = imagesToCreate.map((img, index) => ({
          portfolioId,
          assetId: img.assetId,
          caption: img.caption,
          category: img.category as
            | Prisma.EnumPortfolioImageCategoryFilter
            | undefined,
          isMain:
            !existingMain && !hasMainInBatch
              ? index === 0
              : (img.isMain ?? false),
          sortOrder: img.sortOrder ?? currentCount + index,
          uploadedById: dbUserId,
        }));

        const created = await prisma.$transaction(
          processed.map((data) =>
            prisma.portfolioImage.create({
              // eslint-disable-next-line /typescript-eslint/no-explicit-any
              data: data as any,
              select: portfolioImageSelect,
            }),
          ),
        );

        // GDPR consent
        await prisma.consentRecord.create({
          data: {
            userId: dbUserId,
            type: ConsentType.PRIVACY_POLICY,
            granted: true,
            grantedAt: new Date(),
            documentVersion: "1.0",
            ipAddress,
            metadata: {
              portfolioId,
              userAgent,
              imageCount: created.length,
              action: "add_portfolio_images",
            } as Prisma.InputJsonValue,
          },
        });

        return { data: { images: created, count: created.length } };
      },
      { operationName: "add_portfolio_images" },
    );

    if (!result.success || !result.data) {
      return apiError("Failed to add images", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (result.data.error === "not_found") {
      return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
    }
    if (result.data.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    if (result.data.error === "limit_exceeded") {
      return apiError(
        `Maximum ${PORTFOLIO_CONFIG.MAX_IMAGES_PER_PORTFOLIO} images per portfolio`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      result.data.error === "asset_not_found" ||
      result.data.error === "asset_forbidden"
    ) {
      return apiError(
        "Unauthorized access to one or more assets",
        HttpStatus.FORBIDDEN,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.CREATED);
  },
);

/**
 * PATCH /api/professional-portal/portfolio/[id]/images?imageId=xxx
 * Update a portfolio image's metadata (caption, category, isMain, sortOrder).
 */
export const PATCH = withAuth<PortfolioParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid portfolio ID", HttpStatus.BAD_REQUEST);
    }
    const portfolioId = params.id;

    const { searchParams } = new URL(req.url);
    const imageId = searchParams.get("imageId");
    if (!imageId || !isValidId(imageId)) {
      return apiError(
        "imageId query parameter is required",
        HttpStatus.BAD_REQUEST,
      );
    }

    const sizeError = checkBodySize(req, PORTFOLIO_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdatePortfolioImageSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const updateData = validation.data;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `portfolio-images-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const ownership = await verifyPortfolioOwnership(portfolioId, dbUserId);
        if (!ownership.success) return { error: ownership.error };

        const image = await prisma.portfolioImage.findFirst({
          where: { id: imageId, portfolioId },
          select: { id: true },
        });
        if (!image) return { error: "image_not_found" as const };

        // If setting as main, unset other main images in this portfolio
        if (updateData.isMain) {
          await prisma.portfolioImage.updateMany({
            where: { portfolioId, isMain: true, id: { not: imageId } },
            data: { isMain: false },
          });
        }

        const updated = await prisma.portfolioImage.update({
          where: { id: imageId },
          data: updateData,
          select: portfolioImageSelect,
        });

        return { data: updated };
      },
      { operationName: "update_portfolio_image" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to update image",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data.error === "not_found") {
      return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
    }
    if (result.data.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    if (result.data.error === "image_not_found") {
      return apiError(
        "Image not found in this portfolio",
        HttpStatus.NOT_FOUND,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/portfolio/[id]/images?imageId=xxx
 * Remove an image from a portfolio (owner only).
 * If deleting the main image, promotes the next image to main.
 */
export const DELETE = withAuth<PortfolioParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid portfolio ID", HttpStatus.BAD_REQUEST);
    }
    const portfolioId = params.id;

    const { searchParams } = new URL(req.url);
    const imageId = searchParams.get("imageId");
    if (!imageId || !isValidId(imageId)) {
      return apiError(
        "imageId query parameter is required",
        HttpStatus.BAD_REQUEST,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `portfolio-images-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const ownership = await verifyPortfolioOwnership(portfolioId, dbUserId);
        if (!ownership.success) return { error: ownership.error };

        const image = await prisma.portfolioImage.findFirst({
          where: { id: imageId, portfolioId },
          select: { id: true, isMain: true },
        });
        if (!image) return { error: "image_not_found" as const };

        await prisma.portfolioImage.delete({ where: { id: imageId } });

        // If deleted image was main, promote the next one
        if (image.isMain) {
          const nextImage = await prisma.portfolioImage.findFirst({
            where: { portfolioId },
            orderBy: { sortOrder: "asc" },
            select: { id: true },
          });
          if (nextImage) {
            await prisma.portfolioImage.update({
              where: { id: nextImage.id },
              data: { isMain: true },
            });
          }
        }

        return {
          data: { message: "Image deleted successfully", imageId },
        };
      },
      { operationName: "delete_portfolio_image" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to delete image",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data.error === "not_found") {
      return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
    }
    if (result.data.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    if (result.data.error === "image_not_found") {
      return apiError(
        "Image not found in this portfolio",
        HttpStatus.NOT_FOUND,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);
