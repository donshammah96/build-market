import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/db";
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

const updateLeadSchema = z.object({
  clientName: z.string().min(1).optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  projectType: z.string().min(1).optional(),
  location: z.string().optional(),
  budget: z.string().optional(),
  followUpDate: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "PROPOSAL", "WON", "LOST"]).optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

/**
 * GET /api/professional-portal/leads/[id]
 * Get a specific lead by ID
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

    logger.info("Fetching lead", {
      correlationId,
      leadId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const lead = await prisma.lead.findUnique({
          where: { id },
          include: { professional: true },
        });

        if (!lead || lead.professional.userId !== dbUserId) {
          logger.warn("Lead not found or unauthorized", {
            correlationId,
            leadId: id,
            userId: dbUserId,
          });
          return apiError("Lead not found", HttpStatus.NOT_FOUND);
        }

        logger.info("Lead fetched successfully", { correlationId, leadId: id });
        return lead;
      },
      {
        operationName: "get_lead",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * PATCH /api/professional-portal/leads/[id]
 * Update a specific lead
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
    const validation = updateLeadSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Lead update validation failed", {
        correlationId,
        leadId: id,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input data",
        HttpStatus.BAD_REQUEST,
        validation.error.issues
      );
    }

    const { data } = validation;

    logger.info("Updating lead", {
      correlationId,
      leadId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify ownership
        const existingLead = await prisma.lead.findUnique({
          where: { id },
          include: { professional: true },
        });

        if (!existingLead || existingLead.professional.userId !== dbUserId) {
          logger.warn("Lead not found or unauthorized for update", {
            correlationId,
            leadId: id,
            userId: dbUserId,
          });
          return apiError("Lead not found", HttpStatus.NOT_FOUND);
        }

        const updatedLead = await prisma.lead.update({
          where: { id },
          data: {
            ...data,
            clientEmail: data.clientEmail === "" ? null : data.clientEmail,
            followUpDate: data.followUpDate
              ? new Date(data.followUpDate)
              : undefined,
          },
        });

        logger.info("Lead updated successfully", { correlationId, leadId: id });
        return updatedLead;
      },
      {
        operationName: "update_lead",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * DELETE /api/professional-portal/leads/[id]
 * Delete a specific lead
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

    logger.info("Deleting lead", {
      correlationId,
      leadId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify ownership
        const existingLead = await prisma.lead.findUnique({
          where: { id },
          include: { professional: true },
        });

        if (!existingLead || existingLead.professional.userId !== dbUserId) {
          logger.warn("Lead not found or unauthorized for deletion", {
            correlationId,
            leadId: id,
            userId: dbUserId,
          });
          return apiError("Lead not found", HttpStatus.NOT_FOUND);
        }

        await prisma.lead.delete({
          where: { id },
        });

        logger.info("Lead deleted successfully", { correlationId, leadId: id });
        return { message: "Lead deleted successfully" };
      },
      {
        operationName: "delete_lead",
        successStatus: HttpStatus.OK,
      }
    );
  }
);
