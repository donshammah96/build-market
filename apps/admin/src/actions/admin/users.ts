"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { safeAction } from "./shared";
import { runWithIdempotency } from "./idempotency";
import { usersRepository, usersService } from "@/lib/domains/users";
import { omitUndefined } from "@/lib/utils";

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

function parseActionInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fallbackMessage: string,
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? fallbackMessage);
  }

  return result.data;
}

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
