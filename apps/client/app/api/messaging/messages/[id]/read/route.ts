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
import { isValidId } from "@/app/lib/api/api-guards";
import {
  type MessagingActor,
  messagingService,
} from "@/app/lib/domains/messaging";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();

type MessageParams = { id: string };

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
 * POST /api/messaging/messages/[id]/read
 * Create a read receipt for a specific message.
 * The user must be a participant in the message's thread.
 */
export const POST = withAuth<MessageParams>(
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid message ID", HttpStatus.BAD_REQUEST);
    }
    const messageId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-read:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => messagingService.markMessageAsRead(actor, messageId),
      { operationName: "mark_message_read" },
    );

    if (!result.success) {
      logger.error("Failed to mark message as read", result.error, {
        correlationId,
        messageId,
      });
      return apiError(
        "Failed to mark as read",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data;
    if (!serviceResult || !serviceResult.ok) {
      return apiError(
        "Invalid request",
        serviceResult?.status ?? HttpStatus.BAD_REQUEST,
      );
    }

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);
