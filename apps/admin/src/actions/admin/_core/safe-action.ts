"use server";

import {
  getAdminActionPolicy,
  requireAdminCapability,
  type AdminActionPolicy,
} from "@/lib/security/authorization-policy";
import type {
  AdminActionContext,
  AdminActor,
} from "@/lib/security/admin-actor";
import { checkRateLimit } from "@/lib/api/rate-limit";
import type { ActionResponse, AdminActionError } from "../types";
import { omitUndefined } from "@/lib/utils";
import {
  getAdminLogger,
  type AdminLogOutcome,
} from "@/lib/infrastructure/logger";
import {
  actionOutcomeCounter,
  actionDurationHistogram,
} from "@/lib/infrastructure/metrics";
import { withAdminCorrelation } from "@/lib/infrastructure/correlation";
import { resolveAdminActor } from "./actor-resolver";
import { recordDeclarativeAudit } from "./audit";

const logger = getAdminLogger();

export type SafeActionOptions = {
  recentAuth?: { maxAgeSeconds: number };
  rateLimit?: { namespace: string; limit: number; windowMs: number };
  auditLog?: {
    operation: string;
    resourceType?: string;
    getTargetId?: (payload: { actor: AdminActor; data: unknown }) => string;
    getDetails?: (payload: {
      actor: AdminActor;
      data: unknown;
    }) => Record<string, unknown> | undefined;
    getReason?: (payload: {
      actor: AdminActor;
      data: unknown;
    }) => string | undefined;
  };
};

function adminActionError(
  code: AdminActionError["code"],
  message: string,
  action?: string,
  retryAfterMs?: number,
): AdminActionError {
  return {
    code,
    message,
    ...omitUndefined({ action, retryAfterMs }),
  };
}

function adminActionFailure<T>(
  error: AdminActionError,
  timestamp: string,
): ActionResponse<T> {
  return {
    success: false,
    error: error.message,
    errorDetails: error,
    timestamp,
  };
}

