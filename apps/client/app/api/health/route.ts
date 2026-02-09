import { NextRequest } from "next/server";
import {
  healthCheck,
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/resilient-api";
import { prisma } from "@build/db";

const logger = getClientLogger();
const MESSAGING_SERVICE_URL =
  process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";

/**
 * GET /api/health
 * Comprehensive health check endpoint with circuit breaker and cache stats
 *
 * Returns:
 * - Service status (healthy/degraded/unhealthy)
 * - Individual dependency status (database, messaging-service)
 * - Circuit breaker states
 * - Cache statistics
 *
 * Status logic:
 * - healthy: All critical services up
 * - degraded: All critical services up, some non-critical down
 * - unhealthy: Any critical service down
 */
export async function GET(request: NextRequest) {
  const correlationId = initializeCorrelationId(request);

  logger.debug("Health check requested", { correlationId });

  return healthCheck("build-market-client", [
    {
      name: "database",
      check: async () => {
        try {
          await prisma.$queryRaw`SELECT 1`;
          return true;
        } catch {
          logger.error(
            "Database health check failed",
            new Error("Database connection failed"),
            { correlationId }
          );
          return false;
        }
      },
      critical: true, // App cannot function without database
    },
    {
      name: "messaging-service",
      check: async () => {
        try {
          const response = await fetch(`${MESSAGING_SERVICE_URL}/health`, {
            signal: AbortSignal.timeout(3000),
          });
          return response.ok;
        } catch {
          logger.warn("Messaging service health check failed", {
            correlationId,
          });
          return false;
        }
      },
      critical: false, // App can function in degraded mode without messaging
    },
  ]);
}
