import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET as listCertificatesRoute } from "@/app/api/professional-portal/certificates/route";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  GET as getCertificateRoute,
  PATCH as updateCertificateRoute,
  DELETE as deleteCertificateRoute,
} from "@/app/api/professional-portal/certificates/[id]/route";

const validCertId = "550e8400-e29b-41d4-a716-446655440001";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

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
        context: unknown,
        params?: { id: string },
      ) => Promise<unknown>,
    ) =>
    async (req: NextRequest, params?: { id: string }) =>
      handler(
        req,
        {
          clerkId: "clerk_123",
          dbUserId: "db_user_123",
          userEmail: "pro@example.com",
          userRole: "PROFESSIONAL",
        },
        params ?? { id: validCertId },
      ),
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
      { userId: "db_user_123", role: "professional" },
      {},
    );
  });

  it("maps forbidden list access to 403", async () => {
    mockCertificatesService.getCertificates.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });

    const response = await listCertificatesRoute(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/certificates",
      ),
    );

    expect(response.status).toBe(403);
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
        actorRole: "professional",
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
        actorRole: "professional",
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
      { userId: "db_user_123", role: "professional" },
      validCertId,
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
      { userId: "db_user_123", role: "professional" },
      validCertId,
    );
  });
});
