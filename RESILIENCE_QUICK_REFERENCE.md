# Resilience Patterns Quick Reference

## 🚀 Quick Start

```typescript
import { executeResilient, initializeCorrelationId } from '@/app/lib/resilient-api';

export async function GET(request: NextRequest) {
  initializeCorrelationId(request);
  
  return executeResilient(
    async () => yourOperation(),
    {
      criticality: 'normal',
      operationName: 'your-operation',
      cache: { ttl: 60000 },
      fallback: async () => fallbackValue,
    }
  );
}
```

## ⚡ Criticality Levels

| Level | Timeout | Retry | Cache | Use For |
|-------|---------|-------|-------|---------|
| **critical** | 3s | ❌ No | ❌ No | Payments, Auth, Security |
| **normal** | 10s | ✅ 3x | ✅ 60s | User Data, Listings, Searches |
| **background** | 30s | ✅ 5x | ✅ 5min | Analytics, Logs, Notifications |

## 📋 Common Patterns

### Database Read (Cached)
```typescript
await executeResilient(
  async () => prisma.user.findMany(),
  {
    criticality: 'normal',
    cache: { ttl: 30000, staleWhileRevalidate: 15000 },
    fallback: async () => [],
  }
);
```

### External API Call
```typescript
await resilientFetch(
  'https://api.example.com/data',
  {
    timeout: 5000,
    retry: true,
    operationName: 'external-api',
  }
);
```

### Critical Payment
```typescript
await executeResilient(
  async () => processPayment(data),
  {
    criticality: 'critical',
    // Auto: 3s timeout, no retry, no cache
  }
);
```

### Background Job
```typescript
await executeResilient(
  async () => sendAnalytics(events),
  {
    criticality: 'background',
    // Auto: 30s timeout, 5 retries, 5min cache
  }
);
```

## 🔍 Monitoring

### Health Check
```typescript
GET /api/health
```
Returns service health + circuit breaker states + cache stats

### Metrics
```typescript
GET /api/metrics
```
Returns operation stats (p50, p95, p99) + all metrics

## 🎯 Configuration Options

```typescript
{
  // Timeout
  timeout: 5000,                    // Or 'critical' | 'normal' | 'background'
  
  // Retry
  retry: {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  },
  
  // Circuit Breaker
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
    monitoringPeriod: 10000,
  },
  
  // Cache
  cache: {
    ttl: 60000,
    maxSize: 1000,
    staleWhileRevalidate: 30000,
  },
  
  // Fallback
  fallback: async () => fallbackValue,
  
  // Metadata
  operationName: 'my-operation',
  metrics: true,
}
```

## 📝 Logging

```typescript
import { getClientLogger } from '@/app/lib/resilient-api';

const logger = getClientLogger();

logger.info('Operation completed', {
  correlationId,
  userId,
  duration: 123,
});

logger.error('Operation failed', error, {
  correlationId,
  userId,
  operation: 'fetch-data',
});
```

## 🎨 Response Headers

- `X-Correlation-ID`: Request tracking
- `X-Cache`: HIT | MISS
- `X-Fallback`: true (if fallback used)
- `X-Retry-Attempts`: Number of attempts

## 🔧 Utilities

```typescript
// Initialize correlation ID
const correlationId = initializeCorrelationId(request);

// Get executor (advanced usage)
const executor = getResilientExecutor();

// Get logger
const logger = getClientLogger();

// Health check helper
return healthCheck('service-name', [
  {
    name: 'database',
    check: async () => await prisma.$queryRaw`SELECT 1`,
    critical: true,
  },
]);
```

## 📊 Metrics Access

```typescript
const executor = getResilientExecutor();

// Circuit breaker states
const cbStates = executor.getCircuitBreakerStates();

// Cache statistics
const cacheStats = executor.getCacheStats();

// Operation stats (p50, p95, p99)
const stats = executor.getOperationStats('operation-name');

// All metrics
const metrics = executor.getMetrics();
```

## ✅ Best Practices

1. ✅ Always initialize correlation IDs
2. ✅ Choose appropriate criticality
3. ✅ Use fallbacks for non-critical operations
4. ✅ Log with context and correlation IDs
5. ✅ Monitor circuit breaker states
6. ✅ Cache aggressively for read operations
7. ✅ Set appropriate timeouts
8. ✅ Test resilience patterns

## 🚨 Anti-Patterns

❌ Retry critical operations (payments)
❌ Cache critical operations (auth)
❌ Ignore correlation IDs
❌ Use same config for all operations
❌ No fallbacks for user-facing features
❌ No logging in fallbacks
❌ Not monitoring circuit breakers

## 📦 Package Import

```typescript
// Next.js API routes
import {
  executeResilient,
  resilientFetch,
  initializeCorrelationId,
  healthCheck,
  apiSuccess,
  apiError,
  getClientLogger,
  getResilientExecutor,
} from '@/app/lib/resilient-api';

// Direct package usage (services)
import {
  ResilientExecutor,
  StructuredLogger,
  CorrelationIdManager,
  CircuitBreaker,
  ResilientCache,
  withRetry,
  withTimeout,
  withFallback,
} from '@repo/resilience';
```

## 🎓 Examples by Use Case

### User Profile (Normal)
```typescript
criticality: 'normal',
cache: { ttl: 30000 },
fallback: async () => cachedProfile,
```

### Payment (Critical)
```typescript
criticality: 'critical',
// No retry, no cache, fast fail
```

### Analytics (Background)
```typescript
criticality: 'background',
fallback: async () => { logger.warn('Analytics failed'); return null; },
```

### Search (Normal + Cache)
```typescript
criticality: 'normal',
cache: { ttl: 300000, staleWhileRevalidate: 60000 },
fallback: async () => [],
```

### Notifications (Background)
```typescript
criticality: 'background',
fallback: async () => { await queueForLater(); return { queued: true }; },
```

---

**Quick Reference** | Build Market Resilience Package | v1.0.0
