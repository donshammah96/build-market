import { NextRequest } from "next/server";
import { AdminRole } from "@build/db";
import { type AuthContext, withAdminRole } from "@/lib/api/api-middleware";
import { HttpStatus } from "@/lib/api/api-response";
import {
  apiError,
  executeResilient,
  getClientLogger,
  initializeCorrelationId,
} from "@/lib/api/resilient-api";
import {
  verificationService,
  type VerificationEntityType,
} from "@/lib/domains/verification";

const logger = getClientLogger();

export const GET = withAdminRole([
  AdminRole.SUPER_ADMIN,
  AdminRole.CONTENT_MODERATOR,
])(async (req: NextRequest, context: AuthContext, params?: unknown) => {
  const correlationId = initializeCorrelationId(req);
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const routeParams = params as { id?: string } | undefined;
  const entityId = routeParams?.id;

  if (
    !entityId ||
    !entityType ||
    !["professional", "store", "property"].includes(entityType)
  ) {
    return apiError(
      "A valid entity type and entity id are required",
      HttpStatus.BAD_REQUEST,
    );
  }

  logger.info("Verification details requested", {
    correlationId,
    adminId: context.dbUserId,
    entityType,
    entityId,
  });

  return executeResilient(
    async () => {
      const result = await verificationService.getVerificationDetails(
        {
          clerkId: context.clerkId,
          dbUserId: context.dbUserId,
          adminRole: context.adminRole ?? AdminRole.SUPER_ADMIN,
        },
        {
          entityType: entityType as VerificationEntityType,
          entityId,
        },
      );

      if (!result.ok) {
        throw new Error(result.message);
      }

      return {
        success: true,
        data: result.data,
      };
    },
    {
      operationName: "admin_verification_details",
      criticality: "normal",
      timeout: 10_000,
      retry: { maxAttempts: 2 },
      errorStatus: HttpStatus.BAD_REQUEST,
    },
  );
});
