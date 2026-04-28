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
  AddParticipantSchema,
  type MessagingActor,
  messagingService,
  UpdateParticipantSchema,
} from "@/app/lib/domains/messaging";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();
type Params = { id: string };

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
 * POST /api/messaging/conversations/[id]/participants
 */
export const POST = withAuth<Params>(
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);
    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid conversation ID", HttpStatus.BAD_REQUEST);
    const threadId = params.id;

    const sizeError = checkBodySize(req, 8 * 1024);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const parsed = AddParticipantSchema.safeParse(body);
    if (!parsed.success)
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        parsed.error.issues,
      );

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-participants-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success)
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => messagingService.addParticipant(actor, threadId, parsed.data),
      { operationName: "add_participant" },
    );

    if (!result.success) {
      logger.error("Failed to add participant", result.error, {
        correlationId,
        threadId,
      });
      return apiError(
        "Failed to add participant",
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

    return apiSuccess(serviceResult.data, HttpStatus.CREATED);
  },
);

/**
 * GET /api/messaging/conversations/[id]/participants
 */
export const GET = withAuth<Params>(
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);
    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid conversation ID", HttpStatus.BAD_REQUEST);
    const threadId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-participants-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success)
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => messagingService.listParticipants(actor, threadId),
      { operationName: "list_participants" },
    );

    if (!result.success) {
      logger.error("Failed to list participants", result.error, {
        correlationId,
        threadId,
      });
      return apiError(
        "Failed to list participants",
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

/**
 * PATCH /api/messaging/conversations/[id]/participants
 */
export const PATCH = withAuth<Params>(
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);
    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid conversation ID", HttpStatus.BAD_REQUEST);
    const threadId = params.id;

    const sizeError = checkBodySize(req, 8 * 1024);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const bodyObj = body as Record<string, unknown>;
    const userId =
      typeof bodyObj.userId === "string" ? bodyObj.userId : undefined;
    if (!userId || !isValidId(userId)) {
      return apiError(
        "Missing or invalid userId in body",
        HttpStatus.BAD_REQUEST,
      );
    }

    const parsed = UpdateParticipantSchema.safeParse(body);
    if (!parsed.success)
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        parsed.error.issues,
      );

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-participants-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success)
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () =>
        messagingService.updateParticipant(
          actor,
          threadId,
          userId,
          parsed.data,
        ),
      { operationName: "update_participant" },
    );

    if (!result.success) {
      logger.error("Failed to update participant", result.error, {
        correlationId,
        threadId,
      });
      return apiError(
        "Failed to update participant",
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

/**
 * DELETE /api/messaging/conversations/[id]/participants
 */
export const DELETE = withAuth<Params>(
  async (req: NextRequest, context, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);
    if (!params?.id || !isValidId(params.id))
      return apiError("Invalid conversation ID", HttpStatus.BAD_REQUEST);
    const threadId = params.id;

    let body: unknown = null;
    try {
      body = await req.json().catch(() => null);
    } catch {
      // Ignore JSON parse errors and treat as no body
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-participants-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success)
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);

    const executor = getResilientExecutor();
    const result = await executor.execute(
      async () => {
        if (!body || typeof body !== "object" || !("userId" in body)) {
          return {
            ok: false as const,
            error: "invalid_input" as const,
            message: "Missing userId in body",
            status: HttpStatus.BAD_REQUEST,
          };
        }

        const userId =
          typeof body.userId === "string" ? body.userId : undefined;
        if (!userId || !isValidId(userId)) {
          return {
            ok: false as const,
            error: "invalid_input" as const,
            message: "Missing or invalid userId in body",
            status: HttpStatus.BAD_REQUEST,
          };
        }

        return messagingService.removeParticipant(actor, threadId, userId);
      },
      { operationName: "delete_participant" },
    );

    if (!result.success) {
      logger.error("Failed to delete participant", result.error, {
        correlationId,
        threadId,
      });
      return apiError(
        "Failed to delete participant",
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
