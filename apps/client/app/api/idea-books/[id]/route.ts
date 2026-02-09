import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@build/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";
import {
  executeResilient,
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/resilient-api";

const logger = getClientLogger();

const updateIdeaBookSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100)
    .optional(),
  description: z.string().max(500).optional(),
  items: z.array(z.any()).optional(),
});

// Schema aligned with IdeaBookAttachment model
const addAttachmentSchema = z.object({
  url: z.string().url("Invalid URL"),
  key: z.string().optional(), // Storage key (S3/Uploadthing)
  filename: z.string().min(1, "Filename is required"),
  size: z.number().int().positive("Size must be positive"),
  mimeType: z.string().min(1, "MIME type is required"),
  caption: z.string().max(500).optional(),
});

/**
 * GET /api/idea-books/[id]
 * Get a specific idea book by ID with all attachments
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `idea-books-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window
    );

    if (!rateLimitResult.success) {
      logger.warn("Rate limit exceeded for GET idea-books/[id]", {
        correlationId,
        identifier,
      });
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Fetching idea book", {
      correlationId,
      bookId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const ideaBook = await prisma.ideaBook.findUnique({
          where: { id },
          include: {
            attachments: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                url: true,
                key: true,
                filename: true,
                size: true,
                mimeType: true,
                caption: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            sharedWith: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            _count: {
              select: {
                sharedWith: true,
                attachments: true,
              },
            },
          },
        });

        if (!ideaBook) {
          logger.warn("Idea book not found", { correlationId, bookId: id });
          return apiError("Idea book not found", HttpStatus.NOT_FOUND);
        }

        if (ideaBook.clientId !== dbUserId) {
          logger.warn("Forbidden access to idea book", {
            correlationId,
            bookId: id,
            userId: dbUserId,
          });
          return apiError("Forbidden", HttpStatus.FORBIDDEN);
        }

        logger.info("Idea book fetched successfully", {
          correlationId,
          bookId: id,
        });

        return {
          ...ideaBook,
          attachmentCount: ideaBook._count.attachments,
          sharedCount: ideaBook._count.sharedWith,
        };
      },
      {
        operationName: "get-idea-book",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * PATCH /api/idea-books/[id]
 * Update a specific idea book
 */
export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `idea-books-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!rateLimitResult.success) {
      logger.warn("Rate limit exceeded for PATCH idea-books/[id]", {
        correlationId,
        identifier,
      });
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const body = await req.json();
    const validation = updateIdeaBookSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Idea book update validation failed", {
        correlationId,
        bookId: id,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input data",
        HttpStatus.BAD_REQUEST,
        validation.error.issues
      );
    }

    logger.info("Updating idea book", {
      correlationId,
      bookId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const ideaBook = await prisma.ideaBook.findUnique({
          where: { id },
        });

        if (!ideaBook) {
          logger.warn("Idea book not found for update", {
            correlationId,
            bookId: id,
          });
          return apiError("Idea book not found", HttpStatus.NOT_FOUND);
        }

        if (ideaBook.clientId !== dbUserId) {
          logger.warn("Forbidden update to idea book", {
            correlationId,
            bookId: id,
            userId: dbUserId,
          });
          return apiError("Forbidden", HttpStatus.FORBIDDEN);
        }

        const updatedBook = await prisma.ideaBook.update({
          where: { id },
          data: validation.data,
          include: {
            attachments: {
              orderBy: { createdAt: "desc" },
            },
            _count: {
              select: {
                sharedWith: true,
                attachments: true,
              },
            },
          },
        });

        logger.info("Idea book updated successfully", {
          correlationId,
          bookId: id,
        });

        return {
          ...updatedBook,
          attachmentCount: updatedBook._count.attachments,
          sharedCount: updatedBook._count.sharedWith,
        };
      },
      {
        operationName: "update-idea-book",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * DELETE /api/idea-books/[id]
 * Delete a specific idea book (cascades to attachments)
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `idea-books-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!rateLimitResult.success) {
      logger.warn("Rate limit exceeded for DELETE idea-books/[id]", {
        correlationId,
        identifier,
      });
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Deleting idea book", {
      correlationId,
      bookId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const ideaBook = await prisma.ideaBook.findUnique({
          where: { id },
          include: {
            attachments: {
              select: { key: true },
            },
            _count: { select: { attachments: true } },
          },
        });

        if (!ideaBook) {
          logger.warn("Idea book not found for deletion", {
            correlationId,
            bookId: id,
          });
          return apiError("Idea book not found", HttpStatus.NOT_FOUND);
        }

        if (ideaBook.clientId !== dbUserId) {
          logger.warn("Forbidden deletion of idea book", {
            correlationId,
            bookId: id,
            userId: dbUserId,
          });
          return apiError("Forbidden", HttpStatus.FORBIDDEN);
        }

        // Collect storage keys for potential cleanup (S3/Uploadthing)
        const deletedAttachmentKeys = ideaBook.attachments
          .map((a) => a.key)
          .filter(Boolean);

        // Delete cascades to attachments due to schema relation
        await prisma.ideaBook.delete({
          where: { id },
        });

        logger.info("Idea book deleted successfully", {
          correlationId,
          bookId: id,
          attachmentsDeleted: ideaBook._count.attachments,
        });

        return {
          message: "Idea book deleted successfully",
          deletedAttachmentKeys,
        };
      },
      {
        operationName: "delete-idea-book",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * POST /api/idea-books/[id]
 * Add an attachment to an idea book
 */
export const POST = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `idea-books-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const body = await req.json();
    const validation = addAttachmentSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Attachment validation failed", {
        correlationId,
        bookId: id,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input data",
        HttpStatus.BAD_REQUEST,
        validation.error.issues
      );
    }

    logger.info("Adding attachment to idea book", {
      correlationId,
      bookId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify ownership
        const ideaBook = await prisma.ideaBook.findUnique({
          where: { id },
        });

        if (!ideaBook) {
          logger.warn("Idea book not found for attachment", {
            correlationId,
            bookId: id,
          });
          return apiError("Idea book not found", HttpStatus.NOT_FOUND);
        }

        if (ideaBook.clientId !== dbUserId) {
          logger.warn("Forbidden attachment to idea book", {
            correlationId,
            bookId: id,
            userId: dbUserId,
          });
          return apiError("Forbidden", HttpStatus.FORBIDDEN);
        }

        const { url, key, filename, size, mimeType, caption } = validation.data;

        const attachment = await prisma.ideaBookAttachment.create({
          data: {
            ideaBookId: id,
            url,
            key: key ?? "", // Storage key for S3/Uploadthing; fallback to empty string if undefined
            filename,
            size,
            mimeType,
            caption,
          },
        });

        logger.info("Attachment added successfully", {
          correlationId,
          bookId: id,
          attachmentId: attachment.id,
        });

        return attachment;
      },
      {
        operationName: "add-idea-book-attachment",
        successStatus: HttpStatus.CREATED,
      }
    );
  }
);
