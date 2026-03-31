import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  listProfessionalProperties: vi.fn(),
  groupPipelineCounts: vi.fn(),
}));

vi.mock("@/app/lib/domains/pipeline/repository", () => ({
  pipelineRepository: repositoryMocks,
}));

import { pipelineService } from "@/app/lib/domains/pipeline/service";

describe("pipelineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects pipeline reads for actors without a professional-capable role", async () => {
    const result = await pipelineService.getProfessionalPipeline({
      userId: "agent_1",
      role: "client",
    });

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
    expect(repositoryMocks.listProfessionalProperties).not.toHaveBeenCalled();
  });

  it("returns the expected empty pipeline shape when the professional has no properties", async () => {
    repositoryMocks.listProfessionalProperties.mockResolvedValue([]);

    const result = await pipelineService.getProfessionalPipeline({
      userId: "agent_1",
      role: "professional",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        stages: [
          { id: "viewing", label: "Viewings Scheduled", count: 0, value: 0 },
          { id: "offer", label: "Offers Pending", count: 0, value: 0 },
          { id: "closing", label: "Ready to Close", count: 0, value: 0 },
        ],
        totalValue: 0,
      },
    });
    expect(repositoryMocks.groupPipelineCounts).not.toHaveBeenCalled();
  });

  it("aggregates pipeline counts and total value across property inquiry stages", async () => {
    repositoryMocks.listProfessionalProperties.mockResolvedValue([
      { id: "property_1", price: 5000000 },
      { id: "property_2", price: 7500000 },
    ]);
    repositoryMocks.groupPipelineCounts.mockResolvedValue([
      {
        status: "VIEWING_SCHEDULED",
        propertyId: "property_1",
        _count: { id: 2 },
      },
      { status: "OFFER_MADE", propertyId: "property_2", _count: { id: 1 } },
      { status: "CLOSED", propertyId: "property_1", _count: { id: 1 } },
    ]);

    const result = await pipelineService.getProfessionalPipeline({
      userId: "agent_1",
      role: "professional",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        stages: [
          {
            id: "viewing",
            label: "Viewings Scheduled",
            count: 2,
            value: 10000000,
          },
          {
            id: "offer",
            label: "Offers Pending",
            count: 1,
            value: 7500000,
          },
          {
            id: "closing",
            label: "Ready to Close",
            count: 1,
            value: 5000000,
          },
        ],
        totalValue: 22500000,
      },
    });
    expect(repositoryMocks.groupPipelineCounts).toHaveBeenCalledWith([
      "property_1",
      "property_2",
    ]);
  });
});
