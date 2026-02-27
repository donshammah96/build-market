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

type MessageParams = { id: string };

/**
 * POST /api/messaging/messages/[id]/read
 * Create a read receipt for a specific message.
 * The user must be a participant in the message's thread.
 */
export const POST = withAuth<MessageParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

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
      async () => {
        // Find the message and verify it exists
        const message = await prisma.message.findFirst({
          where: { id: messageId, deletedAt: null },
          select: { id: true, threadId: true },
        });
        if (!message) {
          return { _error: true as const, message: "Message not found", status: HttpStatus.NOT_FOUND };
        }

        // Verify caller is a participant
        const participant = await prisma.threadParticipant.findUnique({
          where: {
            threadId_userId: { threadId: message.threadId, userId: dbUserId },
          },
          select: { id: true },
        });
        if (!participant) {
          return { _error: true as const, message: "Not a participant in this conversation", status: HttpStatus.FORBIDDEN };
        }

        // Upsert read receipt
        const receipt = await prisma.readReceipt.upsert({
          where: { messageId_userId: { messageId, userId: dbUserId } },
          update: { readAt: new Date() },
          create: { messageId, userId: dbUserId },
          select: {
            id: true,
            messageId: true,
            userId: true,
            readAt: true,
          },
        });

        return receipt;
      },
      { operationName: "mark_message_read" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to mark message as read", result.error, {
        correlationId,
        messageId,
      });
      return apiError("Failed to mark as read", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if ("_error" in result.data && result.data._error) {
      return apiError(
        (result.data as { message: string }).message,
        (result.data as { status: number }).status,
      );
    }

    return apiSuccess(result.data, HttpStatus.OK);
  },
);
