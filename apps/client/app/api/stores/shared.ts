import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { normalizeRole } from "@/app/lib/security/roles";
import type { StoreDomainErrorCode } from "@/app/lib/domains/stores/contracts";

export type StoresRouteOutcome =
  | "success"
  | "domain_error"
  | "validation_error"
  | "rate_limited"
  | "internal_error";

type RouteLogInput = {
  operationName: string;
  correlationId: string;
  actorRole?: string | null;
  outcome: StoresRouteOutcome;
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

export function domainErrorCodeToStatus(code: StoreDomainErrorCode): number {
  switch (code) {
    case "not_found":
      return HttpStatus.NOT_FOUND;
    case "forbidden":
    case "unauthorized":
      return HttpStatus.FORBIDDEN;
    case "conflict":
      return HttpStatus.CONFLICT;
    case "invalid_input":
    case "invalid_state":
    case "limit_exceeded":
      return HttpStatus.BAD_REQUEST;
    case "internal":
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

export function storeDomainErrorToClientMessage(
  code: StoreDomainErrorCode,
): string {
  switch (code) {
    case "not_found":
      return "Store not found";
    case "forbidden":
    case "unauthorized":
      return "Forbidden";
    case "conflict":
      return "Request conflict";
    case "invalid_input":
    case "invalid_state":
    case "limit_exceeded":
      return "Invalid request";
    case "internal":
    default:
      return "Request failed";
  }
}

export function logStoresRouteOutcome(input: RouteLogInput): void {
  const logger = getClientLogger();
  const payload = {
    correlationId: input.correlationId,
    operationName: input.operationName,
    actorRole: input.actorRole ?? "anonymous",
    outcome: input.outcome,
    httpStatus: input.httpStatus,
    durationMs: input.durationMs,
    resourceType: "store",
    ...(input.domainError ? { domainError: input.domainError } : {}),
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
  };

  if (input.outcome === "internal_error" || input.httpStatus >= 500) {
    logger.error("Stores route outcome", undefined, payload);
  } else if (input.outcome === "success") {
    logger.info("Stores route outcome", payload);
  } else {
    logger.warn("Stores route outcome", payload);
  }
}

export function conflictResponse() {
  return apiError(
    "Resource version conflict. Retry with the latest version.",
    HttpStatus.CONFLICT,
  );
}
