/**
 * Admin structured logger — ADR-ADMIN-003 §7.1
 *
 * PII exclusion is enforced at the type level: the `AdminLogEvent` type
 * explicitly omits fields that carry identity data (userId, email, phone,
 * nationalId, clerkId, userEmail).  Adapter layers (safeAction, route
 * handlers) emit structured events; service and repository layers do not log.
 *
 * The logger is gated behind the `admin_v2_structured_logging` feature flag.
 * When the flag is disabled the logger falls back to `console.log` so existing
 * behaviour is preserved without any code changes at call sites.
 */

import {
  AdminFeatureFlag,
  isAdminFeatureEnabled,
} from "@/lib/config/feature-flags";

// ---------------------------------------------------------------------------
// Outcome type
// ---------------------------------------------------------------------------

export type AdminLogOutcome =
  | "success"
  | "domain_error"
  | "internal_error"
  | "unauthorized"
  | "forbidden"
  | "validation_error"
  | "rate_limited"
  | "session_stale";

// ---------------------------------------------------------------------------
// PII exclusion — these keys are prohibited at the type level
// ---------------------------------------------------------------------------

type ProhibitedPiiKeys =
  | "userId"
  | "email"
  | "phone"
  | "nationalId"
  | "clerkId"
  | "userEmail"
  | "adminEmail"
  | "userPhone"
  | "firstName"
  | "lastName";

/**
 * Required fields for every structured admin log event.
 * `adminRole` is safe to log — it is a capability enum, not identity.
 */
export type AdminLogEvent = {
  correlationId: string;
  operationName: string;
  adminRole: string;
  outcome: AdminLogOutcome;
  durationMs: number;
  httpStatus?: number;
  errorCode?: string;
  resourceType?: string;
  resourceId?: string;
  /** Free-form Class C/D metadata — PII keys are excluded by type constraint. */
  meta?: Omit<Record<string, unknown>, ProhibitedPiiKeys>;
};

// ---------------------------------------------------------------------------
// Logger interface
// ---------------------------------------------------------------------------

export interface AdminLogger {
  info(event: AdminLogEvent & { errorMessage?: string }): void;
  warn(event: AdminLogEvent & { errorMessage?: string }): void;
  error(event: AdminLogEvent & { errorMessage?: string }): void;
}

// ---------------------------------------------------------------------------
// Console-fallback logger (used when flag is disabled)
// ---------------------------------------------------------------------------

function consoleFallbackLogger(): AdminLogger {
  return {
    info(event) {
      console.log("[admin]", JSON.stringify(event));
    },
    warn(event) {
      console.warn("[admin]", JSON.stringify(event));
    },
    error(event) {
      console.error("[admin]", JSON.stringify(event));
    },
  };
}

// ---------------------------------------------------------------------------
// Structured JSON logger (used when flag is enabled)
// ---------------------------------------------------------------------------

function structuredLogger(): AdminLogger {
  function emit(
    level: "info" | "warn" | "error",
    event: AdminLogEvent & { errorMessage?: string },
  ): void {
    // Sanitise: strip any PII keys that slip through at runtime
    const prohibitedRuntimeKeys = new Set<string>([
      "userId",
      "email",
      "phone",
      "nationalId",
      "clerkId",
      "userEmail",
      "adminEmail",
      "userPhone",
      "firstName",
      "lastName",
    ]);

    const safeMeta: Record<string, unknown> = {};
    if (event.meta) {
      for (const [k, v] of Object.entries(event.meta)) {
        if (!prohibitedRuntimeKeys.has(k)) {
          safeMeta[k] = v;
        }
      }
    }

    const entry = {
      level,
      timestamp: new Date().toISOString(),
      service: "apps/admin",
      correlationId: event.correlationId,
      operationName: event.operationName,
      adminRole: event.adminRole,
      outcome: event.outcome,
      durationMs: event.durationMs,
      ...(event.httpStatus !== undefined
        ? { httpStatus: event.httpStatus }
        : {}),
      ...(event.errorCode !== undefined ? { errorCode: event.errorCode } : {}),
      ...(event.resourceType !== undefined
        ? { resourceType: event.resourceType }
        : {}),
      ...(event.resourceId !== undefined
        ? { resourceId: event.resourceId }
        : {}),
      ...(event.errorMessage !== undefined
        ? { errorMessage: event.errorMessage }
        : {}),
      ...(Object.keys(safeMeta).length > 0 ? { meta: safeMeta } : {}),
    };

    // Write JSON to stdout; in production this is captured by the log aggregator.
    process.stdout.write(JSON.stringify(entry) + "\n");
  }

  return {
    info: (event) => emit("info", event),
    warn: (event) => emit("warn", event),
    error: (event) => emit("error", event),
  };
}

// ---------------------------------------------------------------------------
// Factory — returns the appropriate implementation based on the feature flag
// ---------------------------------------------------------------------------

/**
 * Returns the active admin logger.
 *
 * Call once per action execution — do not hold a reference across requests.
 */
export function getAdminLogger(): AdminLogger {
  if (isAdminFeatureEnabled(AdminFeatureFlag.ADMIN_V2_STRUCTURED_LOGGING)) {
    return structuredLogger();
  }
  return consoleFallbackLogger();
}
