import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/actions/admin/pending-verifications/route";

const verificationServiceMock = vi.hoisted(() => ({
  listVerificationQueue: vi.fn(),
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
};

describe("GET /api/admin/pending-verifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully retrieves queue list with valid filters", async () => {
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

    verificationServiceMock.listVerificationQueue.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            entityType: "professional",
            entityId: "prof-1",
            name: "John Pro",
            status: "PENDING",
            submittedAt: new Date("2026-07-18T10:00:00Z"),
            createdAt: new Date("2026-07-18T10:00:00Z"),
            owner: {
              id: "owner-1",
              email: "owner@test.com",
              firstName: "John",
              lastName: "Owner",
            },
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        filters: {
          entityType: "professional",
          status: "PENDING",
          page: 1,
          limit: 10,
          sortBy: "submittedAt",
          sortOrder: "desc",
        },
      },
    });

    const request = new NextRequest(
      "http://localhost:3500/api/admin/pending-verifications?page=1&limit=10&entityType=professional&status=PENDING",
    );

    const response = await GET(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data).toHaveLength(1);
    expect(data.data.data[0].name).toBe("John Pro");
    expect(data.data.pagination.total).toBe(1);

    expect(verificationServiceMock.listVerificationQueue).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        page: 1,
        limit: 10,
        entityType: "professional",
        status: "PENDING",
      }),
    );
  });

  it("returns 400 Bad Request on invalid parameter types", async () => {
    const request = new NextRequest(
      "http://localhost:3500/api/admin/pending-verifications?page=abc&limit=invalid",
    );

    const response = await GET(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(
      verificationServiceMock.listVerificationQueue,
    ).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request on invalid enum values", async () => {
    const request = new NextRequest(
      "http://localhost:3500/api/admin/pending-verifications?entityType=unknown_entity&status=INVALID_STATUS",
    );

    const response = await GET(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(
      verificationServiceMock.listVerificationQueue,
    ).not.toHaveBeenCalled();
  });
});
