import { NextRequest } from "next/server";
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { executeResilient, resilientFetch, initializeCorrelationId, getClientLogger } from '@/app/lib/resilient-api';
import { z } from 'zod';

const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";
const logger = getClientLogger();

/**
 * Request body schema for creating conversations
 */
const CreateConversationSchema = z.object({
  participants: z.array(z.string()).min(2, 'At least 2 participants required'),
  title: z.string().optional(),
});

/**
 * GET /api/messaging/conversations
 * Get all conversations for the authenticated user
 */
export const GET = withAuth(async (request: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(request);

  // Rate limiting
  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `conversations:${identifier}`,
    RateLimits.API.limit,
    RateLimits.API.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  // Execute with resilience patterns
  return executeResilient(
    async () => {
      const data = await resilientFetch(
        `${MESSAGING_SERVICE_URL}/api/conversations/user/${dbUserId}`,
        {
          headers: {
            'X-User-Id': dbUserId,
            'X-Correlation-ID': correlationId,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
          retry: true,
          operationName: 'fetch-conversations',
        }
      );
      return data;
    },
    {
      criticality: 'normal',
      operationName: 'get-conversations',
      cache: {
        ttl: 10000, // 10s cache
        staleWhileRevalidate: 5000,
      },
      fallback: async () => {
        logger.warn('Messaging service unavailable, returning empty conversations', { correlationId, userId: dbUserId });
        return [];
      },
    }
  );
});

/**
 * POST /api/messaging/conversations
 * Create or get a conversation
 */
export const POST = withAuth(async (request: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(request);

  // Rate limiting
  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `create-conversation:${identifier}`,
    RateLimits.API.limit,
    RateLimits.API.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  try {
    const body = await request.json();

    // Validate request body
    const validated = CreateConversationSchema.parse(body);

    // Ensure authenticated user is in participants
    if (!validated.participants.includes(dbUserId)) {
      return apiError('You must be a participant in the conversation', HttpStatus.FORBIDDEN);
    }

    // Execute with resilience - critical operation (no cache, limited retry)
    return executeResilient(
      async () => {
        const data = await resilientFetch(
          `${MESSAGING_SERVICE_URL}/api/conversations`,
          {
            method: 'POST',
            headers: {
              'X-User-Id': dbUserId,
              'X-Correlation-ID': correlationId,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(validated),
            timeout: 8000,
            retry: true,
            operationName: 'create-conversation',
          }
        );
        return data;
      },
      {
        criticality: 'normal',
        operationName: 'post-conversation',
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Validation failed', HttpStatus.BAD_REQUEST, error.issues);
    }
    logger.error('Error creating conversation', error as Error, { correlationId, userId: dbUserId });
    return apiError('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
});
