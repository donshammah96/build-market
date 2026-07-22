/**
 * POST /api/admin/verify
 * Unified verification endpoint for professionals, stores, and properties.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { AdminRole } from "@build/db";
import { type AuthContext, withAdminRole } from "@/lib/api/api-middleware";
import { HttpStatus } from "@/lib/api/api-response";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/api/rate-limit";
import {
  apiError,
  apiSuccess,
  getClientLogger,
  initializeCorrelationId,
} from "@/lib/api/resilient-api";
import { verificationService } from "@/lib/domains/verification";

const logger = getClientLogger();
const VerifyEntitySchema = z
  .object({
    entityType: z.enum(["professional", "store", "property"]),
    entityId: z.string().uuid("Invalid entity ID format"),
    action: z.enum(["VERIFY", "REJECT", "REQUEST_CORRECTION"]),
    notes: z.string().optional(),
    reason: z.string().optional(),
  })
  .strict();

export const POST = withAdminRole([
  AdminRole.SUPER_ADMIN,
  AdminRole.CONTENT_MODERATOR,
])(async (req: NextRequest, context: AuthContext) => {
  const correlationId = initializeCorrelationId(req);
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, 20, 60 * 1000);

  if (!success) {
    return apiError(
      "Too many verification requests",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = VerifyEntitySchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid verification payload",
      HttpStatus.BAD_REQUEST,
      parsed.error.flatten(),
    );
  }

  logger.info("Admin verification request received", {
    correlationId,
    adminId: context.dbUserId,
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId,
    action: parsed.data.action,
  });

  try {
    if (!context.adminRole) {
      return apiError(
        "Unauthorized: Admin role missing",
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Audit log is created downstream in verificationService.verifyEntity.
    const result = await verificationService.verifyEntity(
      {
        clerkId: context.clerkId,
        dbUserId: context.dbUserId,
        adminRole: context.adminRole,
      },
      parsed.data,
      {
        ...(req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip")
          ? {
              ipAddress:
                req.headers.get("x-forwarded-for") ??
                req.headers.get("x-real-ip") ??
                undefined,
            }
          : {}),
        ...(req.headers.get("user-agent")
          ? { userAgent: req.headers.get("user-agent") ?? undefined }
          : {}),
      },
    );

    if (!result.ok) {
      return apiError(result.message, HttpStatus.BAD_REQUEST);
    }

    logger.info("Verification completed successfully", {
      correlationId,
      adminId: context.dbUserId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      action: parsed.data.action,
      newStatus: result.data.newStatus,
    });

    return apiSuccess({
      success: true,
      data: result.data,
      message: result.data.message,
    });
  } catch (error) {
    logger.error(
      "Verification failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        adminId: context.dbUserId,
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        action: parsed.data.action,
      },
    );

    return apiError(
      error instanceof Error ? error.message : "Verification failed",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
