/**
 * Resilient API utilities for Next.js API routes
 * Integrates all resilience patterns into a simple API
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ResilientExecutor,
  StructuredLogger,
  CorrelationIdManager,
  type OperationCriticality,
  type ResilienceOptions,
} from "@build/resilience";

// Initialize global executor for the client app
const executor = new ResilientExecutor("build-market-client");
const logger = new StructuredLogger("build-market-client");

/**
 * API Response helpers with observability
 */
export function apiSuccess<T>(
  data: T,
  status: number = 200,
  headers?: Record<string, string>,
): NextResponse {
  const correlationId = CorrelationIdManager.get();

  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      ...(correlationId && { correlationId }),
    },
    {
      status,
      headers: {
        "X-Correlation-ID": correlationId || "",
        ...headers,
      },
    },
  );
}

export function apiError(
  message: string,
  status: number = 500,
  // eslint-disable-next-line /typescript-eslint/no-explicit-any
  details?: any,
): NextResponse {
  const correlationId = CorrelationIdManager.get();

  logger.error(message, undefined, {
    correlationId,
    statusCode: status,
    details,
  });

  return NextResponse.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
      ...(correlationId && { correlationId }),
    },
    {
      status,
      headers: {
        "X-Correlation-ID": correlationId || "",
      },
    },
  );
}

/**
 * Execute API operation with resilience patterns
 */
export async function executeResilient<T>(
  operation: () => Promise<T>,
  options: ResilienceOptions & {
    criticality?: OperationCriticality;
    successStatus?: number;
    errorStatus?: number;
  } = {},
): Promise<NextResponse> {
  try {
    const {
      criticality,
      successStatus = 200,
      errorStatus = 500,
      ...resilienceOptions
    } = options;

    let result;

    if (criticality) {
      result = await executor.executeWithCriticality(
        operation,
        criticality,
        resilienceOptions.operationName,
      );
    } else {
      result = await executor.execute(operation, resilienceOptions);
    }

    if (result.success) {
      const headers: Record<string, string> = {};

      if (result.fromCache) {
        headers["X-Cache"] = "HIT";
      }
      if (result.fromFallback) {
        headers["X-Fallback"] = "true";
      }
      if (result.attempts && result.attempts > 1) {
        headers["X-Retry-Attempts"] = String(result.attempts);
      }

      return apiSuccess(result.data, successStatus, headers);
    } else {
      return apiError(
        result.error?.message || "Operation failed",
        errorStatus,
        {
          attempts: result.attempts,
          duration: result.duration,
        },
      );
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return apiError(err.message, options.errorStatus || 500);
  }
}

/**
 * Resilient fetch with timeout and retry
 */
// eslint-disable-next-line /typescript-eslint/no-explicit-any
export async function resilientFetch<T = any>(
  url: string,
  options: RequestInit & {
    timeout?: number;
    retry?: boolean;
    operationName?: string;
  } = {},
): Promise<T> {
  const {
    timeout = 10000,
    retry = true,
    operationName = "fetch",
    ...fetchOptions
  } = options;

  const result = await executor.execute(
    async () => {
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    },
    {
      timeout,
      retry: retry ? { maxAttempts: 3 } : false,
      operationName: `${operationName}:${url}`,
      metrics: true,
    },
  );

  if (!result.success) {
    throw result.error;
  }

  return result.data!;
}

/**
 * Initialize correlation ID from request
 */
export function initializeCorrelationId(request: NextRequest): string {
  const existingId = request.headers.get("X-Correlation-ID");
  const correlationId = existingId || CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);

  logger.debug("Request received", {
    correlationId,
    method: request.method,
    url: request.url,
  });

  return correlationId;
}

/**
 * Get executor for advanced usage
 */
export function getResilientExecutor(): ResilientExecutor {
  return executor;
}

/**
 * Get logger for the client app
 */
export function getClientLogger(): StructuredLogger {
  return logger;
}

/**
 * Health check endpoint helper
 */
export async function healthCheck(
  serviceName: string,
  checks: Array<{
    name: string;
    check: () => Promise<boolean>;
    critical?: boolean;
  }>,
): Promise<NextResponse> {
  const results = await Promise.all(
    checks.map(async ({ name, check, critical = false }) => {
      try {
        const healthy = await executor.execute(check, {
          timeout: 5000,
          retry: false,
          operationName: `health:${name}`,
        });

        return {
          name,
          status: healthy.success && healthy.data ? "healthy" : "unhealthy",
          critical,
        };
      } catch (error) {
        return {
          name,
          status: "unhealthy",
          critical,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const allHealthy = results.every((r) => r.status === "healthy");
  const criticalUnhealthy = results.some(
    (r) => r.critical && r.status === "unhealthy",
  );

  const circuitBreakerStates = executor.getCircuitBreakerStates();
  const cacheStats = executor.getCacheStats();

  return NextResponse.json(
    {
      service: serviceName,
      status: criticalUnhealthy
        ? "critical"
        : allHealthy
          ? "healthy"
          : "degraded",
      timestamp: new Date().toISOString(),
      checks: results,
      circuitBreakers: Object.fromEntries(circuitBreakerStates),
      cacheStats: Object.fromEntries(cacheStats),
    },
    {
      status: criticalUnhealthy ? 503 : allHealthy ? 200 : 207,
    },
  );
}
