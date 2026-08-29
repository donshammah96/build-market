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
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  ThreadQuerySchema,
  CreateThreadSchema,
  MESSAGING_CONFIG,
  type MessagingActor,
  messagingService,
} from "@/app/lib/domains/messaging";
import { normalizeRole } from "@/app/lib/security/roles";

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
 * GET /api/messaging/conversations
 */
export const GET = withAuth(
  async (req: NextRequest, context): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);

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
      getClientLogger().warn("Thread query validation failed", {
        correlationId,
        errors: queryValidation.error.issues,
      });
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        queryValidation.error.issues,
      );
    }

    const query = queryValidation.data;

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => messagingService.listConversations(actor, query),
      { operationName: "list_threads" },
    );

    if (!result.success) {
      getClientLogger().error("Failed to fetch threads", result.error, {
        correlationId,
        actorRole: actor.role,
      });
      return apiError(
        "Failed to fetch conversations",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      const serviceResult = result.data;
      if (!serviceResult || !serviceResult.ok) {
        return apiError(
          "Invalid request",
          serviceResult?.status || HttpStatus.BAD_REQUEST,
        );
      }
      return apiSuccess(serviceResult.data, HttpStatus.OK);
    }
  },
);

/**
 * POST /api/messaging/conversations
 */
export const POST = withAuth(
  async (req: NextRequest, context): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const actor = toMessagingActor(context);

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
      getClientLogger().warn("Create thread validation failed", {
        correlationId,
        errors: validation.error.issues,
      });
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }
    const input = validation.data;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(actor.userId, "POST", {
        domain: "messaging-thread",
        participants: [...input.participantIds].sort(),
        type: input.type,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "messaging",
      actor.userId,
      "POST",
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
      () => messagingService.createConversation(actor, input),
      { operationName: "create_thread" },
    );

    if (!result.success) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      getClientLogger().error("Failed to create thread", result.error, {
        correlationId,
        actorRole: actor.role,
      });
      return apiError(
        "Failed to create conversation",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      const serviceResult = result.data;
      if (!serviceResult || !serviceResult.ok) {
        await IdempotencyService.fail(idempotencyKey).catch(() => {});
        return apiError(
          "Invalid request",
          serviceResult?.status ?? HttpStatus.BAD_REQUEST,
        );
      }
      await safeIdempotencyComplete(idempotencyKey, serviceResult.data);
      return apiSuccess(serviceResult.data, HttpStatus.CREATED);
    }
  },
);
