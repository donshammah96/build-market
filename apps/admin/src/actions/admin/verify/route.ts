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
  executeResilient,
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

  return executeResilient(
    async () => {
      const result = await verificationService.verifyEntity(
        {
          clerkId: context.clerkId,
          dbUserId: context.dbUserId,
          adminRole: context.adminRole ?? AdminRole.SUPER_ADMIN,
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
        throw new Error(result.message);
      }

      logger.info("Verification completed successfully", {
        correlationId,
        adminId: context.dbUserId,
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        action: parsed.data.action,
        newStatus: result.data.newStatus,
      });

      return {
        success: true,
        data: result.data,
        message: result.data.message,
      };
    },
    {
      operationName: "admin_verify_entity",
      criticality: "critical",
      timeout: 15_000,
      retry: {
        maxAttempts: 2,
        initialDelayMs: 1_000,
        maxDelayMs: 5_000,
        backoffMultiplier: 2,
        jitterFactor: 0.1,
      },
    },
  );
});
