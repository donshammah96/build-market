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
import {
  UpdateMessageSchema,
  MESSAGING_CONFIG,
  type MessagingActor,
  messagingService,
} from "@/app/lib/domains/messaging";
import { extractExpectedVersion } from "@/app/lib/api/request-utils";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();
type MessageParams = { id: string };

function toMessagingActor(context: {
  dbUserId: string;
  userRole: unknown;
}): MessagingActor {
  return {
    userId: context.dbUserId,
    role: normalizeRole(String(context.userRole)) ?? null,
  };
}

/**
 * GET /api/messaging/messages/[id]
 */
export const GET = withAuth<MessageParams>(
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    initializeCorrelationId(req);
    const actor = toMessagingActor(context);
    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid message ID", HttpStatus.BAD_REQUEST);
    const messageId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-message-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success)
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => messagingService.getMessage(actor, messageId),
      { operationName: "get_message" },
    );

    if (!result.success) {
      return apiError(
        "Failed to fetch message",
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
 * PATCH /api/messaging/messages/[id]
 */
export const PATCH = withAuth<MessageParams>(
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);
    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid message ID", HttpStatus.BAD_REQUEST);
    const messageId = params.id;

    const sizeError = checkBodySize(req, MESSAGING_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateMessageSchema.safeParse(body);
    if (!validation.success)
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );

    const expectedVersion = extractExpectedVersion(req, body);

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-message-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success)
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => messagingService.updateMessage(actor, messageId, validation.data),
      { operationName: "update_message" },
    );

    if (!result.success) {
      logger.error("Failed to update message", result.error, {
        correlationId,
        messageId,
      });
      return apiError(
        "Failed to update message",
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

/**
 * DELETE /api/messaging/messages/[id]
 */
export const DELETE = withAuth<MessageParams>(
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);
    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid message ID", HttpStatus.BAD_REQUEST);
    const messageId = params.id;

    // Safe parse body
    let body: unknown = null;
    try {
      body = await req.json().catch(() => null);
    } catch {
      // Ignore JSON parse errors and treat as no body
    }

    const expectedVersion = extractExpectedVersion(req, body);

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-message-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success)
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => messagingService.deleteMessage(actor, messageId),
      { operationName: "delete_message" },
    );

    if (!result.success) {
      logger.error("Failed to delete message", result.error, {
        correlationId,
        messageId,
      });
      return apiError(
        "Failed to delete message",
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
