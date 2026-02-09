import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  RateLimits,
  getRateLimitIdentifier,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

const querySchema = z.object({
  limit: z.string().regex(/^\d+$/).optional().default("10"),
  status: z
    .enum(["all", "active", "pending", "sold"])
    .optional()
    .default("active"),
});

/**
 * GET /api/properties/my-listings
 * Get property listings owned by the authenticated user
 * Returns property data formatted for dashboard widget
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  // Parse query params
  const { searchParams } = new URL(req.url);
  const queryParams = {
    limit: searchParams.get("limit") || "10",
    status: searchParams.get("status") || "active",
  };

  const queryValidation = querySchema.safeParse(queryParams);
  if (!queryValidation.success) {
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues
    );
  }

  const { limit, status } = queryValidation.data;
  const limitNum = Math.min(parseInt(limit), 50);

  logger.info("Fetching user property listings", {
    correlationId,
    userId: dbUserId,
    limit: limitNum,
    status,
  });

  return executeResilient(
    async () => {
      // Build status filter
      const whereClause: {
        agentId: string;
        status?:
          | "AVAILABLE"
          | "SOLD"
          | "RENTED"
          | "UNDER_OFFER"
          | { in: ("AVAILABLE" | "UNDER_OFFER")[] };
      } = {
        agentId: dbUserId,
      };

      if (status !== "all") {
        if (status === "active") {
          whereClause.status = { in: ["AVAILABLE", "UNDER_OFFER"] };
        } else if (status === "pending") {
          whereClause.status = "UNDER_OFFER";
        } else {
          whereClause.status = "SOLD";
        }
      }

      // Get properties with images and verification status
      const properties = await prisma.property.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          price: true,
          location: true,
          type: true,
          status: true,
          verificationStatus: true,
          rejectionReason: true,
          images: {
            select: { url: true },
            take: 1,
            orderBy: { sortOrder: "asc" },
          },
          _count: {
            select: { inquiries: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limitNum,
      });

      // Format for dashboard widget
      const formattedProperties = properties.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        location: p.location || "Unknown",
        type: p.type,
        status: p.status.toLowerCase() as
          | "active"
          | "pending"
          | "sold"
          | "rented",
        verificationStatus: p.verificationStatus,
        rejectionReason: p.rejectionReason,
        views: 0, // Would need analytics
        inquiries: p._count.inquiries,
        images: p.images.map((img: { url: string }) => img.url),
      }));

      logger.info("User property listings fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: formattedProperties.length,
      });

      return { data: formattedProperties };
    },
    {
      operationName: "get_my_listings",
      successStatus: HttpStatus.OK,
    }
  );
});
