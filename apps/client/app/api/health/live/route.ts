import { NextResponse } from "next/server";

/**
 * GET /api/health/live
 *
 * Kubernetes-style LIVENESS probe.
 *
 * Answers: "Is the process alive and able to serve HTTP?"
 * - Does NOT check external dependencies
 * - Should NEVER return 503 unless the process is truly broken
 * - If this fails, the orchestrator should RESTART the container
 *
 * Designed for:
 * - Kubernetes livenessProbe
 * - AWS ALB/NLB health checks on the target group
 * - Any system that needs a fast "are you alive?" check
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: "alive",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
