import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET as listProfessionalInquiriesRoute } from "@/app/api/professional-portal/inquiries/route";
import {
  GET as getProfessionalInquiryRoute,
  PATCH as updateProfessionalInquiryRoute,
  DELETE as deleteProfessionalInquiryRoute,
} from "@/app/api/professional-portal/inquiries/[id]/route";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";

const validInquiryId = "550e8400-e29b-41d4-a716-446655440001";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockInquiriesService = vi.hoisted(() => ({
  listProfessionalInquiries: vi.fn(),
  getProfessionalInquiryById: vi.fn(),
  updateProfessionalInquiry: vi.fn(),
  deleteProfessionalInquiry: vi.fn(),
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
        params ?? { id: validInquiryId },
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

vi.mock("@/app/lib/domains/inquiries", () => ({
  inquiriesService: mockInquiriesService,
}));

describe("professional inquiries routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "new",
    });
  });

  it("lists inquiries from the inquiries domain", async () => {
    mockInquiriesService.listProfessionalInquiries.mockResolvedValue({
      ok: true,
      data: {
        data: [
          {
            id: validInquiryId,
            property: {
              id: "property-1",
              title: "Garden Estate",
              slug: "garden-estate",
              location: "Nairobi",
            },
            clientName: "Jane Doe",
            clientPhone: "+254700000000",
            clientEmail: "jane@example.com",
            message: "Interested in a viewing",
            status: "NEW",
            createdAt: "2026-03-10T12:00:00.000Z",
            updatedAt: "2026-03-10T12:00:00.000Z",
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });

    const response = await listProfessionalInquiriesRoute(
      new NextRequest(
        "http://localhost:3000/api/professional-portal/inquiries?page=1&limit=10&status=NEW",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockInquiriesService.listProfessionalInquiries).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "professional",
      },
      expect.objectContaining({ page: 1, limit: 10, status: "NEW" }),
    );
    expect(body.data.pagination.total).toBe(1);
  });

  it("maps forbidden collection access to 403", async () => {
    mockInquiriesService.listProfessionalInquiries.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });

    const response = await listProfessionalInquiriesRoute(
      new NextRequest(
        "http://localhost:3000/api/professional-portal/inquiries",
      ),
    );

    expect(response.status).toBe(403);
  });

  it("returns inquiry detail from the inquiries domain", async () => {
    mockInquiriesService.getProfessionalInquiryById.mockResolvedValue({
      ok: true,
      data: {
        id: validInquiryId,
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+254700000000",
        message: "Interested in a viewing",
        status: "NEW",
        createdAt: new Date("2026-03-10T12:00:00.000Z"),
        updatedAt: new Date("2026-03-10T12:00:00.000Z"),
        sender: null,
        property: {
          id: "property-1",
          title: "Garden Estate",
          slug: "garden-estate",
          price: 12500000,
          currency: "KES",
          type: "HOUSE",
          category: "SALE",
          location: "Nairobi",
          status: "ACTIVE",
        },
      },
    });

    const response = await getProfessionalInquiryRoute(
      new NextRequest(
        `http://localhost:3000/api/professional-portal/inquiries/${validInquiryId}`,
      ),
      { id: validInquiryId },
    );

    expect(response.status).toBe(200);
    expect(
      mockInquiriesService.getProfessionalInquiryById,
    ).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "professional",
      },
      validInquiryId,
    );
  });

  it("maps update not_found responses to 404 and fails idempotency", async () => {
    mockInquiriesService.updateProfessionalInquiry.mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Inquiry not found",
      status: 404,
    });

    const response = await updateProfessionalInquiryRoute(
      new NextRequest(
        `http://localhost:3000/api/professional-portal/inquiries/${validInquiryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "CONTACTED" }),
          headers: { "Content-Type": "application/json" },
        },
      ),
      { id: validInquiryId },
    );

    expect(response.status).toBe(404);
    expect(IdempotencyService.fail).toHaveBeenCalledWith("idem-key");
  });

  it("deletes an inquiry and completes idempotency", async () => {
    mockInquiriesService.deleteProfessionalInquiry.mockResolvedValue({
      ok: true,
      data: { message: "Inquiry deleted successfully" },
    });

    const response = await deleteProfessionalInquiryRoute(
      new NextRequest(
        `http://localhost:3000/api/professional-portal/inquiries/${validInquiryId}`,
        { method: "DELETE" },
      ),
      { id: validInquiryId },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockInquiriesService.deleteProfessionalInquiry).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "professional",
      },
      validInquiryId,
    );
    expect(IdempotencyService.complete).toHaveBeenCalledWith("idem-key", {
      message: "Inquiry deleted successfully",
    });
    expect(body.data.message).toBe("Inquiry deleted successfully");
  });
});
