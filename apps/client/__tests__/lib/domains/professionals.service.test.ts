import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findByUserId: vi.fn(),
}));

vi.mock("@/app/lib/domains/professionals/repository", () => ({
  professionalRepository: repositoryMocks,
}));

vi.mock("@/app/lib/infrastructure/env", () => ({
  env: {
    appUrl: "http://localhost:3500",
  },
}));

import { professionalsService } from "@/app/lib/domains/professionals/service";

describe("professionalsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps public list reads onto canonical dto fields", async () => {
    repositoryMocks.findMany.mockResolvedValue({
      data: [
        {
          id: "prof_1",
          profession: "PLUMBER",
          portfolios: [
            {
              images: [
                {
                  asset: {
                    cdnUrl: "https://cdn.example.com/image.jpg",
                    thumbnailUrl: "https://cdn.example.com/thumb.jpg",
                  },
                },
              ],
            },
          ],
        },
      ],
      total: 1,
      hasMore: false,
    });

    const result = await professionalsService.listProfessionals({
      search: "plumber",
      category: "plumbing",
      profession: undefined,
      county: undefined,
      city: undefined,
      sortBy: "rating",
      includeUnverified: "false",
      limit: 20,
      offset: 0,
    });

    expect(repositoryMocks.findMany).toHaveBeenCalledWith({
      search: "plumber",
      categorySlug: "plumbing",
      profession: undefined,
      county: undefined,
      city: undefined,
      sortBy: "rating",
      verifiedOnly: true,
      limit: 20,
      offset: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const firstProfessional = result.data.professionals[0];
      expect(firstProfessional).toBeDefined();
      if (!firstProfessional) {
        throw new Error("Expected the professionals list to include one item");
      }

      expect(firstProfessional.profileUrl).toBe(
        "http://localhost:3500/professionals/prof_1",
      );
      expect(firstProfessional.portfolioImage).toBe(
        "https://cdn.example.com/image.jpg",
      );
      expect(firstProfessional.professionLabel).toBeTruthy();
    }
  });

  it("returns not_found when the detail profile does not exist", async () => {
    repositoryMocks.findByUserId.mockResolvedValue(null);

    const result = await professionalsService.getProfessionalById("prof_1");

    expect(result).toEqual({
      ok: false,
      error: "not_found",
      message: "Professional not found",
      status: 404,
    });
  });

  it("builds the public detail dto with derived location fields", async () => {
    repositoryMocks.findByUserId.mockResolvedValue({
      userId: "prof_1",
      profession: "ARCHITECT",
      city: "Nairobi",
      county: "NAIROBI",
      country: "Kenya",
      user: {
        avatar: "https://cdn.example.com/avatar.jpg",
      },
    });

    const result = await professionalsService.getProfessionalById("prof_1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.profileImage).toBe(
        "https://cdn.example.com/avatar.jpg",
      );
      expect(result.data.location).toBe("Nairobi, Kenya");
      expect(result.data.profileUrl).toBe(
        "http://localhost:3500/professionals/prof_1",
      );
      expect(result.data.professionLabel).toBeTruthy();
    }
  });
});
