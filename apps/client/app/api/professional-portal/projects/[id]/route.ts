import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const updateProjectSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  budget: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["planning", "in_progress", "completed", "archived"]).optional(),
});

export const GET = withAuth<{ id: string }>(async (req: NextRequest, { clerkId, dbUserId }, params) => {
  try {
    const { id } = params!;

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
      return apiError("Project not found", HttpStatus.NOT_FOUND);
    }

    return apiSuccess({ success: true, data: project });
  } catch (error) {
    console.error("Error fetching project:", error);
    return apiError("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});

export const PATCH = withAuth<{ id: string }>(async (req: NextRequest, { clerkId, dbUserId }, params) => {
  try {
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project_update:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!rateLimitResult.success) {
      return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const { id } = params!;
    const body = await req.json();
    const validation = updateProjectSchema.safeParse(body);

    if (!validation.success) {
      return apiError("Invalid input", HttpStatus.BAD_REQUEST, validation.error.issues);
    }

    const { title, description, budget, startDate, endDate, status } = validation.data;

    // Verify ownership
    const existingProject = await prisma.project.findUnique({
      where: {
        id: id as string,
        professionalId: dbUserId,
      },
    });

    if (!existingProject) {
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
        status: status as any,
      },
    });

    return apiSuccess({ success: true, data: updatedProject });
  } catch (error) {
    console.error("Error updating project:", error);
    return apiError("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});

export const DELETE = withAuth<{ id: string }>(async (req: NextRequest, { clerkId, dbUserId }, params) => {
  try {
    const { id } = params!;

    // Verify ownership
    const existingProject = await prisma.project.findUnique({
      where: {
        id: id as string,
        professionalId: dbUserId,
      },
    });

    if (!existingProject) {
      return apiError("Project not found", HttpStatus.NOT_FOUND);
    }

    await prisma.project.delete({
      where: {
        id: id as string,
      },
    });

    return apiSuccess({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return apiError("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});
