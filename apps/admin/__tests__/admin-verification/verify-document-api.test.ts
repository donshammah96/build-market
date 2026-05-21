import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/actions/admin/verify-document/route";

const verificationServiceMock = vi.hoisted(() => ({
  verifyDocument: vi.fn(),
  batchVerifyDocuments: vi.fn(),
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
  DOCUMENT_1: "e0000000-0000-4000-8000-000000000001",
  DOCUMENT_2: "e0000000-0000-4000-8000-000000000002",
};

describe("POST /actions/admin/verify-document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function mockAdminSession() {
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
  }

  it("approves a professional document through the verification service", async () => {
    await mockAdminSession();

    verificationServiceMock.verifyDocument.mockResolvedValue({
      ok: true,
      data: {
        documentType: "professional_document",
        documentId: TEST_UUIDS.DOCUMENT_1,
        targetEntityType: "professional",
        targetEntityId: "professional_1",
        status: "APPROVED",
        message: "Document approved successfully",
      },
    });

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
    expect(verificationServiceMock.verifyDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        dbUserId: TEST_UUIDS.ADMIN_DB,
      }),
      expect.objectContaining({
        documentType: "professional_document",
      }),
    );
  });

  it("normalizes property_attachment to property_document", async () => {
    await mockAdminSession();

    verificationServiceMock.verifyDocument.mockResolvedValue({
      ok: true,
      data: {
        documentType: "property_document",
        documentId: TEST_UUIDS.DOCUMENT_1,
        targetEntityType: "property",
        targetEntityId: "property_1",
        status: "REJECTED",
        message: "Document rejected successfully",
      },
    });

    const request = new NextRequest(
      "http://localhost:3005/actions/admin/verify-document",
      {
        method: "POST",
        body: JSON.stringify({
          documentType: "property_attachment",
          documentId: TEST_UUIDS.DOCUMENT_1,
          action: "REJECT",
          notes: "Invalid file",
        }),
      },
    );

    const response = await POST(request, { dbUserId: TEST_UUIDS.ADMIN_DB });
    await response.json();

    expect(verificationServiceMock.verifyDocument).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        documentType: "property_document",
      }),
    );
  });

  it("handles batch document verification", async () => {
    await mockAdminSession();

    verificationServiceMock.batchVerifyDocuments.mockResolvedValue({
      ok: true,
      data: {
        summary: { total: 2, successful: 2, failed: 0 },
        results: [
          { documentId: TEST_UUIDS.DOCUMENT_1, success: true },
          { documentId: TEST_UUIDS.DOCUMENT_2, success: true },
        ],
      },
    });

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
              documentType: "certificate",
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
    expect(verificationServiceMock.batchVerifyDocuments).toHaveBeenCalled();
  });

  it("rejects invalid document type", async () => {
    await mockAdminSession();

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

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(verificationServiceMock.verifyDocument).not.toHaveBeenCalled();
  });
});
