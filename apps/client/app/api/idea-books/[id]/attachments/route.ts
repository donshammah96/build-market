import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { 
  checkRateLimit, 
  getRateLimitIdentifier, 
  RateLimits 
} from '@/app/lib/rate-limit';
import {
  executeResilient,
  initializeCorrelationId,
  getClientLogger,
} from '@/app/lib/resilient-api';

const logger = getClientLogger();

/**
 * GET /api/idea-books/[id]/attachments
 * Get all attachments for an idea book
 */
export const GET = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id: ideaBookId } = params!;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching idea book attachments', { correlationId, ideaBookId, userId: dbUserId });

  return executeResilient(
    async () => {
      // Verify ownership
      const ideaBook = await prisma.ideaBook.findUnique({
        where: { id: ideaBookId },
        select: { clientId: true },
      });

      if (!ideaBook) {
        logger.warn('Idea book not found', { correlationId, ideaBookId });
        return apiError('Idea book not found', HttpStatus.NOT_FOUND);
      }

      if (ideaBook.clientId !== dbUserId) {
        logger.warn('Forbidden access to idea book attachments', { correlationId, ideaBookId, userId: dbUserId });
        return apiError('Forbidden', HttpStatus.FORBIDDEN);
      }

      const attachments = await prisma.ideaBookAttachment.findMany({
        where: { ideaBookId },
        orderBy: { createdAt: 'desc' },
      });

      logger.info('Attachments fetched successfully', { correlationId, ideaBookId, count: attachments.length });
      return attachments;
    },
    {
      operationName: 'get-idea-book-attachments',
      successStatus: HttpStatus.OK,
    }
  );
});
