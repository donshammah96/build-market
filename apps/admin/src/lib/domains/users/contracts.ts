import type { AdminRole, Prisma, UserRole } from "@build/db";
import type { AdminActor } from "@/lib/security/admin-actor";
import type { AssignableUserRole } from "@/lib/users/user-roles";

export type AdminUserActor = AdminActor;

export type UsersDomainErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "USER_NOT_FOUND"
  | "USER_ALREADY_EXISTS"
  | "SELF_ROLE_CHANGE_DENIED"
  | "REPOSITORY_ERROR";

export type UsersDomainError = {
  error: UsersDomainErrorCode;
  message: string;
  status?: number;
  details?: unknown;
};

export type ListUsersInput = {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  verified?: boolean;
  sortBy?: "createdAt" | "firstName";
  sortOrder?: "asc" | "desc";
};

export type ListUsersQuery = {
  where: Prisma.UserWhereInput;
  orderBy: Prisma.UserOrderByWithRelationInput;
  skip: number;
  take: number;
};

export type AdminUserListItem = Prisma.UserGetPayload<{
  include: {
    professionalProfile: {
      select: { companyName: true; verified: true };
    };
  };
}>;

export type AdminUserDetails = Prisma.UserGetPayload<{
  include: {
    professionalProfile: true;
    clientProfile: true;
    orders: true;
    reviews: {
      include: {
        professional: { select: { companyName: true } };
      };
    };
  };
}>;

export type ListUsersResult = {
  users: AdminUserListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type UserIdentityTarget = {
  id: string;
  clerkId: string;
  email: string;
};

export type UserCredentialsTarget = UserIdentityTarget & {
  passwordResetRequired: boolean;
};

export type UserRoleTarget = UserIdentityTarget & {
  role: UserRole;
};

export type InviteUserInput = {
  email: string;
  role: string;
};

export type NormalizedInviteUserInput = {
  email: string;
  role: AssignableUserRole;
};

export type AssignUserRoleInput = {
  userId: string;
  role: string;
};

export type NormalizedAssignUserRoleInput = {
  userId: string;
  role: AssignableUserRole;
};

export type UsersAuthorizationSnapshot = {
  actorRole: AdminRole;
  canManageUsers: boolean;
};

