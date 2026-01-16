import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

const logger = getClientLogger();

const withdrawSchema = z.object({
  amount: z.number().min(1, "Amount must be at least 1"),
});

/**
 * POST /api/professional-portal/finance/withdraw
 * Request a withdrawal of funds
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = withdrawSchema.safeParse(body);

  if (!validation.success) {
    logger.warn('Withdrawal validation failed', { correlationId, userId: dbUserId, errors: validation.error.issues });
    return apiError("Invalid input data", HttpStatus.BAD_REQUEST, validation.error.issues);
  }

  const { amount } = validation.data;

  logger.info('Processing withdrawal request', { correlationId, userId: dbUserId, amount });

  return executeResilient(
    async () => {
      // Calculate available balance (INCOME - WITHDRAWAL)
      const income = await prisma.professionalTransaction.aggregate({
        where: {
          professional: { userId: dbUserId },
          type: "INCOME",
          status: "COMPLETED",
        },
        _sum: { amount: true },
      });

      const withdrawals = await prisma.professionalTransaction.aggregate({
        where: {
          professional: { userId: dbUserId },
          type: "WITHDRAWAL",
          status: { in: ["COMPLETED", "PENDING"] },
        },
        _sum: { amount: true },
      });

      const totalIncome = Number(income._sum.amount || 0);
      const totalWithdrawals = Number(withdrawals._sum.amount || 0);
      const availableBalance = totalIncome - totalWithdrawals;

      if (amount > availableBalance) {
        logger.warn('Insufficient funds for withdrawal', {
          correlationId,
          userId: dbUserId,
          requestedAmount: amount,
          availableBalance,
        });
        return apiError("Insufficient funds", HttpStatus.BAD_REQUEST);
      }

      const transaction = await prisma.professionalTransaction.create({
        data: {
          professional: {
            connect: { userId: dbUserId },
          },
          description: "Withdrawal Request",
          amount: amount,
          type: "WITHDRAWAL",
          status: "PENDING",
          date: new Date(),
        },
      });

      logger.info('Withdrawal request created successfully', {
        correlationId,
        userId: dbUserId,
        transactionId: transaction.id,
        amount,
      });

      return transaction;
    },
    {
      operationName: "withdraw_funds",
      successStatus: HttpStatus.CREATED,
    }
  );
});
