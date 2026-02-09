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

const updateProjectSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  budget: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z
    .enum(["planning", "in_progress", "completed", "archived"])
    .optional(),
});

export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window
    );

    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    logger.info("Fetching project", {
      correlationId,
      projectId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const project = await prisma.project.findUnique({
          where: {
            id: id as string,
            professionalId: dbUserId,
          },
          include: {
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
          },
        });

        if (!project) {
          logger.warn("Project not found", {
            correlationId,
            projectId: id,
            userId: dbUserId,
          });
          return apiError("Project not found", HttpStatus.NOT_FOUND);
        }

        logger.info("Project fetched successfully", {
          correlationId,
          projectId: id,
        });
        return project;
      },
      {
        operationName: "get_professional_project",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project_update:${identifier}`,
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
    const validation = updateProjectSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Project update validation failed", {
        correlationId,
        projectId: id,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues
      );
    }

    const { title, description, budget, startDate, endDate, status } =
      validation.data;

    logger.info("Updating project", {
      correlationId,
      projectId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const existingProject = await prisma.project.findUnique({
          where: {
            id: id as string,
            professionalId: dbUserId,
          },
        });

        if (!existingProject) {
          logger.warn("Project not found for update", {
            correlationId,
            projectId: id,
            userId: dbUserId,
          });
          return apiError("Project not found", HttpStatus.NOT_FOUND);
        }

        const updatedProject = await prisma.project.update({
          where: {
            id: id as string,
          },
          data: {
            title,
            description,
            budget,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            status: status as ProjectStatus | undefined,
          },
        });

        logger.info("Project updated successfully", {
          correlationId,
          projectId: id,
        });
        return updatedProject;
      },
      {
        operationName: "update_professional_project",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project_delete:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    logger.info("Deleting project", {
      correlationId,
      projectId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const existingProject = await prisma.project.findUnique({
          where: {
            id: id as string,
            professionalId: dbUserId,
          },
        });

        if (!existingProject) {
          logger.warn("Project not found for deletion", {
            correlationId,
            projectId: id,
            userId: dbUserId,
          });
          return apiError("Project not found", HttpStatus.NOT_FOUND);
        }

        await prisma.project.delete({
          where: {
            id: id as string,
          },
        });

        logger.info("Project deleted successfully", {
          correlationId,
          projectId: id,
        });
        return { message: "Project deleted successfully" };
      },
      {
        operationName: "delete_professional_project",
        successStatus: HttpStatus.OK,
      }
    );
  }
);
