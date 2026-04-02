/**
 * GET /api/admin/verification-details/[id]
 * Get detailed information for verification review
 * Requires admin role
 */

import { NextRequest } from "next/server";
import { AuthContext, withAdminRole } from "@/lib/api/api-middleware";
import { AdminRole } from "@build/db";
import { apiError, HttpStatus } from "@/lib/api/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/lib/api/resilient-api";
import {
  checkRateLimit,
  RateLimits,
  getRateLimitIdentifier,
} from "@/lib/api/rate-limit";
import { getProfessionalVerificationDetails } from "@/lib/services/verification/professional-verification.service";
import { getStoreVerificationDetails } from "@/lib/services/verification/store-verification.service";
import { getPropertyVerificationDetails } from "@/lib/services/verification/property-verification.service";
import { getAuditHistory } from "@/lib/services/verification/audit-service";

const logger = getClientLogger();

/**
 * GET handler for verification details
 * Query params:
 * - entityType: professional | store | property (required)
 */
export const GET = withAdminRole([
  AdminRole.SUPER_ADMIN,
])(async (req: NextRequest, context: AuthContext, params: unknown) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const { id } = params as { id: string };
  const entityType = req.nextUrl.searchParams.get("entityType");

  if (
    !entityType ||
    !["professional", "store", "property"].includes(entityType)
  ) {
    return apiError(
      "Invalid or missing entityType parameter",
      HttpStatus.BAD_REQUEST,
    );
  }

  logger.info("Fetching verification details", {
    correlationId,
    adminId: context.dbUserId,
    entityType,
    entityId: id,
  });

  return executeResilient(
    async () => {
      let details;
      let auditEntityType: string;

      switch (entityType) {
        case "professional":
          details = await getProfessionalVerificationDetails(id);
          auditEntityType = "ProfessionalProfile";
          break;

        case "store":
          details = await getStoreVerificationDetails(id);
          auditEntityType = "Store";
          break;

        case "property":
          details = await getPropertyVerificationDetails(id);
          auditEntityType = "Property";
          break;

        default:
          throw new Error("Invalid entity type");
      }

      if (!details) {
        return apiError(
          `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Fetch audit history
      const auditHistory = await getAuditHistory(auditEntityType, id, 20);

      logger.info("Verification details fetched successfully", {
        correlationId,
        adminId: context.dbUserId,
        entityType,
        entityId: id,
      });

      return {
        data: {
          ...details,
          auditHistory,
        },
      };
    },
    {
      operationName: "get_verification_details",
      successStatus: HttpStatus.OK,
    },
  );
});
