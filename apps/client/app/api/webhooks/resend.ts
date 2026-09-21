import { createHmac, timingSafeEqual } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import { envConfig } from "@/app/lib/infrastructure/env";
import { newsletterRepository } from "@/app/lib/domains/newsletter/repository";

/**
 * Referenced in contracts.ts's ADR-005 operationName inventory
 * (esp_webhook_received) but never actually implemented in the uploaded
 * slice — repository.markSuppressed() existed with no caller. This
 * closes that gap.
 *
 * ASSUMPTION: envConfig.newsletter.resendWebhookSecret holds the
 * `whsec_...` signing secret from the Resend dashboard's webhook
 * settings — adjust the accessor to wherever that's actually configured.
 *
 * Resend signs webhooks using Svix, sending `svix-id`, `svix-timestamp`,
 * and `svix-signature` headers. Verifying this is not optional: without
 * it, anyone who finds this URL can POST a fabricated "email.complained"
 * event for an arbitrary address and get it silently marked COMPLAINED —
 * a trivial way to unsubscribe any competitor's customers, or your own,
 * from your list.
 */

const REPLAY_TOLERANCE_SECONDS = 300;

function verifySvixSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignatureHeader: string,
  secret: string,
): boolean {
  const timestampSeconds = Number(svixTimestamp);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > REPLAY_TOLERANCE_SECONDS
  ) {
    return false;
  }

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  // Svix secrets are distributed as "whsec_" + base64.
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expectedSignature = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");
  const expected = Buffer.from(expectedSignature, "base64");

  // Header format: space-separated "v1,<base64sig>" pairs — multiple
  // versions can be present during Resend's own secret rotation.
  return svixSignatureHeader
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter((sig): sig is string => Boolean(sig))
    .some((sig) => {
      try {
        const provided = Buffer.from(sig, "base64");
        return (
          provided.length === expected.length &&
          timingSafeEqual(provided, expected)
        );
      } catch {
        return false;
      }
    });
}

interface ResendWebhookPayload {
  type: string;
  data: {
    email?: string;
    [key: string]: unknown;
  };
}

export async function POST(req: NextRequest) {
  const startMs = Date.now();
  const correlationId = initializeCorrelationId(req);
  const logger = getClientLogger();

  const secret = envConfig.newsletter.resendWebhookSecret;
  if (!secret) {
    logger.error(
      "Resend webhook secret not configured",
      new Error("esp_misconfigured"),
      { correlationId },
    );
    // 500, not 200 — a silently-unconfigured webhook means bounces/
    // complaints never suppress anyone, which is a sender-reputation and
    // compliance problem, not something to swallow quietly.
    return apiError("Webhook not configured", HttpStatus.SERVICE_UNAVAILABLE);
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  // Signature verification needs the exact raw bytes that were signed —
  // reading via req.json() first and re-serializing would not
  // necessarily byte-match, so read text and parse only after verifying.
  const rawBody = await req.text();

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.warn("Resend webhook missing signature headers", {
      correlationId,
      routePattern: "/api/webhooks/resend",
      httpMethod: "POST",
      outcome: "validation_error",
      httpStatus: HttpStatus.BAD_REQUEST,
      durationMs: Date.now() - startMs,
    });
    return apiError("Missing signature headers", HttpStatus.BAD_REQUEST);
  }

  const isValid = verifySvixSignature(
    rawBody,
    svixId,
    svixTimestamp,
    svixSignature,
    secret,
  );

  if (!isValid) {
    logger.warn("Resend webhook signature verification failed", {
      correlationId,
      operationName: "esp_webhook_received",
      routePattern: "/api/webhooks/resend",
      httpMethod: "POST",
      outcome: "invalid_signature",
      httpStatus: HttpStatus.BAD_REQUEST,
      durationMs: Date.now() - startMs,
    });
    // 400 rather than a more specific 401 to avoid confirming to a
    // prober that this endpoint exists and cares about auth at all.
    return apiError("Invalid signature", HttpStatus.BAD_REQUEST);
  }

  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return apiError("Invalid payload", HttpStatus.BAD_REQUEST);
  }

  const email = payload.data?.email;

  switch (payload.type) {
    case "email.bounced":
    case "contact.bounced": {
      if (email) {
        await newsletterRepository.markSuppressed(email, "BOUNCED");
      }
      break;
    }
    case "email.complained":
    case "contact.complained": {
      if (email) {
        await newsletterRepository.markSuppressed(email, "COMPLAINED");
      }
      break;
    }
    default:
      // Unhandled event types (delivered, opened, clicked, etc.) are
      // expected and not an error — Resend sends every event type to
      // every configured webhook URL; there's no per-event-type
      // subscription filter at the endpoint level.
      break;
  }

  logger.info("Resend webhook processed", {
    correlationId,
    operationName: "esp_webhook_received",
    routePattern: "/api/webhooks/resend",
    httpMethod: "POST",
    outcome: payload.type,
    httpStatus: HttpStatus.OK,
    durationMs: Date.now() - startMs,
  });

  return apiSuccess({ ok: true });
}
