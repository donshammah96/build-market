import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import {
  apiError,
  apiSuccess,
  HttpStatus,
} from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { getClientDashboardData } from "@/lib/services/client-dashboard";

const logger = getClientLogger();

/**
 * GET /api/client/dashboard
 *
 * Returns dashboard data for the authenticated client user.
 *
 * Response includes:
 * - stats: totalProjects, activeProjects, completedProjects, savedProfessionals, ideaBooks
 * - projects: 10 most recent projects with status, progress, budget, professional info
 * - ideaBooks: 6 most recent idea books with cover images
 *
 * Cross-cutting:
 * - Authenticated (withAuth — requires valid Clerk session + active DB user)
 * - Rate limited (READ tier, scoped to client-dashboard:{identifier})
 * - Resilient execution with circuit breaker and timeout
 * - Correlation ID propagation
 */
export const GET = withAuth(async (request: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(request);

  // ── Rate limiting ────────────────────────────────────────────────────
  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `client-dashboard:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
      undefined,
      correlationId,
    );
  }

  logger.info("Fetching client dashboard", {
    correlationId,
    userId: dbUserId,
  });

  // ── Resilient execution ──────────────────────────────────────────────
  const result = await getResilientExecutor().execute(
    () => getClientDashboardData(dbUserId),
    {
      operationName: "client:get_dashboard",
      timeout: 10000,
      retry: false,
    },
  );

  if (!result.success || !result.data) {
    logger.error(
      "Failed to fetch client dashboard",
      result.error ?? new Error("Unknown error"),
      { correlationId, userId: dbUserId },
    );
    return apiError(
      "Failed to load dashboard data",
      HttpStatus.INTERNAL_SERVER_ERROR,
      undefined,
      correlationId,
    );
  }

  logger.info("Client dashboard fetched successfully", {
    correlationId,
    userId: dbUserId,
    totalProjects: result.data.stats.totalProjects,
    activeProjects: result.data.stats.activeProjects,
    ideaBookCount: result.data.ideaBooks.length,
  });

  return apiSuccess(result.data, HttpStatus.OK, correlationId);
});
