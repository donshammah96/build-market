import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { applyPrivateNoStoreHeaders } from "@/app/lib/api/http-security";
import { env } from "@/app/lib/infrastructure/env";

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

  if (!secret) {
    if (env.isTest) {
      return true;
    }
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
