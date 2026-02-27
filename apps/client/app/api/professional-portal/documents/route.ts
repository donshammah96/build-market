import { NextRequest } from "next/server";
import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  DocumentQuerySchema,
  CreateDocumentSchema,
} from "@/app/lib/validation/documents-validation";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { AuditAction } from "@prisma/client";
import { withAuth } from "@/app/lib/api/api-middleware";
import {
  getProfessionalDocuments,
  createProfessionalDocument,
} from "@/lib/services/documents";

const logger = getClientLogger();

const SENSITIVE_CATEGORIES = [
  "ID_OR_PASSPORT",
  "TAX_COMPLIANCE",
  "KRA_TAX_COMPLIANCE",
  "INSURANCE_POLICY",
] as const;

function parseDocumentQuery(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return {
    category: searchParams.get("category") || undefined,
    status: searchParams.get("status") || undefined,
  };
}

/**
 * GET /api/professional-portal/documents
 * List all documents for the authenticated professional.
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "prof-docs-read",
  querySchema: DocumentQuerySchema,
  parseQuery: parseDocumentQuery,
  handler: async ({ dbUserId, query }) =>
    getProfessionalDocuments(dbUserId, query),
  operationName: "get_professional_documents",
  errorMessage: "Failed to fetch documents",
});

/**
 * POST /api/professional-portal/documents
 * Create a new document linked to a pre-uploaded Asset.
 * Sets professional verificationStatus to PENDING on submission.
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
  const { ipAddress, userAgent } = getRequestMetadata(req);

  const sizeError = checkBodySize(req, DOCUMENT_CONFIG.MAX_BODY_SIZE);
  if (sizeError) return sizeError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  const validation = CreateDocumentSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  const docData = validation.data;

  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(dbUserId, "POST", {
      domain: "professional_document",
      ...docData,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "professional_document",
    dbUserId,
    "POST",
  );
  if (!idempotencyCheck) {
    return apiError(
      "Failed to process idempotency key",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
  if (idempotencyCheck.status === "completed") {
    return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
  }
  if (idempotencyCheck.status === "pending") {
    return apiError(
      "Request is being processed. Please wait.",
      HttpStatus.CONFLICT,
    );
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `prof-docs-write:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );
  if (!rateLimitResult.success) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  logger.info("Creating professional document", {
    correlationId,
    userId: dbUserId,
    category: docData.category,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () =>
      createProfessionalDocument(dbUserId, docData, {
        ipAddress,
        userAgent,
      }),
    { operationName: "create_professional_document" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Failed to create document",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const data = result.data;
  if ("error" in data) {
    await IdempotencyService.fail(idempotencyKey);
    if (data.error === "asset_not_found")
      return apiError("Asset not found", HttpStatus.NOT_FOUND);
    if (data.error === "asset_forbidden")
      return apiError("Unauthorized access to asset", HttpStatus.FORBIDDEN);
    return apiError(
      `Maximum ${DOCUMENT_CONFIG.MAX_DOCUMENTS_PER_PROFESSIONAL} documents per professional`,
      HttpStatus.BAD_REQUEST,
    );
  }

  if (SENSITIVE_CATEGORIES.includes(docData.category as (typeof SENSITIVE_CATEGORIES)[number])) {
    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.PROFILE_UPDATED,
      "ProfessionalDocument",
      (data.data as { id: string }).id,
      { category: docData.category, action: "CREATE" },
    ).catch((err) => logger.error("Failed to create audit log", err));
  }

  await IdempotencyService.complete(idempotencyKey, data.data);
  return apiSuccess(data.data, HttpStatus.CREATED);
});
