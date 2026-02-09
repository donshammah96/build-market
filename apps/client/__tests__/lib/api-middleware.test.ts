import { describe, it, expect, vi, beforeEach } from "vitest";
import { withAuth, withRole, withAdminRole } from "@/app/lib/api-middleware";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";

// Mock dependencies
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    adminProfile: {
      findUnique: vi.fn(),
    },
  },
  UserRole: {
    CLIENT: "CLIENT",
    PROFESSIONAL: "PROFESSIONAL",
    ADMIN: "ADMIN",
    SUPPORT: "SUPPORT",
  },
  UserStatus: {
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    BANNED: "BANNED",
    DEACTIVATED: "DEACTIVATED",
    ARCHIVED: "ARCHIVED",
  },
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
    SYSTEM_ADMIN: "SYSTEM_ADMIN",
  },
}));

vi.mock("@/app/lib/api-response", () => ({
  apiError: vi.fn((message: string, status: number) =>
    NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status },
    ),
  ),
  HttpStatus: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

vi.mock("@/app/lib/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@build/resilience", () => ({
  StructuredLogger: vi.fn().mockImplementation(() => ({
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  })),
  CorrelationIdManager: {
    generate: vi.fn().mockReturnValue("test-correlation-id"),
    set: vi.fn(),
    get: vi.fn().mockReturnValue("test-correlation-id"),
  },
  withTimeout: vi.fn().mockImplementation(async (fn) => await fn()),
}));

// Helper to create a standard active user mock
function mockActiveUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "db_user_123",
    email: "test@example.com",
    role: "CLIENT",
    status: "ACTIVE",
    ...overrides,
  };
}

// Helper to set up auth + user mocks
async function setupAuthMocks(
  clerkId: string | null,
  user: Record<string, unknown> | null = null,
) {
  const { auth } = await import("@clerk/nextjs/server");
  vi.mocked(auth).mockResolvedValue({ userId: clerkId } as any);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
}

