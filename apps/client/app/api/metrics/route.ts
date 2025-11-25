import { NextRequest, NextResponse } from 'next/server';
import { getResilientExecutor } from '@/app/lib/resilient-api';

/**
 * GET /api/metrics
 * Observability endpoint for monitoring system health and performance
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const executor = getResilientExecutor();

  const operations = [
    'fetch-professionals',
    'get-conversations',
    'send-message',
    'fetch-user-data',
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

  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      operations: operationStats,
      circuitBreakers: circuitBreakerStates,
      caches: cacheStats,
      metrics: allMetrics,
    },
    {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    }
  );
}
