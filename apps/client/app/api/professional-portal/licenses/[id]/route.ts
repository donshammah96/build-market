import { NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
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
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { UpdateLicenseSchema } from "@/app/lib/validation/documents-validation";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import {
  getProfessionalLicenseById,
  updateProfessionalLicense,
  deleteProfessionalLicense,
} from "@/lib/services/licenses";

const logger = getClientLogger();

type LicenseParams = { id: string };

/**
 * GET /api/professional-portal/licenses/[id]
 * Get a specific license by ID (owner only).
 */
export const GET = withAuth<LicenseParams>(
  async (req: NextRequest, { dbUserId }, params) => {
    initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid license ID", HttpStatus.BAD_REQUEST);
    }
    const licenseId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `prof-licenses-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () => getProfessionalLicenseById(dbUserId, licenseId),
      { operationName: "get_professional_license_detail" },
    );

    if (!result.success) {
      return apiError(
        "Failed to fetch license",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data) {
      return apiError(
        "Failed to fetch license",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (data.success === false) {
      if (data.error === "not_found")
        return apiError("License not found", HttpStatus.NOT_FOUND);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/licenses/[id]
 * Update a license (owner only).
 * Resets verification status when the asset is replaced.
 */
export const PATCH = withAuth<LicenseParams>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid license ID", HttpStatus.BAD_REQUEST);
    }
    const licenseId = params.id;

    const sizeError = checkBodySize(req, DOCUMENT_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateLicenseSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const updateData = validation.data;

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        licenseId,
        ...updateData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "professional_license",
      dbUserId,
      "PATCH",
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
      return apiError("Request is being processed", HttpStatus.CONFLICT);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `prof-licenses-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Updating professional license", {
      correlationId,
      licenseId,
      fields: Object.keys(updateData),
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () => updateProfessionalLicense(dbUserId, licenseId, updateData),
      { operationName: "update_professional_license" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to update license",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if ("error" in data) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "not_found")
        return apiError("License not found", HttpStatus.NOT_FOUND);
      if (data.error === "forbidden")
        return apiError("Forbidden", HttpStatus.FORBIDDEN);
      if (data.error === "asset_not_found")
        return apiError("Asset not found", HttpStatus.NOT_FOUND);
      return apiError("Unauthorized access to asset", HttpStatus.FORBIDDEN);
    }

    await IdempotencyService.complete(idempotencyKey, data.data);
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/licenses/[id]
 * Delete a license (owner only). Hard delete since no deletedAt column.
 */
export const DELETE = withAuth<LicenseParams>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid license ID", HttpStatus.BAD_REQUEST);
    }
    const licenseId = params.id;

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "DELETE", { licenseId });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "professional_license",
      dbUserId,
      "DELETE",
    );
    if (idempotencyCheck?.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck?.status === "pending") {
      return apiError("Request already in progress", HttpStatus.CONFLICT);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `prof-licenses-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Deleting professional license", {
      correlationId,
      licenseId,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () => deleteProfessionalLicense(dbUserId, licenseId),
      { operationName: "delete_professional_license" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to delete license",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if ("error" in data) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "not_found")
        return apiError("License not found", HttpStatus.NOT_FOUND);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    const {
      message,
      licenseId: deletedId,
      authority,
      licenseNumber,
    } = data.data;
    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.DATA_RECTIFIED,
      "ProfessionalLicense",
      licenseId,
      { authority, licenseNumber, action: "DELETE" },
    ).catch((err) => logger.error("Failed to log deletion", err));

    const response = { message, licenseId: deletedId };
    await IdempotencyService.complete(idempotencyKey, response);
    return apiSuccess(response, HttpStatus.OK);
  },
);
