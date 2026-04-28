import { beforeEach, describe, expect, it, vi } from "vitest";
import { professionalsService } from "@/app/lib/domains/professionals/service";

const repositoryMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findByUserId: vi.fn(),
}));

vi.mock("@/app/lib/domains/professionals/repository", () => ({
  professionalRepository: repositoryMocks,
}));

describe("Professionals public-access policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permits listProfessionals as public read", async () => {
    repositoryMocks.findMany.mockResolvedValue({
      data: [],
      total: 0,
      hasMore: false,
    });

    const result = await professionalsService.listProfessionals({
      search: "",
      category: "all",
      profession: undefined,
      county: undefined,
      city: undefined,
      sortBy: "rating",
      includeUnverified: "false",
      limit: 20,
      offset: 0,
    });

    expect(result.ok).toBe(true);
  });

  it("returns not_found for unknown professional id", async () => {
    repositoryMocks.findByUserId.mockResolvedValue(null);

    const result = await professionalsService.getProfessionalById("missing-id");

    expect(result).toMatchObject({
      ok: false,
      error: "not_found",
      status: 404,
    });
  });

  it("returns detail payload for known professional id", async () => {
    repositoryMocks.findByUserId.mockResolvedValue({
      id: "professional-1",
      userId: "professional-1",
      profession: "ARCHITECT",
      companyName: "Build Co",
      city: "Nairobi",
      county: "NAIROBI",
      country: "Kenya",
      user: {
        id: "professional-1",
        firstName: "Alex",
        lastName: "Builder",
        avatar: null,
      },
      portfolios: [],
    });

    const result =
      await professionalsService.getProfessionalById("professional-1");

    expect(result.ok).toBe(true);
  });
});
