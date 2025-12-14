import { z } from "zod";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiSuccess, apiError, executeResilient } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

const updateLeadSchema = z.object({
  clientName: z.string().min(1).optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  projectType: z.string().min(1).optional(),
  location: z.string().optional(),
  budget: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "PROPOSAL", "WON", "LOST"]).optional(),
  notes: z.string().optional(),
});

export const PATCH = withAuth(async (req, context, params?: { id: string }) => {
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", 429);
  }

  if (!params?.id) {
    return apiError("Missing ID", 400);
  }

  const { id } = params;
  const body = await req.json();
  const validation = updateLeadSchema.safeParse(body);

  if (!validation.success) {
    return apiError("Invalid input data", 400, validation.error.issues);
  }

  const { data } = validation;

  return executeResilient(
    async () => {
      // Verify ownership
      const existingLead = await prisma.lead.findUnique({
        where: { id },
        include: { professional: true },
      });

      if (!existingLead || existingLead.professional.userId !== context.dbUserId) {
        throw new Error("Lead not found or unauthorized");
      }

      const updatedLead = await prisma.lead.update({
        where: { id },
        data: {
          ...data,
          clientEmail: data.clientEmail === "" ? null : data.clientEmail,
        },
      });
      return updatedLead;
    },
    {
      operationName: "update_lead",
      successStatus: 200,
      errorStatus: 500, // Default, but good to be explicit if needed
    }
  );
});

export const DELETE = withAuth(async (req, context, params?: { id: string }) => {
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", 429);
  }

  if (!params?.id) {
    return apiError("Missing ID", 400);
  }

  const { id } = params;

  return executeResilient(
    async () => {
      // Verify ownership
      const existingLead = await prisma.lead.findUnique({
        where: { id },
        include: { professional: true },
      });

      if (!existingLead || existingLead.professional.userId !== context.dbUserId) {
        throw new Error("Lead not found or unauthorized");
      }

      await prisma.lead.delete({
        where: { id },
      });
      
      return { message: "Lead deleted successfully" };
    },
    {
      operationName: "delete_lead",
      successStatus: 200,
    }
  );
});
