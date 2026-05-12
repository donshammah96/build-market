import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getActorRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { financeService, WithdrawSchema } from "@/app/lib/domains/finance";

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

/**
 * POST /api/professional-portal/finance/withdraw
 * Request a withdrawal of funds.
 */
export const POST = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    const correlationId = initializeCorrelationId(req);

    const sizeError = checkBodySize(req, MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = WithdrawSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const { amount, method, description } = validation.data;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "POST", {
        domain: "withdrawal",
        amount,
        method,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "withdrawal",
      dbUserId,
      "POST",
    );
    if (!idempotencyCheck) {
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (idempotencyCheck.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const rateLimitKey = getActorRateLimitIdentifier(
      dbUserId,
      "finance-withdraw",
    );
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    getClientLogger().info("Processing withdrawal request", {
      correlationId,
      actorRole: userRole,
      amount,
      method,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        financeService.createWithdrawal(
          {
            userId: dbUserId,
            role: userRole,
          },
          {
            amount,
            method,
            description,
          },
        ),
      { operationName: "create_withdrawal" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to create withdrawal",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "insufficient_funds") {
        return apiError(
          data.message ||
            `Insufficient funds. Available balance: ${data.availableBalance}`,
          data.status || HttpStatus.BAD_REQUEST,
        );
      }
      if (data.error === "below_minimum") {
        return apiError(
          data.message ||
            `Withdrawal amount is below the minimum of ${data.min} KES`,
          data.status || HttpStatus.BAD_REQUEST,
        );
      }
      if (data.error === "above_maximum") {
        return apiError(
          data.message ||
            `Withdrawal amount exceeds the maximum of ${data.max} KES`,
          data.status || HttpStatus.BAD_REQUEST,
        );
      }
      return apiError(
        data.message || "Failed to create withdrawal",
        data.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await safeIdempotencyComplete(idempotencyKey, data.data);
    return apiSuccess(data.data, HttpStatus.CREATED);
  },
  {
    recentAuth: {
      maxAgeSeconds: 180,
    },
  },
);
