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
} from "@/app/lib/api/rate-limit";
import { checkBodySize, isValidId } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  financeService,
  UpdateTransactionSchema,
} from "@/app/lib/domains/finance";

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

/**
 * GET /api/professional-portal/finance/transactions/[id]
 * Get a specific transaction by ID.
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
      return apiError("Invalid transaction ID format", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      `finance-txn-detail:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () =>
        financeService.getTransactionDetail(
          {
            userId: dbUserId,
            role: userRole,
          },
          id,
        ),
      { operationName: "get_transaction" },
    );

    if (!result.success) {
      getClientLogger().error("Failed to fetch transaction", result.error, {
        transactionId: id,
      });
      return apiError(
        "Failed to fetch transaction",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data) {
      return apiError(
        "Failed to fetch transaction",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      return apiError(
        result.data.message || "Transaction not found",
        result.data.status || HttpStatus.NOT_FOUND,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/finance/transactions/[id]
 * Update a transaction's description (professional-editable field).
 */
export const PATCH = withAuth<{ id: string }>(
  async (
    req: NextRequest,
    { dbUserId, userRole },
    params,
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid transaction ID format", HttpStatus.BAD_REQUEST);
    }

    const sizeError = checkBodySize(req, MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateTransactionSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const updateData = validation.data;

    if (Object.keys(updateData).length === 0) {
      return apiError("No fields to update", HttpStatus.BAD_REQUEST);
    }

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        domain: "transaction",
        transactionId: id,
        ...updateData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "transaction",
      dbUserId,
      "PATCH",
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
      `finance-txn-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    getClientLogger().info("Updating transaction", {
      correlationId,
      transactionId: id,
      actorRole: userRole,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () =>
        financeService.updateTransaction(
          {
            userId: dbUserId,
            role: userRole,
          },
          id,
          updateData,
        ),
      { operationName: "update_transaction" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to update transaction",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok && result.data.error === "not_found") {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Transaction not found", HttpStatus.NOT_FOUND);
    }

    if (!result.data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        result.data.message || "Failed to update transaction",
        result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await safeIdempotencyComplete(idempotencyKey, result.data.data);
    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/finance/transactions/[id]
 * Delete a transaction (only PENDING or CANCELLED allowed).
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
      return apiError("Invalid transaction ID format", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `finance-txn-delete:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    getClientLogger().info("Deleting transaction", {
      correlationId,
      transactionId: id,
      actorRole: userRole,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () =>
        financeService.deleteTransaction(
          {
            userId: dbUserId,
            role: userRole,
          },
          id,
        ),
      { operationName: "delete_transaction" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to delete transaction",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok && result.data.error === "not_found") {
      return apiError("Transaction not found", HttpStatus.NOT_FOUND);
    }
    if (!result.data.ok && result.data.error === "not_deletable") {
      return apiError(
        "Only PENDING or CANCELLED transactions can be deleted",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!result.data.ok) {
      return apiError(
        result.data.message || "Failed to delete transaction",
        result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);
