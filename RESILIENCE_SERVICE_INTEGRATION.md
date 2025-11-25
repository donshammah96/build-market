# Applying Resilience Patterns to Other Services

This guide shows how to apply the resilience patterns to your other microservices (messaging-service, payment-service, etc.).

## For Node.js/Express Services

### 1. Add Resilience Package

```json
// apps/messaging-service/package.json
{
  "dependencies": {
    "@repo/resilience": "workspace:*"
  }
}
```

### 2. Create Service Executor

```typescript
// apps/messaging-service/src/utils/resilience.ts
import {
  ResilientExecutor,
  StructuredLogger,
  CorrelationIdManager,
} from '@repo/resilience';

// Initialize executor for messaging service
export const executor = new ResilientExecutor('messaging-service');
export const logger = new StructuredLogger('messaging-service');

// Middleware to initialize correlation ID
export function correlationMiddleware(req: any, res: any, next: any) {
  const correlationId =
    req.headers['x-correlation-id'] || CorrelationIdManager.generate();
  
  CorrelationIdManager.set(correlationId);
  res.setHeader('X-Correlation-ID', correlationId);
  
  logger.debug('Request received', {
    correlationId,
    method: req.method,
    path: req.path,
  });
  
  next();
}
```

### 3. Apply to Routes

```typescript
// apps/messaging-service/src/routes/conversations.ts
import { Router } from 'express';
import { executor, logger } from '../utils/resilience';
import { CorrelationIdManager } from '@repo/resilience';

const router = Router();

router.get('/conversations/user/:userId', async (req, res) => {
  const correlationId = CorrelationIdManager.get();

  const result = await executor.execute(
    async () => {
      // Fetch from database
      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            some: { userId: req.params.userId },
          },
        },
      });

      logger.info('Conversations fetched', {
        correlationId,
        userId: req.params.userId,
        count: conversations.length,
      });

      return conversations;
    },
    {
      criticality: 'normal',
      operationName: 'fetch-user-conversations',
      cache: {
        ttl: 10000, // 10s cache
      },
      fallback: async () => {
        logger.warn('Database unavailable, returning empty', {
          correlationId,
        });
        return [];
      },
    }
  );

  if (result.success) {
    res.json({
      success: true,
      data: result.data,
      fromCache: result.fromCache,
    });
  } else {
    logger.error('Failed to fetch conversations', result.error!, {
      correlationId,
      userId: req.params.userId,
    });
    res.status(500).json({
      success: false,
      error: result.error?.message,
    });
  }
});

export default router;
```

### 4. External Service Calls

```typescript
// Calling another service with resilience
import { resilientFetch } from '@repo/resilience';

async function notifyUser(userId: string, message: string) {
  try {
    const result = await executor.execute(
      async () => {
        const response = await fetch(
          `${NOTIFICATION_SERVICE_URL}/notify`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Correlation-ID': CorrelationIdManager.get() || '',
            },
            body: JSON.stringify({ userId, message }),
            signal: AbortSignal.timeout(5000),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      },
      {
        criticality: 'background', // Non-critical
        operationName: 'send-notification',
        retry: {
          maxAttempts: 5,
          maxDelayMs: 30000,
        },
        fallback: async () => {
          // Silent failure - log and continue
          logger.warn('Failed to send notification, will retry later', {
            userId,
            correlationId: CorrelationIdManager.get(),
          });
          return { queued: true };
        },
      }
    );

    return result.data;
  } catch (error) {
    logger.error('Notification failed', error as Error, {
      userId,
      correlationId: CorrelationIdManager.get(),
    });
    // Don't throw - non-critical operation
    return { error: true };
  }
}
```

### 5. Health Check Endpoint

```typescript
// apps/messaging-service/src/routes/health.ts
import { Router } from 'express';
import { executor } from '../utils/resilience';
import { prisma } from '../db';

const router = Router();

router.get('/health', async (req, res) => {
  const checks = await Promise.all([
    // Database check
    executor.execute(
      async () => {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      },
      {
        timeout: 3000,
        retry: false,
        operationName: 'health:database',
      }
    ),
    // Redis check (if applicable)
    executor.execute(
      async () => {
        await redis.ping();
        return true;
      },
      {
        timeout: 3000,
        retry: false,
        operationName: 'health:redis',
      }
    ),
  ]);

  const allHealthy = checks.every((check) => check.success);

  res.status(allHealthy ? 200 : 503).json({
    service: 'messaging-service',
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: checks[0].success ? 'healthy' : 'unhealthy',
      redis: checks[1].success ? 'healthy' : 'unhealthy',
    },
    circuitBreakers: Object.fromEntries(executor.getCircuitBreakerStates()),
    cacheStats: Object.fromEntries(executor.getCacheStats()),
  });
});

export default router;
```

### 6. Metrics Endpoint

```typescript
// apps/messaging-service/src/routes/metrics.ts
import { Router } from 'express';
import { executor } from '../utils/resilience';

const router = Router();

router.get('/metrics', (req, res) => {
  const operations = [
    'fetch-user-conversations',
    'send-message',
    'create-conversation',
  ];

  const operationStats = operations.map((op) => {
    const stats = executor.getOperationStats(op);
    return {
      name: op,
      summary: stats.summary
        ? {
            count: stats.summary.count,
            avg: stats.summary.count > 0
              ? stats.summary.sum / stats.summary.count
              : 0,
            p50: stats.summary.quantiles.get(0.5),
            p95: stats.summary.quantiles.get(0.95),
            p99: stats.summary.quantiles.get(0.99),
          }
        : null,
    };
  });

  res.json({
    timestamp: new Date().toISOString(),
    operations: operationStats,
    circuitBreakers: Object.fromEntries(executor.getCircuitBreakerStates()),
    caches: Object.fromEntries(executor.getCacheStats()),
    metrics: executor.getMetrics(),
  });
});

export default router;
```

