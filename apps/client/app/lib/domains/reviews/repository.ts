import { Prisma } from "@prisma/client";
import { prisma } from "@build/db";
import { toReviewDto } from "./mappers";
import type { ReviewsQueryInput } from "./contracts";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export const reviewsRepository = {
  /**
   * The project/duplicate checks and creation share one transaction so retries
   * cannot turn a completed project into multiple reviews.
   */
  async createEligibleProjectReview(
    reviewerId: string,
    input: { projectId: string; rating: number; comment?: string; title?: string },
  ) {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: {
          id: input.projectId,
          clientId: reviewerId,
          status: "COMPLETED",
          deletedAt: null,
          professionalId: { not: null },
        },
        select: { id: true, professionalId: true, stagingTestRunId: true },
      });
      if (!project?.professionalId) return null;

      const duplicate = await tx.review.findFirst({
        where: { reviewerId, projectId: project.id, deletedAt: null },
        select: { id: true },
      });
      if (duplicate) return null;

      return tx.review.create({
        data: {
          reviewerId,
          professionalId: project.professionalId,
          projectId: project.id,
          type: "PROFESSIONAL",
          rating: input.rating,
          comment: input.comment,
          title: input.title,
          status: "PENDING",
          isVerified: true,
          stagingTestRunId: project.stagingTestRunId,
        },
        select: { id: true },
      });
    });
  },

  async findPublished(input: ReviewsQueryInput = {}) {
    const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = input.offset ?? 0;

    const where: Prisma.ReviewWhereInput = {
      status: "PUBLISHED",
    };

    if (input.type) {
      where.type = input.type;
    }

    if (input.search?.trim()) {
      const search = input.search.trim().toLowerCase();
      where.OR = [
        { comment: { contains: search, mode: "insensitive" } },
        {
          professional: {
            companyName: { contains: search, mode: "insensitive" },
          },
        },
        {
          store: {
            name: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    const [reviewsData, total] = await Promise.all([
      prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          type: true,
          reviewer: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
              clientProfile: {
                select: { city: true },
              },
            },
          },
          professional: {
            select: {
              userId: true,
              companyName: true,
              verified: true,
              user: {
                select: { avatar: true },
              },
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              verified: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        skip: offset,
      }),
      prisma.review.count({ where }),
    ]);

    const hasMore = reviewsData.length > limit;
    const reviews = reviewsData.slice(0, limit).map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: toReviewDto(r.createdAt) as unknown as string,
      type: r.type,
      reviewer: {
        firstName: r.reviewer.firstName ?? "",
        lastName: r.reviewer.lastName ?? "",
        avatar: r.reviewer.avatar,
        city: r.reviewer.clientProfile?.city ?? null,
      },
      ...(r.professional && {
        professional: {
          id: r.professional.userId,
          companyName: r.professional.companyName,
          imageUrl: r.professional.user?.avatar ?? null,
          verified: r.professional.verified,
        },
      }),
      ...(r.store && {
        store: {
          id: r.store.id,
          name: r.store.name,
          imageUrl: r.store.logoUrl,
          verified: r.store.verified,
        },
      }),
    }));

    return {
      reviews,
      total,
      hasMore,
    };
  },
};