describe("API Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // withAuth
  // =========================================================================
  describe("withAuth", () => {
    it("should call handler with auth context when authenticated", async () => {
      const user = mockActiveUser();
      await setupAuthMocks("clerk_123", user);

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }));

      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest("http://localhost:3500/test");

      await wrappedHandler(request);

      expect(mockHandler).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          clerkId: "clerk_123",
          dbUserId: "db_user_123",
          userEmail: "test@example.com",
          userRole: "CLIENT",
          adminRole: undefined,
        }),
        undefined,
      );
    });

    it("should return 401 when not authenticated", async () => {
      await setupAuthMocks(null);

      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Unauthorized");
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should return 404 when user not found in database", async () => {
      await setupAuthMocks("clerk_123", null);

      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("User account not found");
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should handle authentication errors gracefully", async () => {
      const { auth } = await import("@clerk/nextjs/server");
      vi.mocked(auth).mockRejectedValue(new Error("Auth service down"));

      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Authentication failed");
    });

    it("should pass deletedAt: null in user query to filter soft-deleted users", async () => {
      const user = mockActiveUser();
      await setupAuthMocks("clerk_123", user);

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }));

      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest("http://localhost:3500/test");
      await wrappedHandler(request);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    // -----------------------------------------------------------------------
    // UserStatus blocking
    // -----------------------------------------------------------------------
    describe("user status checks", () => {
      it.each([
        ["SUSPENDED", "temporarily suspended"],
        ["BANNED", "permanently banned"],
        ["DEACTIVATED", "being deactivated"],
        ["ARCHIVED", "has been archived"],
      ])("should return 403 for %s users", async (status, expectedMessage) => {
        const user = mockActiveUser({ status });
        await setupAuthMocks("clerk_123", user);

        const mockHandler = vi.fn();
        const wrappedHandler = withAuth(mockHandler);
        const request = new NextRequest("http://localhost:3500/test");

        const response = await wrappedHandler(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toContain(expectedMessage);
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it("should allow ACTIVE users through", async () => {
        const user = mockActiveUser({ status: "ACTIVE" });
        await setupAuthMocks("clerk_123", user);

        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));

        const wrappedHandler = withAuth(mockHandler);
        const request = new NextRequest("http://localhost:3500/test");

        const response = await wrappedHandler(request);
        expect(response.status).toBe(200);
        expect(mockHandler).toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    // AdminRole fetching
    // -----------------------------------------------------------------------
    describe("admin role resolution", () => {
      it("should fetch AdminProfile and populate adminRole for ADMIN users", async () => {
        const user = mockActiveUser({ role: "ADMIN" });
        await setupAuthMocks("clerk_123", user);
        vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({
          role: "SUPER_ADMIN",
          isActive: true,
        } as any);

        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));

        const wrappedHandler = withAuth(mockHandler);
        const request = new NextRequest("http://localhost:3500/test");
        await wrappedHandler(request);

        expect(prisma.adminProfile.findUnique).toHaveBeenCalledWith({
          where: { userId: "db_user_123" },
          select: { role: true, isActive: true },
        });
        expect(mockHandler).toHaveBeenCalledWith(
          request,
          expect.objectContaining({ adminRole: "SUPER_ADMIN" }),
          undefined,
        );
      });

      it("should NOT fetch AdminProfile for non-admin users", async () => {
        const user = mockActiveUser({ role: "PROFESSIONAL" });
        await setupAuthMocks("clerk_123", user);

        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));

        const wrappedHandler = withAuth(mockHandler);
        const request = new NextRequest("http://localhost:3500/test");
        await wrappedHandler(request);

        expect(prisma.adminProfile.findUnique).not.toHaveBeenCalled();
        expect(mockHandler).toHaveBeenCalledWith(
          request,
          expect.objectContaining({ adminRole: undefined }),
          undefined,
        );
      });

      it("should return 403 when admin profile is inactive", async () => {
        const user = mockActiveUser({ role: "ADMIN" });
        await setupAuthMocks("clerk_123", user);
        vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({
          role: "CONTENT_MODERATOR",
          isActive: false,
        } as any);

        const mockHandler = vi.fn();
        const wrappedHandler = withAuth(mockHandler);
        const request = new NextRequest("http://localhost:3500/test");

        const response = await wrappedHandler(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toContain("admin account has been deactivated");
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it("should allow admin users without an AdminProfile (adminRole will be undefined)", async () => {
        const user = mockActiveUser({ role: "ADMIN" });
        await setupAuthMocks("clerk_123", user);
        vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue(null);

        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));

        const wrappedHandler = withAuth(mockHandler);
        const request = new NextRequest("http://localhost:3500/test");
        await wrappedHandler(request);

        expect(mockHandler).toHaveBeenCalledWith(
          request,
          expect.objectContaining({ adminRole: undefined }),
          undefined,
        );
      });
    });
  });

  // =========================================================================
  // withRole
  // =========================================================================
  describe("withRole", () => {
    it("should allow access when user has required role", async () => {
      const user = mockActiveUser({ role: "PROFESSIONAL" });
      await setupAuthMocks("clerk_123", user);

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }));

      const wrappedHandler = withRole(["PROFESSIONAL"] as any)(mockHandler);
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it("should deny access when user lacks required role", async () => {
      const user = mockActiveUser({ role: "CLIENT" });
      await setupAuthMocks("clerk_123", user);

      const mockHandler = vi.fn();
      const wrappedHandler = withRole(["PROFESSIONAL"] as any)(mockHandler);
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("Forbidden");
      expect(mockHandler).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it("should allow access when user has one of multiple allowed roles", async () => {
      const user = mockActiveUser({ role: "ADMIN" });
      await setupAuthMocks("clerk_123", user);
      vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({
        role: "SUPER_ADMIN",
        isActive: true,
      } as any);

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }));

      const wrappedHandler = withRole(["ADMIN", "SUPPORT"] as any)(mockHandler);
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // withAdminRole
  // =========================================================================
  describe("withAdminRole", () => {
    // Helper to set up an admin user with a given AdminRole
    async function setupAdmin(adminRole: string, isActive = true) {
      const user = mockActiveUser({ role: "ADMIN" });
      await setupAuthMocks("clerk_123", user);
      vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({
        role: adminRole,
        isActive,
      } as any);
    }

    it("should allow access for the exact required admin role", async () => {
      await setupAdmin("CONTENT_MODERATOR");

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }));
      const wrappedHandler = withAdminRole(["CONTENT_MODERATOR"] as any)(
        mockHandler,
      );
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });

    it("should allow SUPER_ADMIN to bypass any admin role check", async () => {
      await setupAdmin("SUPER_ADMIN");

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }));
      const wrappedHandler = withAdminRole(["FINANCE_MANAGER"] as any)(
        mockHandler,
      );
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });

    it("should allow SYSTEM_ADMIN to bypass any admin role check", async () => {
      await setupAdmin("SYSTEM_ADMIN");

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }));
      const wrappedHandler = withAdminRole(["AUDITOR"] as any)(mockHandler);
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });

    it("should deny access when admin role does not match required role", async () => {
      await setupAdmin("AUDITOR");

      const mockHandler = vi.fn();
      const wrappedHandler = withAdminRole(["FINANCE_MANAGER"] as any)(
        mockHandler,
      );
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain(
        "do not have the required admin permissions",
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should deny access for non-admin users", async () => {
      const user = mockActiveUser({ role: "PROFESSIONAL" });
      await setupAuthMocks("clerk_123", user);

      const mockHandler = vi.fn();
      const wrappedHandler = withAdminRole(["CONTENT_MODERATOR"] as any)(
        mockHandler,
      );
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("Admin access required");
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should deny access when admin user has no AdminProfile", async () => {
      const user = mockActiveUser({ role: "ADMIN" });
      await setupAuthMocks("clerk_123", user);
      vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue(null);

      const mockHandler = vi.fn();
      const wrappedHandler = withAdminRole(["CONTENT_MODERATOR"] as any)(
        mockHandler,
      );
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("Admin profile not configured");
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should deny access when admin profile is inactive", async () => {
      await setupAdmin("SUPER_ADMIN", false);

      const mockHandler = vi.fn();
      const wrappedHandler = withAdminRole(["CONTENT_MODERATOR"] as any)(
        mockHandler,
      );
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      const data = await response.json();

      // Blocked at withAuth level before reaching withAdminRole
      expect(response.status).toBe(403);
      expect(data.error).toContain("admin account has been deactivated");
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should allow access when admin has one of multiple allowed roles", async () => {
      await setupAdmin("FINANCE_MANAGER");

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }));
      const wrappedHandler = withAdminRole([
        "CONTENT_MODERATOR",
        "FINANCE_MANAGER",
      ] as any)(mockHandler);
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });

    it("should still block suspended admin users before role check", async () => {
      const user = mockActiveUser({ role: "ADMIN", status: "SUSPENDED" });
      await setupAuthMocks("clerk_123", user);

      const mockHandler = vi.fn();
      const wrappedHandler = withAdminRole(["SUPER_ADMIN"] as any)(mockHandler);
      const request = new NextRequest("http://localhost:3500/test");

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("suspended");
      expect(mockHandler).not.toHaveBeenCalled();
      // AdminProfile should not be fetched since user was blocked at status check
      expect(prisma.adminProfile.findUnique).not.toHaveBeenCalled();
    });
  });
});
