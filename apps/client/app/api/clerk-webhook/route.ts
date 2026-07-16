import { Webhook } from "svix";
import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import { checkBodySize } from "@/app/lib/api/api-guards";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { env } from "@/app/lib/infrastructure/env";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  WEBHOOK_CONFIG,
  type ClerkWebhookEvent,
  type ClerkUserData,
  type ClerkSessionData,
  type HandledEventType,
} from "@/app/lib/validation/clerk-webhook-validation";
import { clerkIntegrationService } from "@/app/lib/integrations/clerk/service";
import {
  claimClerkWebhookDelivery,
  isWebhookTimestampFresh,
  markClerkWebhookDeliveryProcessed,
  releaseClerkWebhookDelivery,
} from "@/app/lib/infrastructure/webhook-replay";
import { applyPrivateNoStoreHeaders } from "@/app/lib/api/http-security";

function mapClerkWebhookResult<T extends { message: string }>(
  result:
    | { ok: true; data: T }
    | { ok: false; message?: string; status?: number; details?: unknown },
  correlationId: string,
) {
  if (!result.ok) {
    return apiError(
      result.message || "Webhook processing failed",
      result.status || HttpStatus.INTERNAL_SERVER_ERROR,
      result.details,
      correlationId,
    );
  }

  return apiSuccess(result.data, HttpStatus.OK, correlationId);
}

async function finalizeWebhookClaim(
  deliveryId: string | null,
  status: "processed" | "released",
) {
  if (!deliveryId) {
    return;
  }

  if (status === "processed") {
    await markClerkWebhookDeliveryProcessed(deliveryId);
    return;
  }

  await releaseClerkWebhookDelivery(deliveryId);
}

/**
 * POST /api/clerk-webhook
 *
 * Handles Clerk webhook events for user lifecycle management.
 *
 * Security:
 * - Svix signature verification
 * - Body size guard (256 KB max)
 * - Timestamp freshness validation
 * - Redis-backed replay and duplicate-delivery suppression
 * - Rate limiting (post-verification, scoped to source IP)
 */
