import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  listProfessionalInquiries: vi.fn(),
  findProfessionalInquiryById: vi.fn(),
  updateProfessionalInquiry: vi.fn(),
  deleteProfessionalInquiry: vi.fn(),
}));

vi.mock("@/app/lib/domains/inquiries/repository", () => ({
  inquiriesRepository: repositoryMocks,
}));

import { inquiriesService } from "@/app/lib/domains/inquiries/service";

describe("inquiriesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects inquiry reads for actors without a professional-capable role", async () => {
    const result = await inquiriesService.listProfessionalInquiries(
      { userId: "agent_1", role: "client" },
      { page: 1, limit: 20 },
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
    expect(repositoryMocks.listProfessionalInquiries).not.toHaveBeenCalled();
  });

  it("formats inquiry list items with sender-preferred client identity", async () => {
    repositoryMocks.listProfessionalInquiries.mockResolvedValue([
      [
        {
          id: "inq_1",
          property: {
            id: "property_1",
            title: "Westlands Apartment",
            slug: "westlands-apartment",
            location: "Westlands",
          },
          sender: {
            firstName: "Jane",
            lastName: "Doe",
            phone: "+254700000000",
          },
          name: "Fallback Name",
          phone: "+254711111111",
          email: "jane@example.com",
          message: "Need a viewing",
          status: "NEW",
          createdAt: new Date("2026-03-11T09:00:00.000Z"),
          updatedAt: new Date("2026-03-11T10:00:00.000Z"),
        },
      ],
      1,
    ]);

    const result = await inquiriesService.listProfessionalInquiries(
      { userId: "agent_1", role: "professional" },
      { page: 1, limit: 20 },
    );

    expect(result).toEqual({
      ok: true,
      data: {
        data: [
          {
            id: "inq_1",
            property: {
              id: "property_1",
              title: "Westlands Apartment",
              slug: "westlands-apartment",
              location: "Westlands",
            },
            clientName: "Jane Doe",
            clientPhone: "+254700000000",
            clientEmail: "jane@example.com",
            message: "Need a viewing",
            status: "NEW",
            createdAt: "2026-03-11T09:00:00.000Z",
            updatedAt: "2026-03-11T10:00:00.000Z",
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      },
    });
  });

  it("returns forbidden when a professional tries to update another agent's inquiry", async () => {
    repositoryMocks.findProfessionalInquiryById.mockResolvedValue({
      id: "inq_1",
      property: {
        agentId: "agent_2",
        price: 9500000,
      },
    });

    const result = await inquiriesService.updateProfessionalInquiry(
      { userId: "agent_1", role: "professional" },
      "inq_1",
      { status: "CONTACTED" },
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
    expect(repositoryMocks.updateProfessionalInquiry).not.toHaveBeenCalled();
  });

  it("returns the canonical delete payload for owned inquiries", async () => {
    repositoryMocks.findProfessionalInquiryById.mockResolvedValue({
      id: "inq_1",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+254700000000",
      message: "Need a viewing",
      status: "NEW",
      notes: null,
      preferredViewingDate: null,
      createdAt: new Date("2026-03-11T09:00:00.000Z"),
      updatedAt: new Date("2026-03-11T10:00:00.000Z"),
      sender: null,
      property: {
        id: "property_1",
        title: "Westlands Apartment",
        slug: "westlands-apartment",
        price: 9500000,
        currency: "KES",
        type: "SALE",
        category: "RESIDENTIAL",
        location: "Westlands",
        status: "ACTIVE",
        agentId: "agent_1",
      },
    });
    repositoryMocks.deleteProfessionalInquiry.mockResolvedValue(undefined);

    const result = await inquiriesService.deleteProfessionalInquiry(
      { userId: "agent_1", role: "professional" },
      "inq_1",
    );

    expect(result).toEqual({
      ok: true,
      data: { message: "Inquiry deleted successfully" },
    });
    expect(repositoryMocks.deleteProfessionalInquiry).toHaveBeenCalledWith(
      "inq_1",
    );
  });
});
