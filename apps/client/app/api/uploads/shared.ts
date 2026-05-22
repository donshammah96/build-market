import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { normalizeRole } from "@/app/lib/security/roles";

export type UploadsRouteOutcome =
  | "success"
  | "domain_error"
  | "validation_error"
  | "rate_limited"
  | "internal_error";

type RouteLogInput = {
  operationName: string;
  correlationId: string;
  actorRole?: string | null;
  outcome: UploadsRouteOutcome;
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

export function domainErrorCodeToStatus(code: string): number {
  switch (code) {
    case "not_found":
    case "expired":
      return HttpStatus.NOT_FOUND;
    case "forbidden":
      return HttpStatus.FORBIDDEN;
    case "conflict":
      return HttpStatus.CONFLICT;
    case "invalid_input":
      return HttpStatus.BAD_REQUEST;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

export function uploadDomainErrorToClientMessage(code: string): string {
  switch (code) {
    case "not_found":
      return "File not found";
    case "expired":
      return "Upload URL has expired";
    case "forbidden":
      return "Forbidden";
    case "conflict":
      return "Request conflict";
    case "invalid_input":
      return "Invalid request";
    default:
      return "Upload operation failed";
  }
}

export function logUploadsRouteOutcome(input: RouteLogInput): void {
  const logger = getClientLogger();
  const payload = {
    correlationId: input.correlationId,
    operationName: input.operationName,
    actorRole: input.actorRole ?? "anonymous",
    outcome: input.outcome,
    httpStatus: input.httpStatus,
    durationMs: input.durationMs,
    resourceType: "upload",
    ...(input.domainError ? { domainError: input.domainError } : {}),
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
  };

  if (input.outcome === "internal_error" || input.httpStatus >= 500) {
    logger.error("Uploads route outcome", undefined, payload);
  } else if (input.outcome === "success") {
    logger.info("Uploads route outcome", payload);
  } else {
    logger.warn("Uploads route outcome", payload);
  }
}

export function conflictResponse() {
  return apiError("Request conflict", HttpStatus.CONFLICT);
}
