import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as createPublicLeadRoute } from "@/app/api/leads/route";
import { GET as getPublicLeadStatusRoute } from "@/app/api/leads/[id]/route";

const validProfessionalId = "550e8400-e29b-41d4-a716-446655440000";
const validLeadId = "550e8400-e29b-41d4-a716-446655440001";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockLeadsService = vi.hoisted(() => ({
  submitPublicLead: vi.fn(),
  getPublicLeadStatus: vi.fn(),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        return { success: true, data: await fn() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  }),
}));

vi.mock("@/app/lib/domains/leads", () => ({
  leadsService: mockLeadsService,
}));

describe("public leads routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid public lead json before invoking the domain", async () => {
    const request = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: "{",
      headers: { "Content-Type": "application/json" },
    });

    const response = await createPublicLeadRoute(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockLeadsService.submitPublicLead).not.toHaveBeenCalled();
  });

  it("maps public lead professional_not_found to 404", async () => {
    mockLeadsService.submitPublicLead.mockResolvedValue({
      ok: false,
      error: "professional_not_found",
    });

    const request = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: JSON.stringify({
        professionalId: validProfessionalId,
        clientName: "Jane Doe",
        clientEmail: "jane@example.com",
        title: "Kitchen Renovation",
        message: "Need an estimate",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createPublicLeadRoute(request);

    expect(response.status).toBe(404);
    expect(mockLeadsService.submitPublicLead).toHaveBeenCalledOnce();
  });

  it("returns 201 for successful public lead submission", async () => {
    mockLeadsService.submitPublicLead.mockResolvedValue({
      ok: true,
      data: {
        message: "Inquiry sent successfully",
        lead: {
          id: "lead-1",
          projectType: "RESIDENTIAL",
          status: "NEW",
          createdAt: new Date("2026-03-10T12:00:00.000Z"),
        },
      },
    });

    const request = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: JSON.stringify({
        professionalId: validProfessionalId,
        clientName: "Jane Doe",
        clientEmail: "jane@example.com",
        title: "Kitchen Renovation",
        message: "Need an estimate",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createPublicLeadRoute(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.message).toBe("Inquiry sent successfully");
  });

  it("returns 400 for invalid public lead status ids", async () => {
    const request = new NextRequest("http://localhost:3000/api/leads/", {
      method: "GET",
    });

    const response = await getPublicLeadStatusRoute(request, {
      params: Promise.resolve({ id: "" }),
    });

    expect(response.status).toBe(400);
    expect(mockLeadsService.getPublicLeadStatus).not.toHaveBeenCalled();
  });

  it("maps public lead status not_found to 404", async () => {
    mockLeadsService.getPublicLeadStatus.mockResolvedValue({
      ok: false,
      error: "not_found",
    });

    const leadId = validLeadId;
    const request = new NextRequest(
      `http://localhost:3000/api/leads/${leadId}`,
      {
        method: "GET",
      },
    );

    const response = await getPublicLeadStatusRoute(request, {
      params: Promise.resolve({ id: leadId }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 200 for successful public lead status lookup", async () => {
    mockLeadsService.getPublicLeadStatus.mockResolvedValue({
      ok: true,
      data: {
        id: validLeadId,
        title: "Kitchen Renovation",
        projectType: "RESIDENTIAL",
        location: "Nairobi",
        status: "NEW",
        statusLabel: "Submitted",
        professionalName: "Acme Builds",
        submittedAt: new Date("2026-03-10T12:00:00.000Z"),
        lastUpdated: new Date("2026-03-10T12:10:00.000Z"),
      },
    });

    const leadId = validLeadId;
    const request = new NextRequest(
      `http://localhost:3000/api/leads/${leadId}`,
      {
        method: "GET",
      },
    );

    const response = await getPublicLeadStatusRoute(request, {
      params: Promise.resolve({ id: leadId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.professionalName).toBe("Acme Builds");
  });
});
