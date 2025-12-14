
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { apiSuccess, apiError, executeResilient } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

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


export const GET = withAuth(async (req, context) => {
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", 429);
  }

  return executeResilient(
    async () => {
      const leads = await prisma.lead.findMany({
        where: {
          professional: {
            userId: context.dbUserId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      return leads;
    },
    {
      operationName: "get_leads",
      successStatus: 200,
    }
  );
});

export const POST = withAuth(async (req, context) => {
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", 429);
  }

  const body = await req.json();
  const validation = createLeadSchema.safeParse(body);

  if (!validation.success) {
    return apiError("Invalid input data", 400, validation.error.issues);
  }

  const { data } = validation;

  return executeResilient(
    async () => {
      const lead = await prisma.lead.create({
        data: {
          professional: {
            connect: {
              userId: context.dbUserId,
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
      return lead;
    },
    {
      operationName: "create_lead",
      successStatus: 201,
    }
  );
});

