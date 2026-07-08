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

/**
 * Best-effort fallback for the primary domain's sign-in URL when
 * `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` is unset for the environment
 * serving this request (e.g. a Preview/branch deploy where only
 * Production has the var configured).
 *
 * Heuristic: strip the leftmost subdomain label from the current host
 * (`admin.buildmarket.app` -> `buildmarket.app`) and assume `/sign-in`
 * lives at the apex. This only fires as a safety net — it should never
 * be relied on in place of setting the env var, since it assumes a
 * specific domain-naming convention (satellite = one subdomain deep
 * under the primary's apex). Returns null if the host doesn't look like
 * a subdomain (nothing sensible to strip), so callers can fall back
 * further.
 */
function deriveFallbackPrimarySignInUrl(req: {
  nextUrl: { protocol: string; host: string };
}): string | null {
  const { protocol, host } = req.nextUrl;
  const labels = host.split(".");

  // Need at least "sub.domain.tld" to safely strip one subdomain label.
  if (labels.length <= 2) {
    return null;
  }

  const apexHost = labels.slice(1).join(".");
  return `${protocol}//${apexHost}/sign-in`;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export default clerkMiddleware(
  async (auth, req) => {
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
      if (adminEnvConfig.NEXT_PUBLIC_CLERK_IS_SATELLITE) {
        // Prefer the explicit env var. If it's unset for this environment,
        // derive a fallback from the request host rather than silently
        // dropping straight to `redirectToSignIn()` — that path resolves
        // via `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (typically a *relative*
        // path like "/sign-in"), which on a satellite domain is exactly
        // the redirect-loop bug this middleware exists to prevent.
        const primarySignIn =
          adminEnvConfig.NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL ||
          deriveFallbackPrimarySignInUrl(req);

        if (primarySignIn) {
          if (!adminEnvConfig.NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL) {
            console.warn(
              "[middleware] NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL is not set " +
                `for this environment; falling back to derived sign-in URL "${primarySignIn}". ` +
                "Set the env var explicitly for this Vercel environment to avoid relying on this heuristic.",
            );
          }

          const redirectUrl = new URL(primarySignIn);
          redirectUrl.searchParams.set("redirect_url", req.url);
          return NextResponse.redirect(redirectUrl);
        }

        // Both the env var and the host-derivation heuristic failed
        // (e.g. running on a bare `vercel.app` preview host with no
        // subdomain structure to strip). Log loudly so this is
        // discoverable in Vercel's function logs instead of silently
        // manifesting as a redirect loop for users.
        console.error(
          "[middleware] NEXT_PUBLIC_CLERK_IS_SATELLITE is true but no primary " +
            `sign-in URL could be resolved for host "${req.nextUrl.host}" ` +
            "(env var unset and host has no apex domain to derive). Falling back " +
            "to local redirectToSignIn(), which may cause a redirect loop on satellite domains.",
        );
      }

      const signInResponse = authObj.redirectToSignIn({
        returnBackUrl: req.url,
      }) as unknown as Response;
      return new NextResponse(signInResponse.body, signInResponse);
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
  },
  // ---------------------------------------------------------------------
  // Dynamic Clerk options resolver.
  //
  // Why a function instead of a static object: `domain` is REQUIRED
  // whenever `isSatellite` is true, or Clerk throws
  // "Missing domain and proxyUrl" at request time. A static object built
  // from `NEXT_PUBLIC_CLERK_DOMAIN` is only as reliable as that env var's
  // propagation to *every* Vercel environment (Production, Preview,
  // per-branch deploys). If it's ever unset for the environment that
  // served a given request, `isSatellite: true` reaches Clerk with no
  // domain and the whole app 500s.
  //
  // Resolving `domain` from the incoming request's host removes that
  // failure mode entirely — it is always defined, and it is always the
  // domain that is actually serving the request (which is also what
  // Clerk needs to validate the satellite handshake against). The env
  // var is kept as an explicit override for cases where you deliberately
  // want to pin the domain rather than infer it.
  // ---------------------------------------------------------------------
  (req) => ({
    isSatellite: adminEnvConfig.NEXT_PUBLIC_CLERK_IS_SATELLITE,
    domain: adminEnvConfig.NEXT_PUBLIC_CLERK_DOMAIN || req.nextUrl.host,
  }),
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
