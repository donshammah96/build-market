import { err, ok, type Result } from "@/lib/errors/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  AuditActor,
  AuditDomainError,
  AuditLogInput,
  AuditLogPage,
  AuditLogQuery,
  AuditLogSortOrder,
  AuditLogStats,
} from "./contracts";
import { auditRepository } from "./repository";

const SORT_ORDER = ["asc", "desc"] as const;

function isSortOrder(value: unknown): value is AuditLogSortOrder {
  return (
    typeof value === "string" && SORT_ORDER.includes(value as AuditLogSortOrder)
  );
}

function invalidFilter(message: string): AuditDomainError {
  return { code: "AUDIT_INVALID_FILTER", message };
}

function requireAuditCapability(
  actor: AuditActor,
): Result<true, AuditDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.EXPORT_DATA);
  if (!policy.success) {
    return err({
      code: "AUDIT_POLICY_DENIED",
      message: policy.error.message,
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
  const capability = requireAuditCapability(actor);
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
  const capability = requireAuditCapability(actor);
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

export const auditService = {
  buildAuditLogQuery,
  listAuditLogPage,
  getAuditLogStats,
};
