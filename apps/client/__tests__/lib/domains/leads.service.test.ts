import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  listProfessionalLeads: vi.fn(),
  findProfessionalLeadById: vi.fn(),
  createProfessionalLead: vi.fn(),
  updateProfessionalLead: vi.fn(),
  deleteProfessionalLead: vi.fn(),
  findProfessionalProfileForPublicLead: vi.fn(),
  createPublicLead: vi.fn(),
  findPublicLeadStatus: vi.fn(),
}));

const notificationMocks = vi.hoisted(() => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/lib/domains/leads/repository", () => ({
  leadsRepository: repositoryMocks,
}));

vi.mock("@/lib/notifications", () => notificationMocks);

import { leadsService } from "@/app/lib/domains/leads/service";
import { LEAD_STATUS_LABELS } from "@/app/lib/domains/leads/contracts";

describe("leadsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects professional lead reads for actors without a professional-capable role", async () => {
    const result = await leadsService.listProfessionalLeads(
      { userId: "user_1", role: "client" },
      { page: 1, limit: 20, status: undefined },
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
    expect(repositoryMocks.listProfessionalLeads).not.toHaveBeenCalled();
  });

  it("returns forbidden when a professional tries to read another professional's lead", async () => {
    repositoryMocks.findProfessionalLeadById.mockResolvedValue({
      id: "lead_1",
      professionalId: "owner_2",
    });

    const result = await leadsService.getProfessionalLeadById(
      { userId: "owner_1", role: "professional" },
      "lead_1",
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
  });

  it("creates public leads and dispatches the domain notification side effect", async () => {
    repositoryMocks.findProfessionalProfileForPublicLead.mockResolvedValue({
      userId: "professional_1",
      companyName: "Acme Builds",
      verified: true,
    });
    repositoryMocks.createPublicLead.mockResolvedValue({
      id: "lead_1",
      projectType: "RESIDENTIAL",
      status: "NEW",
      createdAt: new Date("2026-03-11T09:00:00.000Z"),
    });

    const result = await leadsService.submitPublicLead({
      professionalId: "professional_1",
      clientName: "Jane Doe",
      clientEmail: "jane@example.com",
      title: "Kitchen Renovation",
      message: "Need an estimate",
      projectType: "RESIDENTIAL",
      source: "REFERRAL",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        message: "Inquiry sent successfully",
        lead: {
          id: "lead_1",
          projectType: "RESIDENTIAL",
          status: "NEW",
          createdAt: "2026-03-11T09:00:00.000Z",
        },
      },
    });
    expect(notificationMocks.createNotification).toHaveBeenCalledWith({
      userId: "professional_1",
      title: "New Lead Received",
      message: "New inquiry from Jane Doe: Kitchen Renovation",
      type: "LEAD",
      link: "/professional-portal/leads",
    });
  });

  it("returns a sanitized public lead status payload", async () => {
    repositoryMocks.findPublicLeadStatus.mockResolvedValue({
      id: "lead_1",
      title: "Kitchen Renovation",
      projectType: "RESIDENTIAL",
      location: "Nairobi",
      status: "CONTACTED",
      createdAt: new Date("2026-03-11T09:00:00.000Z"),
      updatedAt: new Date("2026-03-11T10:00:00.000Z"),
      professional: {
        companyName: "Acme Builds",
        user: {
          firstName: "Ann",
          lastName: "Builder",
        },
      },
    });

    const result = await leadsService.getPublicLeadStatus("lead_1");

    expect(result).toEqual({
      ok: true,
      data: {
        id: "lead_1",
        title: "Kitchen Renovation",
        projectType: "RESIDENTIAL",
        location: "Nairobi",
        status: "CONTACTED",
        statusLabel: LEAD_STATUS_LABELS.CONTACTED,
        professionalName: "Acme Builds",
        submittedAt: "2026-03-11T09:00:00.000Z",
        lastUpdated: "2026-03-11T10:00:00.000Z",
      },
    });
  });
});
