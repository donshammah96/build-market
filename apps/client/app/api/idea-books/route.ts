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
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  IdeaBookQuerySchema,
  CreateIdeaBookSchema,
  IDEA_BOOK_CONFIG,
} from "@/app/lib/validation/idea-books-validation";
import { ideaBooksService } from "@/app/lib/domains/idea-books";

const logger = getClientLogger();

function mapIdeaBooksError(error: {
  error: string;
  status?: number;
  message?: string;
}) {
  switch (error.error) {
    case "not_found":
      return apiError(
        error.message || "Idea book not found",
        HttpStatus.NOT_FOUND,
      );
    case "forbidden":
      return apiError(error.message || "Forbidden", HttpStatus.FORBIDDEN);
    case "asset_not_found":
      return apiError(
        error.message || "Asset not found",
        HttpStatus.BAD_REQUEST,
      );
    default:
      return apiError(
        error.message || "Idea book operation failed",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
  }
}

/**
 * GET /api/idea-books
 * List all idea books for the authenticated user.
 * Supports pagination, search, and category filtering.
 */
export const GET = withAuth(
  async (req: NextRequest, { dbUserId, userRole }): Promise<NextResponse> => {
    initializeCorrelationId(req);

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `idea-books-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const { searchParams } = new URL(req.url);
    const queryValidation = IdeaBookQuerySchema.safeParse({
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
    });

    if (!queryValidation.success) {
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        queryValidation.error.issues,
      );
    }

    const { page, limit, search, category } = queryValidation.data;

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () =>
        ideaBooksService.list(
          { userId: dbUserId, role: userRole },
          { page, limit, search, category },
        ),
      { operationName: "list_idea_books" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch idea books", result.error, {
        actorRole: userRole,
      });
      return apiError(
        "Failed to fetch idea books",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      return mapIdeaBooksError(result.data);
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);

/**
 * POST /api/idea-books
 * Create a new idea book.
 */
export const POST = withAuth(
  async (req: NextRequest, { dbUserId, userRole }): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    const sizeError = checkBodySize(req, IDEA_BOOK_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = CreateIdeaBookSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const data = validation.data;

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "POST", {
        domain: "idea-book",
        title: data.title,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "idea-books",
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
      return apiError("Request is being processed", HttpStatus.CONFLICT);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `idea-books-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => ideaBooksService.create({ userId: dbUserId, role: userRole }, data),
      { operationName: "create_idea_book" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error("Failed to create idea book", result.error, {
        correlationId,
        actorRole: userRole,
      });
      return apiError(
        "Failed to create idea book",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      return mapIdeaBooksError(result.data);
    }

    const ideaBook = result.data.data;
    await IdempotencyService.complete(idempotencyKey, ideaBook);
    return apiSuccess(ideaBook, HttpStatus.CREATED);
  },
);
