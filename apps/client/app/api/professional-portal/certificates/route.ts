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
  CertificateQuerySchema,
  CreateCertificateSchema,
} from "@/app/lib/validation/certificate-validation";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { AuditAction } from "@prisma/client";
import { withAuth } from "@/app/lib/api/api-middleware";
import {
  getCertificates,
  createCertificate,
} from "@/lib/services/certificates";

const logger = getClientLogger();

function parseCertificateQuery(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return {
    category: searchParams.get("category") || undefined,
    status: searchParams.get("status") || undefined,
  };
}

/**
 * GET /api/professional-portal/certificates
 * List certificates for the authenticated professional.
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "certificates-read",
  querySchema: CertificateQuerySchema,
  parseQuery: parseCertificateQuery,
  handler: async ({ dbUserId, query }) => getCertificates(dbUserId, query),
  operationName: "get_certificates",
  errorMessage: "Failed to fetch certificates",
});

/**
 * POST /api/professional-portal/certificates
 * Create a new certificate.
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

  const validation = CreateCertificateSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  const certData = validation.data;

  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(dbUserId, "POST", {
      domain: "certificate",
      ...certData,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "certificate",
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
    `certificates-write:${identifier}`,
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

  logger.info("Creating certificate", {
    correlationId,
    userId: dbUserId,
    category: certData.category,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () =>
      createCertificate(dbUserId, certData, {
        ipAddress,
        userAgent,
      }),
    { operationName: "create_certificate" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Failed to create certificate",
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

  ComplianceService.logAdminAction(
    dbUserId,
    AuditAction.PROFILE_UPDATED,
    "ProfessionalDocument",
    (data.data as { id: string }).id,
    { category: certData.category, action: "CREATE_CERTIFICATE" },
  ).catch((err) => logger.error("Failed to create audit log", err));

  await IdempotencyService.complete(idempotencyKey, data.data);
  return apiSuccess(data.data, HttpStatus.CREATED);
});
