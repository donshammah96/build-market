import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { envConfig } from "@/lib/infrastructure/env";
import { toBool } from "@/lib/infrastructure/env-utils";
import { isBlockedUserStatus } from "@build/enums";
import {
  normalizeClerkDomain,
  resolvePrimarySignInUrl,
} from "@build/security-clerk";

/**
 * Edge-level gate for apps/verification-ops. This is defense-in-depth on
 * top of (not instead of) the fix to getVerificationUserContext() in
 * lib/auth.ts — that function does the real authorization (role,
 * isActive, least-privilege mapping); this middleware guarantees no
 * route in this app is reachable by an unauthenticated request or an account
 * lacking the ADMIN container role, so a future route added without
 * remembering to call getVerificationUserContext() still fails closed.
 *
 * Public routes: /sign-in, /unauthorized, /unauthorized-sign-in.
 */
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/unauthorized(.*)",
  "/unauthorized-sign-in(.*)",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
//
// Satellite domain helpers (isAbsoluteHttpUrl, normalizeClerkDomain,
// deriveFallbackPrimarySignInUrl, resolvePrimarySignInUrl) are no longer
// defined locally — they now come from `@build/security-clerk`, the same
// canonical copy apps/admin/src/middleware.ts imports (Finding 7). The
// role/status helpers below (`parseSessionMetadata`,
// `normalizeAdminAccessRole`) stay local: they encode this app's specific
// container-role mapping, not shared satellite mechanics, and weren't part
// of the duplicated set the autopsy flagged.

type SessionMetadata = {
  role?: string;
  status?: string;
  isOnboarded?: boolean;
};

function parseSessionMetadata(
  sessionClaims: unknown,
): SessionMetadata | undefined {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return undefined;
  }
  const record = sessionClaims as Record<string, unknown>;
  const metadata = (record.metadata ?? record.public_metadata) as
    Record<string, unknown> | undefined;
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  const role = typeof metadata.role === "string" ? metadata.role : undefined;
  const status =
    typeof metadata.status === "string" ? metadata.status : undefined;
  const isOnboarded =
    typeof metadata.isOnboarded === "boolean"
      ? metadata.isOnboarded
      : undefined;
  return { role, status, isOnboarded };
}

function normalizeAdminAccessRole(role?: string): "ADMIN" | undefined {
  if (!role) return undefined;
  const normalized = role.trim().toUpperCase();
  if (normalized === "ADMIN" || normalized === "VERIFICATION_ADMIN") {
    return "ADMIN";
  }
  return undefined;
}

/**
 * Resolve the absolute primary sign-in URL to use for a satellite request.
 * Thin app-local wrapper around `@build/security-clerk`'s
 * `resolvePrimarySignInUrl` (Finding 7) — memoized on the `req` reference,
 * so calling this from both the handler body and the dynamic Clerk options
 * resolver below resolves (and, on failure, logs) once per request, not
 * twice (Finding 10).
 */
function resolveSatellitePrimarySignInUrl(req: {
  nextUrl: { protocol: string; host: string };
}): string | null {
  return resolvePrimarySignInUrl(
    req,
    envConfig.clerk.primarySignInUrl,
    "verification-ops middleware",
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export default clerkMiddleware(
  async (authFn, req) => {
    // 1. Always allow public routes without any auth check
    if (isPublicRoute(req)) {
      return NextResponse.next();
    }

    // 2. Require an authenticated Clerk session for every other route.
    const authObj = await authFn();
    const { userId, sessionClaims } = authObj;
    const isApiRoute =
      req.nextUrl.pathname.startsWith("/api") ||
      req.nextUrl.pathname.startsWith("/trpc");

    if (!userId) {
      if (isApiRoute) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (toBool(envConfig.clerk.isSatellite)) {
        const primarySignIn = resolveSatellitePrimarySignInUrl(req);

        if (primarySignIn) {
          const redirectUrl = new URL(primarySignIn);
          redirectUrl.searchParams.set("redirect_url", req.url);
          return NextResponse.redirect(redirectUrl);
        }

        console.error(
          "[verification-ops middleware] NEXT_PUBLIC_CLERK_IS_SATELLITE is " +
            `true but no primary sign-in URL could be resolved for host ` +
            `"${req.nextUrl.host}".`,
        );
      }

      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }

    // 3. Blocked-user gate — fires before role checks (Finding 9: now uses
    //    the shared isBlockedUserStatus() from @build/enums instead of a
    //    local BLOCKED_STATUSES literal) so that suspended/banned accounts
    //    cannot access any route even with valid role claims.
    const metadata = parseSessionMetadata(sessionClaims);
    if (isBlockedUserStatus(metadata?.status)) {
      if (isApiRoute) {
        return NextResponse.json(
          { error: "Forbidden", reason: metadata?.status },
          { status: 403 },
        );
      }
      const url = new URL("/unauthorized-sign-in", req.url);
      url.searchParams.set("reason", String(metadata?.status));
      return NextResponse.redirect(url);
    }

    // 4. Container Role Gate (Edge Defense-in-Depth)
    const normalizedRole = normalizeAdminAccessRole(metadata?.role);
    if (normalizedRole !== "ADMIN") {
      if (isApiRoute) {
        return NextResponse.json(
          { error: "Forbidden", reason: "not_admin" },
          { status: 403 },
        );
      }
      return NextResponse.redirect(
        new URL("/unauthorized-sign-in?reason=not_admin", req.url),
      );
    }

    return NextResponse.next();
  },
  (req) => {
    const isSatellite = toBool(envConfig.clerk.isSatellite);

    if (!isSatellite) {
      return {
        isSatellite: false,
        domain:
          normalizeClerkDomain(envConfig.clerk.domain) || req.nextUrl.host,
      };
    }

    const signInUrl = resolveSatellitePrimarySignInUrl(req) || undefined;

    if (!signInUrl) {
      console.error(
        "[verification-ops middleware] NEXT_PUBLIC_CLERK_IS_SATELLITE is " +
          `true but no absolute signInUrl could be resolved for host ` +
          `"${req.nextUrl.host}". Disabling satellite mode for this request.`,
      );
      return {
        isSatellite: false,
        domain:
          normalizeClerkDomain(envConfig.clerk.domain) || req.nextUrl.host,
      };
    }

    return {
      isSatellite: true,
      domain: normalizeClerkDomain(envConfig.clerk.domain) || req.nextUrl.host,
      signInUrl,
    };
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip)).*)",
    "/(api|trpc)(.*)",
  ],
};
