import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/app/lib/infrastructure/env";
import {
  ensureValidInternalSecret,
  timingSafeEqualStrings,
} from "@/app/lib/security/internal-secret";

/**
 * Decode Base64 in Edge runtime or Node.js environment safely.
 */
function decodeBase64(str: string): string {
  if (typeof atob === "function") {
    try {
      return atob(str);
    } catch {
      return "";
    }
  }
  try {
    return Buffer.from(str, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/**
 * Parse an HTTP Basic Auth header into user and password components.
 */
export function parseBasicAuthHeader(
  authHeader: string | null,
): { user: string; pass: string } | null {
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return null;
  }

  const base64Credentials = authHeader.slice(6).trim();
  if (!base64Credentials) {
    return null;
  }

  const decoded = decodeBase64(base64Credentials);
  const colonIndex = decoded.indexOf(":");
  if (colonIndex === -1) {
    return null;
  }

  return {
    user: decoded.slice(0, colonIndex),
    pass: decoded.slice(colonIndex + 1),
  };
}

/**
 * Checks whether a request should be exempted from staging environment protection.
 * Exemptions include:
 * - Health check liveness probes (/api/healthz)
 * - Inbound third-party webhooks (/api/webhooks/* e.g. Clerk, Stripe, Resend)
 * - Service-to-service internal API calls with valid x-internal-secret
 */
export function isStagingProtectionExempt(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;

  if (pathname === "/api/healthz") {
    return true;
  }

  if (pathname.startsWith("/api/webhooks/")) {
    return true;
  }

  if (pathname.startsWith("/.well-known/")) {
    return true;
  }

  const internalSecret = req.headers.get("x-internal-secret");
  if (internalSecret && ensureValidInternalSecret(internalSecret) === null) {
    return true;
  }

  return false;
}

/**
 * Enforces staging environment authentication and anti-crawling protection.
 *
 * Requirements & Invariants:
 * - When DD_ENV !== "staging" (or stagingAuth is not enabled), immediately returns null (no-op).
 * - Exempts health probes, webhooks, and internal API calls.
 * - Supports HTTP Basic Auth (Authorization: Basic <base64>).
 * - Supports shared secret bypass via `x-staging-secret` header or `bm_staging_auth` cookie.
 * - Uses constant-time string comparison (`timingSafeEqualStrings`) to eliminate timing attacks.
 * - Returns 401 with WWW-Authenticate header when unauthorized.
 */
export function handleStagingProtection(req: NextRequest): NextResponse | null {
  const stagingAuth = env.stagingAuth;
  if (!stagingAuth?.isEnabled) {
    return null;
  }

  if (isStagingProtectionExempt(req)) {
    return null;
  }

  // 1. Check Shared Secret Header
  const secretHeader = req.headers.get("x-staging-secret");
  if (
    stagingAuth.secret &&
    secretHeader &&
    timingSafeEqualStrings(secretHeader, stagingAuth.secret)
  ) {
    return null;
  }

  // 2. Check Shared Secret Cookie
  const secretCookie = req.cookies.get("bm_staging_auth")?.value;
  if (
    stagingAuth.secret &&
    secretCookie &&
    timingSafeEqualStrings(secretCookie, stagingAuth.secret)
  ) {
    return null;
  }

  // 3. Check HTTP Basic Auth
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const credentials = parseBasicAuthHeader(authHeader);
    if (
      credentials &&
      timingSafeEqualStrings(
        credentials.user,
        stagingAuth.user ?? "buildmarket",
      ) &&
      stagingAuth.password &&
      timingSafeEqualStrings(credentials.pass, stagingAuth.password)
    ) {
      return null;
    }
  }

  // 4. Unauthorized: Return 401 with Basic Auth challenge
  return new NextResponse("Authentication required for staging environment", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="BuildMarket Staging", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
