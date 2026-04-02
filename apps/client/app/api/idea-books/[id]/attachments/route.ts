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
import { isValidId } from "@/app/lib/api/api-guards";
import { AttachmentQuerySchema } from "@/app/lib/validation/idea-books-validation";
import { ideaBooksService } from "@/app/lib/domains/idea-books";

const logger = getClientLogger();

type IdeaBookParams = { id: string };

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
    default:
      return apiError(
        error.message || "Idea book operation failed",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
  }
}

/**
 * GET /api/idea-books/[id]/attachments
 * List all attachments for an idea book with pagination.
 */
export const GET = withAuth<IdeaBookParams>(
  async (
    req: NextRequest,
    { dbUserId, userRole },
    params,
  ): Promise<NextResponse> => {
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

    const { searchParams } = new URL(req.url);
    const queryValidation = AttachmentQuerySchema.safeParse({
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    if (!queryValidation.success) {
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        queryValidation.error.issues,
      );
    }

    const { page, limit } = queryValidation.data;

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () =>
        ideaBooksService.listAttachments(
          { userId: dbUserId, role: userRole },
          bookId,
          { page, limit },
        ),
      { operationName: "list_idea_book_attachments" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch attachments", result.error, { bookId });
      return apiError(
        "Failed to fetch attachments",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      return mapIdeaBooksError(result.data);
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);
