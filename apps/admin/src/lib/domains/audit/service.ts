import { err, ok, type Result } from "@/lib/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  AuditActor,
  AuditDomainError,
  AuditExportPage,
  AuditLogInput,
  AuditLogPage,
  AuditLogQuery,
  AuditLogSortOrder,
  AuditLogStats,
  AdminAuditEvent,
} from "./contracts";
import { AUDIT_EXPORT_MAX_ROWS } from "./contracts";
import { auditRepository } from "./repository";
import { securityRepository } from "@/lib/security/repository";
import { AuditStatus, AuditSeverity, prisma } from "@build/db";
import { getAdminLogger } from "@/lib/infrastructure/logger";
import { createHash } from "crypto";
import { auditWriteCounter } from "@/lib/infrastructure/metrics";

const SORT_ORDER = ["asc", "desc"] as const;

function isSortOrder(value: unknown): value is AuditLogSortOrder {
  return (
    typeof value === "string" && SORT_ORDER.includes(value as AuditLogSortOrder)
  );
}

function invalidFilter(message: string): AuditDomainError {
  return { code: "AUDIT_INVALID_FILTER", message };
}

function requireAuditReadCapability(
  actor: AuditActor,
): Result<true, AuditDomainError> {
  // Audit log reads: VIEW_FINANCIALS (SUPER_ADMIN, FINANCE_MANAGER, AUDITOR)
  const policy = requireAdminCapability(actor, AdminCapability.VIEW_FINANCIALS);
  if (!policy.ok) {
    return err({
      code: "AUDIT_POLICY_DENIED",
      message: policy.message,
    });
  }
  return ok(true);
}

function requireAuditExportCapability(
  actor: AuditActor,
): Result<true, AuditDomainError> {
  // Exports: EXPORT_DATA (SUPER_ADMIN, AUDITOR only — Tier 1)
  const policy = requireAdminCapability(actor, AdminCapability.EXPORT_DATA);
  if (!policy.ok) {
    return err({
      code: "AUDIT_POLICY_DENIED",
      message: policy.message,
    });
  }
  return ok(true);
}

function parseDate(value: string | undefined, label: string) {
  if (!value) return ok(undefined);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return err(invalidFilter(`Invalid ${label} date`));
  }
  return ok(date);
}

export function buildAuditLogQuery(
  input: AuditLogInput = {},
): Result<AuditLogQuery, AuditDomainError> {
  const sortOrder = input.sortOrder ?? "desc";
  if (!isSortOrder(sortOrder)) {
    return err(invalidFilter("Invalid audit sort order"));
  }

  const dateFromResult = parseDate(input.dateFrom, "from");
  if (!dateFromResult.ok) return dateFromResult;
  const dateToResult = parseDate(input.dateTo, "to");
  if (!dateToResult.ok) return dateToResult;

  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 20)));
  const search = input.search?.trim();

  return ok({
    page,
    limit,
    skip: (page - 1) * limit,
    sortOrder,
    ...(search ? { search } : {}),
    ...(input.action ? { action: input.action } : {}),
    ...(input.targetType && input.targetType !== "all"
      ? { targetType: input.targetType }
      : {}),
    ...(input.adminId ? { adminId: input.adminId } : {}),
    ...(dateFromResult.data ? { dateFrom: dateFromResult.data } : {}),
    ...(dateToResult.data ? { dateTo: dateToResult.data } : {}),
  });
}

export async function listAuditLogPage(
  actor: AuditActor,
  input: AuditLogInput = {},
): Promise<Result<AuditLogPage, AuditDomainError>> {
  const capability = requireAuditReadCapability(actor);
  if (!capability.ok) return capability;

  const queryResult = buildAuditLogQuery(input);
  if (!queryResult.ok) return queryResult;

  const query = queryResult.data;
  const [logs, total] = await Promise.all([
    auditRepository.listAuditLogs(query),
    auditRepository.countAuditLogs(query),
  ]);

  return ok({
    logs,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
    filters: query,
  });
}

