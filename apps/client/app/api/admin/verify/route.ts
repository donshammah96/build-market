/**
 * POST /api/admin/verify
 * Unified verification endpoint for professionals, stores, and properties
 * Requires admin role
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { withRole } from "@/app/lib/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  RateLimits,
  getRateLimitIdentifier,
} from "@/app/lib/rate-limit";
import { verifyProfessional } from "@/lib/services/verification/professional-verification.service";
import { verifyStore } from "@/lib/services/verification/store-verification.service";
import { verifyProperty } from "@/lib/services/verification/property-verification.service";
import { notifyVerificationResult } from "@/lib/services/verification/notification.service";
import { VerificationRequest } from "@/lib/services/verification/types";

const logger = getClientLogger();

// Validation schema
const verificationSchema = z.object({
  entityType: z.enum(["professional", "store", "property"]),
  entityId: z.string().uuid("Invalid entity ID format"),
  action: z.enum(["VERIFY", "REJECT", "REQUEST_CORRECTION"]),
  notes: z.string().optional(),
  reason: z.string().optional(),
});

/**
 * POST handler for unified verification
 */
export const POST = withRole(["admin"])(
  async (req: NextRequest, { dbUserId }) => {
    const correlationId = initializeCorrelationId(req);

    // Rate limiting - stricter for admin actions
    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      20, // 20 verifications per minute
      60 * 1000 // 1 minute window
    );

    if (!success) {
      return apiError(
        "Too many verification requests",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    logger.info("Admin verification request received", {
      correlationId,
      adminId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Parse and validate request body
        const body = await req.json();
        const validated = verificationSchema.parse(body);

        // Get IP and User Agent for audit
        const ipAddress =
          req.headers.get("x-forwarded-for") ||
          req.headers.get("x-real-ip") ||
          "unknown";
        const userAgent = req.headers.get("user-agent") || "unknown";

        const verificationRequest: VerificationRequest = {
          ...validated,
          adminId: dbUserId,
          ipAddress,
          userAgent,
        };

        // Route to appropriate verification service
        let result;
        let recipientUserId: string;

        switch (validated.entityType) {
          case "professional":
            result = await verifyProfessional(verificationRequest);
            recipientUserId = validated.entityId; // Professional userId
            break;

          case "store":
            result = await verifyStore(verificationRequest);
            // Get store owner's userId
            const store = await import("@repo/db").then((m) =>
              m.prisma.store.findUnique({
                where: { id: validated.entityId },
                select: { professionalId: true },
              })
            );
            recipientUserId = store!.professionalId;
            break;

          case "property":
            result = await verifyProperty(verificationRequest);
            // Get property agent's userId
            const property = await import("@repo/db").then((m) =>
              m.prisma.property.findUnique({
                where: { id: validated.entityId },
                select: { agentId: true },
              })
            );
            recipientUserId = property!.agentId;
            break;

          default:
            throw new Error("Invalid entity type");
        }

        // Send notification to the professional/store owner/agent
        await notifyVerificationResult(result, recipientUserId);

        logger.info("Verification completed successfully", {
          correlationId,
          adminId: dbUserId,
          entityType: validated.entityType,
          entityId: validated.entityId,
          action: validated.action,
          newStatus: result.newStatus,
        });

        return {
          success: true,
          data: result,
          message: result.message,
        };
      },
      {
        operationName: "admin_verify_entity",
        criticality: "critical",
        timeout: 15000, // 15 seconds
        retry: {
          maxAttempts: 2,
          initialDelayMs: 1000,
          maxDelayMs: 5000,
          backoffMultiplier: 2,
          jitterFactor: 0.1,
        },
      }
    );
  }
);
