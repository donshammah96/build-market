import { NextRequest } from "next/server";
import { prisma } from '@repo/db';
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { z } from 'zod';

const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";

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
  try {
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

    // Forward request to messaging service
    const response = await fetch(
      `${MESSAGING_SERVICE_URL}/api/conversations/user/${dbUserId}`,
      {
        headers: {
          'X-User-Id': dbUserId,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch conversations' }));
      return apiError(error.error || 'Failed to fetch conversations', response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return apiError('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
});

/**
 * POST /api/messaging/conversations
 * Create or get a conversation
 */
export const POST = withAuth(async (request: NextRequest, { dbUserId }) => {
  try {
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

    const body = await request.json();

    // Validate request body
    const validated = CreateConversationSchema.parse(body);

    // Ensure authenticated user is in participants
    if (!validated.participants.includes(dbUserId)) {
      return apiError('You must be a participant in the conversation', HttpStatus.FORBIDDEN);
    }

    // Forward request to messaging service
    const response = await fetch(`${MESSAGING_SERVICE_URL}/api/conversations`, {
      method: "POST",
      headers: {
        'X-User-Id': dbUserId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validated),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create conversation' }));
      return apiError(error.error || 'Failed to create conversation', response.status);
    }

    const data = await response.json();
    return apiSuccess(data, response.status);
  } catch (error) {
    console.error("Error creating conversation:", error);

    if (error instanceof z.ZodError) {
      return apiError('Validation failed', HttpStatus.BAD_REQUEST, error.issues);
    }

    return apiError('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
});
