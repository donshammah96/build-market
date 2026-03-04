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
import { MessageQuerySchema, messagingService } from "@build/messaging-server";

const logger = getClientLogger();
type ConversationParams = { conversationId: string };

/**
 * GET /api/messaging/messages/conversation/[conversationId]
 */
export const GET = withAuth<ConversationParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    if (!params?.conversationId || !isValidId(params.conversationId))
      return apiError("Invalid conversation ID", HttpStatus.BAD_REQUEST);
    const threadId = params.conversationId;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-messages-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success)
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);

    const { searchParams } = new URL(req.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    const queryValidation = MessageQuerySchema.safeParse(rawParams);
    if (!queryValidation.success)
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        queryValidation.error.issues,
      );

    const query = queryValidation.data;

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () =>
        messagingService.listConversationMessages(dbUserId, threadId, query),
      { operationName: "list_thread_messages" },
    );

    if (!result.success) {
      logger.error("Failed to fetch messages", result.error, { threadId });
      return apiError(
        "Failed to fetch messages",
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
