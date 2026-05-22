import type { NextRequest, NextResponse } from "next/server";
import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { normalizeRole } from "@/app/lib/security/roles";
import type {
  PropertyErrorDetails,
  PropertyDomainError,
  PropertyDomainErrorCode,
  PropertyResult,
} from "@/app/lib/domains/properties/contracts";

// ─── ADR-005 §1: structured log field contract ────────────────────────────────

/**
 * Five-value outcome union matching ADR-005.
 * Previous shape was binary ("success" | "error") which lost granularity:
 * - domain_error: expected business failure (forbidden, not_found, conflict)
 * - validation_error: request body/query failed Zod schema
 * - rate_limited: rate limit exceeded
 * - internal_error: infrastructure failure (Prisma, circuit open, etc.)
 */
export type PropertiesRouteOutcome =
  | "success"
  | "domain_error"
  | "validation_error"
  | "rate_limited"
  | "internal_error";

type PropertiesRouteLogInput = {
  operationName: string;
  correlationId: string;
  actorRole?: string | null;
  outcome: PropertiesRouteOutcome;
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

/**
 * Emit one structured log event per request outcome.
 *
 * FIX: getClientLogger() is now called per-invocation (not at module level)
 * so each call carries the current request context rather than a stale
 * module-load-time snapshot. (ADR-005 §4)
 */
export function logPropertiesRouteOutcome(
  input: PropertiesRouteLogInput,
): void {
  // FIX: moved inside function — was const logger = getClientLogger() at module level
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

  // Level follows ADR-005: info (success), warn (domain/validation/rate), error (internal)
  if (input.outcome === "internal_error" || input.httpStatus >= 500) {
    logger.error("Properties route outcome", undefined, payload);
    return;
  }

  if (input.outcome === "success") {
    logger.info("Properties route outcome", payload);
    return;
  }

  // domain_error, validation_error, rate_limited → warn
  logger.warn("Properties route outcome", payload);
}

// ─── Domain error → HTTP status mapping ───────────────────────────────────────

/**
 * Maps a PropertyDomainErrorCode to an HTTP status code.
 * This is the single source of truth for status mapping in the adapter layer
 * (service.ts no longer imports HttpStatus).
 */
export function domainErrorCodeToStatus(code: PropertyDomainErrorCode): number {
  switch (code) {
    case "not_found":
    case "asset_not_found":
    case "document_not_found":
    case "attachment_not_found":
      return HttpStatus.NOT_FOUND;
    case "forbidden":
    case "suspended_account":
    case "not_professional":
    case "asset_unauthorized":
      return HttpStatus.FORBIDDEN;
    case "conflict":
    case "slug_conflict":
      return HttpStatus.CONFLICT;
    case "invalid_input":
    case "attachment_mismatch":
      return HttpStatus.BAD_REQUEST;
    case "internal_error":
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

export function domainErrorToResponse(
  error: PropertyDomainError,
  correlationId: string,
): NextResponse {
  const status = domainErrorCodeToStatus(error.error);
  const safeDetails = sanitizeDomainErrorDetails(error.details);
  const safeMessage = propertyDomainErrorToClientMessage(error.error);
  return apiError(safeMessage, status, safeDetails, correlationId);
}

function propertyDomainErrorToClientMessage(
  code: PropertyDomainErrorCode,
): string {
  switch (code) {
    case "not_found":
      return "Property not found";
    case "asset_not_found":
      return "Asset not found";
    case "document_not_found":
      return "Document not found";
    case "attachment_not_found":
      return "Attachment not found";
    case "forbidden":
    case "suspended_account":
    case "not_professional":
    case "asset_unauthorized":
      return "Forbidden";
    case "conflict":
    case "slug_conflict":
      return "Request conflict";
    case "invalid_input":
    case "attachment_mismatch":
      return "Invalid request";
    case "duplicate":
    case "internal_error":
    default:
      return "Request failed";
  }
}

const SAFE_DOMAIN_DETAIL_KEYS = new Set([
  "currentVersion",
  "expectedVersion",
  "correlationId",
]);

function isPropertyErrorDetailValue(
  value: unknown,
): value is string | number | boolean | null | undefined {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function sanitizeDomainErrorDetails(
  details?: unknown,
): PropertyErrorDetails | undefined {
  if (!details || typeof details !== "object") return undefined;

  const safeDetails: PropertyErrorDetails = {};

  for (const [key, value] of Object.entries(
    details as Record<string, unknown>,
  )) {
    if (!SAFE_DOMAIN_DETAIL_KEYS.has(key)) {
      continue;
    }

    if (!isPropertyErrorDetailValue(value)) {
      continue;
    }

    safeDetails[key] = value;
  }

  if (Object.keys(safeDetails).length === 0) {
    return undefined;
  }

  return safeDetails;
}

export function domainResultToErrorResponse<T>(
  result: PropertyResult<T>,
  correlationId: string,
): NextResponse | null {
  if (result.ok) {
    return null;
  }
  return domainErrorToResponse(result, correlationId);
}

export function conflictResponse(
  currentVersion: number | null | undefined,
  correlationId: string,
): NextResponse {
  const response = apiError(
    "Resource version conflict. Retry with the latest version.",
    HttpStatus.CONFLICT,
    undefined,
    correlationId,
  );
  if (currentVersion !== null && currentVersion !== undefined) {
    response.headers.set("X-Property-Version", String(currentVersion));
    response.headers.set("ETag", `"${currentVersion}"`);
  }
  return response;
}

export function isOptimisticRetryEnabled(req: NextRequest): boolean {
  const headerValue = req.headers.get("x-optimistic-retry");
  return headerValue === "true" || headerValue === "1";
}
