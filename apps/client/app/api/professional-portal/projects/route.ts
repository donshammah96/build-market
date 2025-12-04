import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { error } from "console";

// Validation schema for creating a project
const createProjectSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  clientId: z.string().uuid(),
  budget: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["planning", "in_progress", "completed", "archived"]).optional(),
});

export const GET = withAuth(async (req: NextRequest, { clerkId, dbUserId }) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        professionalId: dbUserId,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return apiSuccess(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return apiError("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});

export const POST = withAuth(async (req: NextRequest, { clerkId, dbUserId }) => {
  try {
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project:${identifier}`,
      RateLimits.AUTH.limit,
      RateLimits.AUTH.window
    );

    if (!rateLimitResult.success) {
      return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    
    const body = await req.json();
    const validation = createProjectSchema.safeParse(body);

    if (!validation.success) {
      return apiError('Validation failed', HttpStatus.BAD_REQUEST, validation.error.issues);
    }

    const { title, description, clientId, budget, startDate, endDate, status } = validation.data;

    const project = await prisma.project.create({
      data: {
        professionalId: dbUserId,
        clientId,
        title,
        description,
        budget,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status: status as any,
      },
    });

    return apiSuccess(project);
  } catch (error) {
    console.error("Error creating project:", error);
    return apiError("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});   
