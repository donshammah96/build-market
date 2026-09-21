import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/app/lib/infrastructure/env";
import { edgeEnv } from "@/app/lib/infrastructure/edge-env";
import {
  ensureValidInternalSecret,
  timingSafeEqualStrings,
} from "@/app/lib/security/internal-secret";

export const dynamic = "force-dynamic";

/**
 * GET /api/health/auth-parity
 * ============================================================================
 * Diagnostic Parity Probe (P-1)
 *
 * Verifies whether the Edge runtime (middleware.ts) and Node runtime (route handlers)
 * agree on session authentication for the current request's cookie jar.
 *
 * Security:
 * - Hard gate: only accessible when DD_ENV === "staging" or in non-production.
 * - Requires valid x-internal-secret.
 * - Requires valid x-staging-secret if stagingAuth is enabled.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const isStaging =
    edgeEnv.ddEnv === "staging" ||
    env.otel?.ddEnv === "staging" ||
    edgeEnv.isDev ||
    env.isDev ||
    env.isTest;

  if (!isStaging) {
    return new NextResponse(null, { status: 404 });
  }

  // Verify internal secret
  const internalSecret = request.headers.get("x-internal-secret");
  const internalSecretError = ensureValidInternalSecret(internalSecret);
  if (internalSecretError) {
    return internalSecretError;
  }

  // Verify staging secret if perimeter auth is active
  const isStagingAuthEnabled =
    edgeEnv.isStagingAuthEnabled || Boolean(env.stagingAuth?.isEnabled);
  if (isStagingAuthEnabled) {
    const expectedStagingSecret =
      edgeEnv.stagingAuthSecret || env.stagingAuth?.secret;
    const stagingSecret = request.headers.get("x-staging-secret");
    if (
      !stagingSecret ||
      !expectedStagingSecret ||
      !timingSafeEqualStrings(stagingSecret, expectedStagingSecret)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Edge perspective (forwarded by middleware via request header x-bm-edge-user)
  const edgeUserId = request.headers.get("x-bm-edge-user")?.trim() || null;

  // Node perspective (evaluated directly by Clerk Node runtime)
  let nodeUserId: string | null = null;
  try {
    const session = await auth();
    nodeUserId = session.userId ?? null;
  } catch (err) {
    console.error("[auth-parity] Node auth() evaluation failed:", err);
  }

  const parity = edgeUserId === nodeUserId;

  return NextResponse.json({
    edgeUserId,
    nodeUserId,
    parity,
    timestamp: new Date().toISOString(),
  });
}
