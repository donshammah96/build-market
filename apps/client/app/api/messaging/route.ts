import { NextRequest } from "next/server";
import { healthCheck, initializeCorrelationId } from "@/app/lib/resilient-api";

/**
 * GET /api/messaging
 * Health check for messaging API proxy with circuit breaker monitoring
 */
export async function GET(request: NextRequest) {
  initializeCorrelationId(request);
  
  const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";

  return healthCheck("messaging-service", [
    {
      name: "messaging-service",
      check: async () => {
        const response = await fetch(`${MESSAGING_SERVICE_URL}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        return response.ok;
      },
      critical: false, // Messaging is not critical for app functionality
    },
  ]);
}

