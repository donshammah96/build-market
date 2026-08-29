import { NextRequest, NextResponse } from "next/server";
import {
  getPublicSettings,
  isServingFallback,
} from "@/app/lib/domains/settings";
import {
  checkRateLimit,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { ensureValidInternalSecret } from "@/app/lib/security/internal-secret";

/**
 * GET /api/internal/system-settings
 *
 * Internal endpoint for middleware.
 * Protected by x-internal-secret header (same as user-status).
 * Returns minimal settings for maintenance mode and signup blocking.
 *
 * Returns: { maintenanceMode, maintenanceMessage, publicSignup, allowProfessionalSignup }
 *
 * Response headers:
 *   X-Settings-Source: "db" | "fallback"
 *     - "fallback" means the DB was unreachable and hardcoded safe-defaults are
 *       being served. Middleware resolver treats 200 + defaults as non-maintenance,
 *       which is the intended fail-open behaviour for this endpoint.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secretError = ensureValidInternalSecret(
    req.headers.get("x-internal-secret"),
  );
  if (secretError) {
    getClientLogger().warn(
      "Internal system-settings forbidden: invalid secret",
    );
    return secretError;
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `internal-system-settings:${identifier}`,
    200,
    60_000,
  );
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const settings = await getPublicSettings();
  const servingFallback = isServingFallback();

  if (servingFallback) {
    // Structured warn so Vercel log pipeline surfaces this without noise in
    // error-rate dashboards (DB connectivity issues are infrastructure alerts,
    // not application errors at the route layer).
    getClientLogger().warn(
      "system-settings serving DB-failure fallback defaults",
      {
        operationName: "get_system_settings",
        settingsSource: "fallback",
      },
    );
  }

  return NextResponse.json(
    {
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      publicSignup: settings.publicSignup,
      allowProfessionalSignup: settings.allowProfessionalSignup,
      allowedIPs: settings.allowedIPs,
    },
    {
      headers: {
        // Allows callers and Vercel log queries to distinguish a live DB read
        // from a degraded-default response without changing the JSON shape.
        "X-Settings-Source": servingFallback ? "fallback" : "db",
      },
    },
  );
}

export const dynamic = "force-dynamic";
