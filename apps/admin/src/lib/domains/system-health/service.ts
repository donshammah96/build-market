// ============================================================================
// System Health Domain — Service
// ============================================================================
// Runs parallel infrastructure probes and aggregates results.
//
// ADR-ADMIN-002 compliance notes:
//   - Services do not log (logging belongs in adapter layers).
//   - No actor/authorization required — this is a technical diagnostic probe.
//     Auth is enforced at the dashboard layout level (layout.tsx). The
//     health status of infrastructure services is not per-role sensitive data.
//   - No Prisma repository abstraction for health probes — a raw $queryRaw
//     ping is the correct primitive here; wrapping it in a repository method
//     would add indirection with no benefit.
// ============================================================================

import { prisma } from "@build/db";
import { isRedisHealthy } from "@build/redis";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import type {
  ServiceStatus,
  SystemHealthEntry,
  SystemHealthSummary,
} from "./contracts";

// ── Latency threshold above which a "successful" probe is classified as
// "degraded" rather than "healthy" (500 ms for serverless cold starts).
const DEGRADED_LATENCY_MS = 500;

// ── Internal probe helpers ────────────────────────────────────────────────

/**
 * Probe the PostgreSQL database with a trivial SELECT 1.
 * Uses Prisma's $queryRaw so the probe goes through the same PgAdapter pool
 * as real application queries — it is a true end-to-end connectivity check.
 */
async function probeDatabase(): Promise<SystemHealthEntry> {
  const t0 = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - t0);
    return {
      id: "database",
      name: "Database",
      description: "PostgreSQL · Neon / Supavisor",
      status: latencyMs > DEGRADED_LATENCY_MS ? "degraded" : "healthy",
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id: "database",
      name: "Database",
      description: "PostgreSQL · Neon / Supavisor",
      status: "unhealthy",
      latencyMs: Math.round(performance.now() - t0),
      checkedAt: new Date().toISOString(),
      detail: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/**
 * Probe Upstash Redis via its serverless REST endpoint.
 * Uses the isRedisHealthy() helper from @build/redis which calls PING and
 * expects a PONG response — safe for serverless / Next.js route contexts.
 *
 * If Upstash credentials are absent in the environment (e.g. a local-only
 * dev environment without Redis), the probe is skipped and status is "unknown"
 * rather than "unhealthy", avoiding false-positive alerts.
 */
async function probeRedis(): Promise<SystemHealthEntry> {
  const url = adminEnvConfig.UPSTASH_REDIS_REST_URL;
  const token = adminEnvConfig.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return {
      id: "cache",
      name: "Cache",
      description: "Upstash Redis",
      status: "unknown",
      checkedAt: new Date().toISOString(),
      detail: "Credentials not configured",
    };
  }

  const t0 = performance.now();
  try {
    const healthy = await isRedisHealthy();
    const latencyMs = Math.round(performance.now() - t0);
    return {
      id: "cache",
      name: "Cache",
      description: "Upstash Redis",
      status: healthy
        ? latencyMs > DEGRADED_LATENCY_MS
          ? "degraded"
          : "healthy"
        : "unhealthy",
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id: "cache",
      name: "Cache",
      description: "Upstash Redis",
      status: "unhealthy",
      latencyMs: Math.round(performance.now() - t0),
      checkedAt: new Date().toISOString(),
      detail: error instanceof Error ? error.message : "Ping failed",
    };
  }
}

/**
 * Check NATS message-bus configuration presence.
 *
 * We do NOT attempt a live TCP connection here — opening a NATS TCP socket
 * from a serverless Next.js RSC on every page render is expensive, error-prone
 * in ephemeral environments, and unnecessary for a dashboard status widget.
 * The presence of a configured URL is a sufficient signal for this context.
 */
function probeNats(): SystemHealthEntry {
  const url = adminEnvConfig.NATS_URL;
  if (url) {
    return {
      id: "message-bus",
      name: "Message Bus",
      description: "NATS JetStream",
      status: "healthy",
      checkedAt: new Date().toISOString(),
    };
  }
  return {
    id: "message-bus",
    name: "Message Bus",
    description: "NATS JetStream",
    status: "unknown",
    checkedAt: new Date().toISOString(),
    detail: "NATS_URL not configured",
  };
}

/**
 * Return Clerk auth service status.
 *
 * If this page is rendered, the admin is already authenticated — the layout
 * enforces Clerk auth before rendering children. A live Clerk API call would
 * add latency and consume API quota for no additional signal, so we derive
 * "healthy" implicitly from the authentication precondition.
 */
function probeAuth(): SystemHealthEntry {
  return {
    id: "auth",
    name: "Auth Service",
    description: "Clerk",
    status: "healthy",
    checkedAt: new Date().toISOString(),
  };
}

// ── Status aggregation ────────────────────────────────────────────────────

/**
 * Derive the worst-case aggregate status from a set of individual checks.
 * Priority order: unhealthy > degraded > unknown > healthy
 */
function deriveOverallStatus(checks: SystemHealthEntry[]): ServiceStatus {
  const statuses = new Set(checks.map((c) => c.status));
  if (statuses.has("unhealthy")) return "unhealthy";
  if (statuses.has("degraded")) return "degraded";
  if (statuses.has("unknown") && !statuses.has("healthy")) return "unknown";
  if (statuses.has("unknown")) return "degraded"; // some healthy, some unknown
  return "healthy";
}

// ── Public service ────────────────────────────────────────────────────────

export const systemHealthService = {
  /**
   * Runs all infrastructure probes in parallel and returns an aggregated
   * SystemHealthSummary.
   *
   * Uses Promise.allSettled so that a single probe throwing unexpectedly
   * (rather than returning an unhealthy result) does not abort the others.
   */
  async getSystemHealth(): Promise<SystemHealthSummary> {
    // Run async probes concurrently. Sync probes (NATS, Auth) are called
    // directly — no point wrapping them in allSettled.
    const [dbSettled, redisSettled] = await Promise.allSettled([
      probeDatabase(),
      probeRedis(),
    ]);

    const toEntry = (
      settled: PromiseSettledResult<SystemHealthEntry>,
      fallback: Pick<SystemHealthEntry, "id" | "name" | "description">,
    ): SystemHealthEntry =>
      settled.status === "fulfilled"
        ? settled.value
        : {
            ...fallback,
            status: "unhealthy",
            checkedAt: new Date().toISOString(),
            detail: "Probe threw an unexpected error",
          };

    const checks: SystemHealthEntry[] = [
      toEntry(dbSettled, {
        id: "database",
        name: "Database",
        description: "PostgreSQL · Neon / Supavisor",
      }),
      toEntry(redisSettled, {
        id: "cache",
        name: "Cache",
        description: "Upstash Redis",
      }),
      probeNats(),
      probeAuth(),
    ];

    return {
      overallStatus: deriveOverallStatus(checks),
      checks,
      checkedAt: new Date().toISOString(),
    };
  },
};
