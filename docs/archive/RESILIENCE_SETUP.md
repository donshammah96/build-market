# Resilience Package - Installation & Setup Guide

## 📦 Installation

### Step 1: Install Dependencies

```powershell
# From project root
cd c:\Users\User\build-market
pnpm install
```

This will install the `@build/resilience` package across all workspaces.

### Step 2: Build the Resilience Package

```powershell
# Build the resilience package
cd packages\resilience
pnpm build

# Or build all packages from root
cd ..\..
pnpm build
```

### Step 3: Verify Installation

```powershell
# Check that the package is properly linked
pnpm list @build/resilience
```

## 🚀 Quick Start - Next.js API Routes

### 1. Import Utilities

```typescript
// apps/client/app/api/your-route/route.ts
import { NextRequest } from "next/server";
import {
  executeResilient,
  initializeCorrelationId,
  apiError,
  getClientLogger,
} from "@/app/lib/resilient-api";
```

### 2. Basic API Route

```typescript
export async function GET(request: NextRequest) {
  // Initialize correlation ID for request tracking
  const correlationId = initializeCorrelationId(request);

  // Execute with automatic resilience
  return executeResilient(
    async () => {
      // Your operation here
      const data = await fetchYourData();
      return data;
    },
    {
      criticality: "normal",
      operationName: "fetch-your-data",
      cache: {
        ttl: 60000, // 1 minute
        staleWhileRevalidate: 30000, // Serve stale for 30s
      },
      fallback: async () => {
        // Return empty array if service fails
        return [];
      },
    },
  );
}
```

### 3. Add Health Check

```typescript
// apps/client/app/api/health/route.ts
import { healthCheck } from "@/app/lib/resilient-api";
import { prisma } from "@build/db";

export async function GET() {
  return healthCheck("your-service", [
    {
      name: "database",
      check: async () => {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      },
      critical: true,
    },
  ]);
}
```

### 4. Add Metrics Endpoint

```typescript
// apps/client/app/api/metrics/route.ts
import { NextResponse } from "next/server";
import { getResilientExecutor } from "@/app/lib/resilient-api";

export async function GET() {
  const executor = getResilientExecutor();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    circuitBreakers: Object.fromEntries(executor.getCircuitBreakerStates()),
    cacheStats: Object.fromEntries(executor.getCacheStats()),
    metrics: executor.getMetrics(),
  });
}
```

## 🔧 Setup for Other Services (Express, etc.)

### 1. Add Dependency

```json
// apps/your-service/package.json
{
  "dependencies": {
    "@build/resilience": "workspace:*"
  }
}
```

### 2. Create Service Utilities

```typescript
// apps/your-service/src/utils/resilience.ts
import {
  ResilientExecutor,
  StructuredLogger,
  CorrelationIdManager,
} from "@build/resilience";

export const executor = new ResilientExecutor("your-service");
export const logger = new StructuredLogger("your-service");

// Express middleware for correlation IDs
export function correlationMiddleware(req: any, res: any, next: any) {
  const correlationId =
    req.headers["x-correlation-id"] || CorrelationIdManager.generate();

  CorrelationIdManager.set(correlationId);
  res.setHeader("X-Correlation-ID", correlationId);

  next();
}
```

### 3. Apply to Express Routes

```typescript
// apps/your-service/src/routes/api.ts
import express from "express";
import { executor, logger, correlationMiddleware } from "../utils/resilience";

const router = express.Router();

// Add correlation middleware
router.use(correlationMiddleware);

// Example route
router.get("/data", async (req, res) => {
  const result = await executor.execute(async () => fetchData(), {
    criticality: "normal",
    operationName: "fetch-data",
    cache: { ttl: 60000 },
  });

  if (result.success) {
    res.json({ success: true, data: result.data });
  } else {
    logger.error("Failed to fetch data", result.error);
    res.status(500).json({ success: false, error: result.error?.message });
  }
});

export default router;
```

## 📊 Monitoring Setup

