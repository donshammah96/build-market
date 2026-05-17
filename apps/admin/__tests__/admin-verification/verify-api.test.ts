/**
 * Admin Verification API Test Suite
 * Integration tests for the unified verification endpoint
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/actions/admin/verify/route";

vi.mock("@/lib/services/verification/notification.service", () => ({
  notifyVerificationResult: vi.fn(),
}));

// Test UUIDs for consistent test data (RFC 4122 compliant)
const TEST_UUIDS = {
  ADMIN_CLERK: "a0000000-0000-4000-8000-000000000001",
  ADMIN_DB: "a0000000-0000-4000-8000-000000000002",
  PROFESSIONAL: "b0000000-0000-4000-8000-000000000001",
  STORE: "c0000000-0000-4000-8000-000000000001",
  PROPERTY: "d0000000-0000-4000-8000-000000000001",
};

// Mock dependencies
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
  },
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    adminProfile: {
      findUnique: vi.fn(),
    },
    professionalProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    store: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    property: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-identifier"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 50, window: 60000 },
  },
}));

// Mock resilient-api to pass through operations directly
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
    apiError: vi.fn().mockImplementation((message, status = 500) => {
      return NextResponse.json({ success: false, error: message }, { status });
    }),
    apiSuccess: vi.fn().mockImplementation((data, status = 200) => {
      return NextResponse.json({ success: true, data }, { status });
    }),
  };
});

describe("POST /api/admin/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should verify a professional successfully", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@build/db");

    // Setup mocks
    vi.mocked(auth).mockResolvedValue({
      userId: TEST_UUIDS.ADMIN_CLERK,
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ADMIN_DB,
      email: "admin@test.com",
      role: "ADMIN",
    } as any);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({
      role: "SUPER_ADMIN",
      isActive: true,
    } as any);

    vi.mocked(prisma.professionalProfile.findUnique).mockResolvedValue({
      userId: TEST_UUIDS.PROFESSIONAL,
      companyName: "Test Company",
      verificationStatus: "PENDING",
      verified: false,
      user: {
        email: "don@test.com",
        firstName: "Don",
        lastName: "Shammah",
      },
    } as any);

    vi.mocked(prisma.professionalProfile.update).mockResolvedValue({
      userId: TEST_UUIDS.PROFESSIONAL,
      companyName: "Test Company",
      verificationStatus: "VERIFIED",
      verified: true,
      verifiedAt: new Date(),
      verifiedById: TEST_UUIDS.ADMIN_DB,
    } as any);

    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

    // Create request
    const request = new NextRequest("http://localhost:3500/api/admin/verify", {
      method: "POST",
      body: JSON.stringify({
        entityType: "professional",
        entityId: TEST_UUIDS.PROFESSIONAL,
        action: "VERIFY",
        notes: "All documents verified",
      }),
    });

    // Execute
    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.newStatus).toBe("VERIFIED");
    expect(data.data.entityType).toBe("professional");
    expect(prisma.professionalProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_UUIDS.PROFESSIONAL },
        data: expect.objectContaining({
          verificationStatus: "VERIFIED",
          verified: true,
          verifiedById: TEST_UUIDS.ADMIN_DB,
        }),
      }),
    );
  });

  it("should reject verification with invalid entity type", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@build/db");

    vi.mocked(auth).mockResolvedValue({
      userId: TEST_UUIDS.ADMIN_CLERK,
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ADMIN_DB,
      role: "ADMIN",
    } as any);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({
      role: "SUPER_ADMIN",
      isActive: true,
    } as any);

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

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });

  it("should reject verification without reason when required", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@build/db");

    vi.mocked(auth).mockResolvedValue({
      userId: TEST_UUIDS.ADMIN_CLERK,
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ADMIN_DB,
      role: "ADMIN",
    } as any);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({
      role: "SUPER_ADMIN",
      isActive: true,
    } as any);

    vi.mocked(prisma.professionalProfile.findUnique).mockResolvedValue({
      userId: TEST_UUIDS.PROFESSIONAL,
      verificationStatus: "PENDING",
      companyName: "Test Company",
      user: { email: "test@test.com" },
    } as any);

    const request = new NextRequest("http://localhost:3500/api/admin/verify", {
      method: "POST",
      body: JSON.stringify({
        entityType: "professional",
        entityId: TEST_UUIDS.PROFESSIONAL,
        action: "REJECT",
        // Missing 'reason' field
      }),
    });

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });

  it("should verify a store successfully", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@build/db");

    vi.mocked(auth).mockResolvedValue({
      userId: TEST_UUIDS.ADMIN_CLERK,
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ADMIN_DB,
      role: "ADMIN",
    } as any);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({
      role: "SUPER_ADMIN",
      isActive: true,
    } as any);

    vi.mocked(prisma.store.findUnique).mockResolvedValue({
      id: TEST_UUIDS.STORE,
      name: "Test Store",
      verificationStatus: "PENDING",
      verified: false,
      professional: {
        user: {
          email: "owner@test.com",
          firstName: "Jane",
          lastName: "Smith",
        },
      },
    } as any);

    vi.mocked(prisma.store.update).mockResolvedValue({
      id: TEST_UUIDS.STORE,
      name: "Test Store",
      verificationStatus: "VERIFIED",
      verified: true,
      verifiedAt: new Date(),
      professionalId: TEST_UUIDS.PROFESSIONAL,
    } as any);

    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

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

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.entityType).toBe("store");
    expect(data.data.newStatus).toBe("VERIFIED");
  });

  it("should handle rate limiting", async () => {
    const { checkRateLimit } = await import("@/lib/api/rate-limit");

    vi.mocked(checkRateLimit).mockResolvedValue({ success: false } as any);

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
