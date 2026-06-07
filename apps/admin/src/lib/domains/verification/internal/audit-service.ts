/**
 * Audit Service
 * Centralized audit logging for admin verification actions
 */

import { prisma } from "@build/db";
import { StructuredLogger } from "@build/resilience";
import { omitUndefined } from "@/lib/utils";

const logger = new StructuredLogger("audit-service");

export interface AuditLogData {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldStatus?: string | undefined;
  newStatus: string;
  reason?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    const admin = await prisma.user?.findUnique?.({
      where: { id: data.adminId },
      select: { firstName: true, lastName: true, email: true, role: true },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: data.adminId,
        adminName: admin
          ? `${admin.firstName} ${admin.lastName}`.trim()
          : "Unknown Admin",
        adminEmail: admin?.email || "unknown@admin",
        adminRole: admin?.role || "ADMIN",
        action: data.action,
        targetType: data.entityType,
        targetId: data.entityId,
        details: {
          ...(data.metadata ?? {}),
          ...omitUndefined({
            oldStatus: data.oldStatus,
          }),
          newStatus: data.newStatus,
        },
        ...(data.reason !== undefined ? { reason: data.reason } : {}),
        ...(data.ipAddress !== undefined ? { ipAddress: data.ipAddress } : {}),
        ...(data.userAgent !== undefined ? { userAgent: data.userAgent } : {}),
      },
    });

    logger.info("Audit log created", {
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      adminId: data.adminId,
    });
  } catch (error) {
    logger.error("Failed to create audit log", error as Error, {
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
    });
    // Don't throw - audit failure shouldn't block the operation
  }
}

export async function getAuditHistory(
  entityType: string,
  entityId: string,
  limit: number = 50,
) {
  return prisma.adminAuditLog.findMany({
    where: {
      targetType: entityType,
      targetId: entityId,
    },
    include: {
      admin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}

export async function getAdminActivityLog(
  adminId: string,
  limit: number = 100,
) {
  return prisma.adminAuditLog.findMany({
    where: {
      adminId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}
