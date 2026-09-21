import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { normalizeRole } from "@/app/lib/security/roles";
import type { DomainErrorCode } from "@/app/lib/domains/projects/contracts";

export type ProjectsRouteOutcome =
  | "success"
  | "domain_error"
  | "validation_error"
  | "rate_limited"
  | "internal_error";

type RouteLogInput = {
  operationName: string;
  correlationId: string;
  actorRole?: string | null;
  outcome: ProjectsRouteOutcome;
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

export function domainErrorCodeToStatus(code: DomainErrorCode): number {
  switch (code) {
    case "not_found":
      return HttpStatus.NOT_FOUND;
    case "forbidden":
    case "professional_missing":
      return HttpStatus.FORBIDDEN;
    case "conflict":
      return HttpStatus.CONFLICT;
    case "invalid_transition":
    case "limit_exceeded":
    case "milestone_not_approved":
      return HttpStatus.BAD_REQUEST;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

export function projectDomainErrorToClientMessage(
  code: DomainErrorCode,
): string {
  switch (code) {
    case "not_found":
      return "Project not found";
    case "forbidden":
    case "professional_missing":
      return "Forbidden";
    case "conflict":
      return "Request conflict";
    case "invalid_transition":
    case "limit_exceeded":
    case "milestone_not_approved":
      return "Invalid request";
    default:
      return "Request failed";
  }
}

export function logProjectsRouteOutcome(input: RouteLogInput): void {
  const logger = getClientLogger();
  const payload = {
    correlationId: input.correlationId,
    operationName: input.operationName,
    actorRole: input.actorRole ?? "anonymous",
    outcome: input.outcome,
    httpStatus: input.httpStatus,
    durationMs: input.durationMs,
    resourceType: "project",
    ...(input.domainError ? { domainError: input.domainError } : {}),
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
  };

  if (input.outcome === "internal_error" || input.httpStatus >= 500) {
    logger.error("Projects route outcome", undefined, payload);
  } else if (input.outcome === "success") {
    logger.info("Projects route outcome", payload);
  } else {
    logger.warn("Projects route outcome", payload);
  }
}

export function conflictResponse() {
  return apiError(
    "Resource version conflict. Retry with the latest version.",
    HttpStatus.CONFLICT,
  );
}
