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
  ThreadQuerySchema,
  CreateThreadSchema,
  threadDetailSelect,
  threadListSelect,
  MESSAGING_CONFIG,
} from "@/app/lib/validation/messaging-validation";

const logger = getClientLogger();

/**
 * GET /api/messaging/conversations
 */
export const GET = withAuth(
  async (req: NextRequest, { dbUserId }): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-thread-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const { searchParams } = new URL(req.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    const queryValidation = ThreadQuerySchema.safeParse(rawParams);
    if (!queryValidation.success) {
      logger.warn("Thread query validation failed", {
        correlationId,
        errors: queryValidation.error.issues,
      });
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        queryValidation.error.issues,
      );
    }

    const { type, isArchived, search, page, limit } = queryValidation.data;

    const executor = getResilientExecutor();
    const result = await executor.execute(
      async () => {
        const where = {
          deletedAt: null,
          participants: {
            some: {
              userId: dbUserId,
              ...(isArchived !== undefined ? { isArchived } : {}),
            },
          },
          ...(type ? { type } : {}),
          ...(search
            ? {
                OR: [
                  {
                    subject: { contains: search, mode: "insensitive" as const },
                  },
                  {
                    lastMessage: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
        };

        const skip = (page - 1) * limit;
        const [threads, total] = await Promise.all([
          prisma.messageThread.findMany({
            where,
            select: threadListSelect,
            orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
            skip,
            take: limit,
          }),
          prisma.messageThread.count({ where }),
        ]);

        return {
          threads,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
      { operationName: "list_threads" },
    );

    if (!result.success) {
      logger.error("Failed to fetch threads", result.error, {
        correlationId,
        userId: dbUserId,
      });
      return apiError(
        "Failed to fetch conversations",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      const data = result.data;
      if (data && "_error" in (data as any) && (data as any)._error) {
        return apiError(
          (data as any).message || "Invalid request",
          (data as any).status || HttpStatus.BAD_REQUEST,
        );
      }
      return apiSuccess(data, HttpStatus.OK);
    }
  },
);

/**
 * POST /api/messaging/conversations
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

    const validation = CreateThreadSchema.safeParse(body);
    if (!validation.success) {
      logger.warn("Create thread validation failed", {
        correlationId,
        errors: validation.error.issues,
      });
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
        domain: "messaging-thread",
        participants: [...data.participantIds].sort(),
        type: data.type,
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
      return apiError("Request is being processed", HttpStatus.CONFLICT);

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `messaging-thread-write:${identifier}`,
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
        const existingUsers = await prisma.user.findMany({
          where: { id: { in: data.participantIds } },
          select: { id: true },
        });
        const existingIds = new Set(existingUsers.map((u) => u.id));
        const missingIds = data.participantIds.filter(
          (id) => !existingIds.has(id),
        );
        if (missingIds.length > 0) {
          return {
            _error: true as const,
            message: `Users not found: ${missingIds.join(", ")}`,
            status: HttpStatus.BAD_REQUEST,
          };
        }

        const allParticipantIds = Array.from(
          new Set([dbUserId, ...data.participantIds]),
        );

        if (data.type === "DIRECT" && allParticipantIds.length === 2) {
          const otherUserId = allParticipantIds.find((id) => id !== dbUserId)!;
          const existingThread = await prisma.messageThread.findFirst({
            where: {
              type: "DIRECT",
              deletedAt: null,
              AND: [
                { participants: { some: { userId: dbUserId } } },
                { participants: { some: { userId: otherUserId } } },
              ],
            },
            select: threadDetailSelect,
          });
          if (existingThread) return existingThread;
        }

        if (data.projectId) {
          const project = await prisma.project.findUnique({
            where: { id: data.projectId },
            select: { id: true },
          });
          if (!project) {
            return {
              _error: true as const,
              message: "Project not found",
              status: HttpStatus.BAD_REQUEST,
            };
          }
        }

        return prisma.messageThread.create({
          data: {
            type: data.type,
            subject: data.subject,
            projectId: data.projectId,
            participants: {
              create: allParticipantIds.map((userId) => ({
                userId,
                role: userId === dbUserId ? "OWNER" : "MEMBER",
              })),
            },
          },
          select: threadDetailSelect,
        });
      },
      { operationName: "create_thread" },
    );

    if (!result.success) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      logger.error("Failed to create thread", result.error, {
        correlationId,
        userId: dbUserId,
      });
      return apiError(
        "Failed to create conversation",
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
