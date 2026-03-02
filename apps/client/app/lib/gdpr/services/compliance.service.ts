import { prisma } from "@build/db";
import { Prisma, AuditAction, LegalBasis, ActorType } from "@prisma/client";

interface AuditLogFilters {
  actorId?: string;
  action?: AuditAction;
  legalBasis?: LegalBasis;
  startDate?: Date;
  endDate?: Date;
}

/**
 * ComplianceService - Handles GDPR/DPA compliance operations
 * including audit logging and admin action tracking.
 */
export class ComplianceService {
  /**
   * Instance method: Get audit logs with pagination and filters
   */
  async getAuditLogs(
    options: {
      page?: number;
      limit?: number;
      userId?: string;
      action?: string;
      startDate?: string;
      endDate?: string;
    } = {},
  ) {
    const {
      page = 1,
      limit = 10,
      userId,
      action,
      startDate,
      endDate,
    } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) where.actorId = userId;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Instance method: Get dashboard statistics
   */
  async getDashboardStats(
    options: { startDate?: string; endDate?: string } = {},
  ) {
    const where: any = {};
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = new Date(options.startDate);
      if (options.endDate) where.createdAt.lte = new Date(options.endDate);
    }

    const [
      consentGranted,
      consentRevoked,
      dataExportRequested,
      accountsDeactivated,
    ] = await Promise.all([
      prisma.auditLog.count({ where: { ...where, action: "CONSENT_GRANTED" } }),
      prisma.auditLog.count({ where: { ...where, action: "CONSENT_REVOKED" } }),
      prisma.auditLog.count({
        where: { ...where, action: "DATA_EXPORT_REQUESTED" },
      }),
      prisma.auditLog.count({
        where: { ...where, action: "ACCOUNT_DEACTIVATED" },
      }),
    ]);

    return {
      consentGranted,
      consentRevoked,
      dataExportRequested,
      accountsDeactivated,
    };
  }

  /**
   * Instance method: Create audit log entry
   */
  async createAuditLog(data: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: any;
  }) {
    return await prisma.auditLog.create({
      data: {
        actorId: data.userId,
        actorType: "USER",
        action: data.action as any,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Instance method: Get security incidents
   */
  async getSecurityIncidents(
    options: { page?: number; limit?: number; severity?: string } = {},
  ) {
    const { page = 1, limit = 10, severity } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (severity) where.severity = severity;

    const [incidents, total] = await Promise.all([
      prisma.securityIncident.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.securityIncident.count({ where }),
    ]);

    return {
      incidents,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Static method: Retrieves audit logs with optional filtering
   */
  static async getAuditLogs(filters: AuditLogFilters = {}) {
    const { actorId, action, legalBasis, startDate, endDate } = filters;

    const where: Record<string, unknown> = {};

    if (actorId) {
      where.actorId = actorId;
    }

    if (action) {
      where.action = action;
    }

    if (legalBasis) {
      where.legalBasis = legalBasis;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = startDate;
      }
      if (endDate) {
        (where.createdAt as Record<string, Date>).lte = endDate;
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return logs;
  }

  /**
   * Logs an admin action for compliance tracking
   */
  static async logAdminAction(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: Record<string, unknown>,
  ) {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: action as AuditAction,
        actorType: "ADMIN",
        entityType,
        entityId,
        metadata: details ? (details as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
  }

  /**
   * Gets compliance statistics for dashboard
   */
  static async getComplianceStats() {
    const [totalLogs, recentLogs, actionBreakdown] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
      prisma.auditLog.groupBy({
        by: ["action"],
        _count: { action: true },
      }),
    ]);

    return {
      totalLogs,
      recentLogs,
      actionBreakdown: actionBreakdown.map((item) => ({
        action: item.action,
        count: item._count.action,
      })),
    };
  }
}
