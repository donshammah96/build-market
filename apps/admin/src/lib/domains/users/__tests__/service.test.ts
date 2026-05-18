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
  prepareInviteUser,
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
    const denied = await prepareInviteUser(actor(dbMock.AdminRole.FINANCE_MANAGER), {
      email: "new@example.com",
      role: "client",
    });

    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error).toBe("UNAUTHORIZED");

    repositoryMock.findUserByEmail.mockResolvedValue(null);
    const allowed = await prepareInviteUser(actor(dbMock.AdminRole.SUPER_ADMIN), {
      email: " New.User@Example.COM ",
      role: "professional",
    });

    expect(allowed).toEqual({
      ok: true,
      data: { email: "new.user@example.com", role: "PROFESSIONAL" },
    });
  });

  it("blocks non-admin self-demotion during role assignment preparation", async () => {
    const result = await prepareAssignUserRole(actor(dbMock.AdminRole.SUPER_ADMIN), {
      userId: "admin_1",
      role: "client",
    });

    expect(result).toEqual({
      ok: false,
      error: "SELF_ROLE_CHANGE_DENIED",
      message: "Cannot remove your own admin platform role",
    });
  });
});
