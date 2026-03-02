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
import { UpdateCertificateSchema } from "@/app/lib/validation/certificate-validation";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import {
  getCertificateById,
  updateCertificate,
  deleteCertificate,
} from "@/lib/services/certificates";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/certificates/[id]
 * Get a specific certificate by ID.
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid certificate ID format", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `certificate-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () => getCertificateById(dbUserId, id),
      { operationName: "get_certificate" },
    );

    if (!result.success) {
      logger.error("Failed to fetch certificate", result.error, {
        certificateId: id,
      });
      return apiError(
        "Failed to fetch certificate",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data) {
      return apiError("Certificate not found", HttpStatus.NOT_FOUND);
    }
    if (data.success === false) {
      if (data.error === "not_found")
        return apiError("Certificate not found", HttpStatus.NOT_FOUND);
      return apiError("Unauthorized", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/certificates/[id]
 * Update a specific certificate.
 */
export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid certificate ID format", HttpStatus.BAD_REQUEST);
    }

    const sizeError = checkBodySize(req, DOCUMENT_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateCertificateSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const updateData = validation.data;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        domain: "certificate",
        certificateId: id,
        ...updateData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "certificate",
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
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `certificate-write:${identifier}`,
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

    logger.info("Updating certificate", {
      correlationId,
      certificateId: id,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () => updateCertificate(dbUserId, id, updateData),
      { operationName: "update_certificate" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to update certificate",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if ("error" in data) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "not_found")
        return apiError("Certificate not found", HttpStatus.NOT_FOUND);
      if (data.error === "forbidden")
        return apiError("Unauthorized", HttpStatus.FORBIDDEN);
      if (data.error === "asset_not_found")
        return apiError("Asset not found", HttpStatus.NOT_FOUND);
      return apiError("Unauthorized access to asset", HttpStatus.FORBIDDEN);
    }

    await IdempotencyService.complete(idempotencyKey, data.data);
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/certificates/[id]
 * Soft-delete a specific certificate.
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid certificate ID format", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `certificate-delete:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logger.info("Deleting certificate", {
      correlationId,
      certificateId: id,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () => deleteCertificate(dbUserId, id),
      { operationName: "delete_certificate" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to delete certificate",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if ("error" in data) {
      if (data.error === "not_found")
        return apiError("Certificate not found", HttpStatus.NOT_FOUND);
      return apiError("Unauthorized", HttpStatus.FORBIDDEN);
    }

    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.PROFILE_UPDATED,
      "ProfessionalDocument",
      id,
      { category: data.data.category, action: "DELETE_CERTIFICATE" },
    ).catch((err) => logger.error("Failed to create audit log", err));

    return apiSuccess(
      { message: "Certificate deleted successfully" },
      HttpStatus.OK,
    );
  },
);
