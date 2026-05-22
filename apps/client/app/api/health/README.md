# Health Check API

Production-grade, three-tier health check system following the Kubernetes probe model and cloud-native observability best practices.

## Architecture

```
/api/health          ← Deep health check (comprehensive audit)
/api/health?shallow  ← Lightweight probe (database only)
/api/health/live     ← Liveness probe (process alive?)
/api/health/ready    ← Readiness probe (ready for traffic?)
```

### Probe Separation Strategy

| Probe                  | Purpose                | Checks              | Failure Action           |
| ---------------------- | ---------------------- | ------------------- | ------------------------ |
| `/live`                | Is the process alive?  | None (HTTP only)    | **Restart** container    |
| `/ready`               | Can it accept traffic? | Database (critical) | **Stop routing** traffic |
| `/health`              | Full dependency audit  | All 6 dependencies  | Alert + investigate      |
| `/health?shallow=true` | Fast DB-only check     | Database            | Alert                    |

This separation follows the [Kubernetes probe model](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) and prevents cascading restarts when non-critical dependencies are temporarily unavailable.

---

## Endpoints

### GET `/api/health/live`

**Liveness probe.** Returns `200` if the Node.js process is alive and can serve HTTP. No dependency checks — instant response.

**Authentication:** None  
**Rate Limit:** None

**Response:**

```json
{
  "status": "alive",
  "timestamp": "2026-02-15T12:00:00.000Z"
}
```

| HTTP Status | Meaning       |
| ----------- | ------------- |
| `200`       | Process alive |

**Usage:**

```yaml
# Kubernetes
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 3500
  initialDelaySeconds: 10
  periodSeconds: 15
  failureThreshold: 3
```

---

### GET `/api/health/ready`

**Readiness probe.** Verifies the instance can handle requests by checking critical dependencies (database). Includes a 3-second per-check timeout.

**Authentication:** None  
**Rate Limit:** None  
**Performance Target:** < 1 second

**Success Response (200):**

```json
{
  "status": "ready",
  "timestamp": "2026-02-15T12:00:00.000Z",
  "latencyMs": 12
}
```

**Failure Response (503):**

```json
{
  "status": "not_ready",
  "timestamp": "2026-02-15T12:00:00.000Z",
  "latencyMs": 3001,
  "reason": "Database readiness check timed out"
}
```

| HTTP Status | Meaning                  |
| ----------- | ------------------------ |
| `200`       | Ready for traffic        |
| `503`       | Not ready — stop routing |

**Usage:**

```yaml
# Kubernetes
readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3500
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 2
```

---

### GET `/api/health`

**Deep health check.** Comprehensive dependency audit with per-check timeouts, latency measurement, system metrics, and resilience layer introspection.

**Authentication:** None  
**Rate Limit:** 60 requests/minute per IP

**Query Parameters:**

| Parameter | Type      | Default | Description                                              |
| --------- | --------- | ------- | -------------------------------------------------------- |
| `shallow` | `boolean` | `false` | If `true`, only checks database connectivity (fast path) |

**Headers:**

| Header             | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `X-Correlation-ID` | Correlation ID for request tracing (also in response) |
| `Cache-Control`    | Always `no-store, must-revalidate`                    |

#### Shallow Mode

`GET /api/health?shallow=true`

Lightweight database-only check. Returns minimal payload — suitable for high-frequency monitoring or load balancer checks that need more than liveness but less than a full audit.

**Response (200):**

```json
{
  "status": "healthy",
  "timestamp": "2026-02-15T12:00:00.000Z"
}
```

#### Deep Mode (default)

`GET /api/health`

