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
});
