# Resilience Implementation Guide

## Overview

This document describes the comprehensive resilience patterns implemented across the Build Market platform, built from first principles to create a robust distributed system.

## Architecture Principles

### 1. **Timeouts** ⏱️

All operations have appropriate timeouts based on criticality:

- **Critical Operations (3s)**: Authentication, payments, security operations
- **Normal Operations (10s)**: Standard API calls, user-facing features
- **Background Operations (30s)**: Analytics, logging, batch processing

**Implementation:**

```typescript
import { executeResilient } from "@/app/lib/resilient-api";

// Automatically uses criticality-based timeout
await executeResilient(async () => processPayment(data), {
  criticality: "critical",
});
```

### 2. **Retry Logic** 🔄

Intelligent exponential backoff with jitter prevents thundering herd:

- Default: 3 attempts with 100ms initial delay
- Exponential backoff: 2x multiplier
- Jitter: ±10% randomization
- Max delay: 10 seconds

**Features:**

- Configurable retryable errors
- Automatic retry on network failures
- Backoff prevents overwhelming services
- Jitter prevents synchronized retries

### 3. **Circuit Breakers** 🔌

Protects struggling services from cascading failures:

- Failure threshold: 5 failures in 10s window
- Recovery timeout: 60s before half-open
- Success threshold: 2 successes to close
- Per-service isolation

**States:**

- **Closed**: Normal operation, tracking failures
- **Open**: Service failing, rejecting requests
- **Half-Open**: Testing recovery with limited requests

### 4. **Caching** 💾

Aggressive multi-layer caching reduces dependency load:

- In-memory LRU cache (1000 entries default)
- Stale-while-revalidate support
- Background revalidation
- Configurable TTL per operation

**Example:**

```typescript
// Cache professionals list for 30s, serve stale for 15s while revalidating
cache: {
  ttl: 30000,
  staleWhileRevalidate: 15000,
}
```

### 5. **Fallbacks** 🎯

Graceful degradation when services fail:

- Static fallback values
- Fallback functions
- Multiple fallback strategies
- Cascading fallback chains

**Non-Critical Features:**

- Messaging service: Return empty conversations
- Professional recommendations: Return empty array
- Analytics: Silently fail, log error

**Critical Features:**

- Payments: No fallback, fail fast
- Authentication: No fallback, require service
- User data: No fallback, show error

### 6. **Synchronous Cascading Prevention** 🌊

Prevent cascading failures:

- Circuit breakers stop failure propagation
- Timeouts prevent blocking
- Fallbacks provide alternatives
- Metrics track health

### 7. **Metrics & Observability** 📊

Comprehensive metrics for all operations:

**Metrics Collected:**

- Operation duration (p50, p95, p99)
- Success/failure rates
- Cache hit/miss rates
- Circuit breaker states
- Retry attempts

**Access Metrics:**

```typescript
import { getResilientExecutor } from "@/app/lib/resilient-api";

const executor = getResilientExecutor();

// Get operation stats
const stats = executor.getOperationStats("fetch-professionals");
console.log("P95 latency:", stats.summary?.quantiles.get(0.95));

// Get circuit breaker states
const cbStates = executor.getCircuitBreakerStates();
console.log("Circuit breakers:", cbStates);

// Get cache statistics
const cacheStats = executor.getCacheStats();
console.log("Cache stats:", cacheStats);
```

### 8. **Structured Logging** 📝

Meaningful logging for debugging:

**Features:**

- Correlation IDs for request tracing
- Contextual information
- Multiple log levels
- JSON output in production
- Colored output in development

**Example:**

```typescript
import { getClientLogger } from "@/app/lib/resilient-api";

const logger = getClientLogger();

logger.info("User logged in", {
  userId: "123",
  correlationId: request.headers.get("X-Correlation-ID"),
});

logger.error("Payment failed", error, {
  userId: "123",
  amount: 99.99,
  paymentMethod: "stripe",
});
```

## Implementation Examples

### API Route with Full Resilience

```typescript
import { NextRequest } from "next/server";
import {
  executeResilient,
  initializeCorrelationId,
  apiError,
  getClientLogger,
} from "@/app/lib/resilient-api";

const logger = getClientLogger();

export async function GET(request: NextRequest) {
  const correlationId = initializeCorrelationId(request);

  return executeResilient(
    async () => {
      // Your operation
      const data = await fetchData();

      logger.info("Data fetched successfully", {
        correlationId,
        count: data.length,
      });

      return data;
    },
    {
      criticality: "normal",
      operationName: "fetch-data",
      cache: {
        ttl: 60000, // 1 minute
        staleWhileRevalidate: 30000, // 30s
      },
      fallback: async () => {
        logger.warn("Using fallback", { correlationId });
        return [];
      },
    },
  );
}
```

### External Service Call

```typescript
import { resilientFetch } from "@/app/lib/resilient-api";

const userData = await resilientFetch("https://api.example.com/users/123", {
  timeout: 5000,
  retry: true,
  operationName: "fetch-user",
});
```

### Critical Operation (Fast Fail)

```typescript
// Payment processing - no retry, fast timeout, no cache
return executeResilient(async () => processPayment(data), {
  criticality: "critical",
  operationName: "process-payment",
  // Automatically: 3s timeout, no retry, no cache
});
```

### Background Operation (Aggressive Retry)

