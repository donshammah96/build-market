import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import { Profession, PROFESSION_LABELS } from "../../../types/professional";
import { ProfessionalRepository } from "@/app/lib/repositories/professional.repository";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";
import { env } from "@/app/lib/env";
import {
  executeResilient,
  initializeCorrelationId,
  apiError,
  getClientLogger,
} from "@/app/lib/resilient-api";
import { getProfessionsForCategory } from "@/lib/constants/professionalCategories";

const logger = getClientLogger();

/**
 * GET /api/professionals
 * Get list of verified professionals with filtering, sorting, and resilience
 *
 * Query params:
 * - search: Search term for name, company, service
 * - category: Category slug (e.g., "architecture", "plumbing")
 * - sortBy: "rating" | "experience" | "reviews"
 * - includeUnverified: "true" to include unverified professionals (dev/admin only)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(request);

  // Rate limiting (critical operation - fail fast)
  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `professionals:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    logger.warn("Rate limit exceeded", { correlationId, identifier });
    return apiError("Too many requests. Please try again later.", 429);
  }

  const searchParams = request.nextUrl.searchParams;

  // Validate and sanitize inputs
  const search = searchParams.get("search")?.trim().slice(0, 100) || "";
  const categorySlug =
    searchParams.get("category")?.trim().toLowerCase() || "all";
  const profession =
    searchParams.get("profession")?.trim().toUpperCase() || undefined;
  const county = searchParams.get("county")?.trim() || undefined;
  const city = searchParams.get("city")?.trim().slice(0, 100) || undefined;
  const sortBy = (searchParams.get("sortBy") || "rating") as
    | "rating"
    | "experience"
    | "reviews";
  const includeUnverified = searchParams.get("includeUnverified") === "true";
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
  const offset = Number(searchParams.get("offset")) || 0;

  // Whitelist sortBy values
  const validSortOptions = ["rating", "experience", "reviews"];
  if (!validSortOptions.includes(sortBy)) {
    return apiError(
      "Invalid sort option. Must be one of: rating, experience, reviews",
      400
    );
  }

  // Convert category slug to profession values array
  const professions = getProfessionsForCategory(categorySlug);

  // Execute with resilience patterns
  return executeResilient(
    async () => {
      // Use repository to fetch professionals
      const repo = new ProfessionalRepository(prisma);
      const result = await repo.findMany({
        search,
        professions,
        profession,
        county,
        city,
        sortBy,
        verified: true,
        includeUnverified,
        limit,
        offset,
      });

      // Transform data to match ProfessionalCardData interface
      const baseUrl = env.NEXT_PUBLIC_APP_URL;

      const transformedData = result.professionals.map((prof) => {
        const avgRating =
          prof.reviews && prof.reviews.length > 0
            ? prof.reviews.reduce((sum: number, r) => sum + r.rating, 0) /
              prof.reviews.length
            : undefined;

        // Format location from city, county, country
        const locationParts = [];
        if (prof.city) locationParts.push(prof.city);
        if (prof.county && prof.county !== prof.city)
          locationParts.push(prof.county);
        if (prof.country) locationParts.push(prof.country);
        const location =
          locationParts.length > 0 ? locationParts.join(", ") : undefined;

        // Transform certificates
        const certificates =
          prof.certificates?.map((cert) => ({
            id: cert.id,
            name: cert.name,
            issuer: cert.issuer,
            issueDate: cert.issueDate ? cert.issueDate : undefined,
            expiryDate: cert.expiryDate ? cert.expiryDate : undefined,
            verificationStatus: cert.verificationStatus as
              | "pending"
              | "verified"
              | "rejected",
            verifiedAt: cert.verifiedAt ? cert.verifiedAt : undefined,
          })) || [];

        // Get main image from professional images
        const mainImage =
          prof.images?.find((img) => img.isMain) || prof.images?.[0];
        const profileImage = mainImage?.url || prof.user.avatar || undefined;

        // Get services as array of names
        const servicesOffered = prof.services?.map((s) => s.name) || [];

        // Get profession label (Prisma enum to human-readable)
        const professionKey = prof.profession as Profession;
        const professionLabel =
          PROFESSION_LABELS[professionKey] || prof.profession || "Professional";

        return {
          id: prof.userId,
          name:
            `${prof.user.firstName || ""} ${prof.user.lastName || ""}`.trim() ||
            prof.companyName,
          companyName: prof.companyName,
          profession: professionKey,
          professionLabel,
          title: servicesOffered[0] || professionLabel,
          bio: prof.bio || undefined,
          services: prof.services,
          servicesOffered, // For backwards compatibility
          yearsExperience: prof.yearsExperience || undefined,
          verified: prof.verified,
          status: prof.status,
          earbNumber: prof.earbNumber || undefined,
          rating: avgRating ? Math.round(avgRating * 10) / 10 : undefined,
          reviewCount: prof._count?.reviews || 0,
          projectCount: prof._count?.projects || 0,
          storeCount: prof._count?.stores || 0,
          propertyCount: prof._count?.properties || 0,
          profileImage,
          portfolioImage: prof.portfolios?.[0]?.images?.[0] || undefined,
          portfolioUrl: prof.portfolioUrl || undefined,
          profileUrl: `${baseUrl}/professionals/${prof.userId}`,
          city: prof.city || undefined,
          county: prof.county || undefined,
          country: prof.country || undefined,
          location: location,
          certificates: certificates.length > 0 ? certificates : undefined,
        };
      });

      // Sort by rating if requested (since we can't do this in DB easily)
      if (sortBy === "rating") {
        transformedData.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      }

      logger.info("Professionals fetched successfully", {
        correlationId,
        count: transformedData.length,
        total: result.total,
        filters: {
          search,
          professions,
          profession,
          county,
          city,
          sortBy,
          limit,
          offset,
        },
      });

      return {
        professionals: transformedData,
        total: result.total,
        hasMore: result.hasMore,
      };
    },
    {
      criticality: "normal",
      operationName: "fetch-professionals",
      cache: {
        ttl: 30000, // 30s cache
        staleWhileRevalidate: 15000, // Serve stale for 15s while revalidating
      },
      fallback: async () => {
        // Fallback to empty result with warning
        logger.warn("Using fallback for professionals list", { correlationId });
        return {
          professionals: [],
          total: 0,
          hasMore: false,
        };
      },
    }
  );
}
