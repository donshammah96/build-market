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
 * POST /api/messaging/conversations/[id]/read
 */
export const POST = withAuth<ThreadParams>(
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);
    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid conversation ID", HttpStatus.BAD_REQUEST);
    const threadId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-read-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success)
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => messagingService.markThreadAsRead(actor, threadId),
      { operationName: "mark_thread_read" },
    );

    if (!result.success) {
      logger.error("Failed to mark thread read", result.error, {
        correlationId,
        threadId,
      });
      return apiError(
        "Failed to mark thread read",
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
