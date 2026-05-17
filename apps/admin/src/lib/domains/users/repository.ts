import { prisma } from "@build/db";
import type {
  AdminUserDetails,
  ListUsersQuery,
  UserCredentialsTarget,
  UserIdentityTarget,
  UserRoleTarget,
} from "./contracts";

export async function listUsers(query: ListUsersQuery) {
  return prisma.user.findMany({
    where: query.where,
    skip: query.skip,
    take: query.take,
    orderBy: query.orderBy,
    include: {
      professionalProfile: {
        select: { companyName: true, verified: true },
      },
    },
  });
}

export async function countUsers(where: ListUsersQuery["where"]) {
  return prisma.user.count({ where });
}

export async function findUserDetailsById(
  userId: string,
): Promise<AdminUserDetails | null> {
  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      professionalProfile: true,
      clientProfile: true,
      orders: {
        take: 5,
        orderBy: { createdAt: "desc" },
      },
      reviews: {
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          professional: { select: { companyName: true } },
        },
      },
    },
  });
}

export async function findUserIdentityTarget(
  userId: string,
): Promise<UserIdentityTarget | null> {
  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, clerkId: true, email: true },
  });
}

export async function findUserCredentialsTarget(
  userId: string,
): Promise<UserCredentialsTarget | null> {
  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      clerkId: true,
      email: true,
      passwordResetRequired: true,
    },
  });
}

export async function findUserRoleTarget(
  userId: string,
): Promise<UserRoleTarget | null> {
  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, email: true, role: true, clerkId: true },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      deletedAt: null,
    },
    select: { id: true },
  });
}

export async function deleteUserById(userId: string) {
  return prisma.user.delete({ where: { id: userId } });
}

export async function markPasswordResetRequired(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordResetRequired: true },
  });
}

export async function updateUserRole(
  userId: string,
  role: UserRoleTarget["role"],
) {
  return prisma.user.update({
    where: { id: userId },
    data: { role },
  });
}

