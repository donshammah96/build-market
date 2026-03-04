import { NextRequest, NextResponse } from "next/server";
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
import { checkBodySize, isValidId } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { UpdateInquirySchema } from "@/app/lib/validation/inquiries-validation";
import {
  getProfessionalInquiryById,
  updateProfessionalInquiry,
  deleteProfessionalInquiry,
} from "@/lib/services/inquiries";

const logger = getClientLogger();
const MAX_BODY_SIZE = 1024 * 1024; // 1MB

type InquiryParams = { id: string };

// Union narrowing: use `data.success === false` + explicit else for success path.
// See API-TO-FRONTEND-ARCHITECTURE.md Step 7.

/**
 * GET /api/professional-portal/inquiries/[id]
 */
export const GET = withAuth<InquiryParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);
    const inquiryId = params?.id;

    if (!inquiryId || !isValidId(inquiryId)) {
      return apiError("Invalid inquiry ID format", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `inquiry-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => getProfessionalInquiryById(dbUserId, inquiryId),
      { operationName: "get_property_inquiry" },
    );

    if (!result.success) {
      return apiError(
        "Failed to fetch inquiry",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data) {
      return apiError(
        "Failed to fetch inquiry",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (data.success === false) {
      if (data.error === "not_found")
        return apiError("Inquiry not found", HttpStatus.NOT_FOUND);
      return apiError("Unauthorized", HttpStatus.FORBIDDEN);
    }
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/inquiries/[id]
 */
export const PATCH = withAuth<InquiryParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const inquiryId = params?.id;

    if (!inquiryId || !isValidId(inquiryId)) {
      return apiError("Invalid inquiry ID format", HttpStatus.BAD_REQUEST);
    }

    const sizeError = checkBodySize(req, MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateInquirySchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const updateData = validation.data;
    if (Object.keys(updateData).length === 0) {
      return apiError("No fields to update", HttpStatus.BAD_REQUEST);
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        domain: "property_inquiry",
        inquiryId,
        ...updateData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "property_inquiry",
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
      `inquiry-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Updating property inquiry", {
      correlationId,
      inquiryId,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => updateProfessionalInquiry(dbUserId, inquiryId, updateData),
      { operationName: "update_property_inquiry" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to update inquiry",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (data.success === false) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "not_found")
        return apiError("Inquiry not found", HttpStatus.NOT_FOUND);
      return apiError("Unauthorized", HttpStatus.FORBIDDEN);
    }
    await IdempotencyService.complete(idempotencyKey, data.data);
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/inquiries/[id]
 */
export const DELETE = withAuth<InquiryParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const inquiryId = params?.id;

    if (!inquiryId || !isValidId(inquiryId)) {
      return apiError("Invalid inquiry ID format", HttpStatus.BAD_REQUEST);
    }

    let body: unknown = null;
    try {
      body = await req.json().catch(() => null);
    } catch {
      // ignore
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "DELETE", {
        inquiryId,
        ...(body && typeof body === "object" ? body : {}),
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "property_inquiry",
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
      `inquiry-delete:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Deleting property inquiry", {
      correlationId,
      inquiryId,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => deleteProfessionalInquiry(dbUserId, inquiryId),
      { operationName: "delete_property_inquiry" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to delete inquiry",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (data.success === false) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "not_found")
        return apiError("Inquiry not found", HttpStatus.NOT_FOUND);
      return apiError("Unauthorized", HttpStatus.FORBIDDEN);
    }

    await IdempotencyService.complete(idempotencyKey, {
      message: "Inquiry deleted successfully",
    });
    return apiSuccess(
      { message: "Inquiry deleted successfully" },
      HttpStatus.OK,
    );
  },
);
