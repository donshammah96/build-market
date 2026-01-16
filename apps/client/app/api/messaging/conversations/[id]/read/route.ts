import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  resilientFetch,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";

const MESSAGING_SERVICE_URL =
  process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";
const logger = getClientLogger();

/**
 * POST /api/messaging/conversations/[id]/read
 * Mark conversation as read for the authenticated user
 */
export const POST = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id: conversationId } = params!;

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Marking conversation as read", {
      correlationId,
      conversationId,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const data = await resilientFetch(
          `${MESSAGING_SERVICE_URL}/api/conversations/${conversationId}/read`,
          {
            method: "POST",
            headers: {
              "X-User-Id": dbUserId,
              "X-Correlation-ID": correlationId,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId: dbUserId }),
            timeout: 5000,
            retry: false,
            operationName: "mark-conversation-read",
          }
        );

        logger.info("Conversation marked as read", {
          correlationId,
          conversationId,
        });
        return data;
      },
      {
        operationName: "post-conversation-read",
        successStatus: HttpStatus.OK,
      }
    );
  }
);
