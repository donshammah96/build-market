import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { applyPrivateNoStoreHeaders } from "@/app/lib/api/http-security";
import { env } from "@/app/lib/infrastructure/env";
import { timingSafeEqualStrings } from "@/app/lib/security/internal-secret";

/** Provider callbacks are acknowledged without caching or exposing internals. */
export function providerCallbackResponse(status = 202) {
  return applyPrivateNoStoreHeaders(
    NextResponse.json({ accepted: status < 300 }, { status }),
  );
}

/**
 * Validates callback authenticity against the configured MPESA_CALLBACK_SECRET.
 * Accepts shared secret via query param (?secret=... or ?token=...), header (x-callback-secret / x-mpesa-secret),
 * or Bearer authorization header. Fails closed when secret is unconfigured in non-test environments.
 */
export function verifyMpesaCallbackAuthenticity(request: NextRequest): boolean {
  const secret = env.services.mpesaCallbackSecret;
  const isActualProduction =
    env.isProd &&
    !env.isVercelPreview &&
    env.otel.ddEnv !== "staging" &&
    !env.stagingTestControl?.enabled;

  // Allow internal service callers with matching internal API secret
  const internalSecret = request.headers.get("x-internal-secret");
  if (
    internalSecret &&
    env.services.internalApiSecret &&
    timingSafeEqualStrings(internalSecret, env.services.internalApiSecret)
  ) {
    return true;
  }

  // Allow staging test-control callers with matching test control secret
  const testControlSecret = request.headers.get("x-test-control-secret");
  if (
    testControlSecret &&
    env.stagingTestControl?.secret &&
    timingSafeEqualStrings(testControlSecret, env.stagingTestControl.secret)
  ) {
    return true;
  }

  // Allow internal secret matching staging test control secret as fallback
  if (
    internalSecret &&
    env.stagingTestControl?.secret &&
    timingSafeEqualStrings(internalSecret, env.stagingTestControl.secret)
  ) {
    return true;
  }

  if (!secret) {
    // In staging, preview, or test environments without an explicit callback secret, allow callbacks to proceed
    if (!isActualProduction) {
      return true;
    }
    // Fail closed in actual production
    return false;
  }

  const candidate =
    request.nextUrl.searchParams.get("secret") ||
    request.nextUrl.searchParams.get("token") ||
    request.headers.get("x-callback-secret") ||
    request.headers.get("x-mpesa-secret") ||
    (request.headers.get("authorization")?.startsWith("Bearer ")
      ? request.headers.get("authorization")!.slice(7).trim()
      : null);

  if (!candidate) return false;

  const expectedBuf = Buffer.from(secret, "utf8");
  const providedBuf = Buffer.from(candidate, "utf8");

  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
