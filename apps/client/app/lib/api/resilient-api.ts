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
  details?: unknown,
): NextResponse {
  const correlationId = CorrelationIdManager.get();

  // ADR-005: 4xx statuses are expected client errors — log at warn.
  // 5xx statuses are infrastructure or server failures — log at error.
  // Logging every 400/429 at error level inflates error rates and degrades
  // the signal value of error-level alerts.
  if (status >= 500) {
    logger.error(message, undefined, { correlationId, statusCode: status });
  } else {
    logger.warn(message, { correlationId, statusCode: status });
  }

  return NextResponse.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
      ...(details !== undefined && { details }),
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
    // Log the real error internally but return a static message to the caller.
    // Passing error.message directly to apiError() violates ADR anti-pattern 29
    // (dynamic exception strings reaching client responses).
    logger.error(
      "Unhandled error in executeResilient",
      error instanceof Error ? error : new Error(String(error)),
      { operationName: options.operationName },
    );
    return apiError("An unexpected error occurred", options.errorStatus || 500);
  }
}

/**
 * Resilient fetch with timeout and retry
 */
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
      // operationName must be a static identifier (ADR-005 §3). The URL is
      // dynamic and must not be embedded here — callers should supply a stable
      // name like "fetch_property_detail" rather than relying on the default.
      operationName,
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
    // ADR-005: log httpMethod and routePattern (static), never the raw URL.
    // The full request.url includes path parameters (e.g. /api/users/uuid-here)
    // which are resource identifiers and must not appear in logs.
    // Callers that need routePattern should pass it explicitly in their own
    // structured log event.
    httpMethod: request.method,
  });

  return correlationId;
}

/**
 * Get executor for advanced usage
 */
export function getResilientExecutor(): InstanceType<typeof ResilientExecutor> {
  return executor;
}

/**
 * Get logger for the client app
 */
export function getClientLogger(): InstanceType<typeof StructuredLogger> {
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
