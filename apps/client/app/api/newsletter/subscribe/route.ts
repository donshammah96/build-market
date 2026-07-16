import { type NextRequest } from "next/server";
import { createHash } from "crypto";
import {
  checkRateLimit,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import { subscribe } from "@/app/lib/domains/newsletter/service";
import { NewsletterSubscribeSchema } from "@/app/lib/validation/newsletter-validation";
import {
  now,
  logNewsletterRouteOutcome,
  domainErrorCodeToStatus,
  newsletterDomainErrorToClientMessage,
} from "../shared";

const NEWSLETTER_RATE_LIMIT = {
  limit: 5,
  window: 60_000, // 5 requests per minute per IP
} as const;

export async function POST(req: NextRequest) {
  const startMs = now();
  const correlationId = initializeCorrelationId(req);
  const logger = getClientLogger();

  // ── Rate limiting (IP) ──────────────────────────────────────────────────────
  const ip = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `newsletter-subscribe:ip:${ip}`,
    NEWSLETTER_RATE_LIMIT.limit,
    NEWSLETTER_RATE_LIMIT.window,
  );

  if (!rateLimitResult.success) {
    logNewsletterRouteOutcome({
      operationName: "subscribe",
      correlationId,
      outcome: "rate_limited",
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
      durationMs: now() - startMs,
    });
    return apiError(
      "Too many requests — try again in a minute",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // ── Parse & validate body ──────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return apiError("Invalid request body", HttpStatus.BAD_REQUEST);
  }

  const parsed = NewsletterSubscribeSchema.safeParse(rawBody);
  if (!parsed.success) {
    logNewsletterRouteOutcome({
      operationName: "subscribe",
      correlationId,
      outcome: "validation_error",
      httpStatus: HttpStatus.BAD_REQUEST,
      durationMs: now() - startMs,
    });
    return apiError("Invalid submission", HttpStatus.BAD_REQUEST);
  }

  // ── Honeypot check ─────────────────────────────────────────────────────────
  if (parsed.data.company && parsed.data.company.length > 0) {
    logNewsletterRouteOutcome({
      operationName: "subscribe",
      correlationId,
      outcome: "validation_error",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startMs,
    });
    return apiSuccess({ ok: true });
  }

  // ── Rate limiting (Email Hash) ─────────────────────────────────────────────
  const emailHash = createHash("sha256")
    .update(parsed.data.email.toLowerCase().trim())
    .digest("hex");
  const emailRateLimitResult = await checkRateLimit(
    `newsletter-subscribe:email:${emailHash}`,
    3, // 3 requests
    60_000, // per minute per email
  );

  if (!emailRateLimitResult.success) {
    logNewsletterRouteOutcome({
      operationName: "subscribe",
      correlationId,
      outcome: "rate_limited",
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
      durationMs: now() - startMs,
    });
    return apiError(
      "Too many requests — try again in a minute",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // ── Domain call ────────────────────────────────────────────────────────────
  let result;
  try {
    result = await subscribe({
      email: parsed.data.email,
      ipAddress: ip !== "anonymous" ? ip : undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      source: parsed.data.source ?? "footer",
    });
  } catch (err) {
    logger.error(
      "Newsletter subscribe threw unexpectedly",
      err instanceof Error ? err : new Error(String(err)),
      {
        correlationId,
        operationName: "newsletter_subscribe",
      },
    );
    return apiError(
      "Subscription service temporarily unavailable",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  if (!result.ok) {
    const httpStatus = domainErrorCodeToStatus(result.error);
    const clientMessage = newsletterDomainErrorToClientMessage(
      result.error,
      "subscribe",
    );

    logNewsletterRouteOutcome({
      operationName: "subscribe",
      correlationId,
      outcome: "domain_error",
      httpStatus,
      durationMs: now() - startMs,
      domainError: result.error,
    });

    return apiError(clientMessage, httpStatus);
  }

  // ── Success ────────────────────────────────────────────────────────────────
  logNewsletterRouteOutcome({
    operationName: "subscribe",
    correlationId,
    outcome: "success",
    httpStatus: HttpStatus.OK,
    durationMs: now() - startMs,
  });

  return apiSuccess({ ok: true, status: result.data.status });
}
