import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/finance/transactions
 * Get all transactions for the authenticated professional
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching transactions', { correlationId, userId: dbUserId });

  return executeResilient(
    async () => {
      const transactions = await prisma.professionalTransaction.findMany({
        where: {
          professional: {
            userId: dbUserId,
          },
        },
        orderBy: {
          date: "desc",
        },
      });

      logger.info('Transactions fetched successfully', { correlationId, userId: dbUserId, count: transactions.length });
      return transactions;
    },
    {
      operationName: "get_transactions",
      successStatus: HttpStatus.OK,
    }
  );
});
