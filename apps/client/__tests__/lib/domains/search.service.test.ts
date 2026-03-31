import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMock = vi.hoisted(() => ({
  searchProfessionals: vi.fn(),
}));

vi.mock("@/app/lib/domains/search/repository", () => ({
  searchRepository: repositoryMock,
}));

import { searchService } from "@/app/lib/domains/search/service";

const mockSearchResults = [
  {
    userId: "pro_1",
    companyName: "Build Co",
    bio: "Expert builder",
    verified: true,
    user: {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    },
  },
];

describe("searchService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns search results for public actor", async () => {
    repositoryMock.searchProfessionals.mockResolvedValue(mockSearchResults);

    const result = await searchService.searchProfessionals({}, "carpenter");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockSearchResults);
    }
    expect(repositoryMock.searchProfessionals).toHaveBeenCalledWith(
      "carpenter",
    );
  });

  it("delegates query to repository", async () => {
    repositoryMock.searchProfessionals.mockResolvedValue([]);

    await searchService.searchProfessionals({}, "plumber");

    expect(repositoryMock.searchProfessionals).toHaveBeenCalledTimes(1);
    expect(repositoryMock.searchProfessionals).toHaveBeenCalledWith("plumber");
  });

  it("passes empty actor for public access", async () => {
    repositoryMock.searchProfessionals.mockResolvedValue(mockSearchResults);

    const result = await searchService.searchProfessionals({}, "electrician");

    expect(result.ok).toBe(true);
    expect(repositoryMock.searchProfessionals).toHaveBeenCalledWith(
      "electrician",
    );
  });
});
