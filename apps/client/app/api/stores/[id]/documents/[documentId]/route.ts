import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { isValidId } from "@/app/lib/api/api-guards";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { storesService } from "@/app/lib/domains/stores";

const logger = getClientLogger();
const AUDIT_ACTION_DATA_RECTIFIED = "DATA_RECTIFIED";

export const DELETE = withAuth<{ id: string; documentId: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id, documentId } = params!;

    if (!isValidId(id) || !isValidId(documentId)) {
      return apiError("Invalid IDs provided", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const domainResult = await storesService.removeStoreDocument(
          id,
          documentId,
          { userId: dbUserId, role: "professional" },
        );

        if (!domainResult.ok) {
          return domainResult;
        }

        ComplianceService.logAdminAction(
          dbUserId,
          AUDIT_ACTION_DATA_RECTIFIED,
          "StoreDocument",
          documentId,
          { storeId: id, action: "DELETE" },
        ).catch((err) => logger.error("Failed to log deletion", err));

        return domainResult;
      },
      { operationName: "delete_store_document" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to delete document",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      return apiError(
        result.data.message || "Failed to delete document",
        result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiSuccess(
      { message: "Document deleted successfully" },
      HttpStatus.OK,
      correlationId,
    );
  },
);
