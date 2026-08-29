import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
  } as const,
}));

const repositoryMock = vi.hoisted(() => ({
  listUsers: vi.fn(),
  countUsers: vi.fn(),
  findUserDetailsById: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserRoleTarget: vi.fn(),
  findUserIdentityTarget: vi.fn(),
  findUserCredentialsTarget: vi.fn(),
  findUserStatusTarget: vi.fn(),
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
}));

vi.mock("../repository", () => repositoryMock);

import type { AdminUserActor } from "../contracts";
import {
  buildListUsersQuery,
  getAdminUserDetails,
  listAdminUsers,
  prepareAssignUserRole,
  prepareDeleteUser,
  prepareDeleteUsersBulk,
  prepareInviteUser,
  prepareResetUserCredentials,
  prepareSuspendUser,
  prepareUnsuspendUser,
  prepareBanUser,
  prepareUnbanUser,
  prepareDeactivateUser,
  prepareArchiveUser,
  prepareUnarchiveUser,
} from "../service";

function actor(
  adminRole: (typeof dbMock.AdminRole)[keyof typeof dbMock.AdminRole],
): AdminUserActor {
  return {
    clerkId: "clerk_admin",
    dbUserId: "admin_1",
    adminRole,
  };
}

describe("users domain service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds list query with soft-delete guard, filters, pagination, and sorting", () => {
    const result = buildListUsersQuery({
      page: 2,
      limit: 25,
      search: " ada ",
      role: "professional",
      verified: true,
      sortBy: "firstName",
      sortOrder: "asc",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.query).toEqual({
      where: {
        deletedAt: null,
        OR: [
          { email: { contains: "ada", mode: "insensitive" } },
          { firstName: { contains: "ada", mode: "insensitive" } },
          { lastName: { contains: "ada", mode: "insensitive" } },
        ],
        role: "PROFESSIONAL",
        professionalProfile: { verified: true },
      },
      skip: 25,
      take: 25,
      orderBy: { firstName: "asc" },
    });
  });

  it("rejects invalid role filters before repository access", async () => {
    const result = await listAdminUsers(actor(dbMock.AdminRole.AUDITOR), {
      role: "owner",
    });

    expect(result).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: "Invalid role. Allowed roles: CLIENT, PROFESSIONAL, ADMIN",
    });
    expect(repositoryMock.listUsers).not.toHaveBeenCalled();
  });

  it("returns paginated users", async () => {
    repositoryMock.listUsers.mockResolvedValue([{ id: "user_1" }]);
    repositoryMock.countUsers.mockResolvedValue(1);

    const result = await listAdminUsers(actor(dbMock.AdminRole.AUDITOR), {
      page: 1,
      limit: 10,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        users: [{ id: "user_1" }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      },
    });
  });

  it("returns user details or a typed not-found error", async () => {
    repositoryMock.findUserDetailsById.mockResolvedValue(null);

    const result = await getAdminUserDetails(
      actor(dbMock.AdminRole.SUPPORT_AGENT),
      "user_1",
    );

    expect(result).toEqual({
      ok: false,
      error: "USER_NOT_FOUND",
      message: "User not found",
    });
  });

  it("allows only SUPER_ADMIN to prepare user invitations", async () => {
    const denied = await prepareInviteUser(
      actor(dbMock.AdminRole.FINANCE_MANAGER),
      {
        email: "new@example.com",
        role: "client",
      },
    );

    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error).toBe("UNAUTHORIZED");

    repositoryMock.findUserByEmail.mockResolvedValue(null);
    const allowed = await prepareInviteUser(
      actor(dbMock.AdminRole.SUPER_ADMIN),
      {
        email: " New.User@Example.COM ",
        role: "professional",
      },
    );

    expect(allowed).toEqual({
      ok: true,
      data: { email: "new.user@example.com", role: "PROFESSIONAL" },
    });
  });

  it("blocks non-admin self-demotion during role assignment preparation", async () => {
    const result = await prepareAssignUserRole(
      actor(dbMock.AdminRole.SUPER_ADMIN),
      {
        userId: "admin_1",
        role: "client",
      },
    );

    expect(result).toEqual({
      ok: false,
      error: "SELF_ROLE_CHANGE_DENIED",
      message: "Cannot remove your own admin platform role",
    });
  });

  it("loads the target user during role assignment preparation", async () => {
    repositoryMock.findUserRoleTarget.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      role: "CLIENT",
      clerkId: "clerk_1",
    });

    const result = await prepareAssignUserRole(
      actor(dbMock.AdminRole.SUPER_ADMIN),
      {
        userId: "user_1",
        role: "professional",
      },
    );

    expect(result).toEqual({
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
  });

  it("prevents self-deletion and missing targets during delete preparation", async () => {
    const selfDelete = await prepareDeleteUser(
      actor(dbMock.AdminRole.SUPER_ADMIN),
      "admin_1",
    );

    expect(selfDelete).toEqual({
      ok: false,
      error: "SELF_DELETE_DENIED",
      message: "Cannot delete your own admin account",
    });

    repositoryMock.findUserIdentityTarget.mockResolvedValue(null);
    const missing = await prepareDeleteUser(
      actor(dbMock.AdminRole.SUPER_ADMIN),
      "user_404",
    );

    expect(missing).toEqual({
      ok: false,
      error: "USER_NOT_FOUND",
      message: "User not found",
    });
  });

  it("normalizes and bounds bulk delete input", async () => {
    const result = await prepareDeleteUsersBulk(
      actor(dbMock.AdminRole.SUPER_ADMIN),
      {
        userIds: [" user_1 ", "user_2", "user_1", ""],
      },
    );

    expect(result).toEqual({
      ok: true,
      data: {
        userIds: ["user_1", "user_2"],
      },
    });

    const tooMany = await prepareDeleteUsersBulk(
      actor(dbMock.AdminRole.SUPER_ADMIN),
      {
        userIds: Array.from({ length: 51 }, (_, index) => `user_${index}`),
      },
    );

    expect(tooMany).toEqual({
      ok: false,
      error: "BULK_LIMIT_EXCEEDED",
      message: "Bulk delete limit exceeded (max 50 users per request)",
    });
  });

  it("returns credentials target for reset preparation", async () => {
    repositoryMock.findUserCredentialsTarget.mockResolvedValue({
      id: "user_1",
      clerkId: "clerk_1",
      email: "user@example.com",
      passwordResetRequired: false,
    });

    const result = await prepareResetUserCredentials(
      actor(dbMock.AdminRole.SUPER_ADMIN),
      "user_1",
    );

    expect(result).toEqual({
      ok: true,
      data: {
        id: "user_1",
        clerkId: "clerk_1",
        email: "user@example.com",
        passwordResetRequired: false,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // prepareSuspendUser
  // ---------------------------------------------------------------------------

  describe("prepareSuspendUser", () => {
    const suspendTarget = {
      id: "user_1",
      clerkId: "clerk_1",
      email: "user@example.com",
      status: "ACTIVE",
    };

    it("denies suspension to non-SUPER_ADMIN actors", async () => {
      const result = await prepareSuspendUser(
        actor(dbMock.AdminRole.SUPPORT_AGENT),
        { userId: "user_1" },
      );

      expect(result).toEqual({
        ok: false,
        error: "UNAUTHORIZED",
        message: "Admin user management permission required",
        details: expect.anything(),
      });
      expect(repositoryMock.findUserStatusTarget).not.toHaveBeenCalled();
    });

    it("prevents an admin from suspending their own account", async () => {
      const result = await prepareSuspendUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "admin_1" }, // admin_1 is the actor's dbUserId
      );

      expect(result).toEqual({
        ok: false,
        error: "SELF_SUSPEND_DENIED",
        message: "Cannot suspend your own account",
      });
      expect(repositoryMock.findUserStatusTarget).not.toHaveBeenCalled();
    });

    it("returns USER_NOT_FOUND when the target does not exist", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue(null);

      const result = await prepareSuspendUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_404" },
      );

      expect(result).toEqual({
        ok: false,
        error: "USER_NOT_FOUND",
        message: "User not found",
      });
    });

    it("returns INVALID_INPUT when the user is already suspended", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue({
        ...suspendTarget,
        status: "SUSPENDED",
      });

      const result = await prepareSuspendUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_1" },
      );

      expect(result).toEqual({
        ok: false,
        error: "INVALID_INPUT",
        message: "User is already suspended",
      });
    });

    it("returns the status target on a valid suspension request", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue(suspendTarget);

      const result = await prepareSuspendUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_1", reason: "Policy violation" },
      );

      expect(result).toEqual({ ok: true, data: suspendTarget });
    });
  });

  // ---------------------------------------------------------------------------
  // prepareUnsuspendUser
  // ---------------------------------------------------------------------------

  describe("prepareUnsuspendUser", () => {
    const suspendedTarget = {
      id: "user_2",
      clerkId: "clerk_2",
      email: "suspended@example.com",
      status: "SUSPENDED",
    };

    it("denies unsuspension to non-SUPER_ADMIN actors", async () => {
      const result = await prepareUnsuspendUser(
        actor(dbMock.AdminRole.FINANCE_MANAGER),
        { userId: "user_2" },
      );

      expect(result).toEqual({
        ok: false,
        error: "UNAUTHORIZED",
        message: "Admin user management permission required",
        details: expect.anything(),
      });
      expect(repositoryMock.findUserStatusTarget).not.toHaveBeenCalled();
    });

    it("returns USER_NOT_FOUND when the target does not exist", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue(null);

      const result = await prepareUnsuspendUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_404" },
      );

      expect(result).toEqual({
        ok: false,
        error: "USER_NOT_FOUND",
        message: "User not found",
      });
    });

    it("returns INVALID_INPUT when the user is not currently suspended", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue({
        ...suspendedTarget,
        status: "ACTIVE",
      });

      const result = await prepareUnsuspendUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_2" },
      );

      expect(result).toEqual({
        ok: false,
        error: "INVALID_INPUT",
        message: "User is not currently suspended",
      });
    });

    it("returns the status target on a valid unsuspend request", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue(suspendedTarget);

      const result = await prepareUnsuspendUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_2" },
      );

      expect(result).toEqual({ ok: true, data: suspendedTarget });
    });
  });

  // ---------------------------------------------------------------------------
  // prepareBanUser
  // ---------------------------------------------------------------------------
  describe("prepareBanUser", () => {
    const activeTarget = {
      id: "user_1",
      clerkId: "clerk_1",
      email: "user@example.com",
      status: "ACTIVE",
    };

    it("prevents self-ban", async () => {
      const result = await prepareBanUser(actor(dbMock.AdminRole.SUPER_ADMIN), {
        userId: "admin_1",
      });
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({
        error: "SELF_BAN_DENIED",
      });
    });

    it("prevents banning already banned users", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue({
        ...activeTarget,
        status: "BANNED",
      });
      const result = await prepareBanUser(actor(dbMock.AdminRole.SUPER_ADMIN), {
        userId: "user_1",
      });
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({
        error: "INVALID_INPUT",
      });
    });

    it("prevents status changes on deactivated users", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue({
        ...activeTarget,
        status: "DEACTIVATED",
      });
      const result = await prepareBanUser(actor(dbMock.AdminRole.SUPER_ADMIN), {
        userId: "user_1",
      });
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({
        error: "DEACTIVATED_USER_REVERT_DENIED",
      });
    });

    it("allows valid ban", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue(activeTarget);
      const result = await prepareBanUser(actor(dbMock.AdminRole.SUPER_ADMIN), {
        userId: "user_1",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(activeTarget);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // prepareUnbanUser
  // ---------------------------------------------------------------------------
  describe("prepareUnbanUser", () => {
    const bannedTarget = {
      id: "user_1",
      clerkId: "clerk_1",
      email: "user@example.com",
      status: "BANNED",
    };

    it("prevents unbanning non-banned users", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue({
        ...bannedTarget,
        status: "ACTIVE",
      });
      const result = await prepareUnbanUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_1" },
      );
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({
        error: "INVALID_INPUT",
      });
    });

    it("allows valid unban", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue(bannedTarget);
      const result = await prepareUnbanUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_1" },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(bannedTarget);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // prepareDeactivateUser
  // ---------------------------------------------------------------------------
  describe("prepareDeactivateUser", () => {
    const activeTarget = {
      id: "user_1",
      clerkId: "clerk_1",
      email: "user@example.com",
      status: "ACTIVE",
    };

    it("prevents self-deactivation", async () => {
      const result = await prepareDeactivateUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "admin_1" },
      );
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({
        error: "SELF_DEACTIVATE_DENIED",
      });
    });

    it("prevents deactivating already deactivated users", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue({
        ...activeTarget,
        status: "DEACTIVATED",
      });
      const result = await prepareDeactivateUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_1" },
      );
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({
        error: "INVALID_INPUT",
      });
    });

    it("allows valid deactivation", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue(activeTarget);
      const result = await prepareDeactivateUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_1" },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(activeTarget);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // prepareArchiveUser
  // ---------------------------------------------------------------------------
  describe("prepareArchiveUser", () => {
    const activeTarget = {
      id: "user_1",
      clerkId: "clerk_1",
      email: "user@example.com",
      status: "ACTIVE",
    };

    it("prevents self-archive", async () => {
      const result = await prepareArchiveUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "admin_1" },
      );
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({
        error: "SELF_ARCHIVE_DENIED",
      });
    });

    it("prevents archiving already archived users", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue({
        ...activeTarget,
        status: "ARCHIVED",
      });
      const result = await prepareArchiveUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_1" },
      );
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({
        error: "INVALID_INPUT",
      });
    });

    it("allows valid archive", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue(activeTarget);
      const result = await prepareArchiveUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_1" },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(activeTarget);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // prepareUnarchiveUser
  // ---------------------------------------------------------------------------
  describe("prepareUnarchiveUser", () => {
    const archivedTarget = {
      id: "user_1",
      clerkId: "clerk_1",
      email: "user@example.com",
      status: "ARCHIVED",
    };

    it("prevents unarchiving non-archived users", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue({
        ...archivedTarget,
        status: "ACTIVE",
      });
      const result = await prepareUnarchiveUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_1" },
      );
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({
        error: "INVALID_INPUT",
      });
    });

    it("allows valid unarchive", async () => {
      repositoryMock.findUserStatusTarget.mockResolvedValue(archivedTarget);
      const result = await prepareUnarchiveUser(
        actor(dbMock.AdminRole.SUPER_ADMIN),
        { userId: "user_1" },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(archivedTarget);
      }
    });
  });
});
