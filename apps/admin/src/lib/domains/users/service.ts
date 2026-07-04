import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import { err, ok, type Result } from "@/lib/result";
import {
  ASSIGNABLE_USER_ROLES,
  isAssignableUserRole,
  type AssignableUserRole,
} from "./user-roles";
import type {
  AdminUserDetails,
  AdminUserActor,
  DeleteUsersBulkInput,
  AssignUserRoleInput,
  InviteUserInput,
  ListUsersInput,
  ListUsersQuery,
  ListUsersResult,
  NormalizedAssignUserRoleInput,
  NormalizedInviteUserInput,
  SuspendUserInput,
  UnsuspendUserInput,
  BanUserInput,
  UnbanUserInput,
  DeactivateUserInput,
  ArchiveUserInput,
  UnarchiveUserInput,
  UsersDomainError,
  UserCredentialsTarget,
  UserIdentityTarget,
  UserStatusTarget,
} from "./contracts";
import * as repository from "./repository";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function toDomainError(error: unknown): UsersDomainError {
  return {
    error: "REPOSITORY_ERROR",
    message: error instanceof Error ? error.message : "Users repository failed",
  };
}

function normalizeUserRole(
  role: string,
): Result<AssignableUserRole, UsersDomainError> {
  const normalized = role.trim().toUpperCase();

  if (!isAssignableUserRole(normalized)) {
    return err({
      error: "INVALID_INPUT",
      message: `Invalid role. Allowed roles: ${ASSIGNABLE_USER_ROLES.join(", ")}`,
    });
  }

  return ok(normalized);
}

function requireManageUsers(
  actor: AdminUserActor,
): Result<true, UsersDomainError> {
  const result = requireAdminCapability(actor, AdminCapability.MANAGE_USERS);

  if (result.ok) {
    return ok(true);
  }

  return err({
    error: "UNAUTHORIZED",
    message: "Admin user management permission required",
    details: result.error,
  });
}

export function buildListUsersQuery(
  input: ListUsersInput,
): Result<
  { query: ListUsersQuery; page: number; limit: number },
  UsersDomainError
