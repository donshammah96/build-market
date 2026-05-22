import { ok } from "@/app/lib/errors/result";
import { reviewsRepository } from "./repository";
import type {
  ReviewsActor,
  ReviewsQueryInput,
  ReviewsResult,
  ReviewsResultDto,
} from "./contracts";

export const reviewsService = {
  async getReviews(
    _actor: ReviewsActor,
    input: ReviewsQueryInput = {},
  ): Promise<ReviewsResult<ReviewsResultDto>> {
    const data = await reviewsRepository.findPublished(input);
    return ok(data);
  },
};
