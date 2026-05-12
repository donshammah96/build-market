import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { normalizeRole } from "@/app/lib/security/roles";

export type ProfessionalsRouteOutcome =
  | "success"
  | "domain_error"
  | "validation_error"
  | "rate_limited"
  | "internal_error";

type RouteLogInput = {
  operationName: string;
  correlationId: string;
  actorRole?: string | null;
  outcome: ProfessionalsRouteOutcome;
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

export function professionalDomainErrorToClientMessage(code: string): string {
  switch (code) {
    case "not_found":
      return "Professional not found";
    case "forbidden":
      return "Forbidden";
    case "conflict":
      return "Request conflict";
    case "invalid_input":
      return "Invalid request";
    default:
      return "Professional operation failed";
  }
}

export function logProfessionalsRouteOutcome(input: RouteLogInput): void {
  const logger = getClientLogger();
  const payload = {
    correlationId: input.correlationId,
    operationName: input.operationName,
    actorRole: input.actorRole ?? "anonymous",
    outcome: input.outcome,
    httpStatus: input.httpStatus,
    durationMs: input.durationMs,
    resourceType: "professional",
    ...(input.domainError ? { domainError: input.domainError } : {}),
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
  };

  if (input.outcome === "internal_error" || input.httpStatus >= 500) {
    logger.error("Professionals route outcome", undefined, payload);
  } else if (input.outcome === "success") {
    logger.info("Professionals route outcome", payload);
  } else {
    logger.warn("Professionals route outcome", payload);
  }
}

export function conflictResponse() {
  return apiError("Request conflict", HttpStatus.CONFLICT);
}