export async function POST(req: NextRequest) {
  const correlationId = initializeCorrelationId(req);
  let claimedDeliveryId: string | null = null;
  const finalizeResponse = (response: NextResponse) =>
    applyPrivateNoStoreHeaders(response);

  getClientLogger().info("Clerk webhook request received", { correlationId });

  try {
    const sizeError = checkBodySize(req, WEBHOOK_CONFIG.MAX_PAYLOAD_SIZE);
    if (sizeError) {
      return finalizeResponse(sizeError);
    }

    if (!env.clerk.webhookSecret) {
      getClientLogger().error(
        "CLERK_WEBHOOK_SECRET not configured",
        undefined,
        {
          correlationId,
        },
      );
      return finalizeResponse(
        apiError(
          "Service configuration error",
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    }

    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    const missingSvixHeaders = WEBHOOK_CONFIG.REQUIRED_HEADERS.filter(
      (headerName) => !headers[headerName],
    );

    if (missingSvixHeaders.length > 0) {
      getClientLogger().warn("Missing Svix headers", {
        correlationId,
        missing: missingSvixHeaders,
        outcome: "rejected_missing_headers",
      });
      return finalizeResponse(
        apiError("Missing webhook signature headers", HttpStatus.BAD_REQUEST),
      );
    }

    const wh = new Webhook(env.clerk.webhookSecret);
    let event: ClerkWebhookEvent;

    try {
      event = wh.verify(payload, headers) as ClerkWebhookEvent;
    } catch (verifyError) {
      getClientLogger().error(
        "Webhook signature verification failed",
        verifyError instanceof Error
          ? verifyError
          : new Error(String(verifyError)),
        { correlationId, outcome: "rejected_bad_signature" },
      );
      return finalizeResponse(
        apiError("Invalid webhook signature", HttpStatus.UNAUTHORIZED),
      );
    }

    getClientLogger().info("Webhook signature verified", {
      correlationId,
      eventType: event.type,
    });

    const deliveryId = headers["svix-id"] ?? null;
    const timestampHeader = headers["svix-timestamp"] ?? null;

    if (
      !isWebhookTimestampFresh(timestampHeader, env.clerk.replayWindowSeconds)
    ) {
      getClientLogger().warn("Rejected stale webhook delivery", {
        correlationId,
        eventType: event.type,
        outcome: "rejected_stale",
      });
      return finalizeResponse(
        apiError("Stale webhook timestamp", HttpStatus.UNAUTHORIZED),
      );
    }

    try {
      const replayClaim = await claimClerkWebhookDelivery(deliveryId ?? "");
      if (replayClaim.status === "duplicate") {
        getClientLogger().info("Duplicate webhook delivery acknowledged", {
          correlationId,
          eventType: event.type,
          outcome: "duplicate",
        });
        return finalizeResponse(
          apiSuccess(
            { message: `Event ${event.type} acknowledged`, deduplicated: true },
            HttpStatus.OK,
            correlationId,
          ),
        );
      }

      claimedDeliveryId = replayClaim.deliveryId;
    } catch (replayError) {
      getClientLogger().error(
        "Webhook replay protection unavailable",
        replayError instanceof Error
          ? replayError
          : new Error(String(replayError)),
        {
          correlationId,
          eventType: event.type,
          outcome: "replay_store_unavailable",
        },
      );

      // In production, enforce strict replay protection; fail the request if the store is down.
      // In development/test environments, allow the webhook to execute undeduplicated for developer convenience.
      if (env.isProd) {
        return finalizeResponse(
          apiError(
            "Webhook replay protection unavailable",
            HttpStatus.SERVICE_UNAVAILABLE,
          ),
        );
      }
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `clerk-webhook:${identifier}`,
      RateLimits.WEBHOOK.limit,
      RateLimits.WEBHOOK.window,
    );
    if (!rateLimitResult.success) {
      getClientLogger().warn("Webhook rate limited", {
        correlationId,
        identifier,
        outcome: "rate_limited",
      });
      await finalizeWebhookClaim(claimedDeliveryId, "released");
      return finalizeResponse(
        apiError("Too many webhook requests", HttpStatus.TOO_MANY_REQUESTS),
      );
    }

    switch (event.type as HandledEventType) {
      case "user.created": {
        const result = await clerkIntegrationService.handleUserCreated(
          { correlationId },
          event.data as ClerkUserData,
        );
        await finalizeWebhookClaim(
          claimedDeliveryId,
          result.ok ? "processed" : "released",
        );
        return finalizeResponse(mapClerkWebhookResult(result, correlationId));
      }

      case "user.updated": {
        const result = await clerkIntegrationService.handleUserUpdated(
          { correlationId },
          event.data as ClerkUserData,
        );
        await finalizeWebhookClaim(
          claimedDeliveryId,
          result.ok ? "processed" : "released",
        );
        return finalizeResponse(mapClerkWebhookResult(result, correlationId));
      }

      case "user.deleted": {
        const result = await clerkIntegrationService.handleUserDeleted(
          { correlationId },
          event.data as ClerkUserData,
        );
        await finalizeWebhookClaim(
          claimedDeliveryId,
          result.ok ? "processed" : "released",
        );
        return finalizeResponse(mapClerkWebhookResult(result, correlationId));
      }

      case "session.created": {
        const result = await clerkIntegrationService.handleSessionCreated(
          { correlationId },
          event.data as ClerkSessionData,
        );
        await finalizeWebhookClaim(
          claimedDeliveryId,
          result.ok ? "processed" : "released",
        );
        return finalizeResponse(mapClerkWebhookResult(result, correlationId));
      }

      default:
        await finalizeWebhookClaim(claimedDeliveryId, "processed");
        getClientLogger().info("Unhandled event type acknowledged", {
          correlationId,
          eventType: event.type,
          outcome: "processed_unhandled",
        });
        return finalizeResponse(
          apiSuccess(
            { message: `Event ${event.type} acknowledged` },
            HttpStatus.OK,
            correlationId,
          ),
        );
    }
  } catch (error: unknown) {
    await finalizeWebhookClaim(claimedDeliveryId, "released").catch(
      () => undefined,
    );
    getClientLogger().error(
      "Webhook processing failed",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId, outcome: "released_on_failure" },
    );
    return finalizeResponse(
      apiError("Webhook processing failed", HttpStatus.INTERNAL_SERVER_ERROR),
    );
  }
}
