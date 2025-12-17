import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, resilientFetch, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from "@/app/lib/rate-limit";

const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";
const logger = getClientLogger();

const SendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1, 'Message content is required'),
  type: z.enum(['text', 'image', 'file']).default('text'),
  attachmentUrl: z.string().url().optional(),
});

/**
 * POST /api/messaging/messages
 * Send a new message with resilience patterns
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  let validatedData;
  try {
    const body = await req.json();
    validatedData = SendMessageSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      logger.warn('Message validation failed', { correlationId, userId: dbUserId, errors: err.issues });
      return apiError('Validation failed', HttpStatus.BAD_REQUEST, err.issues);
    }
    throw err;
  }

  const messageData = {
    ...validatedData,
    senderId: dbUserId,
  };

  logger.info('Sending message', { correlationId, userId: dbUserId, conversationId: validatedData.conversationId });

  return executeResilient(
    async () => {
      const data = await resilientFetch(
        `${MESSAGING_SERVICE_URL}/api/messages`,
        {
          method: 'POST',
          headers: {
            'X-User-Id': dbUserId,
            'X-Correlation-ID': correlationId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messageData),
          timeout: 8000,
          retry: true,
          operationName: 'send-message',
        }
      );

      logger.info('Message sent successfully', { correlationId, userId: dbUserId, conversationId: validatedData.conversationId });
      return data;
    },
    {
      operationName: 'post-message',
      successStatus: HttpStatus.CREATED,
    }
  );
});
