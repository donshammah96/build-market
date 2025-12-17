import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, resilientFetch, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from "@/app/lib/rate-limit";

const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";
const logger = getClientLogger();

/**
 * GET /api/messaging/conversations/[id]
 * Get a specific conversation
 */
export const GET = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id: conversationId } = params!;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching conversation', { correlationId, conversationId, userId: dbUserId });

  return executeResilient(
    async () => {
      const data = await resilientFetch(
        `${MESSAGING_SERVICE_URL}/api/conversations/${conversationId}`,
        {
          headers: {
            'X-User-Id': dbUserId,
            'X-Correlation-ID': correlationId,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
          retry: true,
          operationName: 'fetch-conversation',
        }
      );

      logger.info('Conversation fetched successfully', { correlationId, conversationId });
      return data;
    },
    {
      operationName: 'get-conversation',
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * DELETE /api/messaging/conversations/[id]
 * Leave or delete a conversation
 */
export const DELETE = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id: conversationId } = params!;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Deleting conversation', { correlationId, conversationId, userId: dbUserId });

  return executeResilient(
    async () => {
      const data = await resilientFetch(
        `${MESSAGING_SERVICE_URL}/api/conversations/${conversationId}`,
        {
          method: 'DELETE',
          headers: {
            'X-User-Id': dbUserId,
            'X-Correlation-ID': correlationId,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
          retry: false, // Don't retry deletes
          operationName: 'delete-conversation',
        }
      );

      logger.info('Conversation deleted successfully', { correlationId, conversationId });
      return data;
    },
    {
      operationName: 'delete-conversation',
      successStatus: HttpStatus.OK,
    }
  );
});
