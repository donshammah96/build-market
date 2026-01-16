import { NextRequest, NextResponse } from "next/server";
import {
  getResilientExecutor,
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/resilient-api";

const logger = getClientLogger();

// Operations to track - covers all major API operations
const TRACKED_OPERATIONS = [
  // Professional Portal
  "get_professional_profile",
  "update_professional_profile",
  "get_portfolio_items",
  "create_portfolio_item",
  "get_calendar_events",
  "get_leads",
  "get_transactions",
  // Client Dashboard
  "get_client_dashboard",
  "fetch-idea-books",
  // Messaging
  "fetch-professionals",
  "get-conversations",
  "send-message",
  "fetch-conversation-messages",
  // Notifications
  "get_notifications",
  "update_notification",
  // Auth/Onboarding
  "fetch-user-data",
  "complete_onboarding",
  // Public
  "create_public_lead",
  "get_public_lead_status",
];

/**
 * GET /api/metrics
 * Observability endpoint for monitoring system health and performance
 *
 * Returns:
 * - Operation statistics (latency percentiles, counts)
 * - Circuit breaker states
 * - Cache statistics
 * - All collected metrics
 *
 * Note: In production, this should be protected or on an internal network
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(request);

  logger.debug("Metrics endpoint accessed", { correlationId });

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

    // Filter to only show operations with data
    const activeOperations = operationStats.filter((op) => op.summary !== null);

    // Get circuit breaker states
    const circuitBreakerStates = Object.fromEntries(
      executor.getCircuitBreakerStates()
    );

    // Get cache statistics
    const cacheStats = Object.fromEntries(executor.getCacheStats());

    // Get all metrics
    const allMetrics = executor.getMetrics();

    logger.info("Metrics collected", {
      correlationId,
      activeOperationCount: activeOperations.length,
      totalTracked: TRACKED_OPERATIONS.length,
    });

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        correlationId,
        data: {
          operations: activeOperations,
          allOperations: operationStats,
          circuitBreakers: circuitBreakerStates,
          caches: cacheStats,
          metrics: allMetrics,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, must-revalidate",
          "X-Correlation-ID": correlationId || "",
        },
      }
    );
  } catch (err) {
    logger.error(
      "Error collecting metrics",
      err instanceof Error ? err : new Error(String(err)),
      { correlationId }
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to collect metrics",
        correlationId,
      },
      { status: 500 }
    );
  }
}