> {
  const page = Math.max(1, Math.trunc(input.page ?? DEFAULT_PAGE));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Math.trunc(input.limit ?? DEFAULT_LIMIT)),
  );
  const search = input.search?.trim() ?? "";
  const sortBy = input.sortBy === "firstName" ? "firstName" : "createdAt";
  const sortOrder = input.sortOrder === "asc" ? "asc" : "desc";
  const roleResult = input.role ? normalizeUserRole(input.role) : undefined;

  if (roleResult && !roleResult.ok) {
    return roleResult;
  }

  const where: ListUsersQuery["where"] = {
    deletedAt: null,
    ...(search && {
      OR: [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(roleResult?.ok ? { role: roleResult.data } : {}),
    ...(input.verified !== undefined && {
      professionalProfile: {
        verified: input.verified,
      },
    }),
  };

  return ok({
    page,
    limit,
    query: {
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    },
  });
}

export async function listAdminUsers(
  _actor: AdminUserActor,
  input: ListUsersInput,
): Promise<Result<ListUsersResult, UsersDomainError>> {
  const queryResult = buildListUsersQuery(input);

  if (!queryResult.ok) {
    return queryResult;
  }

  try {
    const [users, total] = await Promise.all([
      repository.listUsers(queryResult.data.query),
      repository.countUsers(queryResult.data.query.where),
    ]);

    return ok({
      users,
      meta: {
        total,
        page: queryResult.data.page,
        limit: queryResult.data.limit,
        totalPages: Math.ceil(total / queryResult.data.limit),
      },
    });
  } catch (error) {
    return err(toDomainError(error));
  }
}

export async function getAdminUserDetails(
  _actor: AdminUserActor,
  userId: string,
): Promise<Result<AdminUserDetails, UsersDomainError>> {
  if (!userId.trim()) {
    return err({ error: "INVALID_INPUT", message: "User ID is required" });
  }

  try {
    const user = await repository.findUserDetailsById(userId);

    if (!user) {
      return err({ error: "USER_NOT_FOUND", message: "User not found" });
    }

    return ok(user);
  } catch (error) {
    return err(toDomainError(error));
  }
}

export async function prepareInviteUser(
  actor: AdminUserActor,
  input: InviteUserInput,
): Promise<Result<NormalizedInviteUserInput, UsersDomainError>> {
  const authResult = requireManageUsers(actor);

  if (!authResult.ok) {
    return authResult;
  }

  const email = input.email.trim().toLowerCase();
  const roleResult = normalizeUserRole(input.role || "");

  if (!roleResult.ok) {
    return roleResult;
  }

  if (!email || !email.includes("@")) {
    return err({ error: "INVALID_INPUT", message: "Valid email is required" });
  }

  try {
    const existingUser = await repository.findUserByEmail(email);

    if (existingUser) {
      return err({
        error: "USER_ALREADY_EXISTS",
        message: "A user with this email already exists",
      });
    }

    return ok({ email, role: roleResult.data });
  } catch (error) {
    return err(toDomainError(error));
  }
}

export async function prepareAssignUserRole(
  actor: AdminUserActor,
  input: AssignUserRoleInput,
): Promise<Result<NormalizedAssignUserRoleInput, UsersDomainError>> {
  const authResult = requireManageUsers(actor);

  if (!authResult.ok) {
    return authResult;
  }

  const roleResult = normalizeUserRole(input.role || "");

  if (!roleResult.ok) {
    return roleResult;
  }

  if (input.userId === actor.dbUserId && roleResult.data !== "ADMIN") {
    return err({
      error: "SELF_ROLE_CHANGE_DENIED",
      message: "Cannot remove your own admin platform role",
    });
  }

  try {
    const user = await repository.findUserRoleTarget(input.userId);

    if (!user) {
      return err({ error: "USER_NOT_FOUND", message: "User not found" });
    }

    return ok({ user, role: roleResult.data });
  } catch (error) {
    return err(toDomainError(error));
  }
}

export async function prepareDeleteUser(
  actor: AdminUserActor,
  userId: string,
): Promise<Result<UserIdentityTarget, UsersDomainError>> {
  const authResult = requireManageUsers(actor);

  if (!authResult.ok) {
    return authResult;
  }

  if (!userId.trim()) {
    return err({ error: "INVALID_INPUT", message: "User ID is required" });
  }

  if (userId === actor.dbUserId) {
    return err({
      error: "SELF_DELETE_DENIED",
      message: "Cannot delete your own admin account",
    });
  }

  try {
    const user = await repository.findUserIdentityTarget(userId);

    if (!user) {
      return err({ error: "USER_NOT_FOUND", message: "User not found" });
    }

    return ok(user);
  } catch (error) {
    return err(toDomainError(error));
  }
}

export async function prepareDeleteUsersBulk(
  actor: AdminUserActor,
  input: DeleteUsersBulkInput,
): Promise<Result<{ userIds: string[] }, UsersDomainError>> {
  const authResult = requireManageUsers(actor);

  if (!authResult.ok) {
    return authResult;
  }

  const userIds = Array.from(
    new Set(input.userIds.map((userId) => userId.trim())),
  ).filter(Boolean);

  if (userIds.length === 0) {
    return err({
      error: "USER_SELECTION_REQUIRED",
      message: "No users selected",
    });
  }

  if (userIds.length > 50) {
    return err({
      error: "BULK_LIMIT_EXCEEDED",
      message: "Bulk delete limit exceeded (max 50 users per request)",
    });
  }

  return ok({ userIds });
}

export async function prepareResetUserCredentials(
  actor: AdminUserActor,
  userId: string,
): Promise<Result<UserCredentialsTarget, UsersDomainError>> {
  const authResult = requireManageUsers(actor);

  if (!authResult.ok) {
    return authResult;
  }

  if (!userId.trim()) {
    return err({ error: "INVALID_INPUT", message: "User ID is required" });
  }

  try {
    const user = await repository.findUserCredentialsTarget(userId);

    if (!user) {
      return err({ error: "USER_NOT_FOUND", message: "User not found" });
    }

    return ok(user);
  } catch (error) {
    return err(toDomainError(error));
  }
}

export async function prepareSuspendUser(
  actor: AdminUserActor,
  input: SuspendUserInput,
): Promise<Result<UserStatusTarget, UsersDomainError>> {
  const authResult = requireManageUsers(actor);

  if (!authResult.ok) {
    return authResult;
  }

  const userId = input.userId.trim();

  if (!userId) {
    return err({ error: "INVALID_INPUT", message: "User ID is required" });
  }

  if (userId === actor.dbUserId) {
    return err({
      error: "SELF_SUSPEND_DENIED",
      message: "Cannot suspend your own account",
    });
  }

  try {
    const user = await repository.findUserStatusTarget(userId);

    if (!user) {
      return err({ error: "USER_NOT_FOUND", message: "User not found" });
    }

    if (user.status === "DEACTIVATED") {
      return err({
        error: "DEACTIVATED_USER_REVERT_DENIED",
        message: "Cannot change the status of a deactivated user",
      });
    }

    if (user.status === "SUSPENDED") {
      return err({
        error: "INVALID_INPUT",
        message: "User is already suspended",
      });
    }

    return ok(user);
  } catch (error) {
    return err(toDomainError(error));
  }
}

export async function prepareUnsuspendUser(
  actor: AdminUserActor,
  input: UnsuspendUserInput,
): Promise<Result<UserStatusTarget, UsersDomainError>> {
  const authResult = requireManageUsers(actor);

  if (!authResult.ok) {
    return authResult;
  }

  const userId = input.userId.trim();

  if (!userId) {
    return err({ error: "INVALID_INPUT", message: "User ID is required" });
  }

  try {
    const user = await repository.findUserStatusTarget(userId);

    if (!user) {
      return err({ error: "USER_NOT_FOUND", message: "User not found" });
    }

    if (user.status === "DEACTIVATED") {
      return err({
        error: "DEACTIVATED_USER_REVERT_DENIED",
        message: "Cannot change the status of a deactivated user",
      });
    }

    if (user.status !== "SUSPENDED") {
      return err({
        error: "INVALID_INPUT",
        message: "User is not currently suspended",
      });
    }

    return ok(user);
  } catch (error) {
    return err(toDomainError(error));
  }
}

export async function prepareBanUser(
  actor: AdminUserActor,
  input: BanUserInput,
): Promise<Result<UserStatusTarget, UsersDomainError>> {
  const authResult = requireManageUsers(actor);

  if (!authResult.ok) {
    return authResult;
  }

  const userId = input.userId.trim();

  if (!userId) {
    return err({ error: "INVALID_INPUT", message: "User ID is required" });
  }

  if (userId === actor.dbUserId) {
    return err({
      error: "SELF_BAN_DENIED",
      message: "Cannot ban your own account",
    });
  }

  try {
    const user = await repository.findUserStatusTarget(userId);

    if (!user) {
      return err({ error: "USER_NOT_FOUND", message: "User not found" });
    }

    if (user.status === "DEACTIVATED") {
      return err({
        error: "DEACTIVATED_USER_REVERT_DENIED",
        message: "Cannot change the status of a deactivated user",
      });
    }

    if (user.status === "BANNED") {
      return err({
        error: "INVALID_INPUT",
        message: "User is already banned",
      });
    }

    return ok(user);
  } catch (error) {
    return err(toDomainError(error));
  }
}

export async function prepareUnbanUser(
  actor: AdminUserActor,
  input: UnbanUserInput,
): Promise<Result<UserStatusTarget, UsersDomainError>> {
  const authResult = requireManageUsers(actor);

  if (!authResult.ok) {
    return authResult;
  }

  const userId = input.userId.trim();

  if (!userId) {
    return err({ error: "INVALID_INPUT", message: "User ID is required" });
  }

  try {
    const user = await repository.findUserStatusTarget(userId);

    if (!user) {
      return err({ error: "USER_NOT_FOUND", message: "User not found" });
    }

    if (user.status === "DEACTIVATED") {
      return err({
        error: "DEACTIVATED_USER_REVERT_DENIED",
        message: "Cannot change the status of a deactivated user",
      });
    }

    if (user.status !== "BANNED") {
      return err({
        error: "INVALID_INPUT",
        message: "User is not currently banned",
      });
    }

    return ok(user);
  } catch (error) {
    return err(toDomainError(error));
  }
}

export async function prepareDeactivateUser(
  actor: AdminUserActor,
  input: DeactivateUserInput,
): Promise<Result<UserStatusTarget, UsersDomainError>> {
  const authResult = requireManageUsers(actor);

  if (!authResult.ok) {
    return authResult;
  }

  const userId = input.userId.trim();

  if (!userId) {
    return err({ error: "INVALID_INPUT", message: "User ID is required" });
  }

  if (userId === actor.dbUserId) {
    return err({
      error: "SELF_DEACTIVATE_DENIED",
      message: "Cannot deactivate your own account",
    });
  }

  try {
    const user = await repository.findUserStatusTarget(userId);

    if (!user) {
      return err({ error: "USER_NOT_FOUND", message: "User not found" });
    }

    if (user.status === "DEACTIVATED") {
      return err({
        error: "INVALID_INPUT",
        message: "User is already deactivated",
      });
    }

    return ok(user);
  } catch (error) {
    return err(toDomainError(error));
  }
}

export async function prepareArchiveUser(
  actor: AdminUserActor,
  input: ArchiveUserInput,
): Promise<Result<UserStatusTarget, UsersDomainError>> {
  const authResult = requireManageUsers(actor);

  if (!authResult.ok) {
    return authResult;
  }

  const userId = input.userId.trim();

  if (!userId) {
    return err({ error: "INVALID_INPUT", message: "User ID is required" });
  }

  if (userId === actor.dbUserId) {
    return err({
      error: "SELF_ARCHIVE_DENIED",
      message: "Cannot archive your own account",
    });
  }

  try {
    const user = await repository.findUserStatusTarget(userId);

    if (!user) {
      return err({ error: "USER_NOT_FOUND", message: "User not found" });
    }

    if (user.status === "DEACTIVATED") {
      return err({
        error: "DEACTIVATED_USER_REVERT_DENIED",
        message: "Cannot change the status of a deactivated user",
      });
    }

    if (user.status === "ARCHIVED") {
      return err({
        error: "INVALID_INPUT",
        message: "User is already archived",
      });
    }

    return ok(user);
  } catch (error) {
    return err(toDomainError(error));
  }
}

export async function prepareUnarchiveUser(
  actor: AdminUserActor,
  input: UnarchiveUserInput,
): Promise<Result<UserStatusTarget, UsersDomainError>> {
  const authResult = requireManageUsers(actor);

  if (!authResult.ok) {
    return authResult;
  }

  const userId = input.userId.trim();

  if (!userId) {
    return err({ error: "INVALID_INPUT", message: "User ID is required" });
  }

  try {
    const user = await repository.findUserStatusTarget(userId);

    if (!user) {
      return err({ error: "USER_NOT_FOUND", message: "User not found" });
    }

    if (user.status === "DEACTIVATED") {
      return err({
        error: "DEACTIVATED_USER_REVERT_DENIED",
        message: "Cannot change the status of a deactivated user",
      });
    }

    if (user.status !== "ARCHIVED") {
      return err({
        error: "INVALID_INPUT",
        message: "User is not currently archived",
      });
    }

    return ok(user);
  } catch (error) {
    return err(toDomainError(error));
  }
}
