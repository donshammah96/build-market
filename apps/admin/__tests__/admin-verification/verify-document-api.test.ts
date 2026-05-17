/**
 * Document Verification API Test Suite
 * Tests for document verification endpoint
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/actions/admin/verify-document/route";

// Test UUIDs for consistent test data (RFC 4122 compliant)
const TEST_UUIDS = {
  ADMIN_CLERK: "a0000000-0000-4000-8000-000000000001",
  ADMIN_DB: "a0000000-0000-4000-8000-000000000002",
  PROFESSIONAL: "b0000000-0000-4000-8000-000000000001",
  DOCUMENT_1: "e0000000-0000-4000-8000-000000000001",
  DOCUMENT_2: "e0000000-0000-4000-8000-000000000002",
  LICENSE: "f0000000-0000-4000-8000-000000000001",
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
    professionalDocument: {
      update: vi.fn(),
    },
    propertyDocument: {
      update: vi.fn(),
    },
    certificate: {
      update: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({})),
  },
}));

vi.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-identifier"),
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
  };
});

describe("POST /actions/admin/verify-document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should approve a professional document", async () => {
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

    vi.mocked(prisma.professionalDocument.update).mockResolvedValue({
      id: TEST_UUIDS.DOCUMENT_1,
      professionalId: TEST_UUIDS.PROFESSIONAL,
      isVerified: true,
      verifiedAt: new Date(),
      notes: "Document approved",
      professional: {
        userId: TEST_UUIDS.PROFESSIONAL,
        companyName: "Test Company",
      },
    } as any);

    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as any);

    const request = new NextRequest(
      "http://localhost:3005/actions/admin/verify-document",
      {
        method: "POST",
        body: JSON.stringify({
          documentType: "professional_document",
          documentId: TEST_UUIDS.DOCUMENT_1,
          action: "APPROVE",
          notes: "Document approved",
        }),
      },
    );

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.professionalDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_UUIDS.DOCUMENT_1 },
        data: expect.objectContaining({
          verified: true,
          notes: "Document approved",
        }),
      }),
    );
  });

  it("should reject a license", async () => {
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

    vi.mocked((prisma as any).certificate.update).mockResolvedValue({
      id: TEST_UUIDS.LICENSE,
      professionalId: TEST_UUIDS.PROFESSIONAL,
      verificationStatus: "rejected",
      verifiedAt: null,
      notes: "License expired",
      professional: {
        userId: TEST_UUIDS.PROFESSIONAL,
        companyName: "Test Company",
      },
    } as any);

    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as any);

    const request = new NextRequest(
      "http://localhost:3005/actions/admin/verify-document",
      {
        method: "POST",
        body: JSON.stringify({
          documentType: "certificate",
          documentId: TEST_UUIDS.LICENSE,
          action: "REJECT",
          notes: "License expired",
        }),
      },
    );

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect((prisma as any).certificate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_UUIDS.LICENSE },
        data: expect.objectContaining({
          verificationStatus: "rejected",
          notes: "License expired",
        }),
      }),
    );
  });

  it("should handle batch document verification", async () => {
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

    vi.mocked(prisma.professionalDocument.update)
      .mockResolvedValueOnce({
        id: TEST_UUIDS.DOCUMENT_1,
        professionalId: TEST_UUIDS.PROFESSIONAL,
        isVerified: true,
        professional: {
          userId: TEST_UUIDS.PROFESSIONAL,
          companyName: "Company 1",
        },
      } as any)
      .mockResolvedValueOnce({
        id: TEST_UUIDS.DOCUMENT_2,
        professionalId: TEST_UUIDS.PROFESSIONAL,
        isVerified: true,
        professional: {
          userId: TEST_UUIDS.PROFESSIONAL,
          companyName: "Company 1",
        },
      } as any);

    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as any);

    const request = new NextRequest(
      "http://localhost:3005/actions/admin/verify-document",
      {
        method: "POST",
        body: JSON.stringify({
          documents: [
            {
              documentType: "professional_document",
              documentId: TEST_UUIDS.DOCUMENT_1,
              action: "APPROVE",
            },
            {
              documentType: "professional_document",
              documentId: TEST_UUIDS.DOCUMENT_2,
              action: "APPROVE",
            },
          ],
        }),
      },
    );

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.summary.total).toBe(2);
    expect(data.data.summary.successful).toBeGreaterThan(0);
  });

  it("should reject invalid document type", async () => {
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

    const request = new NextRequest(
      "http://localhost:3005/actions/admin/verify-document",
      {
        method: "POST",
        body: JSON.stringify({
          documentType: "invalid_type",
          documentId: TEST_UUIDS.DOCUMENT_1,
          action: "APPROVE",
        }),
      },
    );

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });
});
