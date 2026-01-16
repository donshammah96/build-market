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
  RateLimits,
  getRateLimitIdentifier,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

const createLeadSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  projectType: z.string().min(1, "Project type is required"),
  location: z.string().optional(),
  budget: z.string().optional(),
  followUpDate: z.string().optional(),
  status: z
    .enum(["NEW", "CONTACTED", "PROPOSAL", "WON", "LOST"])
    .default("NEW"),
  notes: z.string().optional(),
  source: z.string().optional(), // Where the lead came from (e.g., "website", "referral", "social")
});

/**
 * GET /api/professional-portal/leads
 * Get all leads for the authenticated professional
 * Supports pagination via ?page=&limit= and filtering via ?status=
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
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;
  const statusParam = searchParams.get("status");

  // Map status parameter(s) to LeadStatus enum values
  // Supports comma-separated values (e.g., "new,contacted") or single value
  let statusFilter:
    | "NEW"
    | "CONTACTED"
    | "PROPOSAL"
    | "WON"
    | "LOST"
    | { in: ("NEW" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST")[] }
    | undefined;

  if (statusParam) {
    const statusMap: Record<
      string,
      "NEW" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST"
    > = {
      new: "NEW",
      contacted: "CONTACTED",
      proposal: "PROPOSAL",
      won: "WON",
      lost: "LOST",
    };

    // Handle comma-separated values
    const statusValues: ("NEW" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST")[] =
      statusParam
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .map((s) => statusMap[s])
        .filter(
          (s): s is "NEW" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST" =>
            s !== undefined
        );

    if (statusValues.length === 1) {
      statusFilter = statusValues[0];
    } else if (statusValues.length > 1) {
      statusFilter = { in: statusValues };
    }
  }

  logger.info("Fetching leads", {
    correlationId,
    userId: dbUserId,
    page,
    limit,
    statusFilter,
  });

  return executeResilient(
    async () => {
      const whereClause = {
        professionalId: dbUserId,
        ...(statusFilter && { status: statusFilter }),
      };

      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where: whereClause,
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.lead.count({ where: whereClause }),
      ]);

      logger.info("Leads fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: leads.length,
      });

      return {
        data: leads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
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
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = createLeadSchema.safeParse(body);

  if (!validation.success) {
    logger.warn("Lead creation validation failed", {
      correlationId,
      userId: dbUserId,
      errors: validation.error.issues,
    });
    return apiError(
      "Invalid input data",
      HttpStatus.BAD_REQUEST,
      validation.error.issues
    );
  }

  const { data } = validation;

  logger.info("Creating lead", {
    correlationId,
    userId: dbUserId,
    projectType: data.projectType,
  });

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
          followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
          status: data.status,
          notes: data.notes || null,
          source: data.source || null,
        },
      });

      logger.info("Lead created successfully", {
        correlationId,
        userId: dbUserId,
        leadId: lead.id,
      });
      return lead;
    },
    {
      operationName: "create_lead",
      successStatus: HttpStatus.CREATED,
    }
  );
});