**Response (200 — all healthy):**

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "production",
  "uptime": {
    "seconds": 86542,
    "human": "1d 0h 2m 22s"
  },
  "timestamp": "2026-02-15T12:00:00.000Z",
  "correlationId": "abc-123-def",
  "dependencies": [
    {
      "name": "database",
      "status": "healthy",
      "latencyMs": 8,
      "critical": true
    },
    {
      "name": "database-write",
      "status": "healthy",
      "latencyMs": 5,
      "critical": true
    },
    {
      "name": "redis",
      "status": "healthy",
      "latencyMs": 3,
      "critical": false
    },
    {
      "name": "messaging",
      "status": "healthy",
      "latencyMs": 12,
      "critical": false
    },
    {
      "name": "notifications",
      "status": "healthy",
      "latencyMs": 9,
      "critical": false
    },
    {
      "name": "auth-clerk",
      "status": "healthy",
      "latencyMs": 1,
      "critical": false
    }
  ],
  "system": {
    "memoryUsageMB": 256,
    "heapUsedMB": 128,
    "heapTotalMB": 192,
    "heapUtilization": 67
  },
  "circuitBreakers": {
    "health:database": "closed",
    "health:redis": "closed"
  },
  "caches": {
    "default": { "hits": 1204, "misses": 82 }
  }
}
```

**Response (207 — degraded):**

```json
{
  "status": "degraded",
  "dependencies": [
    {
      "name": "database",
      "status": "healthy",
      "latencyMs": 8,
      "critical": true
    },
    {
      "name": "redis",
      "status": "unhealthy",
      "latencyMs": 3001,
      "critical": false,
      "message": "redis health check timed out after 3000ms"
    }
  ]
}
```

**Response (503 — unhealthy):**

```json
{
  "status": "unhealthy",
  "dependencies": [
    {
      "name": "database",
      "status": "unhealthy",
      "latencyMs": 5002,
      "critical": true,
      "message": "database health check timed out after 5000ms"
    }
  ]
}
```

---

## Dependency Matrix

| Name             | Critical | Timeout | What It Checks                             | Failure Impact                                       |
| ---------------- | -------- | ------- | ------------------------------------------ | ---------------------------------------------------- |
| `database`       | **Yes**  | 5s      | `SELECT 1 AS ok` — basic connectivity      | All data operations fail                             |
| `database-write` | **Yes**  | 5s      | `SELECT current_timestamp` — write path    | Mutations fail (read replicas may still work)        |
| `redis`          | No       | 3s      | Rate limiter subsystem responsiveness      | In-memory fallback activates; rate limiting degraded |
| `messaging`      | No       | 3s      | `MessageThread` table reachable via Prisma | Messaging features unavailable                       |
| `notifications`  | No       | 3s      | `Notification` table reachable via Prisma  | Notification features unavailable                    |
| `auth-clerk`     | No       | 3s      | Clerk env var configuration validation     | Auth misconfiguration; no outbound call              |

### Why Clerk Is Config-Only

The `auth-clerk` check validates that environment variables (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) are present and correctly formatted. It intentionally does **not** make an outbound network call to Clerk's API because:

1. External calls in health checks introduce latency and create false negatives from transient network issues.
2. Clerk connectivity is implicitly validated by the auth middleware on every authenticated request.
3. A Clerk outage would surface through auth failures, not health check flapping.

---

## HTTP Status Code Semantics

| Code  | Status         | Meaning                        | Orchestrator Action          |
| ----- | -------------- | ------------------------------ | ---------------------------- |
| `200` | `healthy`      | All dependencies up            | Route traffic normally       |
| `207` | `degraded`     | Non-critical dependency down   | Route traffic, trigger alert |
| `429` | `rate_limited` | Too many health check requests | Retry after backoff          |
| `503` | `unhealthy`    | Critical dependency down       | **Stop routing traffic**     |

---

## Response Schema

### `HealthResponse`

| Field                    | Type                                     | Description                                        |
| ------------------------ | ---------------------------------------- | -------------------------------------------------- |
| `status`                 | `"healthy" \| "degraded" \| "unhealthy"` | Overall service status                             |
| `version`                | `string`                                 | Application version from `npm_package_version`     |
| `environment`            | `string`                                 | `NODE_ENV` value                                   |
| `uptime.seconds`         | `number`                                 | Process uptime in seconds                          |
| `uptime.human`           | `string`                                 | Human-readable uptime (`2d 5h 13m 42s`)            |
| `timestamp`              | `string`                                 | ISO 8601 timestamp                                 |
| `correlationId`          | `string \| null`                         | Request correlation ID for tracing                 |
| `dependencies[]`         | `DependencyResult[]`                     | Per-dependency check results                       |
| `system.memoryUsageMB`   | `number`                                 | RSS memory in MB                                   |
| `system.heapUsedMB`      | `number`                                 | V8 heap used in MB                                 |
| `system.heapTotalMB`     | `number`                                 | V8 heap total in MB                                |
| `system.heapUtilization` | `number`                                 | Heap used / heap total as percentage               |
| `circuitBreakers`        | `Record<string, unknown>`                | Circuit breaker states from `ResilientExecutor`    |
| `caches`                 | `Record<string, unknown>`                | Cache hit/miss statistics from `ResilientExecutor` |

### `DependencyResult`

| Field       | Type                       | Description                     |
| ----------- | -------------------------- | ------------------------------- |
| `name`      | `string`                   | Dependency identifier           |
| `status`    | `"healthy" \| "unhealthy"` | Check result                    |
| `latencyMs` | `number`                   | Check duration in milliseconds  |
| `critical`  | `boolean`                  | Whether failure causes `503`    |
| `message`   | `string?`                  | Error message (only on failure) |

---

## Cross-Cutting Concerns

| Concern                      | Implementation                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| **Rate Limiting**            | 60 req/min per IP on `/api/health` (scoped key `health:{identifier}`)                           |
| **Correlation ID**           | Propagated via `X-Correlation-ID` header on `/health` and `/ready`                              |
| **Caching**                  | `Cache-Control: no-store` on all probes — never served from CDN                                 |
| **Timeouts**                 | Per-dependency `Promise.race` timeout (3–5s) prevents one slow check from stalling the response |
| **Parallelism**              | All dependency checks execute via `Promise.all` for minimum total latency                       |
| **Structured Logging**       | Unhealthy dependencies logged with correlation ID, dependency name, and error message           |
| **Resilience Introspection** | Circuit breaker states and cache statistics included in deep check                              |

---

## Infrastructure Integration

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: build-market-client
          livenessProbe:
            httpGet:
              path: /api/health/live
              port: 3500
            initialDelaySeconds: 10
            periodSeconds: 15
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: 3500
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 2
          startupProbe:
            httpGet:
              path: /api/health/ready
              port: 3500
            initialDelaySeconds: 3
            periodSeconds: 5
            failureThreshold: 12
```

