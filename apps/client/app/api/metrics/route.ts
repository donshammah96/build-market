import { NextRequest, NextResponse } from 'next/server';
import { getResilientExecutor, initializeCorrelationId, getClientLogger } from '@/app/lib/resilient-api';

const logger = getClientLogger();

/**
 * GET /api/metrics
 * Observability endpoint for monitoring system health and performance
 * 
 * Returns:
 * - Operation statistics (latency percentiles, counts)
 * - Circuit breaker states
 * - Cache statistics
 * - All collected metrics
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(request);
  
  logger.debug('Metrics endpoint accessed', { correlationId });

  try {
    const executor = getResilientExecutor();

    const operations = [
      'fetch-professionals',
      'get-conversations',
      'send-message',
      'fetch-user-data',
      'get_client_dashboard',
      'get_notifications',
      'complete_onboarding',
    ];

    const operationStats = operations.map((op) => {
      const stats = executor.getOperationStats(op);
      return {
        name: op,
        summary: stats.summary
          ? {
              count: stats.summary.count,
              sum: stats.summary.sum,
              avg: stats.summary.count > 0 ? stats.summary.sum / stats.summary.count : 0,
              p50: stats.summary.quantiles.get(0.5),
              p75: stats.summary.quantiles.get(0.75),
              p95: stats.summary.quantiles.get(0.95),
              p99: stats.summary.quantiles.get(0.99),
            }
          : null,
      };
    });

    // Get circuit breaker states
    const circuitBreakerStates = Object.fromEntries(
      executor.getCircuitBreakerStates()
    );

    // Get cache statistics
    const cacheStats = Object.fromEntries(executor.getCacheStats());

    // Get all metrics
    const allMetrics = executor.getMetrics();

    logger.info('Metrics collected', { correlationId, operationCount: operationStats.length });

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        correlationId,
        data: {
          operations: operationStats,
          circuitBreakers: circuitBreakerStates,
          caches: cacheStats,
          metrics: allMetrics,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'X-Correlation-ID': correlationId || '',
        },
      }
    );
  } catch (err) {
    logger.error('Error collecting metrics', err instanceof Error ? err : new Error(String(err)), {
      correlationId,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to collect metrics',
        correlationId,
      },
      { status: 500 }
    );
  }
}
