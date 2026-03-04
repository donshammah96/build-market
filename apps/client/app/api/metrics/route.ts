import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  getResilientExecutor,
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { ensureValidInternalSecret } from "@/app/lib/security/internal-secret";

const logger = getClientLogger();

/**
 * Tracked operations — covers all major API operations across the platform.
 * Names must match the `operationName` values passed to `getResilientExecutor().execute()`.
 */
const TRACKED_OPERATIONS = [
  // Professional Portal
  "get_professional_profile",
  "update_professional_profile",
  "get_portfolio_items",
  "create_portfolio_item",
  "get_calendar_events",
  "get_leads",
  "create_lead",
  "get_transactions",
  "get_projects",
  "create_project",
  // Messaging
  "list_threads",
  "create_thread",
  "get_thread",
  "send_message",
  "list_thread_messages",
  "mark_thread_read",
  // Notifications
  "list_notifications",
  "mark_notification_read",
  "delete_notifications",
  // Auth / Onboarding
  "complete_onboarding",
  "skip_onboarding",
  // Public
  "create_public_lead",
  "get_public_lead_status",
  // Stores & Properties
  "get_stores",
  "create_store",
  "get_properties",
  "create_property",
] as const;

/**
 * GET /api/metrics
 * Observability endpoint for monitoring system health and performance.
 *
 * Returns operation latency percentiles, circuit breaker states,
 * cache statistics, and aggregated metrics.
 *
 * Protected by INTERNAL_API_SECRET header. In production, this
 * should be on an internal network or behind admin authentication.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(request);

  // Access control via internal secret
  const secretError = ensureValidInternalSecret(
    request.headers.get("x-internal-secret"),
  );
  if (secretError) {
    return secretError;
  }

  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `metrics:${identifier}`,
    RateLimits.API.limit,
    RateLimits.API.window,
  );
  if (!rateLimitResult.success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  try {
    const executor = getResilientExecutor();

    const operationStats = TRACKED_OPERATIONS.map((op) => {
      const stats = executor.getOperationStats(op);
      return {
        name: op,
        summary: stats.summary
          ? {
              count: stats.summary.count,
              sum: stats.summary.sum,
              avg:
                stats.summary.count > 0
                  ? stats.summary.sum / stats.summary.count
                  : 0,
              p50: stats.summary.quantiles.get(0.5),
              p75: stats.summary.quantiles.get(0.75),
              p95: stats.summary.quantiles.get(0.95),
              p99: stats.summary.quantiles.get(0.99),
            }
          : null,
      };
    });

    const activeOperations = operationStats.filter((op) => op.summary !== null);

    const circuitBreakerStates = Object.fromEntries(
      executor.getCircuitBreakerStates(),
    );

    const cacheStats = Object.fromEntries(executor.getCacheStats());

    const allMetrics = executor.getMetrics();

    logger.info("Metrics collected", {
      correlationId,
      activeOperationCount: activeOperations.length,
      totalTracked: TRACKED_OPERATIONS.length,
    });

    return apiSuccess(
      {
        operations: activeOperations,
        allOperations: operationStats,
        circuitBreakers: circuitBreakerStates,
        caches: cacheStats,
        metrics: allMetrics,
      },
      HttpStatus.OK,
    );
  } catch (err) {
    logger.error(
      "Error collecting metrics",
      err instanceof Error ? err : new Error(String(err)),
      { correlationId },
    );
    return apiError(
      "Failed to collect metrics",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
