import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchProfessionalsAction } from "@/app/actions/search";

const mockSearchService = vi.hoisted(() => ({
  searchProfessionals: vi.fn(),
}));

vi.mock("@/app/lib/domains/search", () => ({
  searchService: mockSearchService,
}));

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

describe("searchProfessionalsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns search results from the search domain with actor context", async () => {
    mockSearchService.searchProfessionals.mockResolvedValue({
      ok: true,
      data: mockSearchResults,
    });

    const result = await searchProfessionalsAction("carpenter");

    expect(result).toEqual(mockSearchResults);
    expect(mockSearchService.searchProfessionals).toHaveBeenCalledWith(
      {},
      "carpenter",
    );
  });

  it("throws on domain error", async () => {
    mockSearchService.searchProfessionals.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });

    await expect(searchProfessionalsAction("query")).rejects.toThrow(
      "Forbidden",
    );
  });

  it("passes empty actor for public access", async () => {
    mockSearchService.searchProfessionals.mockResolvedValue({
      ok: true,
      data: [],
    });

    await searchProfessionalsAction("plumber");

    expect(mockSearchService.searchProfessionals).toHaveBeenCalledWith(
      {},
      "plumber",
    );
  });
});
