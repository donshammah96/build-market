import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

const logger = getClientLogger();

const updateTransactionSchema = z.object({
  description: z.string().optional(),
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
});

/**
 * GET /api/professional-portal/finance/transactions/[id]
 * Get a specific transaction by ID
 */
export const GET = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id } = params!;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching transaction', { correlationId, transactionId: id, userId: dbUserId });

  return executeResilient(
    async () => {
      const transaction = await prisma.professionalTransaction.findUnique({
        where: { id },
        include: {
          professional: {
            select: {
              userId: true,
              companyName: true,
            },
          },
          project: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      if (!transaction || transaction.professional.userId !== dbUserId) {
        logger.warn('Transaction not found or unauthorized', { correlationId, transactionId: id, userId: dbUserId });
        return apiError("Transaction not found", HttpStatus.NOT_FOUND);
      }

      logger.info('Transaction fetched successfully', { correlationId, transactionId: id });
      return transaction;
    },
    {
      operationName: "get_transaction",
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * PATCH /api/professional-portal/finance/transactions/[id]
 * Update a specific transaction (limited fields)
 */
export const PATCH = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id } = params!;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = updateTransactionSchema.safeParse(body);

  if (!validation.success) {
    logger.warn('Transaction update validation failed', { correlationId, transactionId: id, errors: validation.error.issues });
    return apiError("Invalid input", HttpStatus.BAD_REQUEST, validation.error.issues);
  }

  logger.info('Updating transaction', { correlationId, transactionId: id, userId: dbUserId });

  return executeResilient(
    async () => {
      // Verify ownership
      const existingTransaction = await prisma.professionalTransaction.findUnique({
        where: { id },
        include: { professional: true },
      });

      if (!existingTransaction || existingTransaction.professional.userId !== dbUserId) {
        logger.warn('Transaction not found or unauthorized for update', { correlationId, transactionId: id, userId: dbUserId });
        return apiError("Transaction not found", HttpStatus.NOT_FOUND);
      }

      const updatedTransaction = await prisma.professionalTransaction.update({
        where: { id },
        data: validation.data,
      });

      logger.info('Transaction updated successfully', { correlationId, transactionId: id });
      return updatedTransaction;
    },
    {
      operationName: "update_transaction",
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * DELETE /api/professional-portal/finance/transactions/[id]
 * Delete a specific transaction (only if PENDING or CANCELLED)
 */
export const DELETE = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id } = params!;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Deleting transaction', { correlationId, transactionId: id, userId: dbUserId });

  return executeResilient(
    async () => {
      // Verify ownership
      const existingTransaction = await prisma.professionalTransaction.findUnique({
        where: { id },
        include: { professional: true },
      });

      if (!existingTransaction || existingTransaction.professional.userId !== dbUserId) {
        logger.warn('Transaction not found or unauthorized for deletion', { correlationId, transactionId: id, userId: dbUserId });
        return apiError("Transaction not found", HttpStatus.NOT_FOUND);
      }

      // Only allow deletion of PENDING or CANCELLED transactions
      if (!["PENDING", "CANCELLED"].includes(existingTransaction.status)) {
        logger.warn('Cannot delete completed transaction', { correlationId, transactionId: id, status: existingTransaction.status });
        return apiError("Cannot delete completed transactions", HttpStatus.BAD_REQUEST);
      }

      await prisma.professionalTransaction.delete({
        where: { id },
      });

      logger.info('Transaction deleted successfully', { correlationId, transactionId: id });
      return { message: "Transaction deleted successfully" };
    },
    {
      operationName: "delete_transaction",
      successStatus: HttpStatus.OK,
    }
  );
});