export async function getAuditLogStats(
  actor: AuditActor,
  now: Date = new Date(),
): Promise<Result<AuditLogStats, AuditDomainError>> {
  const capability = requireAuditReadCapability(actor);
  if (!capability.ok) return capability;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const [totalLogs, todayLogs, byAction, byTargetType, recentActivity] =
    await Promise.all([
      auditRepository.countAllAuditLogs(),
      auditRepository.countTodayAuditLogs(today),
      auditRepository.groupAuditLogsByAction(),
      auditRepository.groupAuditLogsByTargetType(),
      auditRepository.listRecentAuditLogs(),
    ]);

  return ok({
    totalLogs,
    todayLogs,
    byAction: byAction.map((row) => ({
      action: row.action,
      count: row._count.id,
    })),
    byTargetType: byTargetType.map((row) => ({
      targetType: row.targetType,
      count: row._count.id,
    })),
    recentActivity,
  });
}

/**
 * Returns distinct action strings for filter dropdown population.
 * Requires VIEW_FINANCIALS capability — same gate as list/stats reads.
 */
export async function getDistinctActions(
  actor: AuditActor,
): Promise<Result<string[], AuditDomainError>> {
  const capability = requireAuditReadCapability(actor);
  if (!capability.ok) return capability;

  const actions = await auditRepository.findDistinctActions();
  return ok(actions);
}

/**
 * Exports audit logs as a structured page capped at AUDIT_EXPORT_MAX_ROWS.
 * Requires EXPORT_DATA capability (SUPER_ADMIN, AUDITOR — Tier 1).
 */
export async function exportAuditLogs(
  actor: AuditActor,
  input: AuditLogInput = {},
): Promise<Result<AuditExportPage, AuditDomainError>> {
  const capability = requireAuditExportCapability(actor);
  if (!capability.ok) return capability;

  // Force export-safe limit regardless of caller input
  const exportInput: AuditLogInput = {
    ...input,
    limit: AUDIT_EXPORT_MAX_ROWS,
    page: 1,
  };

  const queryResult = buildAuditLogQuery(exportInput);
  if (!queryResult.ok) return queryResult;

  const rows = await auditRepository.findForExport(queryResult.data);

  const data = rows.map((row) => ({
    id: row.id,
    adminName: row.adminName,
    adminRole: row.adminRole,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    severity: row.severity,
    status: row.status,
    reason: row.reason ?? "",
    ipAddress: row.ipAddress ?? "",
    createdAt: row.createdAt.toISOString(),
  }));

  return ok({ data, count: data.length });
}

/**
 * Appends a canonical audit log event to the database.
 * This method is non-blocking, safe to fail, and catches all internal errors.
 */
