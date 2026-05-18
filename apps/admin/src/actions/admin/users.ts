"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { safeAction, requireAdminGranularRole, logAdminAction } from "./shared";
import { runWithIdempotency } from "./idempotency";
import {
  ASSIGNABLE_USER_ROLES,
  type AssignableUserRole,
  isAssignableUserRole,
} from "../../lib/users/user-roles";
import {
  usersService,
  type AdminUserDetails,
  type AdminUserListItem,
} from "@/lib/domains/users";
import { omitUndefined } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type UserWithProfile = AdminUserListItem;
export type UserDetails = AdminUserDetails;

const USER_MUTATION_ROLES = ["SUPER_ADMIN"];
const USER_IDEMPOTENCY_TTL_HOURS = 0.25;

function normalizeUserRole(role: string): AssignableUserRole {
  const normalized = role.trim().toUpperCase();
  if (!isAssignableUserRole(normalized)) {
    throw new Error(
      `Invalid role. Allowed roles: ${ASSIGNABLE_USER_ROLES.join(", ")}`,
    );
  }
  return normalized;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches a paginated list of users with filtering and sorting.
 */
export async function getUsers(
  page = 1,
  limit = 10,
  search = "",
  role?: string,
  verified?: boolean,
  sortBy: "createdAt" | "firstName" = "createdAt",
  sortOrder: "asc" | "desc" = "desc",
) {
  return safeAction("getUsers", async ({ actor }) => {
    const result = await usersService.listAdminUsers(
      actor,
      omitUndefined({
        page,
        limit,
        search,
        role,
        verified,
        sortBy,
        sortOrder,
      }),
    );

    if (!result.ok) {
      throw new Error(result.message);
    }

    return result.data;
  });
}

/**
 * Fetches complete user details with related profiles and recent activity.
 */
export async function getUserDetails(userId: string) {
  return safeAction("getUserDetails", async ({ actor }) => {
    const result = await usersService.getAdminUserDetails(actor, userId);

    if (!result.ok) {
      throw new Error(result.message);
    }

    return result.data;
  });
}

/**
 * Permanently removes a user from both Clerk and database.
 * Returns the deleted user ID for optimistic UI updates.
 *
 * @warning This is a destructive action with cascading deletes.
 */
export async function deleteUser(userId: string, idempotencyKey: string) {
  return safeAction("deleteUser", async ({ adminUserId }) => {
    await requireAdminGranularRole(USER_MUTATION_ROLES, adminUserId);

    return runWithIdempotency({
      adminUserId,
      actionName: "deleteUser",
      idempotencyKey,
      resourceId: userId,
      ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
      run: async () => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, clerkId: true, email: true },
        });

        if (!user) throw new Error("User not found");

        try {
          const client = await clerkClient();
          await client.users.deleteUser(user.clerkId);
        } catch (clerkError: unknown) {
          const error = clerkError as { status?: number };
          if (error.status !== 404) {
            console.error("Clerk delete error:", clerkError);
            throw new Error("Failed to remove user from identity provider");
          }
        }

        await prisma.user.delete({ where: { id: userId } });

        await logAdminAction({
          userId: adminUserId,
          action: "DELETE_USER",
          targetType: "user",
          targetId: user.id,
          details: {
            email: user.email,
          },
        });

        revalidatePath("/users");

        return {
          deleted: true,
          userId: user.id,
          email: user.email,
        };
      },
    });
  });
}

/**
 * Bulk delete users with per-item success/failure reporting.
 */