### 1. Test Health Endpoint

```powershell
# Start your service
pnpm dev:client

# Test health endpoint
curl http://localhost:3030/api/health
```

**Expected Response:**

```json
{
  "service": "build-market-client",
  "status": "healthy",
  "timestamp": "2025-11-24T10:00:00.000Z",
  "checks": [
    {
      "name": "database",
      "status": "healthy",
      "critical": true
    }
  ],
  "circuitBreakers": {},
  "cacheStats": {}
}
```

### 2. Test Metrics Endpoint

```powershell
curl http://localhost:3030/api/metrics
```

**Expected Response:**

```json
{
  "timestamp": "2025-11-24T10:00:00.000Z",
  "operations": [],
  "circuitBreakers": {},
  "caches": {},
  "metrics": []
}
```

### 3. Monitor in Real-Time

Create a simple monitoring script:

```powershell
# monitor-resilience.ps1
while ($true) {
  Write-Host "`n=== Resilience Metrics ===" -ForegroundColor Green
  $response = Invoke-RestMethod -Uri "http://localhost:3030/api/metrics"

  Write-Host "`nCircuit Breakers:" -ForegroundColor Yellow
  $response.circuitBreakers | ConvertTo-Json

  Write-Host "`nCache Stats:" -ForegroundColor Yellow
  $response.cacheStats | ConvertTo-Json

  Start-Sleep -Seconds 5
}
```

## 🧪 Testing Resilience

### 1. Test Circuit Breaker

```typescript
// Make multiple failing requests to open circuit
for (let i = 0; i < 6; i++) {
  try {
    await fetch("http://localhost:3030/api/failing-endpoint");
  } catch (error) {
    console.log(`Attempt ${i + 1} failed`);
  }
}

// Check circuit breaker state
const metrics = await fetch("http://localhost:3030/api/metrics");
const data = await metrics.json();
console.log("Circuit Breakers:", data.circuitBreakers);
```

### 2. Test Retry Logic

```typescript
// Simulate temporary failure
let attempts = 0;
const result = await executeResilient(
  async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error("Temporary failure");
    }
    return "success";
  },
  {
    retry: { maxAttempts: 3 },
    operationName: "test-retry",
  },
);

console.log("Succeeded after", attempts, "attempts");
```

### 3. Test Caching

```typescript
// First request - cache miss
const start1 = Date.now();
const result1 = await fetch("http://localhost:3030/api/cached-endpoint");
console.log("First request:", Date.now() - start1, "ms");

// Second request - cache hit
const start2 = Date.now();
const result2 = await fetch("http://localhost:3030/api/cached-endpoint");
console.log("Second request (cached):", Date.now() - start2, "ms");

// Check cache stats
const metrics = await fetch("http://localhost:3030/api/metrics");
const data = await metrics.json();
console.log("Cache Stats:", data.cacheStats);
```

## 🎯 Configuration Examples

### Critical Operation (Payment)

```typescript
await executeResilient(async () => processPayment(data), {
  criticality: "critical",
  operationName: "process-payment",
  // Automatically: 3s timeout, no retry, no cache
});
```

### Normal Operation (User Data)

```typescript
await executeResilient(async () => fetchUserProfile(userId), {
  criticality: "normal",
  operationName: "fetch-user-profile",
  cache: { ttl: 30000 },
  fallback: async () => cachedProfile,
});
```

### Background Operation (Analytics)

```typescript
await executeResilient(async () => sendAnalytics(events), {
  criticality: "background",
  operationName: "send-analytics",
  fallback: async () => {
    logger.warn("Analytics service unavailable");
    return { queued: true };
  },
});
```

## 🔍 Debugging

### Enable Debug Logging

```typescript
// Set environment variable
process.env.LOG_LEVEL = "debug";

// Or in code
const logger = new StructuredLogger("my-service");
logger.debug("Debug message", { extra: "data" });
```

### View Detailed Metrics

```typescript
const executor = getResilientExecutor();

