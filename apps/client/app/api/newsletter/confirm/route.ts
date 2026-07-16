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
import { confirmSubscription } from "@/app/lib/domains/newsletter/service";
import { NewsletterConfirmSchema } from "@/app/lib/validation/newsletter-validation";
import {
  now,
  logNewsletterRouteOutcome,
  domainErrorCodeToStatus,
  newsletterDomainErrorToClientMessage,
} from "../shared";

/**
 * POST, not GET, despite the link in the confirmation email pointing to a
 * URL with the token in a query string. The *page* at /newsletter/confirm
 * is what that link opens (a plain, non-mutating GET render); the page's
 * client-side JS is what calls this endpoint. Corporate email security
 * gateways and some mail clients prefetch every link in an email body to
 * scan it before the user opens the message — if this route mutated
 * state on GET, that prefetch would silently consume the confirmation
 * token before the real user ever clicked anything. Requiring a POST
 * that only a JS-executing browser will issue avoids that class of bug
 * entirely, on top of confirmSubscription() itself now being idempotent
 * as defense in depth. See NEWSLETTER_AUDIT_AND_PLAN.md.
 */

const CONFIRM_RATE_LIMIT = {
  limit: 10,
  window: 60_000, // 10 requests per minute per IP — generous since tokens
  // are 256-bit random and brute forcing one via this endpoint is
  // computationally infeasible; this limit exists to blunt casual abuse/
  // scripted hammering, not to defend token secrecy.
} as const;

export async function POST(req: NextRequest) {
  const startMs = now();
  const correlationId = initializeCorrelationId(req);
  const logger = getClientLogger();

  const ip = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `newsletter-confirm:ip:${ip}`,
    CONFIRM_RATE_LIMIT.limit,
    CONFIRM_RATE_LIMIT.window,
  );

  if (!rateLimitResult.success) {
    logNewsletterRouteOutcome({
      operationName: "confirm_subscription",
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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return apiError("Invalid request body", HttpStatus.BAD_REQUEST);
  }

  const parsed = NewsletterConfirmSchema.safeParse(rawBody);
  if (!parsed.success) {
    logNewsletterRouteOutcome({
      operationName: "confirm_subscription",
      correlationId,
      outcome: "validation_error",
      httpStatus: HttpStatus.BAD_REQUEST,
      durationMs: now() - startMs,
    });
    return apiError("Invalid confirmation link", HttpStatus.BAD_REQUEST);
  }

  let result;
  try {
    result = await confirmSubscription({ token: parsed.data.token });
  } catch (err) {
    logger.error(
      "Newsletter confirm threw unexpectedly",
      err instanceof Error ? err : new Error(String(err)),
      { correlationId, operationName: "confirm_subscription" },
    );
    return apiError(
      "Confirmation service temporarily unavailable",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  if (!result.ok) {
    const httpStatus = domainErrorCodeToStatus(result.error);
    const clientMessage = newsletterDomainErrorToClientMessage(
      result.error,
      "confirm",
    );

    logNewsletterRouteOutcome({
      operationName: "confirm_subscription",
      correlationId,
      outcome: "domain_error",
      httpStatus,
      durationMs: now() - startMs,
      domainError: result.error,
    });

    return apiError(clientMessage, httpStatus);
  }

  logNewsletterRouteOutcome({
    operationName: "confirm_subscription",
    correlationId,
    outcome: "success",
    httpStatus: HttpStatus.OK,
    durationMs: now() - startMs,
  });

  return apiSuccess({ ok: true, status: result.data.status });
}
