import { type NextRequest } from "next/server";
import {
  checkRateLimit,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  unsubscribe,
  toPublicSubscribeResult,
} from "@/app/lib/domains/newsletter";
import { NewsletterUnsubscribeSchema } from "@/app/lib/validation/newsletter-validation";
import {
  now,
  logNewsletterRouteOutcome,
  domainErrorCodeToStatus,
  newsletterDomainErrorToClientMessage,
} from "../shared";

/**
 * This single POST endpoint has two callers, both legitimate:
 *
 * 1. Mail providers doing RFC 8058 one-click unsubscribe. Gmail and Yahoo
 *    have required this since Feb 2024 for bulk senders: the provider's
 *    own "Unsubscribe" UI (not a link inside the email body) issues a
 *    POST directly to the URL in the List-Unsubscribe header — the same
 *    URL confirmation-email.worker.ts already sets, with the token as a
 *    query param — with a fixed body `List-Unsubscribe=One-Click` and
 *    content-type application/x-www-form-urlencoded. Per spec this MUST
 *    complete with no further user interaction, so the token is read
 *    from the query string and the (fixed, uninformative) body is
 *    ignored.
 *
 * 2. A human clicking the "Unsubscribe" link in the email footer, which
 *    opens the /newsletter/unsubscribe page. That page's client-side JS
 *    POSTs here with the token as JSON.
 *
 * Both cases end up calling the same idempotent unsubscribe() — a
 * mail-provider one-click hit and a human's own click racing each other
 * is harmless.
 */

const UNSUBSCRIBE_RATE_LIMIT = {
  limit: 10,
  window: 60_000,
} as const;

export async function POST(req: NextRequest) {
  const startMs = now();
  const correlationId = initializeCorrelationId(req);
  const logger = getClientLogger();

  const ip = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `newsletter-unsubscribe:ip:${ip}`,
    UNSUBSCRIBE_RATE_LIMIT.limit,
    UNSUBSCRIBE_RATE_LIMIT.window,
  );

  if (!rateLimitResult.success) {
    logNewsletterRouteOutcome({
      operationName: "unsubscribe",
      correlationId,
      outcome: "rate_limited",
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
      durationMs: now() - startMs,
    });
    // Even rate-limited, a one-click unsubscribe request should ideally
    // never be dropped — but 10/min per IP is generous enough that a
    // legitimate mail-provider hit is not expected to collide with it in
    // practice. If this ever becomes a problem, exempt requests carrying
    // the one-click content-type from the limit rather than removing it.
    return apiError(
      "Too many requests — try again in a minute",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const url = new URL(req.url);
  const tokenFromQuery = url.searchParams.get("token") ?? undefined;

  let token: string | undefined = tokenFromQuery;
  let reason: string | undefined;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const rawBody: unknown = await req.json().catch(() => null);
    const parsed = NewsletterUnsubscribeSchema.safeParse(rawBody);
    if (parsed.success) {
      token = parsed.data.token;
      reason = parsed.data.reason;
    }
  }
  // else: application/x-www-form-urlencoded one-click body
  // ("List-Unsubscribe=One-Click") carries no usable token — it's read
  // from the query string above instead, per the List-Unsubscribe-Post
  // URL that confirmation-email.worker.ts generates.

  if (!token) {
    logNewsletterRouteOutcome({
      operationName: "unsubscribe",
      correlationId,
      outcome: "validation_error",
      httpStatus: HttpStatus.BAD_REQUEST,
      durationMs: now() - startMs,
    });
    return apiError("Invalid unsubscribe link", HttpStatus.BAD_REQUEST);
  }

  let result;
  try {
    result = await unsubscribe({ token, reason });
  } catch (err) {
    logger.error(
      "Newsletter unsubscribe threw unexpectedly",
      err instanceof Error ? err : new Error(String(err)),
      { correlationId, operationName: "unsubscribe" },
    );
    return apiError(
      "Unsubscribe service temporarily unavailable",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  if (!result.ok) {
    const httpStatus = domainErrorCodeToStatus(result.error);
    const clientMessage = newsletterDomainErrorToClientMessage(
      result.error,
      "unsubscribe",
    );

    logNewsletterRouteOutcome({
      operationName: "unsubscribe",
      correlationId,
      outcome: "domain_error",
      httpStatus,
      durationMs: now() - startMs,
      domainError: result.error,
    });

    return apiError(clientMessage, httpStatus);
  }

  logNewsletterRouteOutcome({
    operationName: "unsubscribe",
    correlationId,
    outcome: "success",
    httpStatus: HttpStatus.OK,
    durationMs: now() - startMs,
  });

  return apiSuccess({
    ok: true,
    ...toPublicSubscribeResult(result.data.status),
  });
}
