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
  getActorRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { isValidId } from "@/app/lib/api/api-guards";
import { financeService } from "@/app/lib/domains/finance";

/**
 * GET /api/professional-portal/finance/withdraw/[id]
 * Get a specific withdrawal request by ID.
 */
export const GET = withAuth<{ id: string }>(
  async (
    req: NextRequest,
    { dbUserId, userRole },
    params,
  ): Promise<NextResponse> => {
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
      () =>
        financeService.getWithdrawal(
          {
            userId: dbUserId,
            role: userRole,
          },
          id,
        ),
      { operationName: "get_withdrawal" },
    );

    if (!result.success || !result.data) {
      getClientLogger().error("Failed to fetch withdrawal", result.error, {
        withdrawalId: id,
      });
      return apiError(
        "Failed to fetch withdrawal",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      if (result.data.error === "not_found") {
        return apiError("Withdrawal not found", HttpStatus.NOT_FOUND);
      }
      return apiError(
        "Failed to fetch withdrawal",
        result.data.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
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

    const rateLimitKey = getActorRateLimitIdentifier(
      dbUserId,
      "finance-withdrawal-cancel",
    );
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    getClientLogger().info("Cancelling withdrawal request", {
      correlationId,
      withdrawalId: id,
      actorRole: userRole,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        financeService.cancelWithdrawal(
          {
            userId: dbUserId,
            role: userRole,
          },
          id,
        ),
      { operationName: "cancel_withdrawal" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to cancel withdrawal",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      if (result.data.error === "not_found") {
        return apiError("Withdrawal not found", HttpStatus.NOT_FOUND);
      }
      if (result.data.error === "not_deletable") {
        return apiError(
          "Only PENDING withdrawals can be cancelled",
          HttpStatus.BAD_REQUEST,
        );
      }
      return apiError(
        "Failed to cancel withdrawal",
        result.data.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiSuccess(
      {
        message: "Withdrawal cancelled successfully",
        withdrawal: result.data.data,
      },
      HttpStatus.OK,
    );
  },
  {
    recentAuth: {
      maxAgeSeconds: 180,
    },
  },
);
