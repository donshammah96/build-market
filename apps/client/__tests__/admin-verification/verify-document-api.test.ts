/**
 * Document Verification API Test Suite
 * Tests for document verification endpoint
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/verify-document/route";

// Test UUIDs for consistent test data (RFC 4122 compliant)
const TEST_UUIDS = {
  ADMIN_CLERK: "a0000000-0000-4000-8000-000000000001",
  ADMIN_DB: "a0000000-0000-4000-8000-000000000002",
  PROFESSIONAL: "b0000000-0000-4000-8000-000000000001",
  DOCUMENT_1: "e0000000-0000-4000-8000-000000000001",
  DOCUMENT_2: "e0000000-0000-4000-8000-000000000002",
  CERTIFICATE: "f0000000-0000-4000-8000-000000000001",
};

// Mock dependencies
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    professionalDocument: {
      update: vi.fn(),
    },
    propertyAttachment: {
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

vi.mock("@/app/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-identifier"),
}));

// Mock resilient-api to pass through operations directly
vi.mock("@/app/lib/resilient-api", async () => {
  const { NextResponse } = await import("next/server");
  return {
    initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
    executeResilient: vi.fn().mockImplementation(async (operation) => {
      try {
        const result = await operation();
        return NextResponse.json({ success: true, data: result.data || result, message: result.message });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
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

describe("POST /api/admin/verify-document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should approve a professional document", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@repo/db");

    vi.mocked(auth).mockResolvedValue({ userId: TEST_UUIDS.ADMIN_CLERK } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ADMIN_DB,
      role: "admin",
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
      "http://localhost:3500/api/admin/verify-document",
      {
        method: "POST",
        body: JSON.stringify({
          documentType: "professional_document",
          documentId: TEST_UUIDS.DOCUMENT_1,
          action: "APPROVE",
          notes: "Document approved",
        }),
      }
    );

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.professionalDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_UUIDS.DOCUMENT_1 },
        data: expect.objectContaining({
          isVerified: true,
          notes: "Document approved",
        }),
      })
    );
  });

  it("should reject a certificate", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@repo/db");

    vi.mocked(auth).mockResolvedValue({ userId: TEST_UUIDS.ADMIN_CLERK } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ADMIN_DB,
      role: "admin",
    } as any);

    vi.mocked(prisma.certificate.update).mockResolvedValue({
      id: TEST_UUIDS.CERTIFICATE,
      professionalId: TEST_UUIDS.PROFESSIONAL,
      verificationStatus: "rejected",
      verifiedAt: null,
      notes: "Certificate expired",
      professional: {
        userId: TEST_UUIDS.PROFESSIONAL,
        companyName: "Test Company",
      },
    } as any);

    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as any);

    const request = new NextRequest(
      "http://localhost:3500/api/admin/verify-document",
      {
        method: "POST",
        body: JSON.stringify({
          documentType: "certificate",
          documentId: TEST_UUIDS.CERTIFICATE,
          action: "REJECT",
          notes: "Certificate expired",
        }),
      }
    );

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.certificate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_UUIDS.CERTIFICATE },
        data: expect.objectContaining({
          verificationStatus: "rejected",
          notes: "Certificate expired",
        }),
      })
    );
  });

  it("should handle batch document verification", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@repo/db");

    vi.mocked(auth).mockResolvedValue({ userId: TEST_UUIDS.ADMIN_CLERK } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ADMIN_DB,
      role: "admin",
    } as any);

    vi.mocked(prisma.professionalDocument.update)
      .mockResolvedValueOnce({
        id: TEST_UUIDS.DOCUMENT_1,
        professionalId: TEST_UUIDS.PROFESSIONAL,
        isVerified: true,
        professional: { userId: TEST_UUIDS.PROFESSIONAL, companyName: "Company 1" },
      } as any)
      .mockResolvedValueOnce({
        id: TEST_UUIDS.DOCUMENT_2,
        professionalId: TEST_UUIDS.PROFESSIONAL,
        isVerified: true,
        professional: { userId: TEST_UUIDS.PROFESSIONAL, companyName: "Company 1" },
      } as any);

    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as any);

    const request = new NextRequest(
      "http://localhost:3500/api/admin/verify-document",
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
      }
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
    const { prisma } = await import("@repo/db");

    vi.mocked(auth).mockResolvedValue({ userId: TEST_UUIDS.ADMIN_CLERK } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ADMIN_DB,
      role: "admin",
    } as any);

    const request = new NextRequest(
      "http://localhost:3500/api/admin/verify-document",
      {
        method: "POST",
        body: JSON.stringify({
          documentType: "invalid_type",
          documentId: TEST_UUIDS.DOCUMENT_1,
          action: "APPROVE",
        }),
      }
    );

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });
});
