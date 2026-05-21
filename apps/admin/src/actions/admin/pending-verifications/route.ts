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
import type {
  VerificationQueueEntityType,
  VerificationQueueSortBy,
  VerificationQueueSortOrder,
  VerificationQueueStatus,
} from "@/lib/domains/verification";

const logger = getClientLogger();

export const GET = withAdminRole([
  AdminRole.SUPER_ADMIN,
  AdminRole.CONTENT_MODERATOR,
])(async (req: NextRequest, context: AuthContext) => {
  const correlationId = initializeCorrelationId(req);
  const { searchParams } = new URL(req.url);

  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "20");
  const entityType = searchParams.get("entityType") ?? "all";
  const status = searchParams.get("status") ?? "PENDING";
  const sortBy = searchParams.get("sortBy") ?? "submittedAt";
  const sortOrder = searchParams.get("sortOrder") ?? "desc";

  logger.info("Pending verifications requested", {
    correlationId,
    adminId: context.dbUserId,
    entityType,
    status,
    page,
    limit,
  });

  return executeResilient(
    async () => {
      const result = await verificationService.listVerificationQueue(
        {
          clerkId: context.clerkId,
          dbUserId: context.dbUserId,
          adminRole: context.adminRole ?? AdminRole.SUPER_ADMIN,
        },
        {
          entityType: entityType as VerificationQueueEntityType,
          status: status as VerificationQueueStatus,
          page,
          limit,
          sortBy: sortBy as VerificationQueueSortBy,
          sortOrder: sortOrder as VerificationQueueSortOrder,
        },
      );

      if (!result.ok) {
        throw new Error(result.message);
      }

      return {
        success: true,
        data: {
          data: result.data.items.map((item) => ({
            ...item,
            submittedAt: item.submittedAt?.toISOString() ?? null,
            createdAt: item.createdAt.toISOString(),
          })),
          pagination: result.data.pagination,
          filters: result.data.filters,
        },
      };
    },
    {
      operationName: "admin_pending_verifications",
      criticality: "normal",
      timeout: 10_000,
      retry: { maxAttempts: 2 },
      errorStatus: HttpStatus.BAD_REQUEST,
    },
  );
});
