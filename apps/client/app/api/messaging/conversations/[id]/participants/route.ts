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
import {
  AddParticipantSchema,
  UpdateParticipantSchema,
} from "@/app/lib/validation/messaging-validation";

const logger = getClientLogger();
type Params = { id: string };

/**
 * POST /api/messaging/conversations/[id]/participants
 */
export const POST = withAuth<Params>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
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
      async () => {
        const thread = await prisma.messageThread.findFirst({
          where: { id: threadId, deletedAt: null },
          select: { id: true },
        });
        if (!thread)
          return {
            _error: true as const,
            message: "Conversation not found",
            status: HttpStatus.NOT_FOUND,
          };

        const existing = await prisma.threadParticipant.findFirst({
          where: { threadId, userId: parsed.data.userId },
        });
        if (existing)
          return {
            _error: true as const,
            message: "Participant already exists",
            status: HttpStatus.CONFLICT,
          };

        return prisma.threadParticipant.create({
          data: {
            threadId,
            userId: parsed.data.userId,
            role: parsed.data.role,
          },
          select: { id: true, userId: true, role: true },
        });
      },
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
    } else {
      const data = result.data;
      if (data && "_error" in (data as any) && (data as any)._error)
        return apiError((data as any).message, (data as any).status);
      return apiSuccess(data, HttpStatus.CREATED);
    }
  },
);

/**
 * GET /api/messaging/conversations/[id]/participants
 */
export const GET = withAuth<Params>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
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
      async () => {
        const participants = await prisma.threadParticipant.findMany({
          where: { threadId },
          select: { id: true, userId: true, role: true, nickname: true },
        });
        return participants;
      },
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
    } else {
      const data = result.data;
      if (data && "_error" in (data as any) && (data as any)._error)
        return apiError((data as any).message, (data as any).status);
      return apiSuccess(data, HttpStatus.OK);
    }
  },
);

/**
 * PATCH /api/messaging/conversations/[id]/participants
 */
export const PATCH = withAuth<Params>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
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
      async () => {
        // Extract userId from body (UpdateParticipantSchema does not include userId)
        const bodyObj = body as Record<string, unknown>;
        const userId =
          typeof bodyObj.userId === "string" ? bodyObj.userId : undefined;
        if (!userId || !isValidId(userId)) {
          return {
            _error: true as const,
            message: "Missing or invalid userId in body",
            status: HttpStatus.BAD_REQUEST,
          };
        }

        // Update participant record
        const updated = await prisma.threadParticipant.updateMany({
          where: { threadId, userId },
          data: parsed.data,
        });
        if (updated.count === 0)
          return {
            _error: true as const,
            message: "Participant not found",
            status: HttpStatus.NOT_FOUND,
          };
        return { updated: true };
      },
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
    } else {
      const data = result.data;
      if (data && "_error" in (data as any) && (data as any)._error)
        return apiError((data as any).message, (data as any).status);
      return apiSuccess(data, HttpStatus.OK);
    }
  },
);

/**
 * DELETE /api/messaging/conversations/[id]/participants
 */
export const DELETE = withAuth<Params>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
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
        // Expect body to contain { userId: string }
        if (!body || typeof body !== "object" || !("userId" in (body as any))) {
          return {
            _error: true as const,
            message: "Missing userId in body",
            status: HttpStatus.BAD_REQUEST,
          };
        }
        const userId = (body as any).userId;
        const existing = await prisma.threadParticipant.findFirst({
          where: { threadId, userId },
        });
        if (!existing)
          return {
            _error: true as const,
            message: "Participant not found",
            status: HttpStatus.NOT_FOUND,
          };
        await prisma.threadParticipant.delete({ where: { id: existing.id } });
        return { id: existing.id, deleted: true };
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
    } else {
      const data = result.data;
      if (data && "_error" in (data as any) && (data as any)._error)
        return apiError((data as any).message, (data as any).status);
      return apiSuccess(data, HttpStatus.OK);
    }
  },
);
