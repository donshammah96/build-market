import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
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

const logger = getClientLogger();

/**
 * GET /api/professional-portal/finance/stats/[id]
 * Get financial statistics for a specific project.
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
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
      async () => {
        // Verify project ownership
        const project = await prisma.project.findUnique({
          where: { id: projectId, professionalId: dbUserId, deletedAt: null },
          select: { id: true, title: true },
        });

        if (!project) return { error: "not_found" as const };

        // Run all aggregations in parallel
        const [income, pendingIncome, transactionCount] = await Promise.all([
          prisma.professionalTransaction.aggregate({
            where: {
              professionalId: dbUserId,
              projectId,
              type: "INCOME",
              status: "SUCCESS",
            },
            _sum: { amount: true, netAmount: true, platformFee: true, taxAmount: true },
          }),
          prisma.professionalTransaction.aggregate({
            where: {
              professionalId: dbUserId,
              projectId,
              type: "INCOME",
              status: { in: ["PENDING", "PROCESSING"] },
            },
            _sum: { amount: true },
          }),
          prisma.professionalTransaction.count({
            where: { professionalId: dbUserId, projectId },
          }),
        ]);

        return {
          data: {
            projectId,
            projectTitle: project.title,
            totalEarnings: Number(income._sum.amount ?? 0),
            totalNetEarnings: Number(income._sum.netAmount ?? 0),
            totalPlatformFees: Number(income._sum.platformFee ?? 0),
            totalTax: Number(income._sum.taxAmount ?? 0),
            pendingIncome: Number(pendingIncome._sum.amount ?? 0),
            transactionCount,
          },
        };
      },
      { operationName: "get_project_finance_stats" },
    );

    if (!result.success) {
      logger.error("Failed to fetch project finance stats", result.error, {
        projectId,
      });
      return apiError(
        "Failed to fetch project finance stats",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data?.error === "not_found") {
      return apiError("Project not found", HttpStatus.NOT_FOUND);
    }

    return apiSuccess(result.data?.data, HttpStatus.OK);
  },
);
