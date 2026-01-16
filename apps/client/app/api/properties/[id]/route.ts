import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import { PropertyRepository } from "@/app/lib/repositories/property.repository";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";
import { env } from "@/app/lib/env";

const logger = getClientLogger();

/**
 * GET /api/properties/[id]
 * Get detailed information about a specific property (public endpoint)
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
    `property-detail:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  // Validate ID format (UUID format check)
  if (!id || id.length < 10) {
    logger.warn("Invalid property ID format", { correlationId, id });
    return apiError("Invalid property ID", HttpStatus.BAD_REQUEST);
  }

  logger.info("Fetching property details", { correlationId, propertyId: id });

  return executeResilient(
    async () => {
      const repo = new PropertyRepository(prisma);
      const property = await repo.findById(id);

      if (!property) {
        logger.warn("Property not found", { correlationId, propertyId: id });
        return apiError("Property not found", HttpStatus.NOT_FOUND);
      }

      const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3500";

      // Format agent name
      const agentName = property.agent?.user
        ? `${property.agent.user.firstName || ""} ${property.agent.user.lastName || ""}`.trim() ||
          property.agent.companyName
        : property.agent?.companyName || "Unknown";

      // Transform images to include all relevant fields
      const transformedImages =
        property.images?.map((img) => ({
          id: img.id,
          url: img.url,
          caption: img.caption,
          isMain: img.isMain,
          sortOrder: img.sortOrder,
        })) || [];

      // Transform to PropertyDetailData
      const propertyData = {
        id: property.id,
        title: property.title,
        description: property.description,
        price: Number(property.price),
        currency: property.currency,
        type: property.type,
        category: property.category,
        status: property.status,
        // Location fields
        county: property.county,
        constituency: property.constituency,
        neighbourhood: property.neighbourhood,
        location: property.location,
        address: property.address,
        coordinates:
          property.latitude && property.longitude
            ? { lat: property.latitude, lng: property.longitude }
            : null,
        // Property details
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        areaSqFt: property.areaSqFt,
        lotSize: property.lotSize,
        // Media
        images: transformedImages,
        floorPlan: property.floorPlan,
        videoUrl: property.videoUrl,
        // Verification
        verificationStatus: property.verificationStatus,
        lrNumber: property.lrNumber,
        // Attachments (for verified properties)
        attachments: property.attachments?.map((att) => ({
          id: att.id,
          type: att.type,
          fileUrl: att.fileUrl,
          isVerified: att.isVerified,
          notes: att.notes,
        })),
        // Additional details
        features: property.features,
        featured: property.featured,
        agent: {
          userId: property.agent.userId,
          companyName: property.agent.companyName,
          name: agentName,
          verified: property.agent.verified,
          bio: property.agent.bio,
          city: property.agent.city,
          county: property.agent.county,
          earbNumber: property.agent.earbNumber,
          user: {
            id: property.agent.user.id,
            firstName: property.agent.user.firstName,
            lastName: property.agent.user.lastName,
            email: property.agent.user.email,
            phone: property.agent.user.phone,
            avatar: property.agent.user.avatar,
          },
          profileUrl: `${baseUrl}/professionals/${property.agent.userId}`,
        },
        createdAt: property.createdAt,
        updatedAt: property.updatedAt,
        propertyUrl: `${baseUrl}/properties/${property.id}`,
      };

      // Get similar properties
      const similarProperties = await repo.findSimilar(id, 4);
      const similarData = similarProperties.map((p) => {
        // Get main image from images relation
        const mainImage = p.images?.[0];
        const imageUrl = mainImage?.url || "/placeholder-property.jpg";

        return {
          id: p.id,
          title: p.title,
          price: Number(p.price),
          currency: p.currency,
          location: p.location,
          county: p.county,
          type: p.type,
          category: p.category,
          status: p.status,
          beds: p.bedrooms || undefined,
          baths: p.bathrooms || undefined,
          area: p.areaSqFt || undefined,
          image: imageUrl,
          featured: p.featured,
          agent: p.agent
            ? {
                name:
                  `${p.agent.user?.firstName || ""} ${p.agent.user?.lastName || ""}`.trim() ||
                  p.agent.companyName,
                image: p.agent.user?.avatar || undefined,
              }
            : undefined,
        };
      });

      logger.info("Property details fetched successfully", {
        correlationId,
        propertyId: id,
      });

      return {
        property: propertyData,
        similarProperties: similarData,
      };
    },
    {
      operationName: "get_property_detail",
      successStatus: HttpStatus.OK,
      cache: {
        ttl: 30000, // 30s cache
        staleWhileRevalidate: 10000,
      },
    }
  );
}
