import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/healthz
 *
 * Lightweight process liveness endpoint.
 *
 * Checks only that the Node process is alive and able to accept/serve HTTP
 * requests without touching the database, Redis, Clerk, or message queues.
 * Used for container liveness probes and CI boot smoke checks.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    },
  );
}
