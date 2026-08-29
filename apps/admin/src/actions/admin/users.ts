"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { safeAction } from "@/_core/safe-action";
import { parseActionInput } from "@/_core/validation";
import { runWithIdempotency } from "./idempotency";
import { usersRepository, usersService } from "@/lib/domains/users";
import { omitUndefined } from "@/lib/utils";
import { performGdprErasure } from "@/lib/jobs/gdpr-erasure";

const USER_IDEMPOTENCY_TTL_HOURS = 0.25;
const NonEmptyStringSchema = z.string().trim().min(1);
const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(1, "Idempotency-Key is required");
const InviteUserSchema = z
  .object({
    email: z.string().trim(),
    role: z.string().trim(),
  })
  .strict();
const AssignUserRoleSchema = z
  .object({
    userId: NonEmptyStringSchema,
    role: z.string().trim(),
  })
  .strict();
const DeleteUsersBulkSchema = z
  .object({
    userIds: z.array(z.string()),
  })
  .strict();

function buildClerkDeleteError(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? (error as { status?: number }).status
      : undefined;

  if (status === 404) {
    return { ignored: true };
  }

  throw new Error("Failed to remove user from identity provider");
}

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

export async function getUserDetails(targetUserId: string) {
  return safeAction("getUserDetails", async ({ actor }) => {
    const parsedUserId = parseActionInput(
      NonEmptyStringSchema,
      targetUserId,
      "User ID is required",
    );

    const result = await usersService.getAdminUserDetails(actor, parsedUserId);

    if (!result.ok) {
      throw new Error(result.message);
    }

    return result.data;
  });
}