### AWS ALB Target Group

```
Health check path:     /api/health/ready
Healthy threshold:     2
Unhealthy threshold:   3
Timeout:               5 seconds
Interval:              15 seconds
Success codes:         200
```

### Docker Compose

```yaml
services:
  client:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health/ready"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
```

### Uptime Monitoring (Datadog, Pingdom, etc.)

```
URL:       https://app.buildmarket.co.ke/api/health
Method:    GET
Interval:  60 seconds
Alert on:  HTTP status != 200
```

For deeper alerting, parse the JSON body and alert when `status` is `"degraded"` or `"unhealthy"`, or when any `dependency.latencyMs` exceeds your SLA threshold.

---

## Design Decisions

1. **Three-tier separation** — Liveness, readiness, and deep checks serve fundamentally different purposes. Combining them leads to cascading restarts when a non-critical service is temporarily down.

2. **No auth on health probes** — Health checks must be accessible to load balancers, orchestrators, and monitoring systems that cannot authenticate. Sensitive operational data (circuit breakers, cache stats) is acceptable because it contains no user data.

3. **Per-check timeouts via `Promise.race`** — A single slow dependency (e.g., database with network issues) must not cause the entire health check to hang. Each dependency has its own timeout.

4. **Critical vs non-critical classification** — Only `database` and `database-write` are critical. All other dependencies have graceful degradation paths (in-memory rate limiting, feature toggles).

5. **No outbound network calls** — Health checks should be self-contained within the process boundary. External API calls (to Clerk, S3, etc.) introduce latency and false negatives from transient network issues.

6. **Rate limiting on deep check only** — `/live` and `/ready` are unthrottled because orchestrators need reliable access. The deep check is rate-limited because it's more expensive and typically consumed by dashboards.

7. **`Cache-Control: no-store`** — Health check responses must never be cached by CDNs or proxies. Stale health data defeats the purpose of the check.

8. **Boot time tracking** — Uptime is measured from module load time (`BOOT_TIME`), not process start time, giving an accurate view of how long the application has been serving traffic.