export async function recordAdminAuditEvent(
  event: AdminAuditEvent,
): Promise<void> {
  const logger = getAdminLogger();

  let status: AuditStatus = AuditStatus.SUCCESS;
  if (event.outcome === "unauthorized" || event.outcome === "forbidden") {
    status = AuditStatus.DENIED;
  } else if (event.outcome !== "success") {
    status = AuditStatus.FAILURE;
  }

  // Map severity based on outcome or action details
  let severity: AuditSeverity = AuditSeverity.INFO;
  if (event.outcome === "internal_error") {
    severity = AuditSeverity.CRITICAL;
  } else if (
    event.outcome === "forbidden" ||
    event.outcome === "session_stale" ||
    event.outcome === "rate_limited" ||
    /delete|remove|suspend|reject/i.test(event.operationName)
  ) {
    severity = AuditSeverity.WARNING;
  }

  try {
    const user = await securityRepository.findUserForAudit(
      event.actor.dbUserId,
    );
    if (!user) {
      logger.warn({
        correlationId: event.correlationId,
        operationName: "record_admin_audit_event",
        adminRole: String(event.actor.adminRole),
        outcome: "domain_error",
        durationMs: 0,
        errorMessage: `Admin user ${event.actor.dbUserId} not found for audit logging`,
      });
      return;
    }

    // Hash Chaining implementation
    const lastLog = await auditRepository.findLastAuditLog();
    const prevHash = lastLog
      ? (lastLog.details as any)?._audit?.integrity?.hash || "genesis"
      : "genesis";
    const sequence = lastLog
      ? ((lastLog.details as any)?._audit?.integrity?.sequence || 0) + 1
      : 1;

    const loggedAt = new Date().toISOString();

    const hashPayload = JSON.stringify({
      prevHash,
      sequence,
      adminId: user.id,
      action: event.operationName,
      severity,
      status,
      targetId: event.targetResourceId ?? "global",
      targetType: event.targetResourceType ?? "admin_action",
      reason: event.reason ?? null,
      createdAt: loggedAt,
    });

    const hash = createHash("sha256").update(hashPayload).digest("hex");

    const immutableDetails = {
      ...(event.details ?? {}),
      _audit: {
        immutable: true,
        schemaVersion: 1,
        loggedAt,
        correlationId: event.correlationId,
        outcome: event.outcome,
        integrity: {
          hash,
          prevHash,
          sequence,
        },
      },
    };

    await auditRepository.createAuditLog({
      adminId: user.id,
      adminName:
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        "System Admin",
      adminEmail: user.email,
      adminRole: user.adminProfile?.role
        ? String(user.adminProfile.role)
        : String(user.role),
      action: event.operationName,
      severity,
      status,
      targetId: event.targetResourceId ?? "global",
      targetType: event.targetResourceType ?? "admin_action",
      details: immutableDetails,
      reason: event.reason ?? null,
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent ?? null,
      requestId: event.correlationId,
    });

    try {
      auditWriteCounter.add(1, {
        operationName: event.operationName,
        outcome: event.outcome,
        status,
      });
    } catch {}
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({
      correlationId: event.correlationId,
      operationName: "record_admin_audit_event",
      adminRole: String(event.actor.adminRole),
      outcome: "internal_error",
      durationMs: 0,
      errorMessage: message,
    });

    try {
      auditWriteCounter.add(1, {
        operationName: event.operationName,
        outcome: "internal_error",
        status: AuditStatus.FAILURE,
      });
    } catch {}

    throw error; // Rethrow to propagate to safeAction / recordDeclarativeAudit!
  }
}

export async function verifyAuditLogIntegrity(
  actor: AuditActor,
): Promise<
  Result<
    { isValid: boolean; corruptLogId?: string; message: string },
    AuditDomainError
  >
> {
  const capability = requireAuditReadCapability(actor);
  if (!capability.ok) return capability;

  try {
    const logs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "asc" },
    });

    let prevHash = "genesis";

    for (const log of logs) {
      const details = log.details as any;
      const integrity = details?._audit?.integrity;

      if (!integrity) {
        // Skip log rows that pre-date hash chaining rollout
        continue;
      }

      const hashPayload = JSON.stringify({
        prevHash: integrity.prevHash,
        sequence: integrity.sequence,
        adminId: log.adminId,
        action: log.action,
        severity: log.severity,
        status: log.status,
        targetId: log.targetId,
        targetType: log.targetType,
        reason: log.reason,
        createdAt: details._audit.loggedAt || log.createdAt.toISOString(),
      });

      const calculatedHash = createHash("sha256")
        .update(hashPayload)
        .digest("hex");

      if (integrity.hash !== calculatedHash) {
        return ok({
          isValid: false,
          corruptLogId: log.id,
          message: `Hash mismatch at sequence ${integrity.sequence}, log ID ${log.id}. Calculated: ${calculatedHash}, stored: ${integrity.hash}`,
        });
      }

      if (integrity.prevHash !== prevHash) {
        return ok({
          isValid: false,
          corruptLogId: log.id,
          message: `Chaining mismatch at sequence ${integrity.sequence}, log ID ${log.id}. Stored prevHash: ${integrity.prevHash}, expected: ${prevHash}`,
        });
      }

      prevHash = integrity.hash;
    }

    return ok({
      isValid: true,
      message: "All audit log hashes verified successfully.",
    });
  } catch (error) {
    return err({
      code: "AUDIT_VERIFICATION_FAILED" as any,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export const auditService = {
  buildAuditLogQuery,
  listAuditLogPage,
  getAuditLogStats,
  getDistinctActions,
  exportAuditLogs,
  recordAdminAuditEvent,
  verifyAuditLogIntegrity,
};
