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
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  SendMessageSchema,
  messageListSelect,
  MESSAGING_CONFIG,
} from "@/app/lib/validation/messaging-validation";

const logger = getClientLogger();

/**
 * POST /api/messaging/messages
 */
export const POST = withAuth(
  async (req: NextRequest, { dbUserId }): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    const sizeError = checkBodySize(req, MESSAGING_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = SendMessageSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }
    const data = validation.data;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "POST", {
        domain: "messaging-message",
        threadId: data.threadId,
        content: data.content.substring(0, 100),
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "messaging",
      dbUserId,
      "POST",
    );
    if (!idempotencyCheck)
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    if (idempotencyCheck.status === "completed")
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    if (idempotencyCheck.status === "pending")
      return apiError("Message is being processed", HttpStatus.CONFLICT);

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-send:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      async () => {
        const participant = await prisma.threadParticipant.findUnique({
          where: {
            threadId_userId: { threadId: data.threadId, userId: dbUserId },
          },
          select: { id: true },
        });
        if (!participant)
          return {
            _error: true as const,
            message: "Not a participant in this conversation",
            status: HttpStatus.FORBIDDEN,
          };

        const thread = await prisma.messageThread.findFirst({
          where: { id: data.threadId, deletedAt: null },
          select: { id: true },
        });
        if (!thread)
          return {
            _error: true as const,
            message: "Conversation not found",
            status: HttpStatus.NOT_FOUND,
          };

        if (data.replyToId) {
          const replyMessage = await prisma.message.findFirst({
            where: {
              id: data.replyToId,
              threadId: data.threadId,
              deletedAt: null,
            },
            select: { id: true },
          });
          if (!replyMessage)
            return {
              _error: true as const,
              message: "Reply target message not found in this conversation",
              status: HttpStatus.BAD_REQUEST,
            };
        }

        if (data.attachmentIds && data.attachmentIds.length > 0) {
          const assets = await prisma.asset.findMany({
            where: { id: { in: data.attachmentIds }, uploaderId: dbUserId },
            select: { id: true },
          });
          if (assets.length !== data.attachmentIds.length)
            return {
              _error: true as const,
              message:
                "One or more attachment assets not found or not owned by you",
              status: HttpStatus.BAD_REQUEST,
            };
        }

        return prisma.$transaction(async (tx) => {
          const message = await tx.message.create({
            data: {
              threadId: data.threadId,
              senderId: dbUserId,
              content: data.content,
              type: data.type,
              replyToId: data.replyToId,
              ...(data.attachmentIds?.length
                ? {
                    attachments: {
                      create: data.attachmentIds.map((assetId) => ({
                        assetId,
                      })),
                    },
                  }
                : {}),
            },
            select: messageListSelect,
          });

          await tx.messageThread.update({
            where: { id: data.threadId },
            data: {
              lastMessage: data.content.substring(0, 500),
              lastMessageAt: new Date(),
            },
          });

          await tx.threadParticipant.updateMany({
            where: { threadId: data.threadId, userId: { not: dbUserId } },
            data: { unreadCount: { increment: 1 } },
          });

          await tx.readReceipt.upsert({
            where: {
              messageId_userId: { messageId: message.id, userId: dbUserId },
            },
            update: { readAt: new Date() },
            create: { messageId: message.id, userId: dbUserId },
          });

          return message;
        });
      },
      { operationName: "send_message" },
    );

    if (!result.success) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      logger.error("Failed to send message", result.error, {
        correlationId,
        userId: dbUserId,
        threadId: data.threadId,
      });
      return apiError(
        "Failed to send message",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      const data = result.data;
      if (data && "_error" in (data as any) && (data as any)._error) {
        await IdempotencyService.fail(idempotencyKey).catch(() => {});
        return apiError((data as any).message, (data as any).status);
      }
      await IdempotencyService.complete(idempotencyKey, data).catch(() => {});
      return apiSuccess(data, HttpStatus.CREATED);
    }
  },
);
