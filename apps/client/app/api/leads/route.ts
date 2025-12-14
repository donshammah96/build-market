
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/db";
import { apiSuccess, apiError, executeResilient } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";
import { createNotification } from "@/lib/notifications";

const createPublicLeadSchema = z.object({
  professionalId: z.string().min(1, "Professional ID is required"),
  clientName: z.string().min(1, "Name is required"),
  clientEmail: z.string().email("Invalid email address"),
  clientPhone: z.string().optional(),
  projectType: z.string().min(1, "Project type is required"),
  message: z.string().min(1, "Message is required"),
  location: z.string().optional(),
  budget: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", 429);
  }

  try {
    const body = await req.json();
    const validation = createPublicLeadSchema.safeParse(body);

    if (!validation.success) {
      return apiError("Invalid input data", 400, validation.error.issues);
    }

    const { data } = validation;

    return executeResilient(
      async () => {
        // Verify professional exists
        const professional = await prisma.professionalProfile.findUnique({
          where: { userId: data.professionalId },
        });

        if (!professional) {
          throw new Error("Professional not found");
        }

        const lead = await prisma.lead.create({
          data: {
            professional: {
              connect: { userId: data.professionalId },
            },
            clientName: data.clientName,
            clientEmail: data.clientEmail,
            clientPhone: data.clientPhone || null,
            projectType: data.projectType,
            location: data.location || null,
            budget: data.budget || null,
            status: "NEW",
            notes: data.message, // Map message to notes
          },
        });

        // Trigger notification
        await createNotification({
          userId: data.professionalId,
          title: "New Lead Received",
          message: `You have a new inquiry from ${data.clientName} for ${data.projectType}.`,
          type: "info",
          link: "/professional-portal/leads",
        });

        return { message: "Inquiry sent successfully" };
      },
      {
        operationName: "create_public_lead",
        successStatus: 201,
      }
    );
  } catch (error) {
    console.error("Error creating lead:", error);
    return apiError("Internal Server Error", 500);
  }
}
