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
import { listAttachments } from "@/lib/services/idea-books";

const logger = getClientLogger();

type IdeaBookParams = { id: string };

/**
 * GET /api/idea-books/[id]/attachments
 * List all attachments for an idea book with pagination.
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
      () => listAttachments(dbUserId, bookId, { page, limit }),
      { operationName: "list_idea_book_attachments" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch attachments", result.error, { bookId });
      return apiError(
        "Failed to fetch attachments",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data as
      | { data: { data: unknown; pagination: unknown } }
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
