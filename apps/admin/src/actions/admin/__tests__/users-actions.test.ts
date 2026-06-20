import { beforeEach, describe, expect, it, vi } from "vitest";

const usersServiceMock = vi.hoisted(() => ({
  prepareInviteUser: vi.fn(),
  prepareAssignUserRole: vi.fn(),
  prepareDeleteUser: vi.fn(),
  prepareDeleteUsersBulk: vi.fn(),
  prepareResetUserCredentials: vi.fn(),
  prepareSuspendUser: vi.fn(),
  prepareUnsuspendUser: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
  } as const,
  UserRole: { ADMIN: "ADMIN" } as const,
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
  UserRole: dbMock.UserRole,
  prisma: {},
}));

const usersRepositoryMock = vi.hoisted(() => ({
  deleteUserById: vi.fn(),
  markPasswordResetRequired: vi.fn(),
  updateUserRole: vi.fn(),
  updateUserStatus: vi.fn(),
}));

const sharedMock = vi.hoisted(() => ({
  safeAction: vi.fn(
    async (
      _name: string,
      fn: (context: {
        adminUserId: string;
        adminRole: string;
        actor: {
          clerkId: string;
          dbUserId: string;
          adminRole: string;
        };
        correlationId: string;
        requestStartedAt: number;
      }) => Promise<unknown>,
    ) => {
      try {
        const data = await fn({
          adminUserId: "admin_user_1",
          adminRole: "SUPER_ADMIN",
          actor: {
            clerkId: "clerk_admin_1",
            dbUserId: "admin_user_1",
            adminRole: "SUPER_ADMIN",
          },
          correlationId: "corr_1",
          requestStartedAt: Date.now(),
        });

        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        };
      }
    },
  ),
  parseActionInput: vi.fn(
    (schema: { safeParse: (input: unknown) => unknown }, input: unknown) => {
      const result = schema.safeParse(input) as
        | { success: true; data: unknown }
        | { success: false; error: { issues: Array<{ message?: string }> } };
      if (!result.success) {
        throw new Error(result.error.issues[0]?.message ?? "Invalid input");
      }
      return result.data;
    },
  ),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/domains/stores/store.config", () => ({
  STORE_CONFIG: {
    IDEMPOTENCY_KEY_TTL_HOURS: 1,
  },
}));

vi.mock("../idempotency", () => ({
  runWithIdempotency: vi.fn(async <T>(params: { run: () => Promise<T> }) =>
    params.run(),
  ),
}));

vi.mock("../_core/safe-action", () => ({
  safeAction: sharedMock.safeAction,
}));
vi.mock("../_core/validation", () => ({
  parseActionInput: sharedMock.parseActionInput,
}));
vi.mock("@/_core/safe-action", () => ({
  safeAction: sharedMock.safeAction,
}));
vi.mock("@/_core/validation", () => ({
  parseActionInput: sharedMock.parseActionInput,
}));

vi.mock("@/lib/domains/users", () => ({
  usersService: usersServiceMock,
  usersRepository: usersRepositoryMock,
}));

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  assignUserRole,
  deleteUser,
  deleteUsersBulk,
  inviteUser,
  resetUserCredentials,
  suspendUser,
  unsuspendUser,
} from "../users";
import { safeAction } from "../shared";

const IDEMPOTENCY_KEY = "idem-key-1";

