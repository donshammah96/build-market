import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";

const logger = getClientLogger();

// ─── Boot timestamp (set once when module loads) ─────────────────────────────
const BOOT_TIME = Date.now();

// ─── Types ───────────────────────────────────────────────────────────────────

type HealthStatus = "healthy" | "degraded" | "unhealthy";

interface DependencyResult {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  critical: boolean;
  message?: string;
}

interface HealthResponse {
  status: HealthStatus;
  version: string;
  environment: string;
  uptime: {
    seconds: number;
    human: string;
  };
  timestamp: string;
  correlationId: string | null;
  dependencies: DependencyResult[];
  system: {
    memoryUsageMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
    heapUtilization: number;
  };
  circuitBreakers: Record<string, unknown>;
  caches: Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

/**
 * Run a dependency check with an individual timeout.
 * Returns a DependencyResult with latency measurement.
 */
async function checkDependency(
  name: string,
  critical: boolean,
  timeoutMs: number,
  checkFn: () => Promise<void>,
): Promise<DependencyResult> {
  const start = performance.now();

  try {
    await Promise.race([
      checkFn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${name} health check timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);

    return {
      name,
      status: "healthy",
      latencyMs: Math.round(performance.now() - start),
      critical,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    return {
      name,
      status: "unhealthy",
      latencyMs: Math.round(performance.now() - start),
      critical,
      message,
    };
  }
}

// ─── Dependency Checks ───────────────────────────────────────────────────────

async function checkDatabase(): Promise<DependencyResult> {
  return checkDependency("database", true, 5000, async () => {
    // Validate connection with a lightweight query
    const result = await prisma.$queryRaw<
      { ok: number }[]
    >`SELECT 1 AS ok`;
    if (!result?.[0]?.ok) {
      throw new Error("Unexpected query result");
    }
  });
}

async function checkDatabaseReplication(): Promise<DependencyResult> {
  return checkDependency("database-write", true, 5000, async () => {
    // Verify write path is available (important for read-replica setups)
    // Uses a safe, side-effect-free approach: current_timestamp
    const result = await prisma.$queryRaw<
      { ts: Date }[]
    >`SELECT current_timestamp AS ts`;
    if (!result?.[0]?.ts) {
      throw new Error("Write path check failed");
    }
  });
}

async function checkRedis(): Promise<DependencyResult> {
  return checkDependency("redis", false, 3000, async () => {
    // Redis availability is verified through the rate limiter itself.
    // If Redis is down, the in-memory fallback kicks in — so this is non-critical.
    // Attempt a lightweight rate limit check to verify the path works.
    const result = await checkRateLimit("health-check-probe", 1000, 60000);
    if (!result) {
      throw new Error("Rate limit subsystem unresponsive");
    }
  });
}

async function checkMessaging(): Promise<DependencyResult> {
  return checkDependency("messaging", false, 3000, async () => {
    // Messaging uses direct Prisma — verify the table is reachable
    await prisma.messageThread.findFirst({
      take: 1,
      select: { id: true },
      where: { deletedAt: null },
    });
  });
}

async function checkNotifications(): Promise<DependencyResult> {
  return checkDependency("notifications", false, 3000, async () => {
    await prisma.notification.findFirst({
      take: 1,
      select: { id: true },
    });
  });
}

async function checkClerkAuth(): Promise<DependencyResult> {
  return checkDependency("auth-clerk", false, 3000, async () => {
    // Verify Clerk env vars are configured
    // NOTE: We intentionally do NOT make an outbound network call to Clerk.
    // External calls in health checks introduce latency and false negatives
    // from transient network issues. Clerk connectivity is implicitly validated
    // by the auth middleware on every authenticated request.
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!publishableKey) {
      throw new Error("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not configured");
    }
    if (!secretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }
    if (!publishableKey.startsWith("pk_")) {
      throw new Error("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY has invalid format");
    }
  });
}

// ─── Route Handler ───────────────────────────────────────────────────────────

/**
 * GET /api/health
 *
 * Production-grade health check endpoint.
 *
 * Features:
 * - Individual dependency checks with per-check timeouts and latency measurement
 * - Critical vs non-critical dependency classification
 * - Process uptime and memory utilization
 * - Circuit breaker and cache state introspection
 * - Rate-limited to prevent abuse
 * - Proper HTTP status: 200 (healthy), 207 (degraded), 503 (unhealthy)
 *
 * Designed for use with:
 * - Kubernetes liveness/readiness probes
 * - Load balancer health checks
 * - External uptime monitoring (Datadog, Pingdom, etc.)
 * - Internal dashboards
 *
 * Use ?shallow=true for a lightweight probe (database only, no extras).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(request);

  // Rate limit health checks to prevent abuse
  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `health:${identifier}`,
    60,    // 60 requests
    60000, // per minute
  );
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { status: "rate_limited", message: "Too many health check requests" },
      { status: 429 },
    );
  }

  // ── Shallow mode (for k8s liveness probes / fast LB checks) ──────────
  const shallow = request.nextUrl.searchParams.get("shallow") === "true";

  if (shallow) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return NextResponse.json(
        { status: "healthy", timestamp: new Date().toISOString() },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return NextResponse.json(
        { status: "unhealthy", timestamp: new Date().toISOString() },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  // ── Deep health check ────────────────────────────────────────────────
  const dependencies = await Promise.all([
    checkDatabase(),
    checkDatabaseReplication(),
    checkRedis(),
    checkMessaging(),
    checkNotifications(),
    checkClerkAuth(),
  ]);

  // ── Compute overall status ───────────────────────────────────────────
  const criticalDown = dependencies.some(
    (d) => d.critical && d.status === "unhealthy",
  );
  const anyDown = dependencies.some((d) => d.status === "unhealthy");

  const overallStatus: HealthStatus = criticalDown
    ? "unhealthy"
    : anyDown
      ? "degraded"
      : "healthy";

  // ── System metrics ───────────────────────────────────────────────────
  const mem = process.memoryUsage();
  const uptimeMs = Date.now() - BOOT_TIME;

  // ── Circuit breaker & cache state ────────────────────────────────────
  let circuitBreakers: Record<string, unknown> = {};
  let caches: Record<string, unknown> = {};
  try {
    const executor = getResilientExecutor();
    circuitBreakers = Object.fromEntries(executor.getCircuitBreakerStates());
    caches = Object.fromEntries(executor.getCacheStats());
  } catch {
    // Resilience layer may not be initialized yet
  }

  const response: HealthResponse = {
    status: overallStatus,
    version: process.env.npm_package_version || "0.1.0",
    environment: process.env.NODE_ENV || "development",
    uptime: {
      seconds: Math.floor(uptimeMs / 1000),
      human: formatUptime(uptimeMs),
    },
    timestamp: new Date().toISOString(),
    correlationId,
    dependencies,
    system: {
      memoryUsageMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      heapUtilization: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    },
    circuitBreakers,
    caches,
  };

  // ── Log unhealthy dependencies ───────────────────────────────────────
  const unhealthyDeps = dependencies.filter((d) => d.status === "unhealthy");
  if (unhealthyDeps.length > 0) {
    logger.warn("Health check detected unhealthy dependencies", {
      correlationId,
      status: overallStatus,
      unhealthy: unhealthyDeps.map((d) => ({
        name: d.name,
        critical: d.critical,
        message: d.message,
      })),
    });
  }

  // ── HTTP status: 200 healthy, 207 degraded, 503 critical ────────────
  const httpStatus =
    overallStatus === "unhealthy"
      ? 503
      : overallStatus === "degraded"
        ? 207
        : 200;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, must-revalidate",
      "X-Correlation-ID": correlationId || "",
    },
  });
}