export async function deleteUser(userId: string, idempotencyKey: string) {
  return safeAction(
    "deleteUser",
    async ({ actor, adminUserId }) => {
      const parsedUserId = parseActionInput(
        NonEmptyStringSchema,
        userId,
        "User ID is required",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "deleteUser",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedUserId,
        ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await usersService.prepareDeleteUser(
            actor,
            parsedUserId,
          );

          if (!result.ok) {
            throw new Error(result.message);
          }

          const user = result.data;

          try {
            const client = await clerkClient();
            await client.users.deleteUser(user.clerkId);
          } catch (error) {
            buildClerkDeleteError(error);
          }

          await usersRepository.deleteUserById(user.id);

          revalidatePath("/users");

          return {
            deleted: true,
            userId: user.id,
            email: user.email,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "DELETE_USER",
        resourceType: "user",
        getTargetId: ({ data }) => {
          const result = data as { userId: string };
          return result.userId;
        },
        getDetails: () => ({
          deleted: true,
        }),
      },
    },
  );
}

export async function deleteUsersBulk(
  userIds: string[],
  idempotencyKey: string,
) {
  return safeAction(
    "deleteUsersBulk",
    async ({ actor, adminUserId }) => {
      const parsedInput = parseActionInput(
        DeleteUsersBulkSchema,
        { userIds },
        "No users selected",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "deleteUsersBulk",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedInput.userIds.slice().sort().join(","),
        ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const batchResult = await usersService.prepareDeleteUsersBulk(actor, {
            userIds: parsedInput.userIds,
          });

          if (!batchResult.ok) {
            throw new Error(batchResult.message);
          }

          const client = await clerkClient();
          const results: Array<{
            userId: string;
            success: boolean;
            email?: string;
            error?: string;
          }> = [];

          for (const candidateId of batchResult.data.userIds) {
            const deleteResult = await usersService.prepareDeleteUser(
              actor,
              candidateId,
            );

            if (!deleteResult.ok) {
              results.push({
                userId: candidateId,
                success: false,
                error: deleteResult.message,
              });
              continue;
            }

            const user = deleteResult.data;

            try {
              await client.users.deleteUser(user.clerkId);
            } catch (error) {
              buildClerkDeleteError(error);
            }

            await usersRepository.deleteUserById(user.id);
            results.push({ userId: user.id, email: user.email, success: true });
          }

          const successful = results.filter((result) => result.success).length;
          const failed = results.length - successful;

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
    },
    {
      auditLog: {
        operation: "BULK_DELETE_USERS",
        resourceType: "user",
        getTargetId: () => "bulk",
        getDetails: ({ data }) => {
          const result = data as {
            summary: { total: number; successful: number; failed: number };
          };
          return result.summary;
        },
      },
    },
  );
}

export async function inviteUser(
  input: { email: string; role: string },
  idempotencyKey: string,
) {
  return safeAction(
    "inviteUser",
    async ({ actor, adminUserId }) => {
      const parsedInput = parseActionInput(
        InviteUserSchema,
        input,
        "Valid invitation payload is required",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "inviteUser",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedInput.email.trim().toLowerCase(),
        ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await usersService.prepareInviteUser(
            actor,
            parsedInput,
          );

          if (!result.ok) {
            throw new Error(result.message);
          }

          const client = await clerkClient();
          const invitation = await client.invitations.createInvitation({
            emailAddress: result.data.email,
            publicMetadata: {
              role: result.data.role,
            },
          });

          return {
            invited: true,
            email: result.data.email,
            role: result.data.role,
            invitationId: invitation.id || null,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "INVITE_USER",
        resourceType: "user",
        getTargetId: ({ data }) => {
          const result = data as { invitationId: string | null; email: string };
          return result.invitationId ?? result.email;
        },
        getDetails: ({ data }) => {
          const result = data as { role: string; invitationId: string | null };
          return {
            role: result.role,
            invitationId: result.invitationId,
          };
        },
      },
    },
  );
}

export async function resetUserCredentials(
  userId: string,
  idempotencyKey: string,
) {
  return safeAction(
    "resetUserCredentials",
    async ({ actor, adminUserId }) => {
      const parsedUserId = parseActionInput(
        NonEmptyStringSchema,
        userId,
        "User ID is required",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "resetUserCredentials",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedUserId,
        ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await usersService.prepareResetUserCredentials(
            actor,
            parsedUserId,
          );

          if (!result.ok) {
            throw new Error(result.message);
          }

          const user = result.data;
          const client = await clerkClient();

          await client.users.updateUserMetadata(user.clerkId, {
            publicMetadata: {
              passwordResetRequired: true,
            },
          });

          await usersRepository.markPasswordResetRequired(user.id);

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
    },
    {
      auditLog: {
        operation: "RESET_USER_CREDENTIALS",
        resourceType: "user",
        getTargetId: ({ data }) => {
          const result = data as { userId: string };
          return result.userId;
        },
        getDetails: () => ({
          passwordResetRequired: true,
        }),
      },
    },
  );
}

export async function assignUserRole(
  userId: string,
  roleInput: string,
  idempotencyKey: string,
) {
  return safeAction(
    "assignUserRole",
    async ({ actor, adminUserId }) => {
      const parsedInput = parseActionInput(
        AssignUserRoleSchema,
        { userId, role: roleInput },
        "Valid role assignment payload is required",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "assignUserRole",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedInput.userId,
        ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await usersService.prepareAssignUserRole(
            actor,
            parsedInput,
          );

          if (!result.ok) {
            throw new Error(result.message);
          }

          const { user, role } = result.data;

          await usersRepository.updateUserRole(user.id, role);

          const client = await clerkClient();
          await client.users.updateUserMetadata(user.clerkId, {
            publicMetadata: {
              role,
            },
          });

          revalidatePath("/users");
          revalidatePath(`/users/${user.id}`);

          return {
            updated: true,
            userId: user.id,
            email: user.email,
            previousRole: user.role,
            newRole: role,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "ASSIGN_USER_ROLE",
        resourceType: "user",
        getTargetId: ({ data }) => {
          const result = data as { userId: string };
          return result.userId;
        },
        getDetails: ({ data }) => {
          const result = data as { previousRole: string; newRole: string };
          return {
            previousRole: result.previousRole,
            newRole: result.newRole,
          };
        },
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Suspend / Unsuspend
// ---------------------------------------------------------------------------

const SuspendUserSchema = z
  .object({
    userId: NonEmptyStringSchema,
    reason: z.string().trim().optional(),
  })
  .strict();

const UnsuspendUserSchema = z
  .object({
    userId: NonEmptyStringSchema,
  })
  .strict();

const BanUserSchema = z
  .object({
    userId: NonEmptyStringSchema,
    reason: z.string().trim().optional(),
  })
  .strict();

const UnbanUserSchema = z
  .object({
    userId: NonEmptyStringSchema,
  })
  .strict();

const DeactivateUserSchema = z
  .object({
    userId: NonEmptyStringSchema,
  })
  .strict();

const ArchiveUserSchema = z
  .object({
    userId: NonEmptyStringSchema,
    reason: z.string().trim().optional(),
  })
  .strict();

const UnarchiveUserSchema = z
  .object({
    userId: NonEmptyStringSchema,
  })
  .strict();

/**
 * Suspends a user account.
 *
 * Effect: sets `status = SUSPENDED` in the database AND writes
 * `publicMetadata.status = "SUSPENDED"` in Clerk so that middleware blocks
 * the user on their next request without a DB round-trip.
 *
 * Session freshness note: this is a Tier 2 operation (account transition).
 * The `safeAction` wrapper enforces `maxAgeSeconds: 300` via its internal
 * `withAuth` call if the admin env is configured for session freshness checks.
 */
export async function suspendUser(
  input: { userId: string; reason?: string },
  idempotencyKey: string,
) {
  return safeAction(
    "suspendUser",
    async ({ actor, adminUserId }) => {
      const parsedInput = parseActionInput(
        SuspendUserSchema,
        input,
        "Valid suspension payload is required",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "suspendUser",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedInput.userId,
        ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await usersService.prepareSuspendUser(actor, {
            userId: parsedInput.userId,
            ...(parsedInput.reason !== undefined
              ? { reason: parsedInput.reason }
              : {}),
          });

          if (!result.ok) {
            throw new Error(result.message);
          }

          const user = result.data;

          // 1. Update authoritative DB record first.
          await usersRepository.updateUserStatus(user.id, "SUSPENDED");

          // 2. Sync to Clerk publicMetadata so middleware can block
          //    on the next token refresh without a DB call.
          const client = await clerkClient();
          await client.users.updateUserMetadata(user.clerkId, {
            publicMetadata: {
              status: "SUSPENDED",
            },
          });

          revalidatePath("/users");
          revalidatePath(`/users/${user.id}`);

          return {
            suspended: true,
            userId: user.id,
            email: user.email,
            previousStatus: user.status,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "SUSPEND_USER",
        resourceType: "user",
        getTargetId: ({ data }) => {
          const result = data as { userId: string };
          return result.userId;
        },
        getDetails: ({ data }) => {
          const result = data as {
            previousStatus: string;
            suspended: boolean;
          };
          return {
            previousStatus: result.previousStatus,
            suspended: result.suspended,
          };
        },
      },
    },
  );
}

/**
 * Restores a suspended user account to ACTIVE status.
 *
 * Effect: sets `status = ACTIVE` in the database AND clears
 * `publicMetadata.status` in Clerk so that middleware stops blocking the user.
 */
export async function unsuspendUser(
  input: { userId: string },
  idempotencyKey: string,
) {
  return safeAction(
    "unsuspendUser",
    async ({ actor, adminUserId }) => {
      const parsedInput = parseActionInput(
        UnsuspendUserSchema,
        input,
        "Valid unsuspend payload is required",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "unsuspendUser",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedInput.userId,
        ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await usersService.prepareUnsuspendUser(actor, {
            userId: parsedInput.userId,
          });

          if (!result.ok) {
            throw new Error(result.message);
          }

          const user = result.data;

          // 1. Update authoritative DB record first.
          await usersRepository.updateUserStatus(user.id, "ACTIVE");

          // 2. Remove the blocked status from Clerk publicMetadata so
          //    middleware stops blocking the user on token refresh.
          const client = await clerkClient();
          await client.users.updateUserMetadata(user.clerkId, {
            publicMetadata: {
              status: "ACTIVE",
            },
          });

          revalidatePath("/users");
          revalidatePath(`/users/${user.id}`);

          return {
            unsuspended: true,
            userId: user.id,
            email: user.email,
            previousStatus: user.status,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "UNSUSPEND_USER",
        resourceType: "user",
        getTargetId: ({ data }) => {
          const result = data as { userId: string };
          return result.userId;
        },
        getDetails: ({ data }) => {
          const result = data as {
            previousStatus: string;
            unsuspended: boolean;
          };
          return {
            previousStatus: result.previousStatus,
            unsuspended: result.unsuspended,
          };
        },
      },
    },
  );
}

export async function banUser(
  input: { userId: string; reason?: string },
  idempotencyKey: string,
) {
  return safeAction(
    "banUser",
    async ({ actor, adminUserId }) => {
      const parsedInput = parseActionInput(
        BanUserSchema,
        input,
        "Valid ban payload is required",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "banUser",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedInput.userId,
        ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await usersService.prepareBanUser(actor, {
            userId: parsedInput.userId,
            ...(parsedInput.reason !== undefined
              ? { reason: parsedInput.reason }
              : {}),
          });

          if (!result.ok) {
            throw new Error(result.message);
          }

          const user = result.data;

          await usersRepository.updateUserStatus(user.id, "BANNED");

          const client = await clerkClient();
          await client.users.updateUserMetadata(user.clerkId, {
            publicMetadata: {
              status: "BANNED",
            },
          });

          revalidatePath("/users");
          revalidatePath(`/users/${user.id}`);

          return {
            banned: true,
            userId: user.id,
            email: user.email,
            previousStatus: user.status,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "BAN_USER",
        resourceType: "user",
        getTargetId: ({ data }) => {
          const result = data as { userId: string };
          return result.userId;
        },
        getDetails: ({ data }) => {
          const result = data as {
            previousStatus: string;
            banned: boolean;
          };
          return {
            previousStatus: result.previousStatus,
            banned: result.banned,
          };
        },
      },
    },
  );
}

export async function unbanUser(
  input: { userId: string },
  idempotencyKey: string,
) {
  return safeAction(
    "unbanUser",
    async ({ actor, adminUserId }) => {
      const parsedInput = parseActionInput(
        UnbanUserSchema,
        input,
        "Valid unban payload is required",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "unbanUser",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedInput.userId,
        ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await usersService.prepareUnbanUser(actor, {
            userId: parsedInput.userId,
          });

          if (!result.ok) {
            throw new Error(result.message);
          }

          const user = result.data;

          await usersRepository.updateUserStatus(user.id, "ACTIVE");

          const client = await clerkClient();
          await client.users.updateUserMetadata(user.clerkId, {
            publicMetadata: {
              status: "ACTIVE",
            },
          });

          revalidatePath("/users");
          revalidatePath(`/users/${user.id}`);

          return {
            unbanned: true,
            userId: user.id,
            email: user.email,
            previousStatus: user.status,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "UNBAN_USER",
        resourceType: "user",
        getTargetId: ({ data }) => {
          const result = data as { userId: string };
          return result.userId;
        },
        getDetails: ({ data }) => {
          const result = data as {
            previousStatus: string;
            unbanned: boolean;
          };
          return {
            previousStatus: result.previousStatus,
            unbanned: result.unbanned,
          };
        },
      },
    },
  );
}

export async function deactivateUser(
  input: { userId: string },
  idempotencyKey: string,
) {
  return safeAction(
    "deactivateUser",
    async ({ actor, adminUserId }) => {
      const parsedInput = parseActionInput(
        DeactivateUserSchema,
        input,
        "Valid deactivation payload is required",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "deactivateUser",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedInput.userId,
        ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await usersService.prepareDeactivateUser(actor, {
            userId: parsedInput.userId,
          });

          if (!result.ok) {
            throw new Error(result.message);
          }

          const user = result.data;

          await performGdprErasure(user.id);

          revalidatePath("/users");
          revalidatePath(`/users/${user.id}`);

          return {
            deactivated: true,
            userId: user.id,
            email: user.email,
            previousStatus: user.status,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "DEACTIVATE_USER",
        resourceType: "user",
        getTargetId: ({ data }) => {
          const result = data as { userId: string };
          return result.userId;
        },
        getDetails: ({ data }) => {
          const result = data as {
            previousStatus: string;
            deactivated: boolean;
          };
          return {
            previousStatus: result.previousStatus,
            deactivated: result.deactivated,
          };
        },
      },
    },
  );
}

export async function archiveUser(
  input: { userId: string; reason?: string },
  idempotencyKey: string,
) {
  return safeAction(
    "archiveUser",
    async ({ actor, adminUserId }) => {
      const parsedInput = parseActionInput(
        ArchiveUserSchema,
        input,
        "Valid archive payload is required",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "archiveUser",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedInput.userId,
        ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await usersService.prepareArchiveUser(actor, {
            userId: parsedInput.userId,
            ...(parsedInput.reason !== undefined
              ? { reason: parsedInput.reason }
              : {}),
          });

          if (!result.ok) {
            throw new Error(result.message);
          }

          const user = result.data;

          await usersRepository.updateUserStatus(user.id, "ARCHIVED");

          const client = await clerkClient();
          await client.users.updateUserMetadata(user.clerkId, {
            publicMetadata: {
              status: "ARCHIVED",
            },
          });

          revalidatePath("/users");
          revalidatePath(`/users/${user.id}`);

          return {
            archived: true,
            userId: user.id,
            email: user.email,
            previousStatus: user.status,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "ARCHIVE_USER",
        resourceType: "user",
        getTargetId: ({ data }) => {
          const result = data as { userId: string };
          return result.userId;
        },
        getDetails: ({ data }) => {
          const result = data as {
            previousStatus: string;
            archived: boolean;
          };
          return {
            previousStatus: result.previousStatus,
            archived: result.archived,
          };
        },
      },
    },
  );
}

export async function unarchiveUser(
  input: { userId: string },
  idempotencyKey: string,
) {
  return safeAction(
    "unarchiveUser",
    async ({ actor, adminUserId }) => {
      const parsedInput = parseActionInput(
        UnarchiveUserSchema,
        input,
        "Valid unarchive payload is required",
      );
      const parsedIdempotencyKey = parseActionInput(
        IdempotencyKeySchema,
        idempotencyKey,
        "Idempotency-Key is required",
      );

      return runWithIdempotency({
        adminUserId,
        actionName: "unarchiveUser",
        idempotencyKey: parsedIdempotencyKey,
        resourceId: parsedInput.userId,
        ttlHours: USER_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result = await usersService.prepareUnarchiveUser(actor, {
            userId: parsedInput.userId,
          });

          if (!result.ok) {
            throw new Error(result.message);
          }

          const user = result.data;

          await usersRepository.updateUserStatus(user.id, "ACTIVE");

          const client = await clerkClient();
          await client.users.updateUserMetadata(user.clerkId, {
            publicMetadata: {
              status: "ACTIVE",
            },
          });

          revalidatePath("/users");
          revalidatePath(`/users/${user.id}`);

          return {
            unarchived: true,
            userId: user.id,
            email: user.email,
            previousStatus: user.status,
          };
        },
      });
    },
    {
      auditLog: {
        operation: "UNARCHIVE_USER",
        resourceType: "user",
        getTargetId: ({ data }) => {
          const result = data as { userId: string };
          return result.userId;
        },
        getDetails: ({ data }) => {
          const result = data as {
            previousStatus: string;
            unarchived: boolean;
          };
          return {
            previousStatus: result.previousStatus,
            unarchived: result.unarchived,
          };
        },
      },
    },
  );
}
