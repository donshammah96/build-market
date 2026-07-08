import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { normalizeRole } from "@/app/lib/security/roles";

// ADR-006 classification: Class C - shared adapter helpers expose route metadata only.
// Reviewed: 2026-05-07 by @copilot

import { pushDemoLog } from "@/app/lib/api/demo-logs";

export type ProfessionalPortalRouteOutcome =
  | "success"
  | "domain_error"
  | "validation_error"
  | "rate_limited"
  | "internal_error";

type RouteLogInput = {
  operationName: string;
  correlationId: string;
  actorRole?: string | null;
  outcome: ProfessionalPortalRouteOutcome;
  httpStatus: number;
  durationMs: number;
  domainError?: string;
  resourceType?: string;
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
    case "asset_not_found":
      return HttpStatus.NOT_FOUND;
    case "forbidden":
    case "asset_forbidden":
      return HttpStatus.FORBIDDEN;
    case "conflict":
      return HttpStatus.CONFLICT;
    case "invalid_input":
    case "limit_exceeded":
      return HttpStatus.BAD_REQUEST;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

export function professionalPortalDomainErrorToClientMessage(
  code: string,
): string {
  switch (code) {
    case "not_found":
    case "asset_not_found":
      return "Resource not found";
    case "forbidden":
    case "asset_forbidden":
      return "Forbidden";
    case "conflict":
      return "Request conflict";
    case "invalid_input":
    case "limit_exceeded":
      return "Invalid request";
    default:
      return "Request failed";
  }
}

export function logProfessionalPortalRouteOutcome(input: RouteLogInput): void {
  const logger = getClientLogger();
  const payload = {
    correlationId: input.correlationId,
    operationName: input.operationName,
    actorRole: input.actorRole ?? "anonymous",
    outcome: input.outcome,
    httpStatus: input.httpStatus,
    durationMs: input.durationMs,
    ...(input.domainError ? { domainError: input.domainError } : {}),
    ...(input.resourceType ? { resourceType: input.resourceType } : {}),
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
  };

  if (input.outcome === "internal_error" || input.httpStatus >= 500) {
    logger.error("Professional portal route outcome", undefined, payload);
  } else if (input.outcome === "success") {
    logger.info("Professional portal route outcome", payload);
  } else {
    logger.warn("Professional portal route outcome", payload);
  }

  // Push to telemetry log panel (runs async)
  pushDemoLog(payload).catch(() => undefined);
}

export function conflictResponse() {
  return apiError(
    "Resource version conflict. Retry with the latest version.",
    HttpStatus.CONFLICT,
  );
}