function getSessionAuthTimeSeconds(sessionClaims: unknown): number | undefined {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return undefined;
  }

  const claims = sessionClaims as Record<string, unknown>;
  const candidate = claims.auth_time ?? claims.iat;

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }

  if (typeof candidate === "string") {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function mergeSafeActionOptions(
  policy: AdminActionPolicy,
  options: SafeActionOptions | undefined,
): SafeActionOptions {
  return omitUndefined({
    recentAuth: options?.recentAuth ?? policy.recentAuth,
    rateLimit: options?.rateLimit ?? policy.rateLimit,
    auditLog: options?.auditLog,
  });
}

function enforceRecentAuth(
  actionName: string,
  sessionClaims: unknown,
  recentAuth: { maxAgeSeconds: number } | undefined,
): AdminActionError | undefined {
  if (!recentAuth) {
    return undefined;
  }

  const authTimeSeconds = getSessionAuthTimeSeconds(sessionClaims);

  if (!authTimeSeconds) {
    return adminActionError(
      "SESSION_STALE",
      "Recent admin authentication required",
      actionName,
    );
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authTimeSeconds;

  if (ageSeconds > recentAuth.maxAgeSeconds) {
    return adminActionError(
      "SESSION_STALE",
      "Recent admin authentication required",
      actionName,
    );
  }

  return undefined;
}

async function enforceActorRateLimit(
  actionName: string,
  actor: AdminActor,
  rateLimit: SafeActionOptions["rateLimit"],
): Promise<AdminActionError | undefined> {
  if (!rateLimit) {
    return undefined;
  }

  const result = await checkRateLimit(
    `admin:${rateLimit.namespace}:${actor.dbUserId}`,
    rateLimit.limit,
    rateLimit.windowMs,
  );

  if (result.success) {
    return undefined;
  }

  return adminActionError(
    "RATE_LIMITED",
    "Too many admin action attempts",
    actionName,
    Math.max(0, result.reset - Date.now()),
  );
}

export async function safeAction<T>(
  actionName: string,
  fn: (context: AdminActionContext) => Promise<T>,
  options?: SafeActionOptions,
): Promise<ActionResponse<T>> {
  const timestamp = new Date().toISOString();
  const requestStartedAt = Date.now();
  const correlationId = crypto.randomUUID();

  let resolvedActor: AdminActor | undefined;
  let resolvedOptions: SafeActionOptions | undefined;

  function emitLog(
    outcome: AdminLogOutcome,
    adminRole: string,
    extra?: { errorCode?: string; errorMessage?: string },
  ): void {
    const durationMs = Date.now() - requestStartedAt;
    logger.info({
      correlationId,
      operationName: actionName,
      adminRole,
      outcome,
      durationMs,
      ...omitUndefined(extra ?? {}),
    });

    try {
      actionOutcomeCounter.add(1, {
        operationName: actionName,
        adminRole,
        outcome,
        ...(extra?.errorCode ? { errorCode: extra.errorCode } : {}),
      });

      actionDurationHistogram.record(durationMs, {
        operationName: actionName,
        outcome,
      });
    } catch {
      // Prevent telemetry failure from affecting action lifecycle
    }
  }

  try {
    const actorResult = await resolveAdminActor();

    if (!actorResult.ok) {
      emitLog("unauthorized", "unknown", {
        errorCode: actorResult.error.code,
      });
      return adminActionFailure(
        { ...actorResult.error, action: actionName },
        timestamp,
      );
    }

    resolvedActor = actorResult.actor;
    const adminRole = String(resolvedActor.adminRole);
    const policy = getAdminActionPolicy(actionName);
    resolvedOptions = mergeSafeActionOptions(policy, options);

    if (!policy.allowedRoles.includes(resolvedActor.adminRole)) {
      emitLog("forbidden", adminRole, { errorCode: "FORBIDDEN" });
      const error = adminActionError(
        "FORBIDDEN",
        "Admin action policy denied",
        actionName,
      );
      await recordDeclarativeAudit(
        resolvedActor,
        resolvedOptions.auditLog,
        undefined,
        "forbidden",
        correlationId,
        error.message,
      );
      return adminActionFailure(error, timestamp);
    }

    for (const capability of policy.capabilities) {
      const capabilityResult = requireAdminCapability(
        resolvedActor,
        capability,
      );
      if (!capabilityResult.ok) {
        emitLog("forbidden", adminRole, { errorCode: "FORBIDDEN" });
        const error = adminActionError(
          "FORBIDDEN",
          capabilityResult.message ?? "Admin capability denied",
          actionName,
        );
        await recordDeclarativeAudit(
          resolvedActor,
          resolvedOptions.auditLog,
          undefined,
          "forbidden",
          correlationId,
          error.message,
        );
        return adminActionFailure(error, timestamp);
      }
    }

    const staleSessionError = enforceRecentAuth(
      actionName,
      actorResult.sessionClaims,
      resolvedOptions.recentAuth,
    );
    if (staleSessionError) {
      emitLog("session_stale", adminRole, { errorCode: "SESSION_STALE" });
      await recordDeclarativeAudit(
        resolvedActor,
        resolvedOptions.auditLog,
        undefined,
        "session_stale",
        correlationId,
        staleSessionError.message,
      );
      return adminActionFailure(staleSessionError, timestamp);
    }

    const rateLimitError = await enforceActorRateLimit(
      actionName,
      resolvedActor,
      resolvedOptions.rateLimit,
    );
    if (rateLimitError) {
      emitLog("rate_limited", adminRole, { errorCode: "RATE_LIMITED" });
      await recordDeclarativeAudit(
        resolvedActor,
        resolvedOptions.auditLog,
        undefined,
        "rate_limited",
        correlationId,
        rateLimitError.message,
      );
      return adminActionFailure(rateLimitError, timestamp);
    }

    const data = await withAdminCorrelation(correlationId, () =>
      fn({
        actor: resolvedActor!,
        adminUserId: resolvedActor!.dbUserId,
        adminRole: resolvedActor!.adminRole,
        correlationId,
        requestStartedAt,
      }),
    );

    await recordDeclarativeAudit(
      resolvedActor,
      resolvedOptions.auditLog,
      data,
      "success",
      correlationId,
    );

    emitLog("success", adminRole);
    return {
      success: true,
      data,
      timestamp,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Admin action failed";

    logger.error({
      correlationId,
      operationName: actionName,
      adminRole: resolvedActor ? String(resolvedActor.adminRole) : "unknown",
      outcome: "internal_error",
      durationMs: Date.now() - requestStartedAt,
      errorCode: "ACTION_FAILED",
      errorMessage: message,
    });

    if (resolvedActor) {
      const policy = getAdminActionPolicy(actionName);
      const actionOptions = mergeSafeActionOptions(policy, options);
      await recordDeclarativeAudit(
        resolvedActor,
        actionOptions.auditLog,
        undefined,
        "internal_error",
        correlationId,
        message,
      );
    }

    return adminActionFailure(
      adminActionError("ACTION_FAILED", message, actionName),
      timestamp,
    );
  }
}
