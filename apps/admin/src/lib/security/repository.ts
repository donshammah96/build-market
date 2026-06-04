import { prisma, Prisma } from "@build/db";

export async function findUserForVerificationAdmin(clerkId: string) {
  return prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
}

export async function findUserPermissions(clerkId: string) {
  return prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      adminProfile: {
        select: {
          role: true,
          isActive: true,
        },
      },
    },
  });
}

export async function findAdminProfileForGranularRole(userId: string) {
  return prisma.adminProfile.findUnique({
    where: { userId },
    select: {
      role: true,
      isActive: true,
    },
  });
}

export async function findUserForAdminActor(clerkId: string) {
  return prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      adminProfile: {
        select: {
          role: true,
          isActive: true,
        },
      },
    },
  });
}

export async function findUserForAudit(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      adminProfile: {
        select: {
          role: true,
        },
      },
    },
  });
}

export async function createAdminAuditLog(
  data: Prisma.AdminAuditLogUncheckedCreateInput,
) {
  return prisma.adminAuditLog.create({
    data,
  });
}

export const securityRepository = {
  findUserForVerificationAdmin,
  findUserPermissions,
  findAdminProfileForGranularRole,
  findUserForAdminActor,
  findUserForAudit,
  createAdminAuditLog,
};
