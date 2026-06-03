import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, HttpStatus } from "@/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/lib/api/resilient-api";
import { AuthContext, withAdminRole } from "@/lib/api/api-middleware";
import { AdminRole } from "@build/db";
import { resolveAdminRouteActor } from "@/lib/security/route-auth";
import { professionalsService } from "@/lib/domains/professionals/service";
import { logAdminAction } from "../shared";
import type { AdminLogEvent } from "@/lib/infrastructure/logger";

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
 */
export const POST = withAdminRole([AdminRole.SUPER_ADMIN])(async (
  request: NextRequest,
  context: AuthContext,
) => {
  const correlationId = initializeCorrelationId(request);
  const requestStartedAt = Date.now();

  try {
    const authResult = await resolveAdminRouteActor(
      correlationId,
      "verify_professional",
      (fields) => logger.warn(String(fields.message), fields),
      requestStartedAt,
    );

    if (!authResult.authorized) {
      return authResult.response;
    }

    const { actor } = authResult;

    if (actor.adminRole !== AdminRole.SUPER_ADMIN) {
      return apiError(
        "Forbidden. Admin access required.",
        HttpStatus.FORBIDDEN,
      );
    }

    // Parse and validate request body
    const body = await request.json().catch(() => null);
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        parsed.error.issues,
      );
    }

    const { professionalId, verified } = parsed.data;

    // Update the professional profile using service boundary
    const result = verified
      ? await professionalsService.verifyProfessional(actor, professionalId)
      : await professionalsService.rejectProfessional(
          actor,
          professionalId,
          "Verification revoked by administrator",
        );

    if (!result.ok) {
      return apiError(result.message, HttpStatus.BAD_REQUEST);
    }

    const professional = result.data;

    // Record audit trail entry per ADR-ADMIN-008
    await logAdminAction({
      userId: actor.dbUserId,
      action: verified ? "VERIFY_PROFESSIONAL" : "REJECT_PROFESSIONAL",
      targetType: "professional",
      targetId: professionalId,
      details: {
        companyName: professional.companyName,
        verified,
      },
    }).catch(() => undefined);

    logger.info("Professional verification status updated", {
      correlationId,
      professionalId,
      verified,
      updatedBy: actor.dbUserId,
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
