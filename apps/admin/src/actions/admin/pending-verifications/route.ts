import { NextRequest } from "next/server";
import { z } from "zod";
import { AdminRole } from "@build/db";
import { type AuthContext, withAdminRole } from "@/lib/api/api-middleware";
import { HttpStatus } from "@/lib/api/api-response";
import {
  apiError,
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

const PendingVerificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entityType: z
    .enum(["all", "professional", "store", "property", "license"])
    .default("all"),
  status: z
    .enum([
      "UNVERIFIED",
      "PENDING",
      "IN_REVIEW",
      "VERIFIED",
      "REJECTED",
      "NEEDS_CORRECTION",
      "EXPIRED",
      "SUSPENDED",
    ])
    .default("PENDING"),
  sortBy: z.enum(["submittedAt", "createdAt"]).default("submittedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const GET = withAdminRole([
  AdminRole.SUPER_ADMIN,
  AdminRole.CONTENT_MODERATOR,
])(async (req: NextRequest, context: AuthContext) => {
  const correlationId = initializeCorrelationId(req);
  const { searchParams } = new URL(req.url);
  const queryParams = Object.fromEntries(searchParams.entries());

  const parsed = PendingVerificationsQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      parsed.error.flatten(),
    );
  }

  const { page, limit, entityType, status, sortBy, sortOrder } = parsed.data;

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
      if (!context.adminRole) {
        throw new Error("Unauthorized: Admin role missing");
      }

      const result = await verificationService.listVerificationQueue(
        {
          clerkId: context.clerkId,
          dbUserId: context.dbUserId,
          adminRole: context.adminRole,
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
