import { NextResponse } from "next/server";
import { edgeEnv } from "@/app/lib/infrastructure/edge-env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BOOT_TIME = Date.now();

/**
 * GET /api/healthz
 *
 * Lightweight process liveness endpoint.
 *
 * Checks only that the Node process is alive and able to accept/serve HTTP
 * requests without touching the database, Redis, Clerk, or message queues.
 * Used for container liveness probes, deployment promotion verification, and CI smoke checks.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: edgeEnv.appVersion,
      buildSha: edgeEnv.buildSha,
      deploymentId: edgeEnv.deploymentId,
      bootedAt: new Date(BOOT_TIME).toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    },
  );
}
