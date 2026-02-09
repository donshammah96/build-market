import { NextRequest } from "next/server";
import { prisma, ProjectStatus } from "@build/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import { ClientRepository } from "@/app/lib/repositories/client.repository";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

/**
 * GET /api/client/dashboard
 * Get dashboard data for authenticated client
 * Returns stats, projects, idea books, and saved professionals
 */
export const GET = withAuth(async (request: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(request);

  // Rate limiting
  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `client-dashboard:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  logger.info("Fetching client dashboard data", {
    correlationId,
    userId: dbUserId,
  });

  return executeResilient(
    async () => {
      // Use repository to fetch dashboard data
      const repo = new ClientRepository(prisma);
      const dashboardData = await repo.getDashboardData(dbUserId);

      logger.info("Client dashboard data fetched successfully", {
        correlationId,
        userId: dbUserId,
        projectCount: dashboardData.projects.length,
        ideaBookCount: dashboardData.ideaBooks.length,
      });

      return dashboardData;
    },
    {
      operationName: "get_client_dashboard",
      successStatus: HttpStatus.OK,
    }
  );
});
