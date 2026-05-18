import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@build/db", () => ({
  prisma: prismaMock,
}));

import {
  countUsers,
  deleteUserById,
  findUserByEmail,
  findUserCredentialsTarget,
  findUserDetailsById,
  findUserIdentityTarget,
  findUserRoleTarget,
  listUsers,
  markPasswordResetRequired,
  updateUserRole,
} from "../repository";

describe("users repository contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists users with caller-provided where shape and profile include", async () => {
    await listUsers({
      where: { deletedAt: null, role: "CLIENT" },
      skip: 10,
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, role: "CLIENT" },
      skip: 10,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        professionalProfile: {
          select: { companyName: true, verified: true },
        },
      },
    });
  });

  it("counts with caller-provided where shape", async () => {
    await countUsers({ deletedAt: null });

    expect(prismaMock.user.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
  });

  it("uses deletedAt null guard for detail and target lookups", async () => {
    await findUserDetailsById("user_1");
    await findUserIdentityTarget("user_2");
    await findUserCredentialsTarget("user_3");
    await findUserRoleTarget("user_4");

    expect(prismaMock.user.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: "user_1", deletedAt: null } }),
    );
    expect(prismaMock.user.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: "user_2", deletedAt: null } }),
    );
    expect(prismaMock.user.findFirst).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ where: { id: "user_3", deletedAt: null } }),
    );
    expect(prismaMock.user.findFirst).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ where: { id: "user_4", deletedAt: null } }),
    );
  });

  it("guards email lookup against soft-deleted users", async () => {
    await findUserByEmail("new@example.com");

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: { equals: "new@example.com", mode: "insensitive" },
        deletedAt: null,
      },
      select: { id: true },
    });
  });

  it("keeps mutation repository methods persistence-only", async () => {
    await deleteUserById("user_1");
    await markPasswordResetRequired("user_2");
    await updateUserRole("user_3", "ADMIN");

    expect(prismaMock.user.delete).toHaveBeenCalledWith({
      where: { id: "user_1" },
    });
    expect(prismaMock.user.update).toHaveBeenNthCalledWith(1, {
      where: { id: "user_2" },
      data: { passwordResetRequired: true },
    });
    expect(prismaMock.user.update).toHaveBeenNthCalledWith(2, {
      where: { id: "user_3" },
      data: { role: "ADMIN" },
    });
  });
});

