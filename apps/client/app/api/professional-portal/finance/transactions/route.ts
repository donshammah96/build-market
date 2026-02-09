import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/finance/transactions
 * Get all transactions for the authenticated professional
 * Supports pagination via ?page=&limit= and filtering via ?type=&status=
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  // Parse query params
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;
  const typeFilter = searchParams.get("type") as "INCOME" | "WITHDRAWAL" | "EXPENSE" | null;
  const statusFilter = searchParams.get("status") as "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | null;

  logger.info('Fetching transactions', { correlationId, userId: dbUserId, page, limit, typeFilter, statusFilter });

  return executeResilient(
    async () => {
      const whereClause = {
        professionalId: dbUserId,
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
      };

      const [transactions, total] = await Promise.all([
        prisma.professionalTransaction.findMany({
          where: whereClause,
          include: {
            project: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: {
            date: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.professionalTransaction.count({ where: whereClause }),
      ]);

      logger.info('Transactions fetched successfully', { correlationId, userId: dbUserId, count: transactions.length });
      
      return {
        data: transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
    {
      operationName: "get_transactions",
      successStatus: HttpStatus.OK,
    }
  );
});
