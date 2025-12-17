import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/finance/stats/[id]
 * Get financial statistics for a specific project
 */
export const GET = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id: projectId } = params!;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching project finance stats', { correlationId, userId: dbUserId, projectId });

  return executeResilient(
    async () => {
      // Verify project ownership
      const project = await prisma.project.findUnique({
        where: {
          id: projectId,
          professionalId: dbUserId,
        },
      });

      if (!project) {
        logger.warn('Project not found', { correlationId, userId: dbUserId, projectId });
        return apiError("Project not found", HttpStatus.NOT_FOUND);
      }

      // Calculate project-specific earnings
      const income = await prisma.professionalTransaction.aggregate({
        where: {
          professional: { userId: dbUserId },
          projectId: projectId,
          type: "INCOME",
          status: "COMPLETED",
        },
        _sum: { amount: true },
      });

      // Calculate pending income for this project
      const pendingIncome = await prisma.professionalTransaction.aggregate({
        where: {
          professional: { userId: dbUserId },
          projectId: projectId,
          type: "INCOME",
          status: "PENDING",
        },
        _sum: { amount: true },
      });

      // Count transactions for this project
      const transactionCount = await prisma.professionalTransaction.count({
        where: {
          professional: { userId: dbUserId },
          projectId: projectId,
        },
      });

      const stats = {
        projectId,
        projectTitle: project.title,
        totalEarnings: income._sum.amount || 0,
        pendingIncome: pendingIncome._sum.amount || 0,
        transactionCount,
      };

      logger.info('Project finance stats fetched successfully', { correlationId, projectId });
      return stats;
    },
    {
      operationName: "get_project_finance_stats",
      successStatus: HttpStatus.OK,
    }
  );
});
