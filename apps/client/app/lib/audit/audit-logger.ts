import { prisma, type Prisma } from "@build/db";
import { getClientLogger } from "@/app/lib/api/resilient-api";

/**
 * FIX (H5): the original accepted `action: string` and cast it to `any` at
 * the Prisma call site, meaning a typo'd action string would only surface
 * as a runtime failure inside a `.catch(() => {})` that swallowed it
 * completely — a silently-broken audit trail with zero signal.
 *
 * This version types `action` against Prisma's generated `AuditAction`
 * enum so a typo is a compile error, not a silent production gap, and
 * failures are surfaced through the logger's `error` level (not `warn`)
 * with enough structure to alert on.
 */
export type AuditAction = Prisma.AuditLogCreateInput["action"];

export type AuditLogInput = {
  action: AuditAction;
  actorId: string;
  actorRole?: string;
  resourceId: string;
  resourceType: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Audit Log Service
 * Declaratively records sensitive security and document access events.
 * Writes to structured logs and persists audit record to DB.
 *
 * Note: this function still does not throw — a broken audit sink should
 * not take down the request it's auditing. But a persistence failure is
 * now logged at `error` (previously `warn`) with a distinct event name so
 * it can be alerted on separately from routine warnings, closing the
 * "silent audit outage" gap from the original implementation.
 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  const logger = getClientLogger();

  logger.info(`[AuditLog] ${input.action}`, {
    action: input.action,
    actorId: input.actorId,
    actorRole: input.actorRole,
    resourceId: input.resourceId,
    resourceType: input.resourceType,
    correlationId: input.correlationId,
    metadata: input.metadata,
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        actorType:
          input.actorRole === "ADMIN" || input.actorRole === "SUPER_ADMIN"
            ? "ADMIN"
            : "USER",
        action: input.action,
        entityType: input.resourceType,
        entityId: input.resourceId,
        metadata: {
          // FIX (L3): fixed keys win over caller-supplied metadata, so a
          // caller can't accidentally (or maliciously) overwrite
          // correlationId/actorRole via a colliding metadata key.
          ...input.metadata,
          correlationId: input.correlationId,
          actorRole: input.actorRole,
        },
      },
    });
  } catch (error) {
    // FIX (H5): error, not warn — a dropped audit record is a security
    // observability gap, not routine noise. Distinct event name so
    // alerting can key off it specifically.
    logger.error(
      "audit_log_persist_failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        action: input.action,
        resourceId: input.resourceId,
        resourceType: input.resourceType,
        correlationId: input.correlationId,
      },
    );
  }
}
