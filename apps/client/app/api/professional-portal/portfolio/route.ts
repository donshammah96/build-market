import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const createPortfolioSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  projectType: z.string(),
  images: z.array(z.string().url()).min(1),
  clientTestimonial: z.string().optional(),
});

export const GET = withAuth(async (req: NextRequest, { clerkId, dbUserId }) => {
  try {
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `portfolio:${identifier}`,
      RateLimits.AUTH.limit,
      RateLimits.AUTH.window
    );

    if (!rateLimitResult.success) {
      return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    
    // dbUserId is already available in context
    const userId = dbUserId;

    const portfolioItems = await prisma.portfolio.findMany({
      where: {
        professionalId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return apiSuccess(portfolioItems);
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    return apiError("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});

export const POST = withAuth(async (req: NextRequest, { clerkId, dbUserId }) => {
  try {
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `portfolio:${identifier}`,
      RateLimits.AUTH.limit,
      RateLimits.AUTH.window
    );

    if (!rateLimitResult.success) {
      return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    
    // dbUserId is already available in context
    const userId = dbUserId;

    const body = await req.json();
    const validation = createPortfolioSchema.safeParse(body);

    if (!validation.success) {
      return apiError("Invalid input", HttpStatus.BAD_REQUEST, validation.error.issues);
    }

    const { title, description, projectType, images, clientTestimonial } = validation.data;

    const portfolioItem = await prisma.portfolio.create({
      data: {
        professionalId: userId,
        title,
        description,
        projectType,
        images,
        clientTestimonial,
      },
    });

    return apiSuccess(portfolioItem);
  } catch (error) {
    console.error("Error creating portfolio item:", error);
    return apiError("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});
