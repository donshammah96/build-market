// @ts-nocheck
"use server";

import { Prisma, prisma } from "@build/db";
import { safeAction } from "./shared";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export type AuditLogEntry = {
  id: string;
  adminId: string;
  adminEmail: string;
  adminName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export type AuditLogStats = {
  totalLogs: number;
  todayLogs: number;
  byAction: Array<{ action: string; count: number }>;
  byEntityType: Array<{ entityType: string; count: number }>;
  byAdmin: Array<{ adminId: string; adminName: string; count: number }>;
  recentActivity: AuditLogEntry[];
};

// ============================================================================
// Schemas
// ============================================================================

const AuditLogFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
  action: z.string().optional(),
  entityType: z
    .enum(["professional", "store", "property", "user", "settings", "all"])
    .optional(),
  adminId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(["createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type AuditLogFilterInput = z.infer<typeof AuditLogFilterSchema>;

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches a paginated list of audit logs with filtering.
 */
export async function getAuditLogs(filters: Partial<AuditLogFilterInput> = {}) {
  return safeAction("getAuditLogs", async () => {
    const validatedFilters = AuditLogFilterSchema.parse(filters);
    const skip = (validatedFilters.page - 1) * validatedFilters.limit;

    // Build where clause
    const where: Prisma.AdminAuditLogWhereInput = {};

    if (validatedFilters.search) {
      where.OR = [
        { action: { contains: validatedFilters.search, mode: "insensitive" } },
        {
          entityId: { contains: validatedFilters.search, mode: "insensitive" },
        },
      ];
    }

    if (validatedFilters.action) {
      where.action = validatedFilters.action;
    }

    if (validatedFilters.entityType && validatedFilters.entityType !== "all") {
      where.entityType = validatedFilters.entityType;
    }

    if (validatedFilters.adminId) {
      where.adminId = validatedFilters.adminId;
    }

    if (validatedFilters.dateFrom || validatedFilters.dateTo) {
      where.createdAt = {};
      if (validatedFilters.dateFrom)
        where.createdAt.gte = new Date(validatedFilters.dateFrom);
      if (validatedFilters.dateTo)
        where.createdAt.lte = new Date(validatedFilters.dateTo);
    }

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        skip,
        take: validatedFilters.limit,
        orderBy: { createdAt: validatedFilters.sortOrder },
        select: {
          id: true,
          adminId: true,
          action: true,
          entityType: true,
          entityId: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          admin: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    // Transform to include admin name
    // Transform to include admin name
    const formattedLogs: AuditLogEntry[] = logs.map((log) => ({
      id: log.id,
      adminId: log.adminId,
      adminEmail: log.admin?.email || "Unknown",
      adminName: log.admin
        ? `${log.admin.firstName || ""} ${log.admin.lastName || ""}`.trim() ||
          log.admin.email
        : "Unknown",
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    }));
    return {
      logs: formattedLogs,
      meta: {
        total,
        page: validatedFilters.page,
        limit: validatedFilters.limit,
        totalPages: Math.ceil(total / validatedFilters.limit),
      },
      filters: validatedFilters,
    };
  });
}

/**
 * Gets audit log statistics for dashboard.
 */
export async function getAuditLogStats(): Promise<
  ReturnType<typeof safeAction<AuditLogStats>>
> {
  return safeAction("getAuditLogStats", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalLogs,
      todayLogs,
      byAction,
      byEntityType,
      byAdmin,
      recentActivity,
    ] = await Promise.all([
      prisma.adminAuditLog.count(),
      prisma.adminAuditLog.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.adminAuditLog.groupBy({
        by: ["action"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.adminAuditLog.groupBy({
        by: ["entityType"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.adminAuditLog.groupBy({
        by: ["adminId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.adminAuditLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          adminId: true,
          action: true,
          entityType: true,
          entityId: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          admin: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    // Get admin names for byAdmin stats
    const adminIds = byAdmin.map((a) => a.adminId);
    const admins = await prisma.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    const byAdminWithNames = byAdmin.map((a) => {
      const admin = admins.find((adm) => adm.id === a.adminId);
      return {
        adminId: a.adminId,
        adminName: admin
          ? `${admin.firstName || ""} ${admin.lastName || ""}`.trim() ||
            admin.email
          : "Unknown",
        count: a._count.id,
      };
    });

    // Format recent activity
    // Format recent activity
    const formattedRecentActivity: AuditLogEntry[] = recentActivity.map(
      (log) => ({
        id: log.id,
        adminId: log.adminId,
        adminEmail: log.admin?.email || "Unknown",
        adminName: log.admin
          ? `${log.admin.firstName || ""} ${log.admin.lastName || ""}`.trim() ||
            log.admin.email
          : "Unknown",
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        details: null,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      }),
    );
    return {
      totalLogs,
      todayLogs,
      byAction: byAction.map((a) => ({ action: a.action, count: a._count.id })),
      byEntityType: byEntityType.map((e) => ({
        entityType: e.entityType,
        count: e._count.id,
      })),
      byAdmin: byAdminWithNames,
      recentActivity: formattedRecentActivity,
    };
  });
}

/**
 * Gets unique actions for filter dropdown.
 */
export async function getAuditLogActions() {
  return safeAction("getAuditLogActions", async () => {
    const actions = await prisma.adminAuditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    });

    return actions.map((a) => a.action);
  });
}

/**
 * Exports audit logs to CSV format data.
 */
export async function exportAuditLogs(
  filters: Partial<AuditLogFilterInput> = {},
) {
  return safeAction("exportAuditLogs", async () => {
    const validatedFilters = AuditLogFilterSchema.parse({
      ...filters,
      limit: 5000,
    });

    const where: Prisma.AdminAuditLogWhereInput = {};
    if (validatedFilters.action) where.action = validatedFilters.action;
    if (validatedFilters.entityType && validatedFilters.entityType !== "all") {
      where.entityType = validatedFilters.entityType;
    }
    if (validatedFilters.dateFrom || validatedFilters.dateTo) {
      where.createdAt = {};
      if (validatedFilters.dateFrom)
        where.createdAt.gte = new Date(validatedFilters.dateFrom);
      if (validatedFilters.dateTo)
        where.createdAt.lte = new Date(validatedFilters.dateTo);
    }

    const logs = await prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        adminId: true,
        action: true,
        entityType: true,
        entityId: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        admin: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Transform to CSV-friendly format
    const exportData = logs.map((log) => ({
      id: log.id,
      adminEmail: log.admin?.email || "Unknown",
      adminName: log.admin
        ? `${log.admin.firstName || ""} ${log.admin.lastName || ""}`.trim()
        : "",
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: "",
      ipAddress: log.ipAddress || "",
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      data: exportData,
      count: exportData.length,
    };
  });
}
