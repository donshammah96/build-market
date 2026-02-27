import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
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
  MessageQuerySchema,
  messageListSelect,
} from "@/app/lib/validation/messaging-validation";

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

    const { cursor, limit, direction } = queryValidation.data;

    const executor = getResilientExecutor();
    const result = await executor.execute(
      async () => {
        const participant = await prisma.threadParticipant.findUnique({
          where: { threadId_userId: { threadId, userId: dbUserId } },
          select: { id: true },
        });
        if (!participant)
          return {
            _error: true as const,
            message: "Not a participant in this conversation",
            status: HttpStatus.FORBIDDEN,
          };

        let cursorCondition = {};
        if (cursor) {
          const cursorMessage = await prisma.message.findUnique({
            where: { id: cursor },
            select: { createdAt: true },
          });
          if (cursorMessage) {
            cursorCondition = {
              createdAt:
                direction === "before"
                  ? { lt: cursorMessage.createdAt }
                  : { gt: cursorMessage.createdAt },
            };
          }
        }

        const messages = await prisma.message.findMany({
          where: { threadId, deletedAt: null, ...cursorCondition },
          select: messageListSelect,
          orderBy: { createdAt: direction === "before" ? "desc" : "asc" },
          take: limit + 1,
        });

        const hasMore = messages.length > limit;
        const items = hasMore ? messages.slice(0, limit) : messages;
        if (direction === "before") items.reverse();

        return {
          messages: items,
          hasMore,
          nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
        };
      },
      { operationName: "list_thread_messages" },
    );

    if (!result.success) {
      logger.error("Failed to fetch messages", result.error, { threadId });
      return apiError(
        "Failed to fetch messages",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      const data = result.data;
      if (data && "_error" in (data as any) && (data as any)._error)
        return apiError((data as any).message, (data as any).status);
      return apiSuccess(data, HttpStatus.OK);
    }
  },
);
