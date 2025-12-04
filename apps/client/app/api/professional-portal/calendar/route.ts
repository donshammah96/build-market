import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const createEventSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  location: z.string().optional(),
  type: z.string().default("meeting"),
  status: z.string().default("scheduled"),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

export const GET = withAuth(async (req: NextRequest, { clerkId, dbUserId }) => {
  try {
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `calendar:${identifier}`,
      RateLimits.AUTH.limit,
      RateLimits.AUTH.window
    );

    if (!rateLimitResult.success) {
      return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const where: any = {
      professionalId: dbUserId,
    };

    if (start && end) {
      where.startDate = {
        gte: new Date(start),
        lte: new Date(end),
      };
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        startDate: "asc",
      },
    });

    return apiSuccess(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    return apiError("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});

export const POST = withAuth(async (req: NextRequest, { clerkId, dbUserId }) => {
  try {
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `calendar:${identifier}`,
      RateLimits.AUTH.limit,
      RateLimits.AUTH.window
    );

    if (!rateLimitResult.success) {
      return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    
    const body = await req.json();
    const validation = createEventSchema.safeParse(body);

    if (!validation.success) {
      return apiError("Invalid input", HttpStatus.BAD_REQUEST, validation.error.issues);
    }

    const { title, description, startDate, endDate, location, type, status, clientId, projectId } = validation.data;

    const event = await prisma.calendarEvent.create({
      data: {
        professionalId: dbUserId,
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        type,
        status,
        clientId,
        projectId,
      },
    });

    return apiSuccess(event);
  } catch (error) {
    console.error("Error creating event:", error);
    return apiError("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});
