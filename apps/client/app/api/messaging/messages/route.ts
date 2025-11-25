import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { executeResilient, resilientFetch, initializeCorrelationId, apiError, getClientLogger } from '@/app/lib/resilient-api';

const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";
const logger = getClientLogger();

/**
 * POST /api/messaging/messages
 * Send a new message with resilience patterns
 */
export async function POST(request: NextRequest) {
  const correlationId = initializeCorrelationId(request);

  const session = await auth();

  if (!session || !session.user?.id) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = await request.json();

    // Ensure sender is the authenticated user
    const messageData = {
      ...body,
      senderId: session.user.id,
    };

    // Execute with resilience - critical operation for user experience
    return executeResilient(
      async () => {
        const data = await resilientFetch(
          `${MESSAGING_SERVICE_URL}/api/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              'X-Correlation-ID': correlationId,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messageData),
            timeout: 8000,
            retry: true,
            operationName: 'send-message',
          }
        );
        return data;
      },
      {
        criticality: 'normal',
        operationName: 'post-message',
        // No cache for messages, no fallback - fail if service is down
      }
    );
  } catch (error) {
    logger.error("Error sending message", error as Error, { 
      correlationId, 
      userId: session.user.id 
    });
    return apiError("Failed to send message", 500);
  }
}

