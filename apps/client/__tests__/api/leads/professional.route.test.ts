import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  GET as listProfessionalLeadsRoute,
  POST as createProfessionalLeadRoute,
} from "@/app/api/professional-portal/leads/route";
import {
  GET as getProfessionalLeadRoute,
  PATCH as updateProfessionalLeadRoute,
  DELETE as deleteProfessionalLeadRoute,
} from "@/app/api/professional-portal/leads/[id]/route";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";

const validLeadId = "550e8400-e29b-41d4-a716-446655440001";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockLeadsService = vi.hoisted(() => ({
  listProfessionalLeads: vi.fn(),
  createProfessionalLead: vi.fn(),
  getProfessionalLeadById: vi.fn(),
  updateProfessionalLead: vi.fn(),
  deleteProfessionalLead: vi.fn(),
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
        params ?? { id: validLeadId },
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
    CREATED: 201,
    BAD_REQUEST: 400,
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
}));

vi.mock("@/app/lib/api/request-utils", () => ({
  getRequestMetadata: vi.fn().mockReturnValue({ ipAddress: "127.0.0.1" }),
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/app/lib/domains/leads", () => ({
  leadsService: mockLeadsService,
}));

describe("professional leads routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "new",
    });
  });

  it("lists leads from the leads domain", async () => {
    mockLeadsService.listProfessionalLeads.mockResolvedValue({
      ok: true,
      data: {
        leads: [{ id: validLeadId, title: "Kitchen Renovation" }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

    const response = await listProfessionalLeadsRoute(
      new NextRequest(
        "http://localhost:3000/api/professional-portal/leads?page=1&limit=20&status=NEW",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockLeadsService.listProfessionalLeads).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      expect.objectContaining({
        page: 1,
        limit: 20,
        status: ["NEW"],
      }),
    );
    expect(body.data.pagination.total).toBe(1);
  });

  it("creates a lead and completes idempotency", async () => {
    mockLeadsService.createProfessionalLead.mockResolvedValue({
      ok: true,
      data: {
        id: validLeadId,
        title: "Kitchen Renovation",
        clientName: "Jane Doe",
      },
    });

    const response = await createProfessionalLeadRoute(
      new NextRequest("http://localhost:3000/api/professional-portal/leads", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Jane Doe",
          clientEmail: "jane@example.com",
          title: "Kitchen Renovation",
          description: "Need a quotation",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockLeadsService.createProfessionalLead).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      expect.objectContaining({
        clientName: "Jane Doe",
        title: "Kitchen Renovation",
      }),
    );
    expect(IdempotencyService.complete).toHaveBeenCalledWith("idem-key", {
      id: validLeadId,
      title: "Kitchen Renovation",
      clientName: "Jane Doe",
    });
    expect(body.data.id).toBe(validLeadId);
  });

  it("returns professional lead detail from the leads domain", async () => {
    mockLeadsService.getProfessionalLeadById.mockResolvedValue({
      ok: true,
      data: {
        id: validLeadId,
        title: "Kitchen Renovation",
        clientName: "Jane Doe",
      },
    });

    const response = await getProfessionalLeadRoute(
      new NextRequest(
        `http://localhost:3000/api/professional-portal/leads/${validLeadId}`,
      ),
      { id: validLeadId },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockLeadsService.getProfessionalLeadById).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      validLeadId,
    );
    expect(body.data.title).toBe("Kitchen Renovation");
  });

  it("maps update not_found responses to 404 and fails idempotency", async () => {
    mockLeadsService.updateProfessionalLead.mockResolvedValue({
      ok: false,
      error: "not_found",
    });

    const response = await updateProfessionalLeadRoute(
      new NextRequest(
        `http://localhost:3000/api/professional-portal/leads/${validLeadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "CONTACTED" }),
          headers: { "Content-Type": "application/json" },
        },
      ),
      { id: validLeadId },
    );

    expect(response.status).toBe(404);
    expect(IdempotencyService.fail).toHaveBeenCalledWith("idem-key");
  });

  it("deletes a lead and completes idempotency", async () => {
    mockLeadsService.deleteProfessionalLead.mockResolvedValue({
      ok: true,
      data: {
        message: "Lead deleted successfully",
        leadId: validLeadId,
      },
    });

    const response = await deleteProfessionalLeadRoute(
      new NextRequest(
        `http://localhost:3000/api/professional-portal/leads/${validLeadId}`,
        {
          method: "DELETE",
        },
      ),
      { id: validLeadId },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockLeadsService.deleteProfessionalLead).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      validLeadId,
    );
    expect(IdempotencyService.complete).toHaveBeenCalledWith("idem-key", {
      message: "Lead deleted successfully",
      leadId: validLeadId,
    });
    expect(body.data.leadId).toBe(validLeadId);
  });
});
