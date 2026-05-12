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
  SendMessageSchema,
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
 * POST /api/messaging/messages
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
      IdempotencyService.generateKey(actor.userId, "POST", {
        domain: "messaging-message",
        threadId: data.threadId,
        content: data.content.substring(0, 100),
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "messaging",
      actor.userId,
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
      () => messagingService.sendMessage(actor, data),
      { operationName: "send_message" },
    );

    if (!result.success) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      getClientLogger().error("Failed to send message", result.error, {
        correlationId,
        actorRole: actor.role,
        threadId: data.threadId,
      });
      return apiError(
        "Failed to send message",
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
      await safeIdempotencyComplete(idempotencyKey, serviceResult.data).catch(
        () => {},
      );
      return apiSuccess(serviceResult.data, HttpStatus.CREATED);
    }
  },
);
