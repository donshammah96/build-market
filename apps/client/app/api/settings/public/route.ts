import { NextResponse } from "next/server";
import { getPublicSettings } from "@/app/lib/domains/settings";
import {
  checkRateLimit,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { NextRequest } from "next/server";

/**
 * GET /api/settings/public
 *
 * Public endpoint — no authentication required.
 * Returns system settings safe for unauthenticated clients:
 * maintenanceMode, maintenanceMessage, publicSignup, allowProfessionalSignup,
 * featureFlags, supportEmail, supportPhone, whatsappNumber.
 *
 * Cached: Cache-Control for CDN/edge, rate limited for abuse prevention.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `settings-public:${identifier}`,
    100, // 100 requests per minute per IP
    60_000,
  );
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const settings = await getPublicSettings();

  return NextResponse.json(settings, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
