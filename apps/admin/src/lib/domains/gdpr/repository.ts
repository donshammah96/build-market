import { prisma } from "@build/db";
import { Prisma, AuditAction } from "@prisma/client";
import type { AuditLogEntry, ComplianceQueueFilters } from "./contracts";

/**
 * Persistence-only layer for GDPR/compliance audit log operations.
 * Wraps the Prisma AuditLog model.
 * No authorization. No response shaping beyond typed DTOs.
 */
export const gdprRepository = {
  async findAuditLogs(
    filters: ComplianceQueueFilters = {},
  ): Promise<AuditLogEntry[]> {
    const { actorId, action, legalBasis, startDate, endDate } = filters;

    const where: Record<string, unknown> = {};

    if (actorId) where.actorId = actorId;
    if (action) where.action = action;
    if (legalBasis) where.legalBasis = legalBasis;
    if (startDate ?? endDate) {
      const dateRange: Record<string, Date> = {};
      if (startDate) dateRange.gte = startDate;
      if (endDate) dateRange.lte = endDate;
      where.createdAt = dateRange;
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

    return logs as AuditLogEntry[];
  },

  async logAdminAction(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
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
  },
};