## Common Patterns

### Database Operations

```typescript
// Critical read - fast fail
await executor.executeWithCriticality(
  async () => prisma.user.findUnique({ where: { id } }),
  'critical',
  'get-user-by-id'
);

// Normal read - with cache
await executor.execute(
  async () => prisma.professional.findMany(),
  {
    criticality: 'normal',
    operationName: 'list-professionals',
    cache: { ttl: 30000 },
  }
);

// Background write - aggressive retry
await executor.executeWithCriticality(
  async () => prisma.analytics.create({ data }),
  'background',
  'create-analytics'
);
```

### External API Calls

```typescript
// Critical - payment processing
await executor.execute(
  async () => stripe.charges.create(chargeData),
  {
    criticality: 'critical',
    operationName: 'create-stripe-charge',
    // No retry, no cache for payments
  }
);

// Normal - fetch external data
await executor.execute(
  async () => fetch(EXTERNAL_API_URL).then(r => r.json()),
  {
    criticality: 'normal',
    operationName: 'fetch-external-data',
    cache: { ttl: 60000 },
    fallback: async () => cachedData,
  }
);

// Background - send analytics
await executor.execute(
  async () => analytics.track(event),
  {
    criticality: 'background',
    operationName: 'track-analytics',
    fallback: async () => {
      logger.warn('Analytics unavailable');
      return { queued: true };
    },
  }
);
```

### Message Queue Operations

```typescript
// Publishing messages - background operation
await executor.execute(
  async () => kafka.send({ topic: 'events', messages: [event] }),
  {
    criticality: 'background',
    operationName: 'publish-event',
    retry: {
      maxAttempts: 5,
      maxDelayMs: 60000,
    },
    fallback: async () => {
      // Queue locally for retry
      await localQueue.add(event);
      return { queued: true };
    },
  }
);
```

## Service-Specific Examples

### Payment Service

```typescript
// High-value operation - very conservative
await executor.execute(
  async () => processPayment(paymentData),
  {
    criticality: 'critical',
    operationName: 'process-payment',
    retry: false, // Never retry payments automatically
    cache: false, // Never cache payment operations
    circuitBreaker: {
      failureThreshold: 2, // Very sensitive
      timeout: 30000, // Quick recovery
    },
  }
);
```

### Search Service

```typescript
// Search with aggressive caching
await executor.execute(
  async () => searchIndex.search(query),
  {
    criticality: 'normal',
    operationName: 'search',
    cache: {
      ttl: 300000, // 5 min cache
      staleWhileRevalidate: 60000, // Serve stale for 1 min
    },
    fallback: async () => {
      // Fallback to database search
      return await prisma.product.findMany({
        where: { name: { contains: query } },
      });
    },
  }
);
```

### Notification Service

```typescript
// Non-critical - silent failure OK
await executor.execute(
  async () => sendEmail(recipient, message),
  {
    criticality: 'background',
    operationName: 'send-email',
    retry: {
      maxAttempts: 5,
      maxDelayMs: 120000, // 2 min max delay
    },
    fallback: async () => {
      // Queue for later retry
      await emailQueue.add({ recipient, message });
      logger.info('Email queued for later delivery');
      return { queued: true };
    },
  }
);
```

## Testing Resilience

### Test Circuit Breaker

```typescript
describe('Circuit Breaker', () => {
  it('should open after threshold failures', async () => {
    // Force failures
    for (let i = 0; i < 6; i++) {
      await executor.execute(
        async () => { throw new Error('Test failure'); },
        { operationName: 'test-op', retry: false }
      );
    }

    const state = executor.getCircuitBreakerStates().get('test-op');
    expect(state?.state).toBe('open');
  });
});
```

### Test Retry Logic

```typescript
describe('Retry Logic', () => {
  it('should retry and eventually succeed', async () => {
    let attempts = 0;
    
    const result = await executor.execute(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('Temporary failure');
        return 'success';
      },
      {
        operationName: 'test-retry',
        retry: { maxAttempts: 3 },
      }
    );

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
  });
});
```

### Test Fallback

```typescript
describe('Fallback', () => {
  it('should use fallback on failure', async () => {
    const result = await executor.execute(
      async () => { throw new Error('Service down'); },
      {
        operationName: 'test-fallback',
        fallback: async () => 'fallback-data',
      }
    );

    expect(result.success).toBe(true);
    expect(result.data).toBe('fallback-data');
    expect(result.fromFallback).toBe(true);
  });
});
```

## Monitoring Integration

### Prometheus Metrics (Future)

```typescript
// Export metrics in Prometheus format
router.get('/metrics/prometheus', (req, res) => {
  const metrics = executor.getMetrics();
  
  let output = '';
  metrics.forEach(metric => {
    const labels = metric.tags
      ? Object.entries(metric.tags)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',')
      : '';
    
    output += `${metric.name}{${labels}} ${metric.value} ${metric.timestamp}\n`;
  });
  
  res.type('text/plain').send(output);
});
```

## Summary

Apply resilience patterns to any service by:

1. ✅ Add `@repo/resilience` dependency
2. ✅ Create service executor and logger
3. ✅ Add correlation middleware
4. ✅ Wrap operations with `executor.execute()`
5. ✅ Add health and metrics endpoints
6. ✅ Configure based on criticality
7. ✅ Test resilience patterns
8. ✅ Monitor circuit breakers and metrics

**Result**: All services gain fault tolerance, observability, and graceful degradation!
