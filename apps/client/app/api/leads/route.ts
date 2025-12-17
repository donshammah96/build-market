import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/db";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";
import { createNotification } from "@/lib/notifications";

const logger = getClientLogger();

const createPublicLeadSchema = z.object({
  professionalId: z.string().min(1, "Professional ID is required"),
  clientName: z.string().min(1, "Name is required"),
  clientEmail: z.string().email("Invalid email address"),
  clientPhone: z.string().optional(),
  projectType: z.string().min(1, "Project type is required"),
  message: z.string().min(1, "Message is required"),
  location: z.string().optional(),
  budget: z.string().optional(),
});

/**
 * POST /api/leads
 * Public endpoint for clients to submit inquiries to professionals
 * No authentication required - this is a public contact form
 */
export async function POST(req: NextRequest) {
  const correlationId = initializeCorrelationId(req);
  
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = createPublicLeadSchema.safeParse(body);

  if (!validation.success) {
    logger.warn('Lead validation failed', { correlationId, errors: validation.error.issues });
    return apiError("Invalid input data", HttpStatus.BAD_REQUEST, validation.error.issues);
  }

  const { data } = validation;

  logger.info('Creating public lead inquiry', { correlationId, professionalId: data.professionalId, projectType: data.projectType });

  return executeResilient(
    async () => {
      // Verify professional exists
      const professional = await prisma.professionalProfile.findUnique({
        where: { userId: data.professionalId },
        select: { userId: true, companyName: true },
      });

      if (!professional) {
        logger.warn('Professional not found for lead', { correlationId, professionalId: data.professionalId });
        return apiError("Professional not found", HttpStatus.NOT_FOUND);
      }

      const lead = await prisma.lead.create({
        data: {
          professional: {
            connect: { userId: data.professionalId },
          },
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          clientPhone: data.clientPhone || null,
          projectType: data.projectType,
          location: data.location || null,
          budget: data.budget || null,
          status: "NEW",
          notes: data.message,
        },
      });

      // Trigger notification to professional
      await createNotification({
        userId: data.professionalId,
        title: "New Lead Received",
        message: `You have a new inquiry from ${data.clientName} for ${data.projectType}.`,
        type: "info",
        link: "/professional-portal/leads",
      });

      logger.info('Lead created successfully', { correlationId, leadId: lead.id, professionalId: data.professionalId });

      return { message: "Inquiry sent successfully", leadId: lead.id };
    },
    {
      operationName: "create_public_lead",
      successStatus: HttpStatus.CREATED,
    }
  );
}
