import { prisma, type Prisma } from "@build/db";
import type { AuditLogEntry, AuditLogQuery } from "./contracts";

const AUDIT_LOG_SELECT = {
  id: true,
  adminId: true,
  adminName: true,
  adminEmail: true,
  adminRole: true,
  action: true,
  targetType: true,
  targetId: true,
  severity: true,
  status: true,
  reason: true,
  ipAddress: true,
  userAgent: true,
  requestId: true,
  createdAt: true,
} satisfies Prisma.AdminAuditLogSelect;

type AuditLogRow = Prisma.AdminAuditLogGetPayload<{
  select: typeof AUDIT_LOG_SELECT;
}>;

function whereFor(query: AuditLogQuery): Prisma.AdminAuditLogWhereInput {
  return {
    ...(query.search
      ? {
          OR: [
            { action: { contains: query.search, mode: "insensitive" } },
            { targetId: { contains: query.search, mode: "insensitive" } },
            { targetType: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.adminId ? { adminId: query.adminId } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
  };
}

function mapAuditLog(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    adminId: row.adminId,
    adminName: row.adminName,
    adminEmail: row.adminEmail,
    adminRole: row.adminRole,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    severity: row.severity,
    status: row.status,
    reason: row.reason,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    requestId: row.requestId,
    createdAt: row.createdAt,
  };
}

export async function listAuditLogs(
  query: AuditLogQuery,
): Promise<AuditLogEntry[]> {
  const rows = await prisma.adminAuditLog.findMany({
    where: whereFor(query),
    skip: query.skip,
    take: query.limit,
    orderBy: { createdAt: query.sortOrder },
    select: AUDIT_LOG_SELECT,
  });

  return rows.map(mapAuditLog);
}

export async function countAuditLogs(query: AuditLogQuery): Promise<number> {
  return prisma.adminAuditLog.count({ where: whereFor(query) });
}

export async function countAllAuditLogs(): Promise<number> {
  return prisma.adminAuditLog.count();
}

export async function countTodayAuditLogs(today: Date): Promise<number> {
  return prisma.adminAuditLog.count({
    where: { createdAt: { gte: today } },
  });
}

export async function groupAuditLogsByAction() {
  return prisma.adminAuditLog.groupBy({
    by: ["action"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });
}

export async function groupAuditLogsByTargetType() {
  return prisma.adminAuditLog.groupBy({
    by: ["targetType"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });
}

export async function listRecentAuditLogs(): Promise<AuditLogEntry[]> {
  const rows = await prisma.adminAuditLog.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: AUDIT_LOG_SELECT,
  });

  return rows.map(mapAuditLog);
}

export const auditRepository = {
  listAuditLogs,
  countAuditLogs,
  countAllAuditLogs,
  countTodayAuditLogs,
  groupAuditLogsByAction,
  groupAuditLogsByTargetType,
  listRecentAuditLogs,
};
