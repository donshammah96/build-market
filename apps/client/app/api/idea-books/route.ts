import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/db";
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

// --- Validation Schemas ---
const createIdeaBookSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().max(500).optional(),
});

/**
 * GET /api/idea-books
 * Fetch all idea books for the authenticated user.
 * Supports pagination via ?page=&limit= and search filtering via ?search=
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  // Rate Limiting
  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `idea-books-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    logger.warn("Rate limit exceeded for GET idea-books", {
      correlationId,
      identifier,
    });
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;

  logger.info("Fetching idea books", {
    correlationId,
    userId: dbUserId,
    search,
    page,
    limit,
  });

  return executeResilient(
    async () => {
      const whereClause = {
        clientId: dbUserId,
        ...(search && {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [ideaBooks, total] = await Promise.all([
        prisma.ideaBook.findMany({
          where: whereClause,
          orderBy: { updatedAt: "desc" },
          skip,
          take: limit,
          include: {
            attachments: {
              orderBy: { createdAt: "desc" },
              take: 5, // Return first 5 attachments as preview
              select: {
                id: true,
                url: true,
                key: true,
                filename: true,
                mimeType: true,
                caption: true,
              },
            },
            _count: {
              select: {
                sharedWith: true,
                attachments: true,
              },
            },
          },
        }),
        prisma.ideaBook.count({ where: whereClause }),
      ]);

      // Transform for frontend
      const transformedBooks = ideaBooks.map((book) => {
        const itemsList = Array.isArray(book.items) ? book.items : [];
        return {
          id: book.id,
          title: book.title,
          description: book.description,
          items: itemsList,
          itemCount: itemsList.length,
          sharedCount: book._count.sharedWith,
          attachmentCount: book._count.attachments,
          coverImage: book.attachments[0]?.url || null,
          attachments: book.attachments,
          createdAt: book.createdAt,
          updatedAt: book.updatedAt,
        };
      });

      logger.info("Idea books fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: transformedBooks.length,
      });

      return {
        data: transformedBooks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
    {
      operationName: "fetch-idea-books",
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * POST /api/idea-books
 * Create a new idea book linked to the user's profile.
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  // Rate Limiting
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
  const validation = createIdeaBookSchema.safeParse(body);

  if (!validation.success) {
    logger.warn("Idea book validation failed", {
      correlationId,
      userId: dbUserId,
      errors: validation.error.issues,
    });
    return apiError(
      "Invalid input data",
      HttpStatus.BAD_REQUEST,
      validation.error.issues
    );
  }

  const { title, description } = validation.data;

  logger.info("Creating idea book", { correlationId, userId: dbUserId, title });

  return executeResilient(
    async () => {
      const newBook = await prisma.ideaBook.create({
        data: {
          title,
          description,
          clientId: dbUserId,
          items: [],
        },
        include: {
          attachments: true,
          _count: {
            select: {
              sharedWith: true,
              attachments: true,
            },
          },
        },
      });

      logger.info("Idea book created successfully", {
        correlationId,
        bookId: newBook.id,
        userId: dbUserId,
      });

      return newBook;
    },
    {
      operationName: "create-idea-book",
      successStatus: HttpStatus.CREATED,
    }
  );
});