```typescript
// Analytics - aggressive retry, long timeout, long cache
return executeResilient(async () => sendAnalytics(events), {
  criticality: "background",
  operationName: "send-analytics",
  // Automatically: 30s timeout, 5 retries, 5min cache
});
```

## Health Monitoring

### Health Check Endpoint

```typescript
import { healthCheck } from "@/app/lib/resilient-api";

export async function GET() {
  return healthCheck("my-service", [
    {
      name: "database",
      check: async () => await prisma.$queryRaw`SELECT 1`,
      critical: true,
    },
    {
      name: "messaging-service",
      check: async () => {
        const response = await fetch(MESSAGING_URL + "/health");
        return response.ok;
      },
      critical: false,
    },
  ]);
}
```

**Response:**

```json
{
  "service": "my-service",
  "status": "healthy",
  "timestamp": "2025-11-24T10:00:00.000Z",
  "checks": [
    {
      "name": "database",
      "status": "healthy",
      "critical": true
    },
    {
      "name": "messaging-service",
      "status": "unhealthy",
      "critical": false
    }
  ],
  "circuitBreakers": {
    "messaging-service": {
      "state": "open",
      "failureCount": 5,
      "nextAttemptTime": 1700825460000
    }
  },
  "cacheStats": {
    "fetch-professionals": {
      "size": 42,
      "maxSize": 1000
    }
  }
}
```

## Configuration by Criticality

### Critical Operations

- **Timeout**: 3s
- **Retry**: Disabled
- **Cache**: Disabled
- **Circuit Breaker**: Fast (3 failures, 30s timeout)
- **Examples**: Payments, auth, security

### Normal Operations

- **Timeout**: 10s
- **Retry**: 3 attempts
- **Cache**: 60s with 30s stale-while-revalidate
- **Circuit Breaker**: Standard (5 failures, 60s timeout)
- **Examples**: User profiles, listings, searches

### Background Operations

- **Timeout**: 30s
- **Retry**: 5 attempts
- **Cache**: 5 minutes with 60s stale-while-revalidate
- **Circuit Breaker**: Lenient (10 failures, 120s timeout)
- **Examples**: Analytics, logs, notifications

## Monitoring Dashboard

Create a monitoring endpoint:

```typescript
import { getResilientExecutor } from "@/app/lib/resilient-api";

export async function GET() {
  const executor = getResilientExecutor();

  return NextResponse.json({
    metrics: executor.getMetrics(),
    circuitBreakers: Object.fromEntries(executor.getCircuitBreakerStates()),
    cacheStats: Object.fromEntries(executor.getCacheStats()),
    operations: ["fetch-professionals", "send-message", "process-payment"].map(
      (op) => ({
        name: op,
        stats: executor.getOperationStats(op),
      }),
    ),
  });
}
```

## Best Practices

### 1. Always Initialize Correlation IDs

```typescript
const correlationId = initializeCorrelationId(request);
```

### 2. Choose Appropriate Criticality

- Critical: User can't proceed without it
- Normal: Important but has alternatives
- Background: Nice to have, silent failure OK

### 3. Use Appropriate Fallbacks

```typescript
fallback: async () => {
  // Return cached data, default values, or empty arrays
  // Log warning for monitoring
  logger.warn("Using fallback", { correlationId });
  return defaultValue;
};
```

### 4. Log Meaningfully

```typescript
// Include context
logger.info("Operation completed", {
  correlationId,
  userId,
  duration,
  itemCount,
});

// Include errors
logger.error("Operation failed", error, {
  correlationId,
  userId,
  operation: "fetch-data",
});
```

### 5. Monitor Your System

- Set up dashboards for metrics
- Alert on circuit breaker opens
- Track p95/p99 latencies
- Monitor cache hit rates

## Testing Resilience

### Test Circuit Breakers

```typescript
// Force failures to open circuit
for (let i = 0; i < 6; i++) {
  await makeFailingRequest();
}

// Verify circuit is open
const state = executor.getCircuitBreakerStates().get("my-service");
expect(state?.state).toBe("open");
```

### Test Fallbacks

```typescript
// Simulate service failure
mockServiceDown();

// Verify fallback is used
const result = await executeResilient(async () => failingOperation(), {
  fallback: async () => fallbackData,
});

expect(result.fromFallback).toBe(true);
```

### Test Retries

```typescript
let attempts = 0;
await executeResilient(
  async () => {
    attempts++;
    if (attempts < 3) throw new Error("Temporary failure");
    return "success";
  },
  { retry: { maxAttempts: 3 } },
);

expect(attempts).toBe(3);
```

## Future Enhancements

1. **Redis Integration**: Add Redis layer to cache
2. **Distributed Tracing**: OpenTelemetry integration
3. **Rate Limiting**: Add to resilience package
4. **Bulkhead Pattern**: Isolate thread pools
5. **Request Deduplication**: Prevent duplicate requests
6. **Metrics Export**: Prometheus/DataDog integration
7. **Alert Rules**: Automatic alerting on thresholds

## Summary

The resilience package provides:
✅ Timeouts based on criticality
✅ Intelligent retry with exponential backoff
✅ Circuit breakers to prevent cascading failures
✅ Aggressive caching with stale-while-revalidate
✅ Graceful degradation with fallbacks
✅ Comprehensive metrics and observability
✅ Structured logging with correlation IDs
✅ Easy-to-use API for all services

All patterns work together to create a robust, fault-tolerant distributed system that degrades gracefully under load and recovers automatically from transient failures.
