import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { isValidId } from "@/app/lib/api/api-guards";
import { PROFESSIONAL_CONFIG } from "@/app/lib/config/professional.config";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/profile/[id]
 * Get a professional's public profile by ID (no auth required).
 * Used for public profile viewing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = initializeCorrelationId(req);
  const { id } = await params;

  if (!isValidId(id)) {
    return apiError("Invalid professional ID", HttpStatus.BAD_REQUEST);
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `profile-detail:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  logger.info("Fetching professional profile by ID", {
    correlationId,
    professionalId: id,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () => {
      const professional = await prisma.professionalProfile.findUnique({
        where: { userId: id },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          offeredServices: {
            include: {
              service: {
                include: {
                  category: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      icon: true,
                    },
                  },
                },
              },
            },
          },
          licenses: {
            where: {
              status: "VERIFIED",
              OR: [
                { validUntil: { gt: new Date() } },
                { validUntil: null },
              ],
            },
            select: {
              authority: true,
              licenseNumber: true,
              category: true,
              validFrom: true,
              validUntil: true,
            },
            orderBy: { createdAt: "desc" },
          },
          portfolios: {
            take: 6,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              description: true,
              projectType: true,
              completionDate: true,
              images: {
                orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
                take: 4,
                select: {
                  id: true,
                  caption: true,
                  isMain: true,
                  category: true,
                  asset: {
                    select: {
                      cdnUrl: true,
                      thumbnailUrl: true,
                      blurHash: true,
                    },
                  },
                },
              },
            },
          },
          documents: {
            where: {
              status: "VERIFIED",
              category: { not: "ID_OR_PASSPORT" }, // Exclude sensitive docs
            },
            select: {
              id: true,
              title: true,
              issuer: true,
              category: true,
              status: true,
              verifiedAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          reviews: {
            where: { status: "PUBLISHED" },
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              reviewer: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          _count: {
            select: {
              reviews: true,
              projects: true,
              portfolios: true,
              stores: true,
              properties: true,
            },
          },
        },
      });

      if (!professional) {
        return { error: "not_found" as const };
      }

      // Calculate average rating from published reviews
      const avgRating =
        professional.reviews.length > 0
          ? professional.reviews.reduce((sum, r) => sum + r.rating, 0) /
            professional.reviews.length
          : null;

      return {
        data: {
          ...professional,
          avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        },
        success: true,
      };
    },
    {
      operationName: "get_professional_profile_by_id",
      cache: {
        ttl: PROFESSIONAL_CONFIG.DETAIL_CACHE_TTL_MS,
        staleWhileRevalidate: 10_000,
      },
    },
  );

  if (!result.success) {
    logger.error("Professional profile fetch failed", result.error, {
      correlationId,
      professionalId: id,
    });
    return apiError(
      "Failed to fetch professional",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  if (result.data?.error === "not_found") {
    logger.warn("Professional not found", {
      correlationId,
      professionalId: id,
    });
    return apiError("Professional not found", HttpStatus.NOT_FOUND);
  }

  return apiSuccess(result.data?.data, HttpStatus.OK);
}
