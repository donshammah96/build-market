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
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { STORE_CONFIG } from "@/app/lib/config/store.config";
import {
  storesService,
  createStoreDocumentSchema,
} from "@/app/lib/domains/stores";

const logger = getClientLogger();
const AUDIT_ACTION_PROFILE_UPDATED = "PROFILE_UPDATED";

/*
 ** GET /api/stores/[id]/documents
 *
 * /param {string} id - The ID of the store
 * /returns {Promise<StoreDocument[]>} - The list of store documents
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid store ID", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();

    const result = await resilientExecutor.execute(
      async () =>
        storesService.listStoreDocuments(id, {
          userId: dbUserId,
          role: "professional",
        }),
      { operationName: "get_store_documents" },
    );

    if (result.success && result.data?.ok) {
      return apiSuccess(result.data.data, HttpStatus.OK, correlationId);
    }

    const domainError =
      result.success && result.data && !result.data.ok ? result.data : null;

    logger.error("Failed to fetch store documents", result.error, {
      correlationId,
      storeId: id,
    });

    if (domainError) {
      return apiError(
        domainError.message || "Failed to fetch store documents",
        domainError.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiError(
      "Failed to fetch store documents",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  },
);

/*
 ** POST /api/stores/[id]/documents
 *
 * Creates a new store document linked to an Asset.
 *
 * /param {string} id - The ID of the store
 * /body {Object} - { type, assetId, notes? }
 */
export const POST = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid store ID", HttpStatus.BAD_REQUEST);
    }

    // Rate Limit (Write)
    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const bodyError = checkBodySize(req, STORE_CONFIG.MAX_BODY_SIZE);
    if (bodyError) return bodyError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = createStoreDocumentSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        validation.error.message,
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
        correlationId,
      );
    }

    const { type, assetId, notes } = validation.data;

    const resilientExecutor = getResilientExecutor();

    const result = await resilientExecutor.execute(
      async () => {
        const domainResult = await storesService.addStoreDocument(
          id,
          { userId: dbUserId, role: "professional" },
          {
            type,
            assetId,
            notes,
          },
        );

        if (!domainResult.ok) {
          return domainResult;
        }

        const newDoc = domainResult.data as { id: string };
        ComplianceService.logAdminAction(
          dbUserId,
          AUDIT_ACTION_PROFILE_UPDATED,
          "StoreDocument",
          newDoc.id,
          { storeId: id, type, assetId },
        ).catch((err) => logger.error("Failed to create audit log", err));
        return { ok: true as const, data: newDoc };
      },
      { operationName: "create_store_document" },
    );

    if (result.success && result.data?.ok) {
      return apiSuccess(result.data.data, HttpStatus.CREATED, correlationId);
    }

    logger.error("Failed to create store document", result.error, {
      correlationId,
      storeId: id,
    });

    if (result.success && result.data && !result.data.ok) {
      return apiError(
        result.data.message || "Failed to create store document",
        result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiError(
      "Failed to create store document",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  },
);
