import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { normalizeRole } from "@/app/lib/security/roles";

export type NewsletterRouteOutcome =
  | "success"
  | "domain_error"
  | "validation_error"
  | "rate_limited"
  | "internal_error";

type RouteLogInput = {
  operationName: string;
  correlationId: string;
  actorRole?: string | null;
  outcome: NewsletterRouteOutcome;
  httpStatus: number;
  durationMs: number;
  domainError?: string;
  resourceId?: string;
};

export function now(): number {
  return Date.now();
}

export function actorRoleLabel(role?: string | null): string {
  if (!role) return "anonymous";
  return normalizeRole(role) ?? String(role).toLowerCase();
}

export type NewsletterOperation = "subscribe" | "confirm" | "unsubscribe";

export function domainErrorCodeToStatus(code: string): number {
  switch (code) {
    case "invalid_email":
    case "suppressed":
    case "invalid_token":
    case "token_expired":
      return HttpStatus.BAD_REQUEST;
    case "resubscribe_cooldown":
      return HttpStatus.TOO_MANY_REQUESTS;
    default:
      return HttpStatus.SERVICE_UNAVAILABLE;
  }
}

export function newsletterDomainErrorToClientMessage(
  code: string,
  operation: NewsletterOperation,
): string {
  switch (code) {
    case "invalid_email":
      return "Invalid submission";
    case "suppressed":
      return "This address cannot be resubscribed automatically";
    case "resubscribe_cooldown":
      return "Please wait a few minutes before trying again";
    case "invalid_token":
      return operation === "confirm"
        ? "This confirmation link is invalid"
        : "This unsubscribe link is invalid";
    case "token_expired":
      return "This confirmation link has expired — please subscribe again";
    default:
      switch (operation) {
        case "subscribe":
          return "Subscription service temporarily unavailable";
        case "confirm":
          return "Confirmation service temporarily unavailable";
        case "unsubscribe":
          return "Unsubscribe service temporarily unavailable";
      }
  }
}

export function logNewsletterRouteOutcome(input: RouteLogInput): void {
  const logger = getClientLogger();
  const payload = {
    correlationId: input.correlationId,
    operationName: input.operationName,
    actorRole: input.actorRole ?? "anonymous",
    outcome: input.outcome,
    httpStatus: input.httpStatus,
    durationMs: input.durationMs,
    resourceType: "newsletter",
    ...(input.domainError ? { domainError: input.domainError } : {}),
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
  };

  if (input.outcome === "internal_error" || input.httpStatus >= 500) {
    logger.error("Newsletter route outcome", undefined, payload);
  } else if (input.outcome === "success") {
    logger.info("Newsletter route outcome", payload);
  } else {
    logger.warn("Newsletter route outcome", payload);
  }
}

export function conflictResponse() {
  return apiError("Request conflict", HttpStatus.CONFLICT);
}