describe("admin users actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invite when the users service denies the input", async () => {
    usersServiceMock.prepareInviteUser.mockResolvedValue({
      ok: false,
      error: "INVALID_INPUT",
      message: "Invalid role. Allowed roles: CLIENT, PROFESSIONAL, ADMIN",
    });

    const response = await inviteUser(
      {
        email: "new.user@example.com",
        role: "not_a_role",
      },
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(false);
    expect(response.error).toContain("Invalid role");
    expect(clerkClient).not.toHaveBeenCalled();
  });

  it("creates a Clerk invitation from the normalized service payload", async () => {
    usersServiceMock.prepareInviteUser.mockResolvedValue({
      ok: true,
      data: {
        email: "new.user@example.com",
        role: "ADMIN",
      },
    });

    const createInvitation = vi.fn().mockResolvedValue({
      id: "inv_123",
    });

    vi.mocked(clerkClient).mockResolvedValue({
      invitations: {
        createInvitation,
      },
    } as never);

    const response = await inviteUser(
      {
        email: " New.User@example.com ",
        role: "admin",
      },
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(true);
    expect(createInvitation).toHaveBeenCalledWith({
      emailAddress: "new.user@example.com",
      publicMetadata: { role: "ADMIN" },
    });
    expect(safeAction).toHaveBeenCalledWith(
      "inviteUser",
      expect.any(Function),
      expect.objectContaining({
        auditLog: expect.objectContaining({
          operation: "INVITE_USER",
          resourceType: "user",
        }),
      }),
    );
  });

  it("updates user role through the repository and Clerk metadata", async () => {
    usersServiceMock.prepareAssignUserRole.mockResolvedValue({
      ok: true,
      data: {
        user: {
          id: "user_1",
          email: "user@example.com",
          role: "CLIENT",
          clerkId: "clerk_1",
        },
        role: "PROFESSIONAL",
      },
    });

    const updateUserMetadata = vi.fn().mockResolvedValue({});
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        updateUserMetadata,
      },
    } as never);

    const response = await assignUserRole(
      "user_1",
      "professional",
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(true);
    expect(usersRepositoryMock.updateUserRole).toHaveBeenCalledWith(
      "user_1",
      "PROFESSIONAL",
    );
    expect(updateUserMetadata).toHaveBeenCalledWith("clerk_1", {
      publicMetadata: {
        role: "PROFESSIONAL",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/users");
    expect(revalidatePath).toHaveBeenCalledWith("/users/user_1");
  });

  it("blocks self-demotion when the users service rejects the assignment", async () => {
    usersServiceMock.prepareAssignUserRole.mockResolvedValue({
      ok: false,
      error: "SELF_ROLE_CHANGE_DENIED",
      message: "Cannot remove your own admin platform role",
    });

    const response = await assignUserRole(
      "admin_user_1",
      "client",
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(false);
    expect(response.error).toBe("Cannot remove your own admin platform role");
    expect(usersRepositoryMock.updateUserRole).not.toHaveBeenCalled();
    expect(clerkClient).not.toHaveBeenCalled();
  });

  it("deletes a user via repository persistence and ignores Clerk 404s", async () => {
    usersServiceMock.prepareDeleteUser.mockResolvedValue({
      ok: true,
      data: {
        id: "user_1",
        clerkId: "clerk_1",
        email: "user@example.com",
      },
    });

    const deleteUserFromClerk = vi
      .fn()
      .mockRejectedValue({ status: 404 } as never);
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        deleteUser: deleteUserFromClerk,
      },
    } as never);

    const response = await deleteUser("user_1", IDEMPOTENCY_KEY);

    expect(response.success).toBe(true);
    expect(usersRepositoryMock.deleteUserById).toHaveBeenCalledWith("user_1");
    expect(revalidatePath).toHaveBeenCalledWith("/users");
    expect(vi.mocked(safeAction).mock.calls[0]?.[0]).toBe("deleteUser");
    expect(vi.mocked(safeAction).mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        auditLog: expect.objectContaining({
          operation: "DELETE_USER",
          resourceType: "user",
        }),
      }),
    );
  });

  it("returns per-item bulk delete results without direct Prisma calls", async () => {
    usersServiceMock.prepareDeleteUsersBulk.mockResolvedValue({
      ok: true,
      data: {
        userIds: ["user_1", "admin_user_1", "user_404"],
      },
    });
    usersServiceMock.prepareDeleteUser
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: "user_1",
          clerkId: "clerk_1",
          email: "user1@example.com",
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: "SELF_DELETE_DENIED",
        message: "Cannot delete your own admin account",
      })
      .mockResolvedValueOnce({
        ok: false,
        error: "USER_NOT_FOUND",
        message: "User not found",
      });

    const deleteUserFromClerk = vi.fn().mockResolvedValue({});
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        deleteUser: deleteUserFromClerk,
      },
    } as never);

    const response = await deleteUsersBulk(
      ["user_1", "admin_user_1", "user_404"],
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(true);
    expect(response.data).toEqual({
      summary: {
        total: 3,
        successful: 1,
        failed: 2,
      },
      results: [
        { userId: "user_1", email: "user1@example.com", success: true },
        {
          userId: "admin_user_1",
          success: false,
          error: "Cannot delete your own admin account",
        },
        {
          userId: "user_404",
          success: false,
          error: "User not found",
        },
      ],
    });
  });

  it("marks credentials reset through the repository and Clerk metadata", async () => {
    usersServiceMock.prepareResetUserCredentials.mockResolvedValue({
      ok: true,
      data: {
        id: "user_1",
        clerkId: "clerk_1",
        email: "user@example.com",
        passwordResetRequired: false,
      },
    });

    const updateUserMetadata = vi.fn().mockResolvedValue({});
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        updateUserMetadata,
      },
    } as never);

    const response = await resetUserCredentials("user_1", IDEMPOTENCY_KEY);

    expect(response.success).toBe(true);
    expect(usersRepositoryMock.markPasswordResetRequired).toHaveBeenCalledWith(
      "user_1",
    );
    expect(updateUserMetadata).toHaveBeenCalledWith("clerk_1", {
      publicMetadata: {
        passwordResetRequired: true,
      },
    });
  });
});

