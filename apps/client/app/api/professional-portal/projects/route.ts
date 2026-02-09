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
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

type ProjectStatus = "planning" | "in_progress" | "completed" | "archived";

// Validation schema for creating a project
const createProjectSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  clientId: z.string().uuid(),
  budget: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z
    .enum(["planning", "in_progress", "completed", "archived"])
    .optional(),
});

/**
 * GET /api/professional-portal/projects
 * Get all projects for the authenticated professional
 * Supports pagination via ?page=&limit= and filtering via ?status=
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `projects:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  // Parse query params
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;
  const statusParam = searchParams.get("status");

  // Map "active" to planning and in_progress statuses
  let statusFilter: ProjectStatus | { in: ProjectStatus[] } | undefined;
  if (statusParam === "active") {
    statusFilter = { in: ["planning", "in_progress"] };
  } else if (
    statusParam &&
    ["planning", "in_progress", "completed", "archived"].includes(statusParam)
  ) {
    statusFilter = statusParam as ProjectStatus;
  }

  logger.info("Fetching projects", {
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

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where: whereClause,
          include: {
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            _count: {
              select: {
                milestones: true,
                quotes: true,
              },
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.project.count({ where: whereClause }),
      ]);

      logger.info("Projects fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: projects.length,
      });

      return {
        data: projects,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
    {
      operationName: "get_professional_projects",
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * POST /api/professional-portal/projects
 * Create a new project
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `project:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  const body = await req.json();
  const validation = createProjectSchema.safeParse(body);

  if (!validation.success) {
    logger.warn("Project creation validation failed", {
      correlationId,
      userId: dbUserId,
      errors: validation.error.issues,
    });
    return apiError(
      "Validation failed",
      HttpStatus.BAD_REQUEST,
      validation.error.issues
    );
  }

  const { title, description, clientId, budget, startDate, endDate, status } =
    validation.data;

  logger.info("Creating project", {
    correlationId,
    userId: dbUserId,
    title,
    clientId,
  });

  return executeResilient(
    async () => {
      const project = await prisma.project.create({
        data: {
          professionalId: dbUserId,
          clientId,
          title,
          description,
          budget,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          status: status as ProjectStatus | undefined,
        },
      });

      logger.info("Project created successfully", {
        correlationId,
        userId: dbUserId,
        projectId: project.id,
      });
      return project;
    },
    {
      operationName: "create_professional_project",
      successStatus: HttpStatus.CREATED,
    }
  );
});
