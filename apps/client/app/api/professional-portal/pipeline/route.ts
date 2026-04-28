import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { pipelineService } from "@/app/lib/domains/pipeline";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/pipeline
 * Get sales pipeline data for property professionals.
 */
export const GET = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    const correlationId = initializeCorrelationId(req);
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `pipeline-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () =>
        pipelineService.getProfessionalPipeline({
          userId: dbUserId,
          role: normalizeRole(String(userRole)),
        }),
      { operationName: "get_sales_pipeline" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch sales pipeline", result.error, {
        correlationId,
        actorRole: normalizeRole(String(userRole)),
      });
      return apiError(
        "Failed to fetch sales pipeline",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      if (result.data.error === "forbidden") {
        return apiError(
          result.data.message ?? "Forbidden",
          HttpStatus.FORBIDDEN,
        );
      }

      return apiError(
        result.data.message ?? "Failed to fetch sales pipeline",
        result.data.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);
