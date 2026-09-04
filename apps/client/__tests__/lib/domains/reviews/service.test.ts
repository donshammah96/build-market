import { describe, expect, it, vi } from "vitest";
import { reviewsService } from "@/app/lib/domains/reviews/service";
import { reviewsRepository } from "@/app/lib/domains/reviews/repository";

describe("reviewsService.submitProjectReview", () => {
  it("permits exactly one review by the completed project's client", async () => {
    vi.spyOn(
      reviewsRepository,
      "createEligibleProjectReview",
    ).mockResolvedValue({
      id: "review_1",
    } as any);

    await expect(
      reviewsService.submitProjectReview(
        { userId: "client_1" },
        { projectId: "project_1", rating: 5, comment: "Completed as agreed" },
      ),
    ).resolves.toEqual({ ok: true, data: { id: "review_1" } });
  });

  it("returns the repository eligibility outcome without creating a review", async () => {
    vi.spyOn(
      reviewsRepository,
      "createEligibleProjectReview",
    ).mockResolvedValue(null);

    const result = await reviewsService.submitProjectReview(
      { userId: "client_1" },
      { projectId: "project_1", rating: 5 },
    );

    expect(result).toMatchObject({
      ok: false,
      error: "review_not_eligible",
      status: 403,
    });
  });
});
