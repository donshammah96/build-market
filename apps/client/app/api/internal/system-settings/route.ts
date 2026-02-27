import { NextRequest, NextResponse } from "next/server";
import { getPublicSettings } from "@build/db/system-settings";
import {
  checkRateLimit,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { getClientLogger } from "@/app/lib/api/resilient-api";

const logger = getClientLogger();

/**
 * GET /api/internal/system-settings
 *
 * Internal endpoint for middleware.
 * Protected by x-internal-secret header (same as user-status).
 * Returns minimal settings for maintenance mode and signup blocking.
 *
 * Returns: { maintenanceMode, maintenanceMessage, publicSignup, allowProfessionalSignup }
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  if (expectedSecret && internalSecret !== expectedSecret) {
    logger.warn("Internal system-settings forbidden: invalid secret");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `internal-system-settings:${identifier}`,
    200,
    60_000,
  );
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
  }

  const settings = await getPublicSettings();

  return NextResponse.json({
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    publicSignup: settings.publicSignup,
    allowProfessionalSignup: settings.allowProfessionalSignup,
    allowedIPs: settings.allowedIPs,
  });
}

export const dynamic = "force-dynamic";
