import { NextRequest } from "next/server";
import { AdminRole } from "@build/db";
import { type AuthContext, withAdminRole } from "@/lib/api/api-middleware";
import { HttpStatus } from "@/lib/api/api-response";
import {
  executeResilient,
  getClientLogger,
  initializeCorrelationId,
} from "@/lib/api/resilient-api";
import { verificationService } from "@/lib/domains/verification";

const logger = getClientLogger();

export const GET = withAdminRole([
  AdminRole.SUPER_ADMIN,
  AdminRole.CONTENT_MODERATOR,
])(async (req: NextRequest, context: AuthContext) => {
  const correlationId = initializeCorrelationId(req);
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "all";

  logger.info("Verification stats requested", {
    correlationId,
    adminId: context.dbUserId,
    period,
  });

  return executeResilient(
    async () => {
      if (!context.adminRole) {
        throw new Error("Unauthorized: Admin role missing");
      }

      const result = await verificationService.getVerificationStats(
        {
          clerkId: context.clerkId,
          dbUserId: context.dbUserId,
          adminRole: context.adminRole,
        },
        period,
      );

      if (!result.ok) {
        throw new Error(result.message);
      }

      return {
        success: true,
        data: {
          ...result.data,
          recentActivity: [],
        },
      };
    },
    {
      operationName: "admin_verification_stats",
      criticality: "normal",
      timeout: 10_000,
      retry: { maxAttempts: 2 },
      errorStatus: HttpStatus.BAD_REQUEST,
    },
  );
});
