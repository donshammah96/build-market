import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@repo/db';
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

const updateIdeaBookSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100).optional(),
  description: z.string().max(500).optional(),
});

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await props.params;
  const id = params.id;
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
    logger.warn('Rate limit exceeded for GET idea-books/[id]', { correlationId, identifier });
    return apiError('Too many requests', 429);
  }

  return executeResilient(
    async () => {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }
      });

      if (!user) {
        return apiError('User not found', 404);
      }

      const ideaBook = await prisma.ideaBook.findUnique({
        where: { id },
      });

      if (!ideaBook) {
        return apiError('Idea book not found', 404);
      }

      if (ideaBook.clientId !== user.id) {
        return apiError('Forbidden', 403);
      }

      return ideaBook;
    },
    { operationName: 'get-idea-book' }
  );
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await props.params;
  const id = params.id;
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
    logger.warn('Rate limit exceeded for PATCH idea-books/[id]', { correlationId, identifier });
    return apiError('Too many requests', 429);
  }

  return executeResilient(
    async () => {
      const body = await request.json();
      const validation = updateIdeaBookSchema.safeParse(body);

      if (!validation.success) {
        return apiError('Invalid input data', 400, validation.error.issues);
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }
      });

      if (!user) {
        return apiError('User not found', 404);
      }

      const ideaBook = await prisma.ideaBook.findUnique({
        where: { id },
      });

      if (!ideaBook) {
        return apiError('Idea book not found', 404);
      }

      if (ideaBook.clientId !== user.id) {
        return apiError('Forbidden', 403);
      }

      const updatedBook = await prisma.ideaBook.update({
        where: { id },
        data: validation.data,
      });

      logger.info('Idea book updated', { correlationId, bookId: id });
      return updatedBook;
    },
    { operationName: 'update-idea-book' }
  );
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await props.params;
  const id = params.id;
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
    logger.warn('Rate limit exceeded for DELETE idea-books/[id]', { correlationId, identifier });
    return apiError('Too many requests', 429);
  }

  return executeResilient(
    async () => {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }
      });

      if (!user) {
        return apiError('User not found', 404);
      }

      const ideaBook = await prisma.ideaBook.findUnique({
        where: { id },
      });

      if (!ideaBook) {
        return apiError('Idea book not found', 404);
      }

      if (ideaBook.clientId !== user.id) {
        return apiError('Forbidden', 403);
      }

      await prisma.ideaBook.delete({
        where: { id },
      });

      logger.info('Idea book deleted', { correlationId, bookId: id });
      return { success: true };
    },
    { operationName: 'delete-idea-book' }
  );
}
