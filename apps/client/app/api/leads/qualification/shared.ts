import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { normalizeRole } from "@/app/lib/security/roles";
import type { AuthContext } from "@/app/lib/api/api-middleware";
import type { MarketplaceLeadErrorCode } from "@/app/lib/domains/marketplace-leads";

export const MARKETPLACE_LEADS_CONFIG = {
  MAX_BODY_SIZE: 32 * 1024, // 32KB
  MAX_DOC_BODY_SIZE: 16 * 1024, // 16KB
} as const;

export type MarketplaceLeadRouteOutcome =
  | "success"
  | "domain_error"
  | "validation_error"
  | "rate_limited"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "internal_error";

export type MarketplaceLeadActor = {
  clerkId: string;
  userId: string;
  role: string | null;
};

export function toMarketplaceLeadActor(
  context: AuthContext,
): MarketplaceLeadActor {
  return {
    clerkId: context.clerkId,
    userId: context.dbUserId,
    role: normalizeRole(String(context.userRole)) ?? null,
  };
}

export function now(): number {
  return Date.now();
}

export function domainErrorCodeToHttpStatus(
  code?: MarketplaceLeadErrorCode | string,
): number {
  switch (code) {
    case "not_found":
      return HttpStatus.NOT_FOUND;
    case "forbidden":
      return HttpStatus.FORBIDDEN;
    case "invalid_state":
    case "invalid_input":
      return HttpStatus.BAD_REQUEST;
    case "already_accepted":
      return HttpStatus.CONFLICT;
    case "scan_in_progress":
      return HttpStatus.ACCEPTED;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

export function domainErrorCodeToClientMessage(
  code?: MarketplaceLeadErrorCode | string,
): string {
  switch (code) {
    case "not_found":
      return "Lead or resource not found";
    case "forbidden":
      return "Access denied";
    case "invalid_state":
      return "Invalid lead state for this operation";
    case "invalid_input":
      return "Invalid lead data provided";
    case "already_accepted":
      return "Lead has already been accepted";
    case "scan_in_progress":
      return "Document scan is currently in progress";
    default:
      return "Marketplace lead operation failed";
  }
}

export type RouteLogInput = {
  operationName: string;
  correlationId: string;
  actorRole?: string | null;
  outcome: MarketplaceLeadRouteOutcome;
  httpStatus: number;
  durationMs: number;
  domainError?: string;
  leadId?: string;
  routingEventId?: string;
};

export function logMarketplaceLeadRouteOutcome(input: RouteLogInput): void {
  const logger = getClientLogger();
  const payload = {
    correlationId: input.correlationId,
    operationName: input.operationName,
    actorRole: input.actorRole ?? "anonymous",
    outcome: input.outcome,
    httpStatus: input.httpStatus,
    durationMs: input.durationMs,
    resourceType: "marketplace_lead",
    ...(input.domainError ? { domainError: input.domainError } : {}),
    ...(input.leadId ? { leadId: input.leadId } : {}),
    ...(input.routingEventId ? { routingEventId: input.routingEventId } : {}),
  };

  if (input.outcome === "internal_error" || input.httpStatus >= 500) {
    logger.error("Marketplace lead route outcome", undefined, payload);
  } else if (input.outcome === "success") {
    logger.info("Marketplace lead route outcome", payload);
  } else {
    logger.warn("Marketplace lead route outcome", payload);
  }
}

export function conflictResponse(
  message: string = "Request is being processed",
) {
  return apiError(message, HttpStatus.CONFLICT);
}
