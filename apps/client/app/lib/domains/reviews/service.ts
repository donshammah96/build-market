import { err, ok } from "@/app/lib/errors/result";
import { reviewsRepository } from "./repository";
import type {
  ReviewsActor,
  ReviewsQueryInput,
  ReviewsResult,
  ReviewsResultDto,
  SubmitProjectReviewInput,
} from "./contracts";

export const reviewsService = {
  async submitProjectReview(
    actor: { userId: string },
    input: SubmitProjectReviewInput,
  ): Promise<ReviewsResult<{ id: string }>> {
    const review = await reviewsRepository.createEligibleProjectReview(
      actor.userId,
      input,
    );
    if (!review) {
      return err({
        error: "review_not_eligible",
        message:
          "A review requires a completed project you own and can be submitted once.",
        status: 403,
      });
    }
    return ok(review);
  },

  async getReviews(
    _actor: ReviewsActor,
    input: ReviewsQueryInput = {},
  ): Promise<ReviewsResult<ReviewsResultDto>> {
    const data = await reviewsRepository.findPublished(input);
    return ok(data);
  },
};
