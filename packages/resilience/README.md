# Resilience Package

Comprehensive resilience utilities for distributed systems built from first principles.

## Features

### 1. **Timeouts** ⏱️

Criticality-based timeout strategies:

- **Critical operations** (3s): Auth, payments, security
- **Normal operations** (10s): Standard API calls
- **Background operations** (30s): Analytics, logs, batch jobs

### 2. **Retry Logic** 🔄

Intelligent retry with:

- Exponential backoff with configurable multiplier
- Jitter to prevent thundering herd (10% by default)
- Configurable max attempts and delays
- Retryable error filtering

### 3. **Circuit Breakers** 🔌

Protect struggling services:

- Configurable failure thresholds
- Half-open state for recovery attempts
- Automatic timeout-based recovery
- Per-service circuit management

### 4. **Caching** 💾

Aggressive multi-layer caching:

- In-memory LRU cache
- Stale-while-revalidate support
- Background revalidation
- Configurable TTL and max size

### 5. **Fallbacks** 🎯

Graceful degradation:

- Static fallback values
- Fallback functions
- Multiple fallback strategies
- Cascading fallback chains

### 6. **Metrics** 📊

Comprehensive observability:

- Counters, gauges, histograms
- Duration tracking with percentiles (p50, p95, p99)
- Operation success/failure rates
- Cache hit/miss rates

### 7. **Logging** 📝

Structured logging with:

- Correlation IDs for request tracing
- Contextual information
- Multiple log levels
- JSON output for production

## Usage

### Quick Start

```typescript
import { ResilientExecutor } from "@build/resilience";

const executor = new ResilientExecutor("my-service");

// Execute with automatic resilience patterns
const result = await executor.execute(
  async () => {
    // Your operation
    return await fetch("https://api.example.com/data");
  },
  {
    timeout: "normal",
    retry: { maxAttempts: 3 },
    circuitBreaker: true,
    cache: { ttl: 60000 },
    fallback: async () => cachedData,
    operationName: "fetch-user-data",
  },
);

if (result.success) {
  console.log("Data:", result.data);
  console.log("From cache:", result.fromCache);
  console.log("Attempts:", result.attempts);
}
```

### Criticality-Based Execution

```typescript
// Critical operation - fast fail, no retry
await executor.executeWithCriticality(
  async () => processPayment(data),
  "critical",
  "process-payment",
);

// Normal operation - balanced resilience
await executor.executeWithCriticality(
  async () => fetchUserProfile(userId),
  "normal",
  "fetch-profile",
);

// Background operation - aggressive retry and caching
await executor.executeWithCriticality(
  async () => sendAnalytics(events),
  "background",
  "send-analytics",
);
```

### Individual Patterns

```typescript
import {
  withTimeout,
  withRetry,
  CircuitBreaker,
  ResilientCache,
  withFallback,
} from "@build/resilience";

// Timeout
const result = await withTimeout(
  async () => slowOperation(),
  5000,
  "slow-operation",
);

// Retry
const { result, attempts } = await withRetry(
  async () => unreliableOperation(),
  { maxAttempts: 3, initialDelayMs: 100 },
  "unreliable-operation",
);

// Circuit Breaker
const breaker = new CircuitBreaker("external-api");
const data = await breaker.execute(async () => callExternalAPI());

// Cache
const cache = new ResilientCache("user-cache", { ttl: 60000 });
const user = await cache.getOrCompute(`user:${userId}`, async () =>
  fetchUserFromDB(userId),
);

// Fallback
const { value, usedFallback } = await withFallback(
  async () => primaryDataSource(),
  {
    fallbackFn: async () => secondaryDataSource(),
    fallbackValue: defaultData,
  },
);
```

### Monitoring and Observability

```typescript
// Get circuit breaker states
const cbStates = executor.getCircuitBreakerStates();
console.log("Circuit breakers:", cbStates);

// Get cache statistics
const cacheStats = executor.getCacheStats();
console.log("Cache stats:", cacheStats);

// Get metrics
const metrics = executor.getMetrics();
console.log("Metrics:", metrics);

// Get operation statistics
const stats = executor.getOperationStats("fetch-user-data");
console.log("P95 latency:", stats.summary?.quantiles.get(0.95));
```

### Structured Logging

```typescript
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";

const logger = new StructuredLogger("my-service");

// Set correlation ID for request
CorrelationIdManager.set(CorrelationIdManager.generate());

// Log with context
logger.info("User logged in", {
  userId: "123",
  correlationId: CorrelationIdManager.get(),
});

logger.error("Payment failed", error, {
  userId: "123",
  amount: 99.99,
  correlationId: CorrelationIdManager.get(),
});

// Create child logger with default context
const childLogger = logger.child({ component: "auth" });
childLogger.info("Token validated");
```

## Configuration

### Default Configurations

```typescript
// Timeouts
{
  critical: 3000,    // 3s
  normal: 10000,     // 10s
  background: 30000, // 30s
}

// Retry
{
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
}

// Circuit Breaker
{
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  monitoringPeriod: 10000,
}

// Cache
{
  ttl: 60000,
  maxSize: 1000,
  staleWhileRevalidate: 0,
}
```

## Best Practices

1. **Choose the right criticality**:
   - `critical`: Payments, auth, security operations
   - `normal`: Standard user-facing operations
   - `background`: Analytics, logs, non-critical updates

2. **Use appropriate fallbacks**:
   - Cached data for read operations
   - Default values for non-critical data
   - Graceful degradation for features

3. **Monitor your systems**:
   - Track circuit breaker states
   - Monitor cache hit rates
   - Analyze operation latencies

4. **Log meaningfully**:
   - Use correlation IDs for request tracing
   - Include relevant context
   - Log errors with full stack traces

5. **Cache aggressively**:
   - Use stale-while-revalidate for better UX
   - Cache read-heavy operations
   - Set appropriate TTLs based on data freshness needs

## License

MIT
