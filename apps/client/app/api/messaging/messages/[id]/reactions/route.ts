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
import { ReactionSchema } from "@/app/lib/validation/messaging-validation";

const logger = getClientLogger();
type MessageParams = { id: string };

/**
 * POST /api/messaging/messages/[id]/reactions
 */
export const POST = withAuth<MessageParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid message ID", HttpStatus.BAD_REQUEST);
    const messageId = params.id;

    const sizeError = checkBodySize(req, 8 * 1024);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const parsed = ReactionSchema.safeParse(body);
    if (!parsed.success)
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        parsed.error.issues,
      );

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-reaction-write:${identifier}`,
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
          select: { id: true },
        });
        if (!message)
          return {
            _error: true as const,
            message: "Message not found",
            status: HttpStatus.NOT_FOUND,
          };

        const reaction = await prisma.messageReaction.create({
          data: { messageId, userId: dbUserId, emoji: parsed.data.emoji },
          select: { id: true, emoji: true, userId: true },
        });
        return reaction;
      },
      { operationName: "create_reaction" },
    );

    if (!result.success) {
      logger.error("Failed to create reaction", result.error, {
        correlationId,
        messageId,
      });
      return apiError(
        "Failed to create reaction",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      const data = result.data;
      if (data && "_error" in (data as any) && (data as any)._error)
        return apiError((data as any).message, (data as any).status);
      return apiSuccess(data, HttpStatus.CREATED);
    }
  },
);

/**
 * DELETE /api/messaging/messages/[id]/reactions
 */
export const DELETE = withAuth<MessageParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid message ID", HttpStatus.BAD_REQUEST);
    const messageId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-reaction-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success)
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);

    let body: unknown = null;
    try {
      body = await req.json().catch(() => null);
    } catch {}

    const executor = getResilientExecutor();
    const result = await executor.execute(
      async () => {
        const reaction = await prisma.messageReaction.findFirst({
          where: { messageId, userId: dbUserId },
        });
        if (!reaction)
          return {
            _error: true as const,
            message: "Reaction not found",
            status: HttpStatus.NOT_FOUND,
          };
        await prisma.messageReaction.delete({ where: { id: reaction.id } });
        return { id: reaction.id, deleted: true };
      },
      { operationName: "delete_reaction" },
    );

    if (!result.success) {
      logger.error("Failed to delete reaction", result.error, {
        correlationId,
        messageId,
      });
      return apiError(
        "Failed to delete reaction",
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
