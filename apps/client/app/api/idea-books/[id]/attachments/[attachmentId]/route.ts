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
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import {
  UpdateAttachmentSchema,
  IDEA_BOOK_CONFIG,
} from "@/app/lib/validation/idea-books-validation";
import {
  getAttachmentById,
  updateAttachment,
  deleteAttachment,
} from "@/lib/services/idea-books";

const logger = getClientLogger();

type AttachmentParams = { id: string; attachmentId: string };

/**
 * GET /api/idea-books/[id]/attachments/[attachmentId]
 * Get a specific attachment with ownership verification.
 */
export const GET = withAuth<AttachmentParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.attachmentId ||
      !isValidId(params.attachmentId)
    ) {
      return apiError("Invalid ID parameter", HttpStatus.BAD_REQUEST);
    }
    const attachmentId = params.attachmentId;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `idea-books-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => getAttachmentById(dbUserId, attachmentId),
      { operationName: "get_idea_book_attachment" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to fetch attachment",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data as
      | { data: unknown }
      | { error: "not_found" | "forbidden" };
    if ("error" in serviceResult) {
      if (serviceResult.error === "not_found") {
        return apiError("Attachment not found", HttpStatus.NOT_FOUND);
      }
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/idea-books/[id]/attachments/[attachmentId]
 * Update attachment caption.
 */
export const PATCH = withAuth<AttachmentParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.attachmentId ||
      !isValidId(params.attachmentId)
    ) {
      return apiError("Invalid ID parameter", HttpStatus.BAD_REQUEST);
    }
    const attachmentId = params.attachmentId;

    const sizeError = checkBodySize(req, IDEA_BOOK_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateAttachmentSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `idea-books-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => updateAttachment(dbUserId, attachmentId, { caption: validation.data.caption }),
      { operationName: "update_idea_book_attachment" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to update attachment", result.error, {
        correlationId,
        attachmentId,
      });
      return apiError(
        "Failed to update attachment",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data as
      | { data: unknown }
      | { error: "not_found" | "forbidden" };
    if ("error" in serviceResult) {
      if (serviceResult.error === "not_found") {
        return apiError("Attachment not found", HttpStatus.NOT_FOUND);
      }
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/idea-books/[id]/attachments/[attachmentId]
 * Delete an attachment from an idea book.
 */
export const DELETE = withAuth<AttachmentParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.attachmentId ||
      !isValidId(params.attachmentId)
    ) {
      return apiError("Invalid ID parameter", HttpStatus.BAD_REQUEST);
    }
    const attachmentId = params.attachmentId;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `idea-books-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => deleteAttachment(dbUserId, attachmentId),
      { operationName: "delete_idea_book_attachment" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to delete attachment", result.error, {
        correlationId,
        attachmentId,
      });
      return apiError(
        "Failed to delete attachment",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data as
      | { data: unknown }
      | { error: "not_found" | "forbidden" };
    if ("error" in serviceResult) {
      if (serviceResult.error === "not_found") {
        return apiError("Attachment not found", HttpStatus.NOT_FOUND);
      }
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);
