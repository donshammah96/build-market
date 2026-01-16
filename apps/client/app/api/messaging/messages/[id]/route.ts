import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, resilientFetch, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from "@/app/lib/rate-limit";

const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";
const logger = getClientLogger();

/**
 * GET /api/messaging/messages/[id]
 * Get a specific message
 */
export const GET = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id: messageId } = params!;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching message', { correlationId, messageId, userId: dbUserId });

  return executeResilient(
    async () => {
      const data = await resilientFetch(
        `${MESSAGING_SERVICE_URL}/api/messages/${messageId}`,
        {
          headers: {
            'X-User-Id': dbUserId,
            'X-Correlation-ID': correlationId,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
          retry: true,
          operationName: 'fetch-message',
        }
      );

      logger.info('Message fetched successfully', { correlationId, messageId });
      return data;
    },
    {
      operationName: 'get-message',
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * DELETE /api/messaging/messages/[id]
 * Delete a message
 */
export const DELETE = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id: messageId } = params!;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Deleting message', { correlationId, messageId, userId: dbUserId });

  return executeResilient(
    async () => {
      const data = await resilientFetch(
        `${MESSAGING_SERVICE_URL}/api/messages/${messageId}`,
        {
          method: 'DELETE',
          headers: {
            'X-User-Id': dbUserId,
            'X-Correlation-ID': correlationId,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
          retry: false,
          operationName: 'delete-message',
        }
      );

      logger.info('Message deleted successfully', { correlationId, messageId });
      return data;
    },
    {
      operationName: 'delete-message',
      successStatus: HttpStatus.OK,
    }
  );
});
