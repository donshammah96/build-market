import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@build/db";
import type { AuthContext } from "@/app/lib/api/api-middleware";
import {
  GET as listCertificatesRoute,
  POST as createCertificateRoute,
} from "@/app/api/professional-portal/certificates/route";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  GET as getCertificateRoute,
  PATCH as updateCertificateRoute,
  DELETE as deleteCertificateRoute,
} from "@/app/api/professional-portal/certificates/[id]/route";
import { getActorRateLimitIdentifier } from "@/app/lib/api/rate-limit";

const validCertId = "550e8400-e29b-41d4-a716-446655440001";

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

const mockCertificatesService = vi.hoisted(() => ({
  getCertificates: vi.fn(),
  getCertificateById: vi.fn(),
  createCertificate: vi.fn(),
  updateCertificate: vi.fn(),
  deleteCertificate: vi.fn(),
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
      handler(req, mockAuthContext, params ?? { id: validCertId }),
}));

vi.mock("@/app/lib/api/api-guards", async () => {
  const actual = await vi.importActual("@/app/lib/api/api-guards");
  return {
    ...actual,
    checkBodySize: vi.fn().mockReturnValue(null),
  };
});

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
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
    BAD_REQUEST: 400,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    CREATED: 201,
    OK: 200,
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

vi.mock("@/app/lib/domains/certificates", () => ({
  certificatesService: mockCertificatesService,
}));

