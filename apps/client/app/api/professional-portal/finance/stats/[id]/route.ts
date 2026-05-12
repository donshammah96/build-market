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
  RateLimits,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { isValidId } from "@/app/lib/api/api-guards";
import { financeService } from "@/app/lib/domains/finance";

/**
 * GET /api/professional-portal/finance/stats/[id]
 * Get financial statistics for a specific project.
 */
export const GET = withAuth<{ id: string }>(
  async (
    req: NextRequest,
    { dbUserId, userRole },
    params,
  ): Promise<NextResponse> => {
    initializeCorrelationId(req);
    const { id: projectId } = params!;

    if (!isValidId(projectId)) {
      return apiError("Invalid project ID format", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      `finance-project-stats:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () =>
        financeService.getProjectStats(
          {
            userId: dbUserId,
            role: userRole,
          },
          projectId,
        ),
      { operationName: "get_project_finance_stats" },
    );

    if (!result.success) {
      getClientLogger().error(
        "Failed to fetch project finance stats",
        result.error,
        {
          projectId,
        },
      );
      return apiError(
        "Failed to fetch project finance stats",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data) {
      return apiError(
        "Failed to fetch project finance stats",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      return apiError(
        result.data.message || "Project not found",
        result.data.status || HttpStatus.NOT_FOUND,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);
