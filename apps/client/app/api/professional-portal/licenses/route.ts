import { NextRequest } from "next/server";
import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import { withAuth } from "@/app/lib/api/api-middleware";
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
import { CreateLicenseSchema } from "@/app/lib/validation/documents-validation";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { AuditAction } from "@prisma/client";
import {
  getProfessionalLicenses,
  createProfessionalLicense,
} from "@/lib/services/licenses";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/licenses
 * List all licenses for the authenticated professional.
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "prof-licenses-read",
  handler: async ({ dbUserId }) => getProfessionalLicenses(dbUserId),
  operationName: "get_professional_licenses",
  errorMessage: "Failed to fetch licenses",
});

/**
 * POST /api/professional-portal/licenses
 * Create a new license.
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

  const validation = CreateLicenseSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  const licenseData = validation.data;

  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(dbUserId, "POST", {
      domain: "professional_license",
      authority: licenseData.authority,
      licenseNumber: licenseData.licenseNumber,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "professional_license",
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
    `prof-licenses-write:${identifier}`,
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

  logger.info("Creating professional license", {
    correlationId,
    userId: dbUserId,
    authority: licenseData.authority,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () =>
      createProfessionalLicense(dbUserId, licenseData, {
        ipAddress,
        userAgent,
      }),
    { operationName: "create_professional_license" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Failed to create license",
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
    if (data.error === "limit_exceeded")
      return apiError(
        `Maximum ${DOCUMENT_CONFIG.MAX_LICENSES_PER_PROFESSIONAL} licenses per professional`,
        HttpStatus.BAD_REQUEST,
      );
    return apiError(
      "A license with this authority and number already exists",
      HttpStatus.CONFLICT,
    );
  }

  ComplianceService.logAdminAction(
    dbUserId,
    AuditAction.PROFILE_UPDATED,
    "ProfessionalLicense",
    (data.data as { id: string }).id,
    { authority: licenseData.authority, action: "CREATE" },
  ).catch((err) => logger.error("Failed to create audit log", err));

  await IdempotencyService.complete(idempotencyKey, data.data);
  return apiSuccess(data.data, HttpStatus.CREATED);
});