// =============================================================================
// Suspend / Unsuspend actions
// =============================================================================

describe("admin suspend / unsuspend user actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const suspendTarget = {
    id: "user_1",
    clerkId: "clerk_1",
    email: "user@example.com",
    status: "ACTIVE",
  };

  const suspendedTarget = {
    id: "user_1",
    clerkId: "clerk_1",
    email: "user@example.com",
    status: "SUSPENDED",
  };

  // ---------------------------------------------------------------------------
  // suspendUser
  // ---------------------------------------------------------------------------

  describe("suspendUser", () => {
    it("propagates service denial without touching the DB or Clerk", async () => {
      usersServiceMock.prepareSuspendUser.mockResolvedValue({
        ok: false,
        error: "SELF_SUSPEND_DENIED",
        message: "Cannot suspend your own account",
      });

      const response = await suspendUser(
        { userId: "admin_user_1" },
        IDEMPOTENCY_KEY,
      );

      expect(response.success).toBe(false);
      expect(response.error).toBe("Cannot suspend your own account");
      expect(usersRepositoryMock.updateUserStatus).not.toHaveBeenCalled();
      expect(clerkClient).not.toHaveBeenCalled();
    });

    it("writes SUSPENDED to DB before syncing Clerk publicMetadata", async () => {
      usersServiceMock.prepareSuspendUser.mockResolvedValue({
        ok: true,
        data: suspendTarget,
      });

      const updateUserMetadata = vi.fn().mockResolvedValue({});
      vi.mocked(clerkClient).mockResolvedValue({
        users: { updateUserMetadata },
      } as never);

      const response = await suspendUser(
        { userId: "user_1", reason: "Repeated violations" },
        IDEMPOTENCY_KEY,
      );

      expect(response.success).toBe(true);

      // DB write must precede Clerk sync
      const dbCallOrder =
        usersRepositoryMock.updateUserStatus.mock.invocationCallOrder[0];
      const clerkCallOrder = updateUserMetadata.mock.invocationCallOrder[0];
      expect(dbCallOrder).toBeLessThan(clerkCallOrder!);

      expect(usersRepositoryMock.updateUserStatus).toHaveBeenCalledWith(
        "user_1",
        "SUSPENDED",
      );
      expect(updateUserMetadata).toHaveBeenCalledWith("clerk_1", {
        publicMetadata: { status: "SUSPENDED" },
      });
    });

    it("revalidates user list and detail paths after suspension", async () => {
      usersServiceMock.prepareSuspendUser.mockResolvedValue({
        ok: true,
        data: suspendTarget,
      });
      vi.mocked(clerkClient).mockResolvedValue({
        users: { updateUserMetadata: vi.fn().mockResolvedValue({}) },
      } as never);

      await suspendUser({ userId: "user_1" }, IDEMPOTENCY_KEY);

      expect(revalidatePath).toHaveBeenCalledWith("/users");
      expect(revalidatePath).toHaveBeenCalledWith("/users/user_1");
    });

    it("includes SUSPEND_USER audit log entry", async () => {
      usersServiceMock.prepareSuspendUser.mockResolvedValue({
        ok: true,
        data: suspendTarget,
      });
      vi.mocked(clerkClient).mockResolvedValue({
        users: { updateUserMetadata: vi.fn().mockResolvedValue({}) },
      } as never);

      await suspendUser({ userId: "user_1" }, IDEMPOTENCY_KEY);

      expect(vi.mocked(safeAction)).toHaveBeenCalledWith(
        "suspendUser",
        expect.any(Function),
        expect.objectContaining({
          auditLog: expect.objectContaining({
            operation: "SUSPEND_USER",
            resourceType: "user",
          }),
        }),
      );
    });

    it("returns the suspension result payload", async () => {
      usersServiceMock.prepareSuspendUser.mockResolvedValue({
        ok: true,
        data: suspendTarget,
      });
      vi.mocked(clerkClient).mockResolvedValue({
        users: { updateUserMetadata: vi.fn().mockResolvedValue({}) },
      } as never);

      const response = await suspendUser({ userId: "user_1" }, IDEMPOTENCY_KEY);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        suspended: true,
        userId: "user_1",
        email: "user@example.com",
        previousStatus: "ACTIVE",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // unsuspendUser
  // ---------------------------------------------------------------------------

  describe("unsuspendUser", () => {
    it("propagates service denial without touching the DB or Clerk", async () => {
      usersServiceMock.prepareUnsuspendUser.mockResolvedValue({
        ok: false,
        error: "INVALID_INPUT",
        message: "User is not currently suspended",
      });

      const response = await unsuspendUser(
        { userId: "user_1" },
        IDEMPOTENCY_KEY,
      );

      expect(response.success).toBe(false);
      expect(response.error).toBe("User is not currently suspended");
      expect(usersRepositoryMock.updateUserStatus).not.toHaveBeenCalled();
      expect(clerkClient).not.toHaveBeenCalled();
    });

    it("writes ACTIVE to DB before syncing Clerk publicMetadata", async () => {
      usersServiceMock.prepareUnsuspendUser.mockResolvedValue({
        ok: true,
        data: suspendedTarget,
      });

      const updateUserMetadata = vi.fn().mockResolvedValue({});
      vi.mocked(clerkClient).mockResolvedValue({
        users: { updateUserMetadata },
      } as never);

      const response = await unsuspendUser(
        { userId: "user_1" },
        IDEMPOTENCY_KEY,
      );

      expect(response.success).toBe(true);

      const dbCallOrder =
        usersRepositoryMock.updateUserStatus.mock.invocationCallOrder[0];
      const clerkCallOrder = updateUserMetadata.mock.invocationCallOrder[0];
      expect(dbCallOrder).toBeLessThan(clerkCallOrder!);

      expect(usersRepositoryMock.updateUserStatus).toHaveBeenCalledWith(
        "user_1",
        "ACTIVE",
      );
      expect(updateUserMetadata).toHaveBeenCalledWith("clerk_1", {
        publicMetadata: { status: "ACTIVE" },
      });
    });

    it("revalidates user list and detail paths after unsuspension", async () => {
      usersServiceMock.prepareUnsuspendUser.mockResolvedValue({
        ok: true,
        data: suspendedTarget,
      });
      vi.mocked(clerkClient).mockResolvedValue({
        users: { updateUserMetadata: vi.fn().mockResolvedValue({}) },
      } as never);

      await unsuspendUser({ userId: "user_1" }, IDEMPOTENCY_KEY);

      expect(revalidatePath).toHaveBeenCalledWith("/users");
      expect(revalidatePath).toHaveBeenCalledWith("/users/user_1");
    });

    it("includes UNSUSPEND_USER audit log entry", async () => {
      usersServiceMock.prepareUnsuspendUser.mockResolvedValue({
        ok: true,
        data: suspendedTarget,
      });
      vi.mocked(clerkClient).mockResolvedValue({
        users: { updateUserMetadata: vi.fn().mockResolvedValue({}) },
      } as never);

      await unsuspendUser({ userId: "user_1" }, IDEMPOTENCY_KEY);

      expect(vi.mocked(safeAction)).toHaveBeenCalledWith(
        "unsuspendUser",
        expect.any(Function),
        expect.objectContaining({
          auditLog: expect.objectContaining({
            operation: "UNSUSPEND_USER",
            resourceType: "user",
          }),
        }),
      );
    });

    it("returns the unsuspension result payload", async () => {
      usersServiceMock.prepareUnsuspendUser.mockResolvedValue({
        ok: true,
        data: suspendedTarget,
      });
      vi.mocked(clerkClient).mockResolvedValue({
        users: { updateUserMetadata: vi.fn().mockResolvedValue({}) },
      } as never);

      const response = await unsuspendUser(
        { userId: "user_1" },
        IDEMPOTENCY_KEY,
      );

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        unsuspended: true,
        userId: "user_1",
        email: "user@example.com",
        previousStatus: "SUSPENDED",
      });
    });
  });
});
