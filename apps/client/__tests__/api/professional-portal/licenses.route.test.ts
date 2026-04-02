import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET as listLicensesRoute } from "@/app/api/professional-portal/licenses/route";
import {
  GET as getLicenseRoute,
  PATCH as updateLicenseRoute,
  DELETE as deleteLicenseRoute,
} from "@/app/api/professional-portal/licenses/[id]/route";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";

const validLicenseId = "550e8400-e29b-41d4-a716-446655440001";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockLicensesService = vi.hoisted(() => ({
  getLicenses: vi.fn(),
  getLicenseById: vi.fn(),
  createLicense: vi.fn(),
  updateLicense: vi.fn(),
  deleteLicense: vi.fn(),
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
        params ?? { id: validLicenseId },
      ),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
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

vi.mock("@/app/lib/domains/licenses", () => ({
  licensesService: mockLicensesService,
}));

vi.mock("@/app/lib/gdpr/services/compliance.service", () => ({
  ComplianceService: {
    logAdminAction: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("professional licenses routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "new",
    });
  });

  it("lists licenses from the licenses domain with actor context", async () => {
    mockLicensesService.getLicenses.mockResolvedValue({
      ok: true,
      data: [
        {
          id: validLicenseId,
          authority: "NCA",
          licenseNumber: "NCA-001",
          status: "PENDING",
          validFrom: "2026-01-01T00:00:00.000Z",
          validUntil: null,
          isAnnualRenewal: true,
          createdAt: "2026-03-10T12:00:00.000Z",
          updatedAt: "2026-03-10T12:00:00.000Z",
          asset: null,
        },
      ],
    });

    const response = await listLicensesRoute(
      new NextRequest("http://localhost:3500/api/professional-portal/licenses"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockLicensesService.getLicenses).toHaveBeenCalledWith({
      userId: "db_user_123",
      role: "professional",
    });
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(validLicenseId);
  });

  it("maps forbidden list access to 403", async () => {
    mockLicensesService.getLicenses.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });

    const response = await listLicensesRoute(
      new NextRequest("http://localhost:3500/api/professional-portal/licenses"),
    );

    expect(response.status).toBe(403);
  });

  it("emits required observability keys for licenses list success", async () => {
    mockLicensesService.getLicenses.mockResolvedValue({
      ok: true,
      data: [],
    });

    const response = await listLicensesRoute(
      new NextRequest("http://localhost:3500/api/professional-portal/licenses"),
    );

    expect(response.status).toBe(200);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Professional licenses adapter outcome",
      expect.objectContaining({
        correlationId: "test-correlation-id",
        operationName: "get_professional_licenses",
        httpMethod: "GET",
        routePattern: "/api/professional-portal/licenses",
        actorRole: "professional",
        outcome: "succeeded",
        httpStatus: 200,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("emits required observability keys for licenses list failure", async () => {
    mockLicensesService.getLicenses.mockRejectedValue(new Error("boom"));

    const response = await listLicensesRoute(
      new NextRequest("http://localhost:3500/api/professional-portal/licenses"),
    );

    expect(response.status).toBe(500);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Professional licenses adapter outcome",
      expect.objectContaining({
        correlationId: "test-correlation-id",
        operationName: "get_professional_licenses",
        httpMethod: "GET",
        routePattern: "/api/professional-portal/licenses",
        actorRole: "professional",
        outcome: "failed",
        httpStatus: 500,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("returns license detail from the licenses domain", async () => {
    mockLicensesService.getLicenseById.mockResolvedValue({
      ok: true,
      data: {
        id: validLicenseId,
        authority: "NCA",
        licenseNumber: "NCA-001",
        status: "PENDING",
        verifiedBy: null,
        notes: null,
      },
    });

    const response = await getLicenseRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/licenses/${validLicenseId}`,
      ),
      { id: validLicenseId },
    );

    expect(response.status).toBe(200);
    expect(mockLicensesService.getLicenseById).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "professional" },
      validLicenseId,
    );
  });

  it("maps getLicenseById not_found to 404", async () => {
    mockLicensesService.getLicenseById.mockResolvedValue({
      ok: false,
      error: "not_found",
    });

    const response = await getLicenseRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/licenses/${validLicenseId}`,
      ),
      { id: validLicenseId },
    );

    expect(response.status).toBe(404);
  });

  it("maps update not_found to 404 and fails idempotency", async () => {
    mockLicensesService.updateLicense.mockResolvedValue({
      ok: false,
      error: "not_found",
    });

    const response = await updateLicenseRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/licenses/${validLicenseId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ licenseNumber: "NCA-002" }),
          headers: { "Content-Type": "application/json" },
        },
      ),
      { id: validLicenseId },
    );

    expect(response.status).toBe(404);
    expect(IdempotencyService.fail).toHaveBeenCalledWith("idem-key");
  });

  it("deletes a license and completes idempotency", async () => {
    mockLicensesService.deleteLicense.mockResolvedValue({
      ok: true,
      data: {
        message: "License deleted successfully",
        licenseId: validLicenseId,
        authority: "NCA",
        licenseNumber: "NCA-001",
      },
    });

    const response = await deleteLicenseRoute(
      new NextRequest(
        `http://localhost:3500/api/professional-portal/licenses/${validLicenseId}`,
        { method: "DELETE" },
      ),
      { id: validLicenseId },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockLicensesService.deleteLicense).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "professional" },
      validLicenseId,
    );
    expect(IdempotencyService.complete).toHaveBeenCalledWith("idem-key", {
      message: "License deleted successfully",
      licenseId: validLicenseId,
    });
    expect(body.data.message).toBe("License deleted successfully");
  });
});
