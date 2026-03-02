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

const logger = getClientLogger();
type ThreadParams = { id: string };

/**
 * POST /api/messaging/conversations/[id]/read
 */
export const POST = withAuth<ThreadParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
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
      async () => {
        const participant = await prisma.threadParticipant.findUnique({
          where: { threadId_userId: { threadId, userId: dbUserId } },
        });
        if (!participant)
          return {
            _error: true as const,
            message: "Not a participant",
            status: HttpStatus.FORBIDDEN,
          };
        await prisma.threadParticipant.update({
          where: { id: participant.id },
          data: { unreadCount: 0, lastReadAt: new Date() },
        });
        return { success: true };
      },
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
    } else {
      const data = result.data;
      if (data && "_error" in (data as any) && (data as any)._error)
        return apiError((data as any).message, (data as any).status);
      return apiSuccess(data, HttpStatus.OK);
    }
  },
);
