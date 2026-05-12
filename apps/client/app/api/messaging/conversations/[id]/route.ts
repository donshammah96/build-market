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
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  UpdateThreadSchema,
  MESSAGING_CONFIG,
  type MessagingActor,
  messagingService,
} from "@/app/lib/domains/messaging";
import {
  extractExpectedVersion,
  extractExpectedVersionFromIfMatch,
} from "@/app/lib/api/request-utils";
import { normalizeRole } from "@/app/lib/security/roles";

type ThreadParams = { id: string };

function toMessagingActor(context: {
  clerkId: string;
  dbUserId: string;
  userRole: unknown;
}): MessagingActor {
  return {
    clerkId: context.clerkId,
    userId: context.dbUserId,
    role: normalizeRole(String(context.userRole)) ?? null,
  };
}

/**
 * GET /api/messaging/conversations/[id]
 */
export const GET = withAuth<ThreadParams>(
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);

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
      () => messagingService.getConversation(actor, threadId),
      { operationName: "get_thread" },
    );

    if (!result.success) {
      getClientLogger().error("Project fetch failed", result.error, {
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
          "Invalid request",
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
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);

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
      IdempotencyService.generateKey(actor.userId, "PATCH", {
        domain: "messaging-thread",
        threadId,
        version: expectedVersion,
        ...data,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "messaging",
      actor.userId,
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
      () => messagingService.updateConversation(actor, threadId, data),
      { operationName: "update_thread" },
    );

    if (!result.success) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      getClientLogger().error("Failed to update thread", result.error, {
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
          "Invalid request",
          serviceResult?.status ?? HttpStatus.BAD_REQUEST,
        );
      }
      await safeIdempotencyComplete(idempotencyKey, serviceResult.data).catch(
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
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);

    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid conversation ID", HttpStatus.BAD_REQUEST);
    const threadId = params.id;

    const ifMatch = req.headers.get("If-Match");
    if (!ifMatch) {
      return apiError(
        "Missing If-Match header. Provide entity version in If-Match.",
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }

    const expectedVersion = extractExpectedVersionFromIfMatch(req);
    if (expectedVersion === null) {
      return apiError(
        "Invalid If-Match header. Provide a numeric version.",
        HttpStatus.BAD_REQUEST,
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
      () => messagingService.deleteConversation(actor, threadId),
      { operationName: "delete_thread" },
    );

    if (!result.success) {
      getClientLogger().error("Failed to delete thread", result.error, {
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
          "Invalid request",
          serviceResult?.status ?? HttpStatus.BAD_REQUEST,
        );
      }
      const payload = serviceResult.data as Record<string, unknown>;
      return apiSuccess({ ...payload, expectedVersion }, HttpStatus.OK);
    }
  },
);
