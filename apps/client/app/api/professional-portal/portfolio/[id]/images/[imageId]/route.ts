import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { checkBodySize, isValidId } from "@/app/lib/api/api-guards";
import { UpdatePortfolioImageSchema } from "@/app/lib/validation/portfolio-validation";
import { PORTFOLIO_CONFIG } from "@/app/lib/config/portfolio.config";
import { portfolioService } from "@/app/lib/domains/portfolio";

type PortfolioImageParams = { id: string; imageId: string };

/**
 * PATCH /api/professional-portal/portfolio/[id]/images/[imageId]
 * Update a portfolio image's metadata (caption, category, isMain, sortOrder).
 */
export const PATCH = withAuth<PortfolioImageParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.imageId ||
      !isValidId(params.imageId)
    ) {
      return apiError("Invalid IDs", HttpStatus.BAD_REQUEST);
    }
    const { id: portfolioId, imageId } = params;

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
      () =>
        portfolioService.updateImage({
          portfolioId,
          imageId,
          userId: dbUserId,
          data: updateData,
        }),
      { operationName: "update_portfolio_image_item" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to update image",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok && result.data.error === "not_found") {
      return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
    }
    if (!result.data.ok && result.data.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    if (!result.data.ok && result.data.error === "image_not_found") {
      return apiError(
        "Image not found in this portfolio",
        HttpStatus.NOT_FOUND,
      );
    }

    return apiSuccess(result.data.ok ? result.data.data : null, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/portfolio/[id]/images/[imageId]
 * Remove an image from a portfolio (owner only).
 * If deleting the main image, promotes the next image to main.
 */
export const DELETE = withAuth<PortfolioImageParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.imageId ||
      !isValidId(params.imageId)
    ) {
      return apiError("Invalid IDs", HttpStatus.BAD_REQUEST);
    }
    const { id: portfolioId, imageId } = params;

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
      () =>
        portfolioService.deleteImage({
          portfolioId,
          imageId,
          userId: dbUserId,
        }),
      { operationName: "delete_portfolio_image_item" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to delete image",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok && result.data.error === "not_found") {
      return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
    }
    if (!result.data.ok && result.data.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    if (!result.data.ok && result.data.error === "image_not_found") {
      return apiError(
        "Image not found in this portfolio",
        HttpStatus.NOT_FOUND,
      );
    }

    return apiSuccess(result.data.ok ? result.data.data : null, HttpStatus.OK);
  },
);
