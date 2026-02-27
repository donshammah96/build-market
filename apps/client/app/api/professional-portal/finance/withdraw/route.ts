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
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { WithdrawSchema } from "@/app/lib/validation/finance-validation";
import { createWithdrawal } from "@/lib/services/finance";

const logger = getClientLogger();
const MAX_BODY_SIZE = 1024 * 1024; // 1MB

/**
 * POST /api/professional-portal/finance/withdraw
 * Request a withdrawal of funds.
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
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

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `finance-withdraw:${identifier}`,
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

  logger.info("Processing withdrawal request", {
    correlationId,
    userId: dbUserId,
    amount,
    method,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () =>
      createWithdrawal(dbUserId, {
        amount,
        method,
        description,
      }),
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
  if ("error" in data) {
    await IdempotencyService.fail(idempotencyKey);
    if (data.error === "insufficient_funds") {
      return apiError(
        `Insufficient funds. Available balance: ${data.availableBalance}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (data.error === "below_minimum") {
      return apiError(
        `Withdrawal amount is below the minimum of ${data.min} KES`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (data.error === "above_maximum") {
      return apiError(
        `Withdrawal amount exceeds the maximum of ${data.max} KES`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return apiError(
      "Failed to create withdrawal",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  await IdempotencyService.complete(idempotencyKey, data.data);
  return apiSuccess(data.data, HttpStatus.CREATED);
});
