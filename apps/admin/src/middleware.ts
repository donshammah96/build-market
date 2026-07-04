import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  ADMIN_ROUTE_POLICY_MAP,
  type AdminAccessRole,
} from "@/lib/security/authorization-policy";
import {
  normalizeAdminAccessRole,
  parseSessionMetadata,
} from "@/lib/security/claims";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Route matchers
// ---------------------------------------------------------------------------

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/unauthorized(.*)",
  "/unauthorized-sign-in(.*)",
]);

// Dashboard routes that require admin access
const isDashboardRoute = createRouteMatcher([
  "/",
  "/analytics(.*)",
  "/audit(.*)",
  "/leads(.*)",
  "/professionals(.*)",
  "/projects(.*)",
  "/properties(.*)",
  "/services(.*)",
  "/settings(.*)",
  "/stores(.*)",
  "/users(.*)",
]);

// Verification routes that require verification_admin or admin role
const isVerificationRoute = createRouteMatcher(["/verifications(.*)"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Statuses that must be blocked before role checks are applied. */
const BLOCKED_STATUSES = ["SUSPENDED", "BANNED", "DEACTIVATED", "ARCHIVED"];

type MiddlewareAuthObject = {
  userId: string | null;
  sessionClaims: unknown;
  has: (args: { role: string }) => boolean;
  redirectToSignIn: (args: { returnBackUrl: string }) => Response;
};

function hasAllowedRole(
  authObj: MiddlewareAuthObject,
  allowedRoles: readonly AdminAccessRole[],
): boolean {
  // Primary check: Clerk's built-in `has` helper (reads org roles / permissions)
  for (const role of allowedRoles) {
    if (authObj.has({ role })) {
      return true;
    }
  }

  // Fallback: read role from publicMetadata propagated into session claims
  const metadata = parseSessionMetadata(authObj.sessionClaims);
  const normalizedRole = normalizeAdminAccessRole(metadata?.role);
  return normalizedRole ? allowedRoles.includes(normalizedRole) : false;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export default clerkMiddleware(async (auth, req) => {
  // 1. Always allow public routes (sign-in, unauthorized pages) without any
  //    auth check — this is the primary defence against redirect loops.
  if (isPublicRoute(req)) {
    return;
  }

  // 2. Dev bypass: short-circuit all auth/role checks in local development
  //    when DEV_ADMIN_BYPASS=true. Never enable in production.
  const isDev = adminEnvConfig.NODE_ENV === "development";
  const devBypass = adminEnvConfig.DEV_ADMIN_BYPASS;

  if (isDev && devBypass) {
    return;
  }

  // 3. Require an authenticated Clerk session for all non-public routes.
  //    `redirectToSignIn` will send the user to the primary domain sign-in
  //    (resolved by ClerkProvider's `signInUrl`) and append `redirect_url`
  //    so that after sign-in they return to the page they requested.
  const authObj = await auth();

  if (!authObj.userId) {
    return authObj.redirectToSignIn({ returnBackUrl: req.url });
  }

  // 4. Blocked-user gate — fires before role checks so that suspended/banned
  //    accounts cannot access any admin route even with valid role claims.
  //    Redirects to /unauthorized-sign-in (public) to avoid a protect-loop.
  const metadata = parseSessionMetadata(authObj.sessionClaims);
  if (metadata?.status && BLOCKED_STATUSES.includes(metadata.status)) {
    const url = new URL("/unauthorized-sign-in", req.url);
    url.searchParams.set("reason", metadata.status);
    return NextResponse.redirect(url);
  }

  // 5. Verification routes — requires admin or verification_admin role
  if (isVerificationRoute(req)) {
    const isAuthorized = hasAllowedRole(
      authObj as MiddlewareAuthObject,
      ADMIN_ROUTE_POLICY_MAP.verification,
    );

    if (!isAuthorized) {
      return NextResponse.redirect(
        new URL("/unauthorized-sign-in?reason=not_admin", req.url),
      );
    }
    return;
  }

  // 6. Dashboard routes — requires admin role only
  if (isDashboardRoute(req)) {
    const isAuthorized = hasAllowedRole(
      authObj as MiddlewareAuthObject,
      ADMIN_ROUTE_POLICY_MAP.dashboard,
    );

    if (!isAuthorized) {
      return NextResponse.redirect(
        new URL("/unauthorized-sign-in?reason=not_admin", req.url),
      );
    }
    return;
  }

  // 7. Default: any other protected route requires at least a known admin role
  const isAuthorized = hasAllowedRole(
    authObj as MiddlewareAuthObject,
    ADMIN_ROUTE_POLICY_MAP.defaultProtected,
  );
  if (!isAuthorized) {
    return NextResponse.redirect(
      new URL("/unauthorized-sign-in?reason=not_admin", req.url),
    );
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
