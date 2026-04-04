import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProfessionalLeadAction,
  deleteProfessionalLeadAction,
  getProfessionalLeadByIdAction,
  getProfessionalLeadsAction,
  updateProfessionalLeadAction,
} from "@/app/actions/leads";
import { leadsService } from "@/app/lib/domains/leads";

const {
  authMock,
  userFindUniqueMock,
  adminProfileFindUniqueMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  adminProfileFindUniqueMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

const mockValidateTrustedMutationOriginForServerAction = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ok: true }),
);

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
    adminProfile: {
      findUnique: adminProfileFindUniqueMock,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/app/lib/api/http-security", () => ({
  validateTrustedMutationOriginForServerAction:
    mockValidateTrustedMutationOriginForServerAction,
  mutationOriginFailureMessage: vi.fn().mockReturnValue("Forbidden"),
}));

vi.mock("@/app/lib/domains/leads", () => ({
  leadsService: {
    listProfessionalLeads: vi.fn(),
    getProfessionalLeadById: vi.fn(),
    createProfessionalLead: vi.fn(),
    updateProfessionalLead: vi.fn(),
    deleteProfessionalLead: vi.fn(),
  },
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("leads actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "clerk_123" });
    userFindUniqueMock.mockResolvedValue({
      id: "db_user_123",
      email: "pro@example.com",
      role: "PROFESSIONAL",
    });
    adminProfileFindUniqueMock.mockResolvedValue(null);
  });

  it("returns unauthorized when the actor is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const result = await getProfessionalLeadsAction();

    expect(result).toEqual({
      success: false,
      error: {
        code: "unauthorized",
        message: "Unauthorized",
        status: 401,
      },
    });
  });

  it("returns validation_error for invalid lead creation input", async () => {
    const result = await createProfessionalLeadAction({
      clientName: "",
      title: "",
    } as never);

    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.code).toBe(
      "validation_error",
    );
    expect(leadsService.createProfessionalLead).not.toHaveBeenCalled();
  });

  it("returns forbidden for non-professional actors before reading lead detail", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: "db_user_123",
      email: "client@example.com",
      role: "CLIENT",
    });

    const result = await getProfessionalLeadByIdAction(
      "550e8400-e29b-41d4-a716-446655440001",
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "Forbidden",
        status: 403,
      },
    });
    expect(leadsService.getProfessionalLeadById).not.toHaveBeenCalled();
  });

  it("maps domain not_found failures for updates to a structured action error", async () => {
    vi.mocked(leadsService.updateProfessionalLead).mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Lead not found",
      status: 404,
    });

    const result = await updateProfessionalLeadAction({
      leadId: "550e8400-e29b-41d4-a716-446655440001",
      data: { status: "CONTACTED" },
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "not_found",
        message: "Lead not found",
        status: 404,
      },
    });
  });

  it("creates a lead through secureAction and revalidates the leads page", async () => {
    vi.mocked(leadsService.createProfessionalLead).mockResolvedValue({
      ok: true,
      data: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        clientName: "Jane Doe",
        clientEmail: "jane@example.com",
        clientPhone: null,
        clientId: null,
        title: "Kitchen Renovation",
        projectType: "RESIDENTIAL",
        location: null,
        county: null,
        budget: null,
        budgetMin: null,
        budgetMax: null,
        currency: "KES",
        status: "NEW",
        priority: "MEDIUM",
        source: "PLATFORM_SEARCH",
        lostReason: null,
        followUpDate: null,
        lastContactedAt: null,
        reminderSent: false,
        createdAt: "2026-03-10T12:00:00.000Z",
        updatedAt: "2026-03-10T12:00:00.000Z",
      },
    });

    const result = await createProfessionalLeadAction({
      clientName: "Jane Doe",
      clientEmail: "jane@example.com",
      title: "Kitchen Renovation",
      description: "Need an estimate",
      projectType: "RESIDENTIAL",
      currency: "KES",
      status: "NEW",
      priority: "MEDIUM",
      source: "PLATFORM_SEARCH",
    });

    expect(leadsService.createProfessionalLead).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      expect.objectContaining({
        clientName: "Jane Doe",
        title: "Kitchen Renovation",
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/professional-portal/leads",
    );
    expect(result).toEqual({
      success: true,
      data: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        clientName: "Jane Doe",
        clientEmail: "jane@example.com",
        clientPhone: null,
        clientId: null,
        title: "Kitchen Renovation",
        projectType: "RESIDENTIAL",
        location: null,
        county: null,
        budget: null,
        budgetMin: null,
        budgetMax: null,
        currency: "KES",
        status: "NEW",
        priority: "MEDIUM",
        source: "PLATFORM_SEARCH",
        lostReason: null,
        followUpDate: null,
        lastContactedAt: null,
        reminderSent: false,
        createdAt: "2026-03-10T12:00:00.000Z",
        updatedAt: "2026-03-10T12:00:00.000Z",
      },
    });
  });

  it("deletes a lead through secureAction and revalidates the leads page", async () => {
    vi.mocked(leadsService.deleteProfessionalLead).mockResolvedValue({
      ok: true,
      data: {
        message: "Lead deleted successfully",
        leadId: "550e8400-e29b-41d4-a716-446655440001",
      },
    });

    const result = await deleteProfessionalLeadAction({
      leadId: "550e8400-e29b-41d4-a716-446655440001",
    });

    expect(leadsService.deleteProfessionalLead).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      "550e8400-e29b-41d4-a716-446655440001",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/professional-portal/leads",
    );
    expect(result).toEqual({
      success: true,
      data: {
        message: "Lead deleted successfully",
        leadId: "550e8400-e29b-41d4-a716-446655440001",
      },
    });
  });
});