export async function deleteUsersBulk(
  userIds: string[],
  idempotencyKey: string,
) {
  return safeAction("deleteUsersBulk", async ({ adminUserId }) => {
    await requireAdminGranularRole(USER_MUTATION_ROLES, adminUserId);

    return runWithIdempotency({
      adminUserId,
      actionName: "deleteUsersBulk",
      idempotencyKey,
      resourceId: userIds.slice().sort().join(","),
      ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
      run: async () => {
        const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
        if (uniqueIds.length === 0) {
          throw new Error("No users selected");
        }

        if (uniqueIds.length > 50) {
          throw new Error(
            "Bulk delete limit exceeded (max 50 users per request)",
          );
        }

        const client = await clerkClient();
        const results: Array<{
          userId: string;
          success: boolean;
          email?: string;
          error?: string;
        }> = [];

        for (const userId of uniqueIds) {
          if (userId === adminUserId) {
            results.push({
              userId,
              success: false,
              error: "Cannot delete your own admin account",
            });
            continue;
          }

          try {
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, clerkId: true, email: true },
            });

            if (!user) {
              results.push({ userId, success: false, error: "User not found" });
              continue;
            }

            try {
              await client.users.deleteUser(user.clerkId);
            } catch (clerkError: unknown) {
              const error = clerkError as { status?: number };
              if (error.status !== 404) {
                throw new Error("Failed to remove user from identity provider");
              }
            }

            await prisma.user.delete({ where: { id: user.id } });
            results.push({ userId: user.id, email: user.email, success: true });
          } catch (error) {
            results.push({
              userId,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        const successful = results.filter((result) => result.success).length;
        const failed = results.length - successful;

        await logAdminAction({
          userId: adminUserId,
          action: "BULK_DELETE_USERS",
          targetType: "user",
          targetId: "bulk",
          details: {
            total: results.length,
            successful,
            failed,
          },
        });

        revalidatePath("/users");

        return {
          summary: {
            total: results.length,
            successful,
            failed,
          },
          results,
        };
      },
    });
  });
}

/**
 * Sends a Clerk invitation for a new user with the requested platform role.
 */
export async function inviteUser(
  input: { email: string; role: string },
  idempotencyKey: string,
) {
  return safeAction("inviteUser", async ({ adminUserId }) => {
    await requireAdminGranularRole(USER_MUTATION_ROLES, adminUserId);

    return runWithIdempotency({
      adminUserId,
      actionName: "inviteUser",
      idempotencyKey,
      resourceId: input.email?.trim().toLowerCase(),
      ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
      run: async () => {
        const email = input.email?.trim().toLowerCase();
        const role = normalizeUserRole(input.role || "");

        if (!email || !email.includes("@")) {
          throw new Error("Valid email is required");
        }

        const existingUser = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true },
        });

        if (existingUser) {
          throw new Error("A user with this email already exists");
        }

        const client = await clerkClient();
        const invitation = await client.invitations.createInvitation({
          emailAddress: email,
          publicMetadata: {
            role,
          },
        });

        await logAdminAction({
          userId: adminUserId,
          action: "INVITE_USER",
          targetType: "user",
          targetId: invitation.id || email,
          details: {
            email,
            role,
            invitationId: invitation.id || null,
          },
        });

        return {
          invited: true,
          email,
          role,
          invitationId: invitation.id || null,
        };
      },
    });
  });
}

/**
 * Forces a user to reset credentials on next login.
 */
export async function resetUserCredentials(
  userId: string,
  idempotencyKey: string,
) {
  return safeAction("resetUserCredentials", async ({ adminUserId }) => {
    await requireAdminGranularRole(USER_MUTATION_ROLES, adminUserId);

    return runWithIdempotency({
      adminUserId,
      actionName: "resetUserCredentials",
      idempotencyKey,
      resourceId: userId,
      ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
      run: async () => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            clerkId: true,
            email: true,
            passwordResetRequired: true,
          },
        });

        if (!user) {
          throw new Error("User not found");
        }

        const client = await clerkClient();
        await client.users.updateUserMetadata(user.clerkId, {
          publicMetadata: {
            passwordResetRequired: true,
          },
        });

        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetRequired: true,
          },
        });

        await logAdminAction({
          userId: adminUserId,
          action: "RESET_USER_CREDENTIALS",
          targetType: "user",
          targetId: user.id,
          details: {
            email: user.email,
            previouslyRequired: user.passwordResetRequired,
            nowRequired: true,
          },
        });

        revalidatePath("/users");
        revalidatePath(`/users/${user.id}`);

        return {
          updated: true,
          userId: user.id,
          email: user.email,
          passwordResetRequired: true,
        };
      },
    });
  });
}

/**
 * Assigns a new platform role to an existing user.
 */
export async function assignUserRole(
  userId: string,
  roleInput: string,
  idempotencyKey: string,
) {
  return safeAction("assignUserRole", async ({ adminUserId }) => {
    await requireAdminGranularRole(USER_MUTATION_ROLES, adminUserId);

    return runWithIdempotency({
      adminUserId,
      actionName: "assignUserRole",
      idempotencyKey,
      resourceId: userId,
      ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
      run: async () => {
        const newRole = normalizeUserRole(roleInput || "");

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, role: true, clerkId: true },
        });

        if (!user) {
          throw new Error("User not found");
        }

        if (user.id === adminUserId && newRole !== "ADMIN") {
          throw new Error("Cannot remove your own admin platform role");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            role: newRole,
          },
        });

        const client = await clerkClient();
        await client.users.updateUserMetadata(user.clerkId, {
          publicMetadata: {
            role: newRole,
          },
        });

        await logAdminAction({
          userId: adminUserId,
          action: "ASSIGN_USER_ROLE",
          targetType: "user",
          targetId: user.id,
          details: {
            email: user.email,
            previousRole: user.role,
            newRole,
          },
        });

        revalidatePath("/users");
        revalidatePath(`/users/${user.id}`);

        return {
          updated: true,
          userId: user.id,
          email: user.email,
          previousRole: user.role,
          newRole,
        };
      },
    });
  });
}