// Get stats for specific operation
const stats = executor.getOperationStats("operation-name");
console.log("P50:", stats.summary?.quantiles.get(0.5));
console.log("P95:", stats.summary?.quantiles.get(0.95));
console.log("P99:", stats.summary?.quantiles.get(0.99));

// Get all circuit breaker states
const cbStates = executor.getCircuitBreakerStates();
cbStates.forEach((state, name) => {
  console.log(`${name}:`, state);
});
```

## 📝 Environment Variables

```env
# Optional environment variables

# Logging
LOG_LEVEL=info              # debug | info | warn | error | fatal
LOG_FORMAT=json             # json | pretty

# Service URLs
MESSAGING_SERVICE_URL=http://localhost:3010
PAYMENT_SERVICE_URL=http://localhost:3020

# Resilience Configuration (optional - has sensible defaults)
TIMEOUT_CRITICAL=3000       # 3s
TIMEOUT_NORMAL=10000        # 10s
TIMEOUT_BACKGROUND=30000    # 30s

RETRY_MAX_ATTEMPTS=3
RETRY_INITIAL_DELAY=100
RETRY_MAX_DELAY=10000

CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000

CACHE_TTL=60000
CACHE_MAX_SIZE=1000
```

## 🚀 Deployment Checklist

- [ ] Install dependencies: `pnpm install`
- [ ] Build packages: `pnpm build`
- [ ] Test health endpoint: `/api/health`
- [ ] Test metrics endpoint: `/api/metrics`
- [ ] Configure environment variables
- [ ] Test circuit breaker behavior
- [ ] Verify correlation IDs in logs
- [ ] Set up monitoring dashboards
- [ ] Configure alerting on circuit breaker opens
- [ ] Test fallback mechanisms
- [ ] Verify cache hit rates

## 📚 Additional Resources

- **Package README**: `packages/resilience/README.md`
- **Implementation Guide**: `RESILIENCE_IMPLEMENTATION.md`
- **Quick Reference**: `RESILIENCE_QUICK_REFERENCE.md`
- **Service Integration**: `RESILIENCE_SERVICE_INTEGRATION.md`
- **Summary**: `RESILIENCE_SUMMARY.md`

## 🆘 Troubleshooting

### Package Not Found

```powershell
# Reinstall dependencies
pnpm install

# Build the package
cd packages\resilience
pnpm build
```

### Import Errors

```typescript
// Make sure you're importing from the right location

// For Next.js API routes:
import { executeResilient } from "@/app/lib/resilient-api";

// For other services:
import { ResilientExecutor } from "@build/resilience";
```

### Circuit Breaker Not Working

```typescript
// Check that you're using the same operation name
const result1 = await executor.execute(op, { operationName: "test" });
const result2 = await executor.execute(op, { operationName: "test" }); // Same name!

// Check circuit breaker state
const state = executor.getCircuitBreakerStates().get("test");
console.log("Circuit state:", state);
```

### Cache Not Working

```typescript
// Ensure cache is enabled
await executeResilient(async () => operation(), {
  cache: { ttl: 60000 }, // Must specify cache config
  operationName: "my-op", // Must specify operation name
});

// Check cache stats
const stats = executor.getCacheStats();
console.log("Cache stats:", stats);
```

## ✅ Next Steps

1. **Test Your Setup**: Make some API calls and check `/api/health` and `/api/metrics`
2. **Apply to Routes**: Update your API routes to use resilience patterns
3. **Monitor**: Set up dashboards to monitor circuit breakers and metrics
4. **Tune**: Adjust configurations based on observed behavior
5. **Expand**: Apply to other services (messaging, payment, etc.)

---

**Installation Complete!** 🎉

You now have a fully functional resilience framework with:

- ⏱️ Timeouts
- 🔄 Retries
- 🔌 Circuit Breakers
- 💾 Caching
- 🎯 Fallbacks
- 📊 Metrics
- 📝 Logging

For questions or issues, refer to the documentation in the `packages/resilience` directory.
