import { NextRequest, NextResponse } from "next/server";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { ensureValidInternalSecret } from "@/app/lib/security/internal-secret";
import { getAuthSloMetricsSummary } from "@/app/lib/auth/telemetry-metrics";

/**
 * GET /api/internal/telemetry-metrics
 *
 * Internal endpoint to query the aggregated Auth SLO metrics summary:
 * - Clerk sync lag (total events, total lag, average lag, max lag)
 * - Webhook replay rejects (total rejects, breakdown by reason)
 * - Middleware fallbacks (total fallbacks, breakdown by type:path)
 *
 * Security: Protected by `x-internal-secret` header validation.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(req);

  // Access control
  const secretError = ensureValidInternalSecret(
    req.headers.get("x-internal-secret"),
  );
  if (secretError) {
    getClientLogger().warn(
      "Internal telemetry-metrics forbidden: invalid secret",
      {
        correlationId,
      },
    );
    return secretError;
  }

  // Rate limit guard
  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `internal-telemetry-metrics:${identifier}`,
    120,
    60_000,
  );
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const summary = getAuthSloMetricsSummary();
  return NextResponse.json(summary, { status: 200 });
}

export const dynamic = "force-dynamic";
