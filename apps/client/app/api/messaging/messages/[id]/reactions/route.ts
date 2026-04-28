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
  ReactionSchema,
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
 * POST /api/messaging/messages/[id]/reactions
 */
export const POST = withAuth<MessageParams>(
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);
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
      () => messagingService.addReaction(actor, messageId, parsed.data),
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
      const serviceResult = result.data;
      if (!serviceResult || !serviceResult.ok) {
        return apiError(
          "Invalid request",
          serviceResult?.status ?? HttpStatus.BAD_REQUEST,
        );
      }
      return apiSuccess(serviceResult.data, HttpStatus.CREATED);
    }
  },
);

/**
 * DELETE /api/messaging/messages/[id]/reactions
 */
export const DELETE = withAuth<MessageParams>(
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);
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

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => messagingService.removeReaction(actor, messageId),
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
      const serviceResult = result.data;
      if (!serviceResult || !serviceResult.ok) {
        return apiError(
          "Invalid request",
          serviceResult?.status ?? HttpStatus.BAD_REQUEST,
        );
      }
      return apiSuccess(serviceResult.data, HttpStatus.OK);
    }
  },
);
