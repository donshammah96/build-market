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
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  UpdateThreadSchema,
  MESSAGING_CONFIG,
  messagingService,
} from "@build/messaging-server";
import { extractExpectedVersion } from "@/app/lib/api/request-utils";

const logger = getClientLogger();
type ThreadParams = { id: string };

/**
 * GET /api/messaging/conversations/[id]
 */
export const GET = withAuth<ThreadParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid conversation ID", HttpStatus.BAD_REQUEST);
    }
    const threadId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-thread-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success)
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => messagingService.getConversation(dbUserId, threadId),
      { operationName: "get_thread" },
    );

    if (!result.success) {
      logger.error("Project fetch failed", result.error, {
        correlationId,
        threadId,
      });
      return apiError(
        "Failed to fetch conversation",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      const serviceResult = result.data;
      if (!serviceResult || !serviceResult.ok) {
        return apiError(
          serviceResult?.message ?? "Invalid request",
          serviceResult?.status ?? HttpStatus.BAD_REQUEST,
        );
      }
      return apiSuccess(serviceResult.data, HttpStatus.OK);
    }
  },
);

/**
 * PATCH /api/messaging/conversations/[id]
 */
export const PATCH = withAuth<ThreadParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid conversation ID", HttpStatus.BAD_REQUEST);
    const threadId = params.id;

    const sizeError = checkBodySize(req, MESSAGING_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateThreadSchema.safeParse(body);
    if (!validation.success)
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    const data = validation.data;
    if (!data.subject && data.isArchived === undefined)
      return apiError("No fields to update", HttpStatus.BAD_REQUEST);

    const expectedVersion = extractExpectedVersion(req, body);

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        domain: "messaging-thread",
        threadId,
        version: expectedVersion,
        ...data,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "messaging",
      dbUserId,
      "PATCH",
    );
    if (!idempotencyCheck)
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    if (idempotencyCheck.status === "completed")
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    if (idempotencyCheck.status === "pending")
      return apiError("Request is being processed", HttpStatus.CONFLICT);

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-thread-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => messagingService.updateConversation(dbUserId, threadId, data),
      { operationName: "update_thread" },
    );

    if (!result.success) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      logger.error("Failed to update thread", result.error, {
        correlationId,
        threadId,
      });
      return apiError(
        "Failed to update conversation",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      const serviceResult = result.data;
      if (!serviceResult || !serviceResult.ok) {
        await IdempotencyService.fail(idempotencyKey).catch(() => {});
        return apiError(
          serviceResult?.message ?? "Invalid request",
          serviceResult?.status ?? HttpStatus.BAD_REQUEST,
        );
      }
      await IdempotencyService.complete(idempotencyKey, serviceResult.data).catch(
        () => {},
      );
      return apiSuccess(serviceResult.data, HttpStatus.OK);
    }
  },
);

/**
 * DELETE /api/messaging/conversations/[id]
 */
export const DELETE = withAuth<ThreadParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid conversation ID", HttpStatus.BAD_REQUEST);
    const threadId = params.id;

    // Safe parse
    let body: unknown = null;
    try {
      body = await req.json().catch(() => null);
    } catch {
      // Ignore JSON parse errors and treat as no body
    }

    const expectedVersion = extractExpectedVersion(req, body);
    if (expectedVersion === null) {
      return apiError(
        "Missing or invalid version. Provide If-Match header or version in body.",
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-thread-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success)
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => messagingService.deleteConversation(dbUserId, threadId),
      { operationName: "delete_thread" },
    );

    if (!result.success) {
      logger.error("Failed to delete thread", result.error, {
        correlationId,
        threadId,
      });
      return apiError(
        "Failed to delete conversation",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      const serviceResult = result.data;
      if (!serviceResult || !serviceResult.ok) {
        return apiError(
          serviceResult?.message ?? "Invalid request",
          serviceResult?.status ?? HttpStatus.BAD_REQUEST,
        );
      }
      const payload = serviceResult.data as Record<string, unknown>;
      return apiSuccess({ ...payload, expectedVersion }, HttpStatus.OK);
    }
  },
);
