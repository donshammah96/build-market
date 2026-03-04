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
  UpdateIdeaBookSchema,
  AddAttachmentSchema,
  IDEA_BOOK_CONFIG,
} from "@/app/lib/validation/idea-books-validation";
import {
  getIdeaBookById,
  updateIdeaBook,
  deleteIdeaBook,
  addAttachment,
} from "@/lib/services/idea-books";

const logger = getClientLogger();

type IdeaBookParams = { id: string };

/**
 * GET /api/idea-books/[id]
 * Get a specific idea book with all attachments and collaborators.
 */
export const GET = withAuth<IdeaBookParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid idea book ID", HttpStatus.BAD_REQUEST);
    }
    const bookId = params.id;

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
      () => getIdeaBookById(dbUserId, bookId),
      { operationName: "get_idea_book" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to fetch idea book",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data as
      | { data: unknown }
      | { error: "not_found" | "forbidden" };
    if ("error" in serviceResult) {
      if (serviceResult.error === "not_found") {
        return apiError("Idea book not found", HttpStatus.NOT_FOUND);
      }
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/idea-books/[id]
 * Update idea book title, description, category, or privacy.
 */
export const PATCH = withAuth<IdeaBookParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid idea book ID", HttpStatus.BAD_REQUEST);
    }
    const bookId = params.id;

    const sizeError = checkBodySize(req, IDEA_BOOK_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateIdeaBookSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const data = validation.data;
    if (!data.title && !data.description && !data.category && !data.privacy) {
      return apiError("No fields to update", HttpStatus.BAD_REQUEST);
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
      () => updateIdeaBook(dbUserId, bookId, data),
      { operationName: "update_idea_book" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to update idea book", result.error, {
        correlationId,
        bookId,
      });
      return apiError(
        "Failed to update idea book",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data as
      | { data: unknown }
      | { error: "not_found" | "forbidden" };
    if ("error" in serviceResult) {
      if (serviceResult.error === "not_found") {
        return apiError("Idea book not found", HttpStatus.NOT_FOUND);
      }
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/idea-books/[id]
 * Delete an idea book (cascades to attachments, saved items, collaborators).
 */
export const DELETE = withAuth<IdeaBookParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid idea book ID", HttpStatus.BAD_REQUEST);
    }
    const bookId = params.id;

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
      () => deleteIdeaBook(dbUserId, bookId),
      { operationName: "delete_idea_book" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to delete idea book", result.error, {
        correlationId,
        bookId,
      });
      return apiError(
        "Failed to delete idea book",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data as
      | { data: unknown }
      | { error: "not_found" | "forbidden" };
    if ("error" in serviceResult) {
      if (serviceResult.error === "not_found") {
        return apiError("Idea book not found", HttpStatus.NOT_FOUND);
      }
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);

/**
 * POST /api/idea-books/[id]
 * Add an attachment to an idea book.
 * Supports Asset-based (assetId) or legacy file fields (fileUrl + fileKey).
 */
export const POST = withAuth<IdeaBookParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid idea book ID", HttpStatus.BAD_REQUEST);
    }
    const bookId = params.id;

    const sizeError = checkBodySize(req, IDEA_BOOK_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = AddAttachmentSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const data = validation.data;

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
      () => addAttachment(dbUserId, bookId, data),
      { operationName: "add_idea_book_attachment" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to add attachment", result.error, {
        correlationId,
        bookId,
      });
      return apiError(
        "Failed to add attachment",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data as
      | { data: unknown }
      | { error: "not_found" | "forbidden" | "asset_not_found" };
    if ("error" in serviceResult) {
      if (serviceResult.error === "not_found") {
        return apiError("Idea book not found", HttpStatus.NOT_FOUND);
      }
      if (serviceResult.error === "forbidden") {
        return apiError("Forbidden", HttpStatus.FORBIDDEN);
      }
      return apiError("Asset not found", HttpStatus.BAD_REQUEST);
    }

    return apiSuccess(serviceResult.data, HttpStatus.CREATED);
  },
);
