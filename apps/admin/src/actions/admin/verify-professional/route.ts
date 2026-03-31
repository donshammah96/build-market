import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
import { apiError, apiSuccess, HttpStatus } from "@/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/lib/api/resilient-api";
import { AuthContext, withAdminRole } from "@/lib/api/api-middleware";
import { AdminRole } from "@build/db";

const logger = getClientLogger();

// Request body schema
const verifySchema = z.object({
  professionalId: z.string().min(10, "Invalid professional ID"),
  verified: z.boolean(),
});

/**
 * POST /api/admin/verify-professional
 * Admin endpoint to verify/unverify a professional profile
 *
 * Request body:
 * - professionalId: The user ID of the professional
 * - verified: true to verify, false to unverify
 *
 * IMPORTANT: In production, this endpoint should be protected with proper admin authentication.
 * For development purposes, it checks for an admin role in Clerk metadata.
 */
export const POST = withAdminRole([
  AdminRole.SYSTEM_ADMIN,
  AdminRole.SUPER_ADMIN,
])(async (request: NextRequest, context: AuthContext) => {
  const { dbUserId } = context;
  const correlationId = initializeCorrelationId(request);

  try {
    // Check if user is admin (in production, implement proper admin check)
    const user = await prisma.adminProfile.findUnique({
      where: { userId: dbUserId },
      select: { role: true, isActive: true },
    });

    if (
      !user ||
      (user.role !== AdminRole.SYSTEM_ADMIN &&
        user.role !== AdminRole.SUPER_ADMIN) ||
      !user.isActive
    ) {
      return apiError(
        "Forbidden. Admin access required.",
        HttpStatus.FORBIDDEN,
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { professionalId, verified } = verifySchema.parse(body);

    // Update the professional profile
    const professional = await prisma.professionalProfile.update({
      where: { userId: professionalId },
      data: { verified },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    logger.info("Professional verification status updated", {
      correlationId,
      professionalId,
      verified,
      updatedBy: dbUserId,
    });

    return apiSuccess({
      message: verified
        ? `Professional "${professional.companyName}" has been verified.`
        : `Professional "${professional.companyName}" has been unverified.`,
      professional: {
        userId: professional.userId,
        companyName: professional.companyName,
        verified: professional.verified,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        error.issues,
      );
    }

    logger.error(
      "Failed to update verification status",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId },
    );

    return apiError(
      "Failed to update verification status",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
