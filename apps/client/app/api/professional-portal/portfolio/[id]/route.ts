import { NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
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
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { UpdatePortfolioSchema } from "@/app/lib/validation/portfolio-validation";
import { PORTFOLIO_CONFIG } from "@/app/lib/config/portfolio.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { portfolioService } from "@/app/lib/domains/portfolio";

type PortfolioParams = { id: string };

/**
 * GET /api/professional-portal/portfolio/[id]
 * Get a specific portfolio item with all images and details (owner only).
 */
export const GET = withAuth<PortfolioParams>(
  async (req: NextRequest, { dbUserId }, params) => {
    initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid portfolio ID", HttpStatus.BAD_REQUEST);
    }
    const portfolioId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `portfolio-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        portfolioService.getPortfolioDetail({
          portfolioId,
          userId: dbUserId,
        }),
      { operationName: "get_portfolio_detail" },
    );

    if (!result.success) {
      return apiError(
        "Failed to fetch portfolio",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data) {
      return apiError(
        "Failed to fetch portfolio",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!data.ok) {
      if (data.error === "not_found")
        return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/portfolio/[id]
 * Update a portfolio item (owner only).
 */
export const PATCH = withAuth<PortfolioParams>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const correlationId = initializeCorrelationId(req);

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

    const validation = UpdatePortfolioSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const updateData = validation.data;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        portfolioId,
        ...updateData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "portfolio",
      dbUserId,
      "PATCH",
    );
    if (idempotencyCheck.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      return apiError("Request is being processed", HttpStatus.CONFLICT);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `portfolio-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    getClientLogger().info("Updating portfolio item", {
      correlationId,
      portfolioId,
      fields: Object.keys(updateData),
      actorRole: userRole,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        portfolioService.updatePortfolio({
          portfolioId,
          userId: dbUserId,
          data: updateData,
        }),
      { operationName: "update_portfolio_item" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to update portfolio",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "not_found")
        return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
      if (data.error === "forbidden")
        return apiError("Forbidden", HttpStatus.FORBIDDEN);
      return apiError("Linked project not found", HttpStatus.NOT_FOUND);
    }

    await safeIdempotencyComplete(idempotencyKey, data.data);
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/portfolio/[id]
 * Soft-delete a portfolio item (owner only).
 */
export const DELETE = withAuth<PortfolioParams>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid portfolio ID", HttpStatus.BAD_REQUEST);
    }
    const portfolioId = params.id;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "DELETE", { portfolioId });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "portfolio",
      dbUserId,
      "DELETE",
    );
    if (idempotencyCheck?.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck?.status === "pending") {
      return apiError("Request already in progress", HttpStatus.CONFLICT);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `portfolio-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    getClientLogger().info("Deleting portfolio item", {
      correlationId,
      portfolioId,
      actorRole: userRole,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        portfolioService.deletePortfolio({
          portfolioId,
          userId: dbUserId,
        }),
      { operationName: "delete_portfolio_item" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to delete portfolio",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "not_found")
        return apiError("Portfolio not found", HttpStatus.NOT_FOUND);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.DATA_RECTIFIED,
      "Portfolio",
      portfolioId,
      { title: data.data.title, action: "DELETE" },
    ).catch((err) => getClientLogger().error("Failed to log deletion", err));

    const { message, portfolioId: deletedId } = data.data;
    const response = { message, portfolioId: deletedId };
    await safeIdempotencyComplete(idempotencyKey, response);
    return apiSuccess(response, HttpStatus.OK);
  },
);
