import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, resilientFetch, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from "@/app/lib/rate-limit";

const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";
const logger = getClientLogger();

/**
 * GET /api/messaging/messages/conversation/[conversationId]
 * Get all messages for a conversation (with pagination)
 */
export const GET = withAuth<{ conversationId: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { conversationId } = params!;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  // Get query parameters for pagination
  const searchParams = req.nextUrl.searchParams;
  const page = searchParams.get("page") || "1";
  const limit = searchParams.get("limit") || "50";

  logger.info('Fetching conversation messages', { correlationId, conversationId, userId: dbUserId, page, limit });

  return executeResilient(
    async () => {
      const data = await resilientFetch(
        `${MESSAGING_SERVICE_URL}/api/messages/conversation/${conversationId}?page=${page}&limit=${limit}`,
        {
          headers: {
            'X-User-Id': dbUserId,
            'X-Correlation-ID': correlationId,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
          retry: true,
          operationName: 'fetch-conversation-messages',
        }
      );

      logger.info('Conversation messages fetched successfully', { correlationId, conversationId });
      return data;
    },
    {
      operationName: 'get-conversation-messages',
      successStatus: HttpStatus.OK,
      cache: {
        ttl: 5000, // 5s cache for message lists
        staleWhileRevalidate: 2000,
      },
    }
  );
});
