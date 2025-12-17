import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/finance/stats
 * Get financial statistics for the authenticated professional
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching finance stats', { correlationId, userId: dbUserId });

  return executeResilient(
    async () => {
      // Calculate total earnings (INCOME - COMPLETED)
      const income = await prisma.professionalTransaction.aggregate({
        where: {
          professional: { userId: dbUserId },
          type: "INCOME",
          status: "COMPLETED",
        },
        _sum: {
          amount: true,
        },
      });

      // Calculate pending payouts (WITHDRAWAL - PENDING)
      const pendingPayouts = await prisma.professionalTransaction.aggregate({
        where: {
          professional: { userId: dbUserId },
          type: "WITHDRAWAL",
          status: "PENDING",
        },
        _sum: {
          amount: true,
        },
      });

      // Calculate outstanding invoices (INCOME - PENDING)
      const outstandingInvoices = await prisma.professionalTransaction.aggregate({
        where: {
          professional: { userId: dbUserId },
          type: "INCOME",
          status: "PENDING",
        },
        _sum: {
          amount: true,
        },
      });

      const stats = {
        totalEarnings: income._sum.amount || 0,
        pendingPayouts: pendingPayouts._sum.amount || 0,
        outstandingInvoices: outstandingInvoices._sum.amount || 0,
      };

      logger.info('Finance stats fetched successfully', { correlationId, userId: dbUserId });
      return stats;
    },
    {
      operationName: "get_finance_stats",
      successStatus: HttpStatus.OK,
    }
  );
});
