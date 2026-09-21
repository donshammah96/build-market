import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
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
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  PortfolioQuerySchema,
  CreatePortfolioSchema,
} from "@/app/lib/validation/portfolio-validation";
import { PORTFOLIO_CONFIG } from "@/app/lib/config/portfolio.config";
import { portfolioService } from "@/app/lib/domains/portfolio";

function parsePortfolioQuery(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return {
    page: searchParams.get("page") || undefined,
    limit: searchParams.get("limit") || undefined,
    projectType: searchParams.get("projectType") || undefined,
  };
}

/**
 * GET /api/professional-portal/portfolio
 * List all portfolio items for the authenticated professional.
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "portfolio-read",
  querySchema: PortfolioQuerySchema,
  parseQuery: parsePortfolioQuery,
  handler: async ({ dbUserId, query }) => {
    const result = await portfolioService.listPortfolios({
      userId: dbUserId,
      query,
    });
    if (!result.ok) {
      throw new Error(result.message ?? "Failed to fetch portfolio items");
    }
    return result.data;
  },
  operationName: "get_portfolio_items",
  errorMessage: "Failed to fetch portfolio items",
});

/**
 * POST /api/professional-portal/portfolio
 * Create a new portfolio item.
 */
export const POST = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    const correlationId = initializeCorrelationId(req);
    const { ipAddress, userAgent } = getRequestMetadata(req);

    const sizeError = checkBodySize(req, PORTFOLIO_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = CreatePortfolioSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const portfolioData = validation.data;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "POST", {
        domain: "portfolio",
        title: portfolioData.title,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "portfolio",
      dbUserId,
      "POST",
    );
    if (idempotencyCheck.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `portfolio-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    getClientLogger().info("Creating portfolio item", {
      correlationId,
      actorRole: userRole,
      title: portfolioData.title,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () =>
        portfolioService.createPortfolio({
          userId: dbUserId,
          data: portfolioData,
          ipAddress,
          userAgent,
        }),
      { operationName: "create_portfolio_item" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to create portfolio item",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      if (data.error === "limit_exceeded") {
        await IdempotencyService.fail(idempotencyKey);
        return apiError(
          `Maximum ${PORTFOLIO_CONFIG.MAX_PORTFOLIOS_PER_PROFESSIONAL} portfolios per professional`,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (data.error === "project_not_found") {
        await IdempotencyService.fail(idempotencyKey);
        return apiError("Linked project not found", HttpStatus.NOT_FOUND);
      }
      // Fallback for unexpected errors
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to create portfolio item",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await safeIdempotencyComplete(idempotencyKey, data.data);
    return apiSuccess(data.data, HttpStatus.CREATED);
  },
);
