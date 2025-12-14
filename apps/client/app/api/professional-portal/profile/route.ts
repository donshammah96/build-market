
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, apiSuccess, executeResilient } from '@/app/lib/resilient-api';
import { HttpStatus } from '@/app/lib/api-response';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().min(1, "Company name is required"),
  bio: z.string().optional(),
  location: z.string().optional(), // Maps to city/country logic if needed, simplify for now
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  portfolioUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  servicesOffered: z.array(z.string()),
});

export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  return executeResilient(
    async () => {
      const professional = await prisma.professionalProfile.findUnique({
        where: { userId: dbUserId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      if (!professional) {
        throw new Error("Professional profile not found");
      }

      return professional;
    },
    {
      operationName: "get_professional_profile",
      successStatus: HttpStatus.OK,
    }
  );
});

export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = updateProfileSchema.safeParse(body);

  if (!validation.success) {
    return apiError("Invalid input", HttpStatus.BAD_REQUEST, validation.error.issues);
  }

  const data = validation.data;

  return executeResilient(
    async () => {
      // Update User fields
      await prisma.user.update({
        where: { id: dbUserId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
        },
      });

      // Update ProfessionalProfile fields
      // Simple logic: if location provided, putting it in 'city' for now
      const professional = await prisma.professionalProfile.update({
        where: { userId: dbUserId },
        data: {
          companyName: data.companyName,
          bio: data.bio,
          city: data.location, 
          website: data.website || null,
          portfolioUrl: data.portfolioUrl || null,
          servicesOffered: data.servicesOffered,
        },
        include: {
            user: {
                select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                }
            }
        }
      });

      return professional;
    },
    {
      operationName: "update_professional_profile",
      successStatus: HttpStatus.OK,
    }
  );
});
