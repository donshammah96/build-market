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
  type: z.enum(["all", "property", "service"]).optional().default("all"),
  status: z
    .enum([
      "all",
      "new",
      "contacted",
      "viewing_scheduled",
      "offer_made",
      "closed",
    ])
    .optional()
    .default("all"),
});

/**
 * GET /api/professional-portal/inquiries
 * Get property and service inquiries for the authenticated professional
 * Returns inquiry data formatted for dashboard widget
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
    type: searchParams.get("type") || "all",
    status: searchParams.get("status") || "all",
  };

  const queryValidation = querySchema.safeParse(queryParams);
  if (!queryValidation.success) {
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues
    );
  }

  const { limit, type, status } = queryValidation.data;
  const limitNum = Math.min(parseInt(limit), 50);

  logger.info("Fetching professional inquiries", {
    correlationId,
    userId: dbUserId,
    limit: limitNum,
    type,
    status,
  });

  return executeResilient(
    async () => {
      // Map status values to database format
      const statusMap: Record<string, "NEW" | "CONTACTED" | "VIEWING_SCHEDULED" | "OFFER_MADE" | "CLOSED"> = {
        new: "NEW",
        contacted: "CONTACTED",
        viewing_scheduled: "VIEWING_SCHEDULED",
        offer_made: "OFFER_MADE",
        closed: "CLOSED",
      };

      const statusFilter: "NEW" | "CONTACTED" | "VIEWING_SCHEDULED" | "OFFER_MADE" | "CLOSED" | undefined = 
        status === "all" ? undefined : statusMap[status];

      // Fetch property inquiries if type is 'all' or 'property'
      let propertyInquiries: Array<{
        id: string;
        propertyTitle: string;
        clientName: string;
        clientPhone: string;
        message: string;
        status: string;
        createdAt: Date;
      }> = [];

      if (type === "all" || type === "property") {
        const inquiries = await prisma.propertyInquiry.findMany({
          where: {
            property: { agentId: dbUserId },
            ...(statusFilter && { status: statusFilter as any }),
          },
          select: {
            id: true,
            clientName: true,
            clientEmail: true,
            clientPhone: true,
            message: true,
            status: true,
            createdAt: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            property: {
              select: {
                title: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limitNum,
        });

        propertyInquiries = inquiries.map((inq: {
          id: string;
          clientName: string;
          clientEmail: string | null;
          clientPhone: string | null;
          message: string | null;
          status: string;
          createdAt: Date;
          user: {
            firstName: string | null;
            lastName: string | null;
            phone: string | null;
          } | null;
          property: {
            title: string;
          };
        }) => ({
          id: inq.id,
          propertyTitle: inq.property.title,
          clientName: inq.user
            ? `${inq.user.firstName || ""} ${inq.user.lastName || ""}`.trim() ||
              inq.clientName
            : inq.clientName,
          clientPhone: inq.user?.phone || inq.clientPhone || "",
          message: inq.message || "",
          status: inq.status.toLowerCase(),
          createdAt: inq.createdAt,
        }));
      }

      // Format for dashboard widget
      const formattedInquiries = propertyInquiries.map((inq) => ({
        id: inq.id,
        propertyTitle: inq.propertyTitle,
        clientName: inq.clientName,
        clientPhone: inq.clientPhone,
        message: inq.message,
        status: inq.status as
          | "new"
          | "contacted"
          | "viewing_scheduled"
          | "offer_made"
          | "closed",
        createdAt: inq.createdAt.toISOString(),
      }));

      logger.info("Professional inquiries fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: formattedInquiries.length,
      });

      return { data: formattedInquiries };
    },
    {
      operationName: "get_professional_inquiries",
      successStatus: HttpStatus.OK,
    }
  );
});
