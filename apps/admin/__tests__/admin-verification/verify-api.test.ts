import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/actions/admin/verify/route";

const verificationServiceMock = vi.hoisted(() => ({
  verifyEntity: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@build/db", () => ({
  UserRole: {
    ADMIN: "ADMIN",
  },
  UserStatus: {
    SUSPENDED: "SUSPENDED",
    BANNED: "BANNED",
    DEACTIVATED: "DEACTIVATED",
    ARCHIVED: "ARCHIVED",
  },
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
  },
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    adminProfile: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-identifier"),
}));

vi.mock("@/lib/domains/verification", () => ({
  verificationService: verificationServiceMock,
}));

vi.mock("@/lib/api/resilient-api", async () => {
  const { NextResponse } = await import("next/server");
  return {
    initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
    executeResilient: vi.fn().mockImplementation(async (operation) => {
      try {
        const result = await operation();
        return NextResponse.json({
          success: true,
          data: result.data || result,
          message: result.message,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 },
        );
      }
    }),
    getClientLogger: vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
    apiError: vi.fn().mockImplementation((message, status = 500, details) => {
      return NextResponse.json(
        { success: false, error: message, ...(details ? { details } : {}) },
        { status },
      );
    }),
  };
});

const TEST_UUIDS = {
  ADMIN_CLERK: "a0000000-0000-4000-8000-000000000001",
  ADMIN_DB: "a0000000-0000-4000-8000-000000000002",
  PROFESSIONAL: "b0000000-0000-4000-8000-000000000001",
  STORE: "c0000000-0000-4000-8000-000000000001",
};

describe("POST /api/admin/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies a professional successfully through the domain service", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@build/db");

    vi.mocked(auth).mockResolvedValue({
      userId: TEST_UUIDS.ADMIN_CLERK,
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ADMIN_DB,
      email: "admin@test.com",
      role: "ADMIN",
    } as never);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({
      role: "SUPER_ADMIN",
      isActive: true,
    } as never);

    verificationServiceMock.verifyEntity.mockResolvedValue({
      ok: true,
      data: {
        entityType: "professional",
        entityId: TEST_UUIDS.PROFESSIONAL,
        previousStatus: "PENDING",
        newStatus: "VERIFIED",
        message: "Professional verified",
      },
    });

    const request = new NextRequest("http://localhost:3500/api/admin/verify", {
      method: "POST",
      body: JSON.stringify({
        entityType: "professional",
        entityId: TEST_UUIDS.PROFESSIONAL,
        action: "VERIFY",
        notes: "All documents verified",
      }),
    });

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.newStatus).toBe("VERIFIED");
    expect(verificationServiceMock.verifyEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        dbUserId: TEST_UUIDS.ADMIN_DB,
      }),
      expect.objectContaining({
        entityType: "professional",
        action: "VERIFY",
      }),
      {},
    );
  });

  it("rejects verification with invalid entity type", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@build/db");

    vi.mocked(auth).mockResolvedValue({
      userId: TEST_UUIDS.ADMIN_CLERK,
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ADMIN_DB,
      role: "ADMIN",
    } as never);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({
      role: "SUPER_ADMIN",
      isActive: true,
    } as never);

    const request = new NextRequest("http://localhost:3500/api/admin/verify", {
      method: "POST",
      body: JSON.stringify({
        entityType: "invalid_type",
        entityId: TEST_UUIDS.PROFESSIONAL,
        action: "VERIFY",
      }),
    });

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(verificationServiceMock.verifyEntity).not.toHaveBeenCalled();
  });

  it("surfaces verification service errors", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@build/db");

    vi.mocked(auth).mockResolvedValue({
      userId: TEST_UUIDS.ADMIN_CLERK,
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ADMIN_DB,
      role: "ADMIN",
    } as never);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({
      role: "SUPER_ADMIN",
      isActive: true,
    } as never);

    verificationServiceMock.verifyEntity.mockResolvedValue({
      ok: false,
      code: "VERIFICATION_POLICY_DENIED",
      message: "Admin capability denied",
    });

    const request = new NextRequest("http://localhost:3500/api/admin/verify", {
      method: "POST",
      body: JSON.stringify({
        entityType: "store",
        entityId: TEST_UUIDS.STORE,
        action: "VERIFY",
      }),
    });

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Admin capability denied");
  });

  it("handles rate limiting", async () => {
    const { checkRateLimit } = await import("@/lib/api/rate-limit");

    vi.mocked(checkRateLimit).mockResolvedValue({ success: false } as never);

    const request = new NextRequest("http://localhost:3500/api/admin/verify", {
      method: "POST",
      body: JSON.stringify({
        entityType: "professional",
        entityId: TEST_UUIDS.PROFESSIONAL,
        action: "VERIFY",
      }),
    });

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
  });
});
