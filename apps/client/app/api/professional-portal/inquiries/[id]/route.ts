import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
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
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

const updateInquirySchema = z.object({
  status: z
    .enum(["NEW", "CONTACTED", "VIEWING_SCHEDULED", "OFFER_MADE", "CLOSED"])
    .optional(),
  notes: z.string().optional(),
  preferredViewingDate: z.string().datetime().nullable().optional(),
});

/**
 * GET /api/professional-portal/inquiries/[id]
 * Get a specific property inquiry by ID
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.READ.limit,
      RateLimits.READ.window
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Fetching property inquiry", {
      correlationId,
      inquiryId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const inquiry = await prisma.propertyInquiry.findUnique({
          where: { id },
          include: {
            property: {
              select: {
                id: true,
                title: true,
                price: true,
                currency: true,
                type: true,
                category: true,
                location: true,
                status: true,
                agentId: true,
              },
            },
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        });

        if (!inquiry) {
          logger.warn("Property inquiry not found", {
            correlationId,
            inquiryId: id,
            userId: dbUserId,
          });
          return apiError("Inquiry not found", HttpStatus.NOT_FOUND);
        }

        // Verify ownership - inquiry must belong to a property owned by this professional
        if (inquiry.property.agentId !== dbUserId) {
          logger.warn("Unauthorized access to property inquiry", {
            correlationId,
            inquiryId: id,
            userId: dbUserId,
            propertyAgentId: inquiry.property.agentId,
          });
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        logger.info("Property inquiry fetched successfully", {
          correlationId,
          inquiryId: id,
        });

        return inquiry;
      },
      {
        operationName: "get_property_inquiry",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * PATCH /api/professional-portal/inquiries/[id]
 * Update a specific property inquiry
 */
export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const body = await req.json();
    const validation = updateInquirySchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Property inquiry update validation failed", {
        correlationId,
        inquiryId: id,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues
      );
    }

    const data = validation.data;

    logger.info("Updating property inquiry", {
      correlationId,
      inquiryId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify ownership
        const existingInquiry = await prisma.propertyInquiry.findUnique({
          where: { id },
          include: {
            property: {
              select: {
                agentId: true,
              },
            },
          },
        });

        if (!existingInquiry) {
          logger.warn("Property inquiry not found for update", {
            correlationId,
            inquiryId: id,
            userId: dbUserId,
          });
          return apiError("Inquiry not found", HttpStatus.NOT_FOUND);
        }

        if (existingInquiry.property.agentId !== dbUserId) {
          logger.warn("Unauthorized update attempt on property inquiry", {
            correlationId,
            inquiryId: id,
            userId: dbUserId,
            propertyAgentId: existingInquiry.property.agentId,
          });
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        const updatedInquiry = await prisma.propertyInquiry.update({
          where: { id },
          data: {
            ...data,
            preferredViewingDate: data.preferredViewingDate
              ? new Date(data.preferredViewingDate)
              : undefined,
          },
        });

        logger.info("Property inquiry updated successfully", {
          correlationId,
          inquiryId: id,
        });

        return updatedInquiry;
      },
      {
        operationName: "update_property_inquiry",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * DELETE /api/professional-portal/inquiries/[id]
 * Delete a specific property inquiry
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Deleting property inquiry", {
      correlationId,
      inquiryId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify ownership
        const existingInquiry = await prisma.propertyInquiry.findUnique({
          where: { id },
          include: {
            property: {
              select: {
                agentId: true,
              },
            },
          },
        });

        if (!existingInquiry) {
          logger.warn("Property inquiry not found for deletion", {
            correlationId,
            inquiryId: id,
            userId: dbUserId,
          });
          return apiError("Inquiry not found", HttpStatus.NOT_FOUND);
        }

        if (existingInquiry.property.agentId !== dbUserId) {
          logger.warn("Unauthorized deletion attempt on property inquiry", {
            correlationId,
            inquiryId: id,
            userId: dbUserId,
            propertyAgentId: existingInquiry.property.agentId,
          });
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        await prisma.propertyInquiry.delete({
          where: { id },
        });

        logger.info("Property inquiry deleted successfully", {
          correlationId,
          inquiryId: id,
        });

        return { message: "Inquiry deleted successfully" };
      },
      {
        operationName: "delete_property_inquiry",
        successStatus: HttpStatus.OK,
      }
    );
  }
);
