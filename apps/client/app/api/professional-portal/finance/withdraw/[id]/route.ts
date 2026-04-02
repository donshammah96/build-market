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
import {
  transactionDetailSelect,
  serializeTransactionDecimals,
} from "@/app/lib/validation/finance-validation";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/finance/withdraw/[id]
 * Get a specific withdrawal request by ID.
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid withdrawal ID format", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      `finance-withdrawal-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const withdrawal = await prisma.professionalTransaction.findUnique({
          where: { id, professionalId: dbUserId, type: "WITHDRAWAL" },
          select: transactionDetailSelect,
        });

        return withdrawal;
      },
      { operationName: "get_withdrawal" },
    );

    if (!result.success) {
      logger.error("Failed to fetch withdrawal", result.error, {
        withdrawalId: id,
      });
      return apiError(
        "Failed to fetch withdrawal",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data) {
      return apiError("Withdrawal not found", HttpStatus.NOT_FOUND);
    }

    return apiSuccess(serializeTransactionDecimals(result.data), HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/finance/withdraw/[id]
 * Cancel a pending withdrawal request.
 * Sets status to CANCELLED instead of hard-deleting.
 */
export const DELETE = withAuth<{ id: string }>(
  async (
    req: NextRequest,
    { dbUserId, userRole },
    params,
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid withdrawal ID format", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `finance-withdrawal-cancel:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Cancelling withdrawal request", {
      correlationId,
      withdrawalId: id,
      actorRole: userRole,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const existing = await prisma.professionalTransaction.findUnique({
          where: { id, professionalId: dbUserId, type: "WITHDRAWAL" },
          select: { id: true, status: true },
        });

        if (!existing) return { error: "not_found" as const };

        // Only allow cancellation of PENDING withdrawals
        if (existing.status !== "PENDING") {
          return { error: "not_cancellable" as const, status: existing.status };
        }

        const cancelled = await prisma.professionalTransaction.update({
          where: { id },
          data: { status: "CANCELLED" },
          select: transactionDetailSelect,
        });

        return { data: cancelled };
      },
      { operationName: "cancel_withdrawal" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to cancel withdrawal",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data.error === "not_found") {
      return apiError("Withdrawal not found", HttpStatus.NOT_FOUND);
    }
    if (result.data.error === "not_cancellable") {
      return apiError(
        `Only PENDING withdrawals can be cancelled. Current status: ${result.data.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return apiSuccess(
      {
        message: "Withdrawal cancelled successfully",
        withdrawal: serializeTransactionDecimals(result.data.data!),
      },
      HttpStatus.OK,
    );
  },
);
