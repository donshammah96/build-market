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
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  UpdateMessageSchema,
  messageDetailSelect,
  MESSAGING_CONFIG,
} from "@/app/lib/validation/messaging-validation";
import { extractExpectedVersion } from "@/app/lib/api/request-utils";

const logger = getClientLogger();
type MessageParams = { id: string };

/**
 * GET /api/messaging/messages/[id]
 */
export const GET = withAuth<MessageParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
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
      async () => {
        const message = await prisma.message.findFirst({
          where: { id: messageId, deletedAt: null },
          select: messageDetailSelect,
        });
        if (!message)
          return {
            _error: true as const,
            message: "Message not found",
            status: HttpStatus.NOT_FOUND,
          };

        const participant = await prisma.threadParticipant.findUnique({
          where: {
            threadId_userId: { threadId: message.threadId, userId: dbUserId },
          },
          select: { id: true },
        });
        if (!participant)
          return {
            _error: true as const,
            message: "Not a participant in this conversation",
            status: HttpStatus.FORBIDDEN,
          };

        return message;
      },
      { operationName: "get_message" },
    );

    if (!result.success) {
      return apiError(
        "Failed to fetch message",
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

/**
 * PATCH /api/messaging/messages/[id]
 */
export const PATCH = withAuth<MessageParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
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
      async () => {
        const message = await prisma.message.findFirst({
          where: { id: messageId, deletedAt: null },
          select: { id: true, senderId: true },
        });
        if (!message)
          return {
            _error: true as const,
            message: "Message not found",
            status: HttpStatus.NOT_FOUND,
          };
        if (message.senderId !== dbUserId)
          return {
            _error: true as const,
            message: "Only the sender can edit a message",
            status: HttpStatus.FORBIDDEN,
          };

        return prisma.message.update({
          where: { id: messageId },
          data: { content: validation.data.content },
          select: messageDetailSelect,
        });
      },
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
      const data = result.data;
      if (data && "_error" in (data as any) && (data as any)._error)
        return apiError((data as any).message, (data as any).status);
      return apiSuccess(data, HttpStatus.OK);
    }
  },
);

/**
 * DELETE /api/messaging/messages/[id]
 */
export const DELETE = withAuth<MessageParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
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
      async () => {
        const message = await prisma.message.findFirst({
          where: { id: messageId, deletedAt: null },
          select: { id: true, senderId: true, threadId: true },
        });
        if (!message)
          return {
            _error: true as const,
            message: "Message not found",
            status: HttpStatus.NOT_FOUND,
          };

        if (message.senderId !== dbUserId) {
          const participant = await prisma.threadParticipant.findUnique({
            where: {
              threadId_userId: { threadId: message.threadId, userId: dbUserId },
            },
            select: { role: true },
          });
          if (!participant)
            return {
              _error: true as const,
              message: "Not a participant",
              status: HttpStatus.FORBIDDEN,
            };
          if (participant.role !== "OWNER" && participant.role !== "ADMIN")
            return {
              _error: true as const,
              message: "Only the sender or thread admins can delete messages",
              status: HttpStatus.FORBIDDEN,
            };
        }

        await prisma.message.update({
          where: { id: messageId },
          data: { deletedAt: new Date() },
        });
        return { id: messageId, deleted: true, expectedVersion };
      },
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
      const data = result.data;
      if (data && "_error" in (data as any) && (data as any)._error)
        return apiError((data as any).message, (data as any).status);
      return apiSuccess(data, HttpStatus.OK);
    }
  },
);
