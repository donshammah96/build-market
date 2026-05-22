import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";

/**
 * GET /api/health/ready
 *
 * Kubernetes-style READINESS probe.
 *
 * Answers: "Is this instance ready to accept traffic?"
 * - Checks ONLY critical dependencies (database)
 * - If this fails, the orchestrator should STOP routing traffic to this instance
 *   but should NOT restart it (the dependency may recover on its own)
 *
 * Designed for:
 * - Kubernetes readinessProbe
 * - AWS ALB health checks for traffic routing decisions
 * - Rolling deployment gates
 * - Service mesh traffic management
 *
 * Performance target: < 1 second response time
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(request);
  const start = performance.now();

  try {
    // Only check critical path: database connectivity
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Database readiness check timed out")),
          3000,
        ),
      ),
    ]);

    const latencyMs = Math.round(performance.now() - start);

    return NextResponse.json(
      {
        status: "ready",
        timestamp: new Date().toISOString(),
        latencyMs,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Correlation-ID": correlationId || "",
        },
      },
    );
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    const message =
      error instanceof Error ? error.message : "Readiness check failed";

    getClientLogger().error("Readiness probe failed", new Error(message), {
      correlationId,
      latencyMs,
    });

    return NextResponse.json(
      {
        status: "not_ready",
        timestamp: new Date().toISOString(),
        latencyMs,
        reason: message,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Correlation-ID": correlationId || "",
        },
      },
    );
  }
}
