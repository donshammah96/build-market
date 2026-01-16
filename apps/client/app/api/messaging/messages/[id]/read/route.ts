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
 * POST /api/messaging/messages/[id]/read
 * Mark a message as read
 */
export const POST = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id: messageId } = params!;

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Marking message as read", {
      correlationId,
      messageId,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const data = await resilientFetch(
          `${MESSAGING_SERVICE_URL}/api/messages/${messageId}/read`,
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
            operationName: "mark-message-read",
          }
        );

        logger.info("Message marked as read", { correlationId, messageId });
        return data;
      },
      {
        operationName: "post-message-read",
        successStatus: HttpStatus.OK,
      }
    );
  }
);
