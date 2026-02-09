import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import { ProfessionalRepository } from "@/app/lib/repositories/professional.repository";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";
import { env } from "@/app/lib/env";

const logger = getClientLogger();

/**
 * GET /api/professionals/[id]
 * Get detailed information about a specific professional (public endpoint)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = initializeCorrelationId(request);
  const { id } = await params;

  // Rate limiting
  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `professional-detail:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  // Validate ID format (basic validation)
  if (!id || id.length < 10) {
    logger.warn("Invalid professional ID format", { correlationId, id });
    return apiError("Invalid professional ID", HttpStatus.BAD_REQUEST);
  }

  logger.info("Fetching professional details", {
    correlationId,
    professionalId: id,
  });

  return executeResilient(
    async () => {
      // Use repository to fetch professional
      const repo = new ProfessionalRepository(prisma);
      const professional = await repo.findByUserId(id);

      if (!professional) {
        logger.warn("Professional not found", {
          correlationId,
          professionalId: id,
        });
        return apiError("Professional not found", HttpStatus.NOT_FOUND);
      }

      const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3500";

      // Calculate average rating
      const avgRating =
        professional.reviews && professional.reviews.length > 0
          ? professional.reviews.reduce((sum, r) => sum + r.rating, 0) /
            professional.reviews.length
          : undefined;

      // Format location
      const locationParts = [];
      if (professional.city) locationParts.push(professional.city);
      if (professional.county && professional.county !== professional.city) {
        locationParts.push(professional.county);
      }
      if (professional.country) locationParts.push(professional.country);
      const location =
        locationParts.length > 0 ? locationParts.join(", ") : undefined;

      // Get main image
      const mainImage =
        professional.images?.find((img) => img.isMain) ||
        professional.images?.[0];
      const profileImage =
        mainImage?.url || professional.user.avatar || undefined;

      // Get services as array of names (for backwards compatibility)
      const servicesOffered = professional.services?.map((s) => s.name) || [];

      // Transform to detailed response
      const professionalData = {
        id: professional.userId,
        name:
          `${professional.user.firstName || ""} ${professional.user.lastName || ""}`.trim() ||
          professional.companyName,
        companyName: professional.companyName,
        profession: professional.profession,
        bio: professional.bio,
        // Services
        services: professional.services,
        servicesOffered, // Backwards compatibility
        // Experience
        yearsExperience: professional.yearsExperience,
        licenseNumber: professional.licenseNumber,
        // Verification
        verified: professional.verified,
        status: professional.status,
        earbNumber: professional.earbNumber,
        // Rating
        rating: avgRating ? Math.round(avgRating * 10) / 10 : undefined,
        reviewCount: professional._count?.reviews || 0,
        projectCount: professional._count?.projects || 0,
        storeCount: professional._count?.stores || 0,
        propertyCount: professional._count?.properties || 0,
        // Location
        city: professional.city,
        county: professional.county,
        country: professional.country,
        location,
        // Contact
        user: {
          id: professional.user.id,
          firstName: professional.user.firstName,
          lastName: professional.user.lastName,
          email: professional.user.email,
          phone: professional.user.phone,
          avatar: professional.user.avatar,
        },
        // Media
        profileImage,
        images: professional.images,
        portfolioUrl: professional.portfolioUrl,
        website: professional.website,
        // Portfolio
        portfolios: professional.portfolios?.map((p) => ({
          id: p.id,
          title: p.title,
          images: p.images,
        })),
        // Reviews (limited for initial load)
        reviews: professional.reviews?.slice(0, 5).map((r) => ({
          rating: r.rating,
          reviewer: r.reviewer
            ? `${r.reviewer.firstName || ""} ${r.reviewer.lastName || ""}`.trim()
            : "Anonymous",
          reviewerAvatar: r.reviewer?.avatar,
        })),
        // Certificates
        certificates: professional.certificates?.map((cert) => ({
          id: cert.id,
          name: cert.name,
          issuer: cert.issuer,
          issueDate: cert.issueDate,
          expiryDate: cert.expiryDate,
          verificationStatus: cert.verificationStatus,
          verifiedAt: cert.verifiedAt,
        })),
        // Documents (only show verified ones publicly)
        documents: professional.documents
          ?.filter((d) => d.isVerified)
          .map((d) => ({
            id: d.id,
            type: d.type,
            verifiedAt: d.verifiedAt,
          })),
        // Timestamps
        createdAt: professional.createdAt,
        updatedAt: professional.updatedAt,
        // URLs
        profileUrl: `${baseUrl}/professionals/${professional.userId}`,
      };

      logger.info("Professional details fetched successfully", {
        correlationId,
        professionalId: id,
      });

      return professionalData;
    },
    {
      operationName: "get_professional_detail",
      successStatus: HttpStatus.OK,
      cache: {
        ttl: 30000, // 30s cache for professional profiles
        staleWhileRevalidate: 10000,
      },
    }
  );
}
