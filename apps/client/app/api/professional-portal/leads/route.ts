import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

const logger = getClientLogger();

const createLeadSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  projectType: z.string().min(1, "Project type is required"),
  location: z.string().optional(),
  budget: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "PROPOSAL", "WON", "LOST"]).default("NEW"),
  notes: z.string().optional(),
});

/**
 * GET /api/professional-portal/leads
 * Get all leads for the authenticated professional
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching leads', { correlationId, userId: dbUserId });

  return executeResilient(
    async () => {
      const leads = await prisma.lead.findMany({
        where: {
          professional: {
            userId: dbUserId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      logger.info('Leads fetched successfully', { correlationId, userId: dbUserId, count: leads.length });
      return leads;
    },
    {
      operationName: "get_leads",
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * POST /api/professional-portal/leads
 * Create a new lead for the authenticated professional
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = createLeadSchema.safeParse(body);

  if (!validation.success) {
    logger.warn('Lead creation validation failed', { correlationId, userId: dbUserId, errors: validation.error.issues });
    return apiError("Invalid input data", HttpStatus.BAD_REQUEST, validation.error.issues);
  }

  const { data } = validation;

  logger.info('Creating lead', { correlationId, userId: dbUserId, projectType: data.projectType });

  return executeResilient(
    async () => {
      const lead = await prisma.lead.create({
        data: {
          professional: {
            connect: {
              userId: dbUserId,
            },
          },
          clientName: data.clientName,
          clientEmail: data.clientEmail || null,
          clientPhone: data.clientPhone || null,
          projectType: data.projectType,
          location: data.location || null,
          budget: data.budget || null,
          status: data.status,
          notes: data.notes || null,
        },
      });

      logger.info('Lead created successfully', { correlationId, userId: dbUserId, leadId: lead.id });
      return lead;
    },
    {
      operationName: "create_lead",
      successStatus: HttpStatus.CREATED,
    }
  );
});
