import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/finance/withdraw/[id]
 * Get a specific withdrawal request by ID
 */
export const GET = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id } = params!;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching withdrawal request', { correlationId, withdrawalId: id, userId: dbUserId });

  return executeResilient(
    async () => {
      const withdrawal = await prisma.professionalTransaction.findUnique({
        where: {
          id,
          type: "WITHDRAWAL",
        },
        include: {
          professional: {
            select: {
              userId: true,
              companyName: true,
            },
          },
        },
      });

      if (!withdrawal || withdrawal.professional.userId !== dbUserId) {
        logger.warn('Withdrawal not found or unauthorized', { correlationId, withdrawalId: id, userId: dbUserId });
        return apiError("Withdrawal not found", HttpStatus.NOT_FOUND);
      }

      logger.info('Withdrawal fetched successfully', { correlationId, withdrawalId: id });
      return withdrawal;
    },
    {
      operationName: "get_withdrawal",
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * DELETE /api/professional-portal/finance/withdraw/[id]
 * Cancel a pending withdrawal request
 */
export const DELETE = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id } = params!;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Cancelling withdrawal request', { correlationId, withdrawalId: id, userId: dbUserId });

  return executeResilient(
    async () => {
      // Verify ownership and type
      const withdrawal = await prisma.professionalTransaction.findUnique({
        where: {
          id,
          type: "WITHDRAWAL",
        },
        include: { professional: true },
      });

      if (!withdrawal || withdrawal.professional.userId !== dbUserId) {
        logger.warn('Withdrawal not found or unauthorized for cancellation', { correlationId, withdrawalId: id, userId: dbUserId });
        return apiError("Withdrawal not found", HttpStatus.NOT_FOUND);
      }

      // Only allow cancellation of PENDING withdrawals
      if (withdrawal.status !== "PENDING") {
        logger.warn('Cannot cancel non-pending withdrawal', { correlationId, withdrawalId: id, status: withdrawal.status });
        return apiError("Only pending withdrawals can be cancelled", HttpStatus.BAD_REQUEST);
      }

      // Update status to CANCELLED instead of deleting
      const cancelledWithdrawal = await prisma.professionalTransaction.update({
        where: { id },
        data: {
          status: "CANCELLED",
          description: `${withdrawal.description} (Cancelled by user)`,
        },
      });

      logger.info('Withdrawal cancelled successfully', { correlationId, withdrawalId: id });
      return {
        message: "Withdrawal cancelled successfully",
        withdrawal: cancelledWithdrawal,
      };
    },
    {
      operationName: "cancel_withdrawal",
      successStatus: HttpStatus.OK,
    }
  );
});
