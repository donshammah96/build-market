import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@repo/db'; // Adjust path based on your monorepo structure
import { 
  checkRateLimit, 
  getRateLimitIdentifier, 
  RateLimits 
} from '@/app/lib/rate-limit';
import {
  executeResilient,
  initializeCorrelationId,
  apiError,
  getClientLogger,
} from '@/app/lib/resilient-api';

const logger = getClientLogger();

// --- Validation Schemas ---
const createIdeaBookSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().max(500).optional(),
});

/**
 * GET /api/idea-books
 * Fetch all idea books for the authenticated user.
 * Supports simple search filtering.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(request);
  const { userId } = await auth();

  if (!userId) {
    return apiError('Unauthorized', 401);
  }

  // Rate Limiting (Read Operation)
  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `idea-books-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    logger.warn('Rate limit exceeded for GET idea-books', { correlationId, identifier });
    return apiError('Too many requests', 429);
  }

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search')?.trim();

  return executeResilient(
    async () => {
      // Find the internal DB User ID based on Clerk ID
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }
      });

      if (!user) {
        logger.warn('User found in Clerk but not in DB', { correlationId, clerkId: userId });
        return apiError('User profile not found', 404);
      }

      const ideaBooks = await prisma.ideaBook.findMany({
        where: {
          clientId: user.id,
          ...(search && {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }),
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          items: true, // JSONB field
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { sharedWith: true } // Optional: see how many people it's shared with
          }
        }
      });

      // Transform JSONB items into a frontend-friendly format (e.g., getting counts)
      const transformedBooks = ideaBooks.map(book => {
        const itemsList = Array.isArray(book.items) ? book.items : [];
        return {
          id: book.id,
          title: book.title,
          description: book.description,
          items: itemsList, // Pass full items or just a preview slice if payload is large
          itemCount: itemsList.length,
          createdAt: book.createdAt,
          updatedAt: book.updatedAt,
        };
      });

      logger.info('Idea Books fetched successfully', { 
        correlationId, 
        userId: user.id, 
        count: transformedBooks.length 
      });

      return transformedBooks;
    },
    {
      operationName: 'fetch-idea-books',
      criticality: 'critical', // User content is high criticality
    }
  );
}

/**
 * POST /api/idea-books
 * Create a new idea book linked to the user's profile.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(request);
  const { userId } = await auth();

  if (!userId) {
    return apiError('Unauthorized', 401);
  }

  // Rate Limiting (Write Operation - Stricter limits)
  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `idea-books-write:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests', 429);
  }

  return executeResilient(
    async () => {
      // 1. Parse Body
      const body = await request.json();
      const validation = createIdeaBookSchema.safeParse(body);

      if (!validation.success) {
        return apiError('Invalid input data', 400, validation.error.issues);
      }

      const { title, description } = validation.data;

      // 2. Resolve User
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }
      });

      if (!user) {
        return apiError('User profile not found. Please complete onboarding.', 404);
      }

      // 3. Create Book Transactionally
      const newBook = await prisma.ideaBook.create({
        data: {
          title,
          description,
          clientId: user.id,
          items: [], // Initialize empty JSON array
        },
      });

      logger.info('Idea Book created successfully', { 
        correlationId, 
        bookId: newBook.id,
        userId: user.id 
      });

      return newBook;
    },
    {
      operationName: 'create-idea-book',
      criticality: 'critical',
    }
  );
}