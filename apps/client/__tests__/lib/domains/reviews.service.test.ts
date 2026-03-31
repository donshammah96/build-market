import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMock = vi.hoisted(() => ({
  findPublished: vi.fn(),
}));

vi.mock("@/app/lib/domains/reviews/repository", () => ({
  reviewsRepository: repositoryMock,
}));

import { reviewsService } from "@/app/lib/domains/reviews/service";

const mockReviewsResult = {
  reviews: [
    {
      id: "rev_1",
      rating: 5,
      comment: "Great work",
      createdAt: "2026-03-10T12:00:00.000Z",
      type: "PROFESSIONAL" as const,
      reviewer: {
        firstName: "Jane",
        lastName: "Doe",
        avatar: null,
        city: "Nairobi",
      },
      professional: {
        id: "pro_1",
        companyName: "Build Co",
        imageUrl: null,
        verified: true,
      },
    },
  ],
  total: 1,
  hasMore: false,
};

describe("reviewsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns reviews result for public actor", async () => {
    repositoryMock.findPublished.mockResolvedValue(mockReviewsResult);

    const result = await reviewsService.getReviews({}, {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockReviewsResult);
    }
    expect(repositoryMock.findPublished).toHaveBeenCalledWith({});
  });

  it("delegates filters to repository", async () => {
    repositoryMock.findPublished.mockResolvedValue(mockReviewsResult);

    await reviewsService.getReviews(
      {},
      { type: "STORE", search: "plumber", limit: 10, offset: 5 },
    );

    expect(repositoryMock.findPublished).toHaveBeenCalledWith({
      type: "STORE",
      search: "plumber",
      limit: 10,
      offset: 5,
    });
  });

  it("passes empty actor for public access", async () => {
    repositoryMock.findPublished.mockResolvedValue(mockReviewsResult);

    const result = await reviewsService.getReviews(
      {},
      { type: "PROFESSIONAL" },
    );

    expect(result.ok).toBe(true);
    expect(repositoryMock.findPublished).toHaveBeenCalledWith({
      type: "PROFESSIONAL",
    });
  });
});
