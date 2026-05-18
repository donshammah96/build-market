import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@build/db", () => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
  },
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    idempotencyKey: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/config/store.config", () => ({
  STORE_CONFIG: {
    IDEMPOTENCY_KEY_TTL_HOURS: 1,
  },
}));

vi.mock("../../lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("scoped-idempotency-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../shared", () => ({
  safeAction: vi.fn(
    async (
      _name: string,
      fn: (context: {
        adminUserId: string;
        adminRole: string;
      }) => Promise<unknown>,
    ) => {
      try {
        const data = await fn({
          adminUserId: "admin_user_1",
          adminRole: "admin",
        });
        return { success: true, data, timestamp: new Date().toISOString() };
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
  requireAdminGranularRole: vi.fn().mockResolvedValue("SUPER_ADMIN"),
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { assignUserRole, inviteUser } from "../users";

const IDEMPOTENCY_KEY = "idem-key-1";

describe("admin users actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue(
      null as never,
    );
    vi.mocked(prisma.idempotencyKey.create).mockResolvedValue({} as never);
    vi.mocked(prisma.idempotencyKey.update).mockResolvedValue({} as never);
  });

  it("rejects invite when role is not assignable", async () => {
    const response = await inviteUser(
      {
        email: "new.user@example.com",
        role: "not_a_role",
      },
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(false);
    expect(response.error).toContain("Invalid role");
  });

  it("rejects inviteUser when role input is only whitespace", async () => {
    const response = await inviteUser(
      {
        email: "new.user@example.com",
        role: "   ",
      },
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(false);
    expect(response.error).toContain("Invalid role. Allowed roles:");
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(clerkClient).not.toHaveBeenCalled();
  });

  it("rejects inviteUser when email input is empty or whitespace", async () => {
    for (const email of ["", "   "]) {
      const response = await inviteUser(
        {
          email,
          role: "ADMIN",
        },
        IDEMPOTENCY_KEY,
      );

      expect(response.success).toBe(false);
      expect(response.error).toBe("Valid email is required");
    }

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(clerkClient).not.toHaveBeenCalled();
  });

  it("normalizes lowercase role input for invite and persists uppercase role metadata", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);

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
        email: "new.user@example.com",
        role: "admin",
      },
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(true);
    expect(createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        publicMetadata: { role: "ADMIN" },
      }),
    );
  });

  it("normalizes lowercase role input for role assignment", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      role: "CLIENT",
      clerkId: "clerk_1",
    } as never);

    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

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
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user_1" },
        data: { role: "PROFESSIONAL" },
      }),
    );
    expect(updateUserMetadata).toHaveBeenCalledWith("clerk_1", {
      publicMetadata: {
        role: "PROFESSIONAL",
      },
    });
  });

  it("blocks self-demotion from ADMIN role", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin_user_1",
      email: "admin@example.com",
      role: "ADMIN",
      clerkId: "clerk_admin_1",
    } as never);

    const response = await assignUserRole(
      "admin_user_1",
      "client",
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(false);
    expect(response.error).toBe("Cannot remove your own admin platform role");
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(clerkClient).not.toHaveBeenCalled();
  });

  it("rejects assignUserRole when role is not assignable", async () => {
    const response = await assignUserRole(
      "user_1",
      "invalid_role",
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(false);
    expect(response.error).toContain("Invalid role. Allowed roles:");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(clerkClient).not.toHaveBeenCalled();
  });

  it("rejects assignUserRole when role input is only whitespace", async () => {
    const response = await assignUserRole("user_1", "    ", IDEMPOTENCY_KEY);

    expect(response.success).toBe(false);
    expect(response.error).toContain("Invalid role. Allowed roles:");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(clerkClient).not.toHaveBeenCalled();
  });
});