vi.mock("@/app/lib/gdpr/services/compliance.service", () => ({
  ComplianceService: {
    logAdminAction: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("professional certificates routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "new",
    });
  });

  it("lists certificates from the certificates domain with actor context", async () => {
    mockCertificatesService.getCertificates.mockResolvedValue({
      ok: true,
      data: [{ id: validCertId, category: "EDUCATION_CERT", title: "Degree" }],
    });

    const response = await listCertificatesRoute(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/certificates",
      ),
    );

    expect(response.status).toBe(200);
    expect(mockCertificatesService.getCertificates).toHaveBeenCalledWith(
      {
        clerkId: "clerk_123",
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      {},
    );
    expect(vi.mocked(getActorRateLimitIdentifier)).toHaveBeenCalledWith(
      "db_user_123",
      "prof-certificates-read",
    );
  });

  it("maps forbidden list access to 403", async () => {
    mockCertificatesService.getCertificates.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "sensitive detail",
      status: 403,
    });

    const response = await listCertificatesRoute(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/certificates",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("generates certificate POST idempotency key from summary projection", async () => {
    mockCertificatesService.createCertificate.mockResolvedValue({
      ok: true,
      data: {
        id: validCertId,
        category: "EDUCATION_CERT",
        title: "Degree",
        status: "PENDING",
        createdAt: "2026-03-10T12:00:00.000Z",
        updatedAt: "2026-03-10T12:00:00.000Z",
        asset: {
          id: "a1",
          cdnUrl: "/url",
          originalName: "degree.pdf",
          mimeType: "application/pdf",
          size: 2048,
        },
      },
    });

    const response = await createCertificateRoute(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/certificates",
        {
          method: "POST",
          body: JSON.stringify({
            title: "Degree",
            category: "EDUCATION_CERT",
            assetId: validCertId,
            issuer: "University",
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
        domain: "certificate",
        assetId: validCertId,
        titleLength: "Degree".length,
        issuerLength: "University".length,
        hasIssueDate: true,
        hasExpiryDate: false,
      },
    );
    expect(vi.mocked(getActorRateLimitIdentifier)).toHaveBeenCalledWith(
      "db_user_123",
      "prof-certificates-write",
    );
  });

  it("emits required observability keys for certificates list success", async () => {
    mockCertificatesService.getCertificates.mockResolvedValue({
      ok: true,
      data: [],
    });

    const response = await listCertificatesRoute(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/certificates",
      ),
    );

    expect(response.status).toBe(200);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Professional certificates adapter outcome",
      expect.objectContaining({
        correlationId: "test-correlation-id",
        operationName: "get_certificates",
        httpMethod: "GET",
        routePattern: "/api/professional-portal/certificates",
        actorRole: "PROFESSIONAL",
        outcome: "succeeded",
        httpStatus: 200,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("emits required observability keys for certificates list failure", async () => {
    mockCertificatesService.getCertificates.mockRejectedValue(
      new Error("boom"),
    );

    const response = await listCertificatesRoute(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/certificates",
      ),
    );

    expect(response.status).toBe(500);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Professional certificates adapter outcome",
      expect.objectContaining({
        correlationId: "test-correlation-id",
        operationName: "get_certificates",
        httpMethod: "GET",
        routePattern: "/api/professional-portal/certificates",
        actorRole: "PROFESSIONAL",
        outcome: "failed",
        httpStatus: 500,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("returns certificate detail from the certificates domain", async () => {
    mockCertificatesService.getCertificateById.mockResolvedValue({
      ok: true,
      data: {
        id: validCertId,
        category: "EDUCATION_CERT",
        title: "Degree",
        status: "PENDING",
      },
    });

    const response = await getCertificateRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/certificates/${validCertId}`,
      ),
      { id: validCertId },
    );

    expect(response.status).toBe(200);
    expect(mockCertificatesService.getCertificateById).toHaveBeenCalledWith(
      {
        clerkId: "clerk_123",
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      validCertId,
    );
    expect(vi.mocked(getActorRateLimitIdentifier)).toHaveBeenCalledWith(
      "db_user_123",
      "prof-certificates-read",
    );
  });

  it("maps getCertificateById not_found to 404", async () => {
    mockCertificatesService.getCertificateById.mockResolvedValue({
      ok: false,
      error: "not_found",
    });

    const response = await getCertificateRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/certificates/${validCertId}`,
      ),
      { id: validCertId },
    );

    expect(response.status).toBe(404);
    expect(vi.mocked(getActorRateLimitIdentifier)).toHaveBeenCalledWith(
      "db_user_123",
      "prof-certificates-read",
    );
  });

  it("maps update not_found to 404", async () => {
    mockCertificatesService.updateCertificate.mockResolvedValue({
      ok: false,
      error: "not_found",
    });

    const response = await updateCertificateRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/certificates/${validCertId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title: "Updated" }),
          headers: { "Content-Type": "application/json" },
        },
      ),
      { id: validCertId },
    );

    expect(response.status).toBe(404);
    expect(vi.mocked(getActorRateLimitIdentifier)).toHaveBeenCalledWith(
      "db_user_123",
      "prof-certificates-write",
    );
  });

  it("returns update success when idempotency completion fails", async () => {
    mockCertificatesService.updateCertificate.mockResolvedValue({
      ok: true,
      data: {
        id: validCertId,
        category: "EDUCATION_CERT",
        title: "Degree",
        status: "PENDING",
      },
    });
    vi.mocked(IdempotencyService.complete).mockRejectedValueOnce(
      new Error("serialize failure"),
    );

    const response = await updateCertificateRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/certificates/${validCertId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title: "Updated" }),
          headers: { "Content-Type": "application/json" },
        },
      ),
      { id: validCertId },
    );

    expect(response.status).toBe(200);
    expect(IdempotencyService.fail).toHaveBeenCalledWith("idem-key");
  });

  it("deletes a certificate and returns success", async () => {
    mockCertificatesService.deleteCertificate.mockResolvedValue({
      ok: true,
      data: {
        message: "Certificate deleted successfully",
        category: "EDUCATION_CERT",
      },
    });

    const response = await deleteCertificateRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/certificates/${validCertId}`,
        { method: "DELETE" },
      ),
      { id: validCertId },
    );

    expect(response.status).toBe(200);
    expect(mockCertificatesService.deleteCertificate).toHaveBeenCalledWith(
      {
        clerkId: "clerk_123",
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      validCertId,
    );
    expect(vi.mocked(getActorRateLimitIdentifier)).toHaveBeenCalledWith(
      "db_user_123",
      "prof-certificates-write",
    );
  });
});
