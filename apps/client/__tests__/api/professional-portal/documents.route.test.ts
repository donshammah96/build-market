import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@build/db";
import type { AuthContext } from "@/app/lib/api/api-middleware";
import {
  GET as listDocumentsRoute,
  POST as createDocumentRoute,
} from "@/app/api/professional-portal/documents/route";
import {
  GET as getDocumentRoute,
  PATCH as updateDocumentRoute,
  DELETE as deleteDocumentRoute,
} from "@/app/api/professional-portal/documents/[id]/route";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";

const validDocumentId = "550e8400-e29b-41d4-a716-446655440001";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockAuthContext: AuthContext = {
  clerkId: "clerk_123",
  dbUserId: "db_user_123",
  userRole: UserRole.PROFESSIONAL,
};

const mockDocumentsService = vi.hoisted(() => ({
  getDocuments: vi.fn(),
  getDocumentById: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (
      handler: (
        req: NextRequest,
        context: AuthContext,
        params?: { id: string },
      ) => Promise<unknown>,
    ) =>
    async (req: NextRequest, params?: { id: string }) =>
      handler(req, mockAuthContext, params ?? { id: validDocumentId }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  getActorRateLimitIdentifier: vi
    .fn()
    .mockImplementation(
      (userId: string, namespace: string) => `${namespace}:${userId}`,
    ),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", async () => {
  const actual = await vi.importActual("@/app/lib/api/api-guards");
  return {
    ...actual,
    checkBodySize: vi.fn().mockReturnValue(null),
  };
});

vi.mock("@/app/lib/api/api-response", () => ({
  apiError: vi
    .fn()
    .mockImplementation((message: string, status: number, details?: unknown) =>
      NextResponse.json(
        { success: false, error: message, details },
        { status },
      ),
    ),
  apiSuccess: vi
    .fn()
    .mockImplementation((data: unknown, status: number = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
  HttpStatus: {
    OK: 200,
    BAD_REQUEST: 400,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    CREATED: 201,
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        return { success: true, data: await fn() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  }),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/app/lib/domains/documents", () => ({
  documentsService: mockDocumentsService,
}));

vi.mock("@/app/lib/gdpr/services/compliance.service", () => ({
  ComplianceService: {
    logAdminAction: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("professional documents routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "new",
    });
  });

  it("lists documents from the documents domain with actor context", async () => {
    mockDocumentsService.getDocuments.mockResolvedValue({
      ok: true,
      data: [
        {
          id: validDocumentId,
          category: "ID_OR_PASSPORT",
          title: "Passport",
          status: "PENDING",
          createdAt: "2026-03-10T12:00:00.000Z",
          updatedAt: "2026-03-10T12:00:00.000Z",
          asset: {
            id: "a1",
            cdnUrl: "/url",
            originalName: "p.pdf",
            mimeType: "application/pdf",
            size: 1024,
          },
        },
      ],
    });

    const response = await listDocumentsRoute(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/documents?category=ID_OR_PASSPORT",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockDocumentsService.getDocuments).toHaveBeenCalledWith(
      {
        clerkId: "clerk_123",
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      expect.objectContaining({ category: "ID_OR_PASSPORT" }),
    );
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(validDocumentId);
  });

  it("maps forbidden list access to 403", async () => {
    mockDocumentsService.getDocuments.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "internal policy detail",
      status: 403,
    });

    const response = await listDocumentsRoute(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/documents",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("generates document POST idempotency key from summary projection", async () => {
    mockDocumentsService.createDocument.mockResolvedValue({
      ok: true,
      data: {
        id: validDocumentId,
        category: "ID_OR_PASSPORT",
        title: "Passport",
        status: "PENDING",
        createdAt: "2026-03-10T12:00:00.000Z",
        updatedAt: "2026-03-10T12:00:00.000Z",
        asset: {
          id: "a1",
          cdnUrl: "/url",
          originalName: "p.pdf",
          mimeType: "application/pdf",
          size: 1024,
        },
      },
    });

    const response = await createDocumentRoute(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/documents",
        {
          method: "POST",
          body: JSON.stringify({
            title: "Passport",
            category: "ID_OR_PASSPORT",
            assetId: validDocumentId,
            issuer: "Gov",
            issueDate: "2026-03-10T12:00:00.000Z",
          }),
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    expect(response.status).toBe(201);
    expect(IdempotencyService.generateKey).toHaveBeenCalledWith(
      "db_user_123",
      "POST",
      {
        domain: "professional_document",
        assetId: validDocumentId,
        titleLength: "Passport".length,
        issuerLength: "Gov".length,
        hasIssueDate: true,
        hasExpiryDate: false,
      },
    );
  });

  it("emits required observability keys for documents list success", async () => {
    mockDocumentsService.getDocuments.mockResolvedValue({
      ok: true,
      data: [],
    });

    const response = await listDocumentsRoute(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/documents",
      ),
    );

    expect(response.status).toBe(200);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Professional documents adapter outcome",
      expect.objectContaining({
        correlationId: "test-correlation-id",
        operationName: "get_professional_documents",
        httpMethod: "GET",
        routePattern: "/api/professional-portal/documents",
        actorRole: "PROFESSIONAL",
        outcome: "succeeded",
        httpStatus: 200,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("emits required observability keys for documents list failure", async () => {
    mockDocumentsService.getDocuments.mockRejectedValue(new Error("boom"));

    const response = await listDocumentsRoute(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/documents",
      ),
    );

    expect(response.status).toBe(500);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Professional documents adapter outcome",
      expect.objectContaining({
        correlationId: "test-correlation-id",
        operationName: "get_professional_documents",
        httpMethod: "GET",
        routePattern: "/api/professional-portal/documents",
        actorRole: "PROFESSIONAL",
        outcome: "failed",
        httpStatus: 500,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("returns document detail from the documents domain", async () => {
    mockDocumentsService.getDocumentById.mockResolvedValue({
      ok: true,
      data: {
        id: validDocumentId,
        category: "ID_OR_PASSPORT",
        title: "Passport",
        status: "PENDING",
        asset: {
          id: "a1",
          cdnUrl: "/url",
          originalName: "p.pdf",
          mimeType: "application/pdf",
          size: 1024,
        },
        verifiedBy: null,
        deletedAt: null,
      },
    });

    const response = await getDocumentRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/documents/${validDocumentId}`,
      ),
      { id: validDocumentId },
    );

    expect(response.status).toBe(200);
    expect(mockDocumentsService.getDocumentById).toHaveBeenCalledWith(
      {
        clerkId: "clerk_123",
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      validDocumentId,
    );
  });

  it("maps getDocumentById not_found to 404", async () => {
    mockDocumentsService.getDocumentById.mockResolvedValue({
      ok: false,
      error: "not_found",
    });

    const response = await getDocumentRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/documents/${validDocumentId}`,
      ),
      { id: validDocumentId },
    );

    expect(response.status).toBe(404);
  });

  it("maps update not_found to 404 and fails idempotency", async () => {
    mockDocumentsService.updateDocument.mockResolvedValue({
      ok: false,
      error: "not_found",
    });

    const response = await updateDocumentRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/documents/${validDocumentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title: "Updated" }),
          headers: { "Content-Type": "application/json" },
        },
      ),
      { id: validDocumentId },
    );

    expect(response.status).toBe(404);
    expect(IdempotencyService.fail).toHaveBeenCalledWith("idem-key");
  });

  it("deletes a document and completes idempotency", async () => {
    mockDocumentsService.deleteDocument.mockResolvedValue({
      ok: true,
      data: {
        message: "Document deleted successfully",
        documentId: validDocumentId,
        category: "ID_OR_PASSPORT",
      },
    });

    const response = await deleteDocumentRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/documents/${validDocumentId}`,
        { method: "DELETE" },
      ),
      { id: validDocumentId },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockDocumentsService.deleteDocument).toHaveBeenCalledWith(
      {
        clerkId: "clerk_123",
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      validDocumentId,
    );
    expect(IdempotencyService.complete).toHaveBeenCalledWith("idem-key", {
      message: "Document deleted successfully",
      documentId: validDocumentId,
      category: "ID_OR_PASSPORT",
    });
    expect(body.data.message).toBe("Document deleted successfully");
  });

  it("returns delete success when idempotency completion fails", async () => {
    mockDocumentsService.deleteDocument.mockResolvedValue({
      ok: true,
      data: {
        message: "Document deleted successfully",
        documentId: validDocumentId,
        category: "ID_OR_PASSPORT",
      },
    });
    vi.mocked(IdempotencyService.complete).mockRejectedValueOnce(
      new Error("serialize failure"),
    );

    const response = await deleteDocumentRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/documents/${validDocumentId}`,
        { method: "DELETE" },
      ),
      { id: validDocumentId },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(IdempotencyService.fail).toHaveBeenCalledWith("idem-key");
    expect(body.success).toBe(true);
  });
});
