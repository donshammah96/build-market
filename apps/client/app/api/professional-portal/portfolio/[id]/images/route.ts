import { NextRequest, NextResponse } from "next/server";
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
  PortfolioImageCategorySchema,
  type CreatePortfolioImageInput,
} from "@/app/lib/validation/portfolio-validation";
import { PORTFOLIO_CONFIG } from "@/app/lib/config/portfolio.config";
import { portfolioService } from "@/app/lib/domains/portfolio";

type PortfolioParams = { id: string };

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
    const categoryValue = searchParams.get("category") || undefined;
    let categoryFilter:
      | ReturnType<typeof PortfolioImageCategorySchema.parse>
      | undefined;

    if (categoryValue) {
      const parsedCategory =
        PortfolioImageCategorySchema.safeParse(categoryValue);
      if (!parsedCategory.success) {
        return apiError("Invalid category", HttpStatus.BAD_REQUEST);
      }
      categoryFilter = parsedCategory.data;
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        portfolioService.listImages({
          portfolioId,
          userId: dbUserId,
          category: categoryFilter,
        }),
      { operationName: "get_portfolio_images" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to fetch images",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok && result.data.error === "not_found") {
      return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
    }
    if (!result.data.ok && result.data.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(result.data.ok ? result.data.data : null, HttpStatus.OK);
  },
);

/**
 * POST /api/professional-portal/portfolio/[id]/images
 * Add image(s) to a portfolio linked to pre-uploaded Assets (owner only).
 * Supports single image or batch via { images: [...] }.
 * Ensures exactly one image is marked as main.
 */
export const POST = withAuth<PortfolioParams>(
  async (
    req: NextRequest,
    { dbUserId, userRole },
    params,
  ): Promise<NextResponse> => {
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

    let imagesToCreate: CreatePortfolioImageInput[];

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

    getClientLogger().info("Adding portfolio images", {
      correlationId,
      portfolioId,
      count: imagesToCreate.length,
      actorRole: userRole,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        portfolioService.addImages({
          portfolioId,
          userId: dbUserId,
          images: imagesToCreate,
          ipAddress,
          userAgent,
        }),
      { operationName: "add_portfolio_images" },
    );

    if (!result.success || !result.data) {
      return apiError("Failed to add images", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!result.data.ok && result.data.error === "not_found") {
      return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
    }
    if (!result.data.ok && result.data.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    if (!result.data.ok && result.data.error === "limit_exceeded") {
      return apiError(
        `Maximum ${PORTFOLIO_CONFIG.MAX_IMAGES_PER_PORTFOLIO} images per portfolio`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      !result.data.ok &&
      (result.data.error === "asset_not_found" ||
        result.data.error === "asset_forbidden")
    ) {
      return apiError(
        "Unauthorized access to one or more assets",
        HttpStatus.FORBIDDEN,
      );
    }

    return apiSuccess(
      result.data.ok ? result.data.data : null,
      HttpStatus.CREATED,
    );
  },
);
