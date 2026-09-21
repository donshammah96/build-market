import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  ADMIN_ROUTE_POLICY_MAP,
  type AdminAccessRole,
} from "@/lib/security/authorization-policy";
import {
  normalizeAdminAccessRole,
  parseSessionMetadata,
} from "@/lib/security/claims";
import { env } from "@/lib/infrastructure/env";
import { NextResponse } from "next/server";
import {
  isPublicRoute,
  isDashboardRoute,
  isVerificationRoute,
} from "@/lib/security/route-registry";
import { isBlockedUserStatus } from "@build/enums";
import {
  normalizeClerkDomain,
  resolvePrimarySignInUrl,
} from "@build/security-clerk";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MiddlewareAuthObject = {
  userId: string | null;
  sessionClaims: unknown;
  has: (args: { role: string }) => boolean;
  redirectToSignIn: (args: { returnBackUrl: string }) => Response;
};

/**
 * Finding 8: `authObj.has({ role })` checks Clerk *Organizations*
 * role/permission grants. Build Market does not use Clerk Organizations —
 * authorization is modeled entirely through `AdminProfile` in Postgres,
 * synced into `publicMetadata` / session claims. With Organizations
 * unconfigured, `has()` returns `false` unconditionally for every request,
 * making the "primary check" dead code that only added a false sense of
 * defense-in-depth; 100% of real authorization decisions were already being
 * made by the metadata fallback beneath it.
 *
 * This removes that dead branch per the hardening doc's option (b). If
 * Build Market ever adopts Clerk Organizations for admin role management,
 * reintroduce an explicit `authObj.has({ role })` check here deliberately —
 * don't restore it silently as "defense-in-depth" without organizations
 * actually being configured, or it regresses back to unverified dead code.
 */
function hasAllowedRole(
  authObj: MiddlewareAuthObject,
  allowedRoles: readonly AdminAccessRole[],
): boolean {
  const metadata = parseSessionMetadata(authObj.sessionClaims);
  const normalizedRole = normalizeAdminAccessRole(metadata?.role);
  return normalizedRole ? allowedRoles.includes(normalizedRole) : false;
}

/**
 * Resolve the absolute primary sign-in URL to use for a satellite request.
 * Thin app-local wrapper around `@build/security-clerk`'s
 * `resolvePrimarySignInUrl` (Finding 7): the derivation/validation logic now
 * lives in exactly one place, and this app just supplies its own
 * `env.clerk.primarySignInUrl` and logger name.
 *
 * The shared function memoizes its result on the `req` reference (Finding
 * 10), so calling this twice per request — once from the dynamic Clerk
 * options resolver below, once from the unauthenticated-request handler
 * branch — resolves and logs only once, not twice.
 */
function resolveSatellitePrimarySignInUrl(req: {
  nextUrl: { protocol: string; host: string };
}): string | null {
  return resolvePrimarySignInUrl(
    req,
    env.clerk.primarySignInUrl,
    "apps/admin middleware",
  );
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
    //    when AUTH_DEV_BYPASS=true (canonical; legacy DEV_ADMIN_BYPASS still
    //    honored via @build/env-validation's resolveDevAuthBypass). Never
    //    enabled in production — enforced fail-closed at the env layer.
    const isDev = env.nodeEnv === "development";
    const devBypass = env.auth.bypassEnabled;

    if (isDev && devBypass) {
      return;
    }

    // 3. Require an authenticated Clerk session for all non-public routes.
    //    `redirectToSignIn` will send the user to the primary domain sign-in
    //    (resolved by ClerkProvider's `signInUrl`) and append `redirect_url`
    //    so that after sign-in they return to the page they requested.
    const authObj = await auth();
    const isApiRoute =
      req.nextUrl.pathname.startsWith("/api") ||
      req.nextUrl.pathname.startsWith("/trpc");

    if (!authObj.userId) {
      if (isApiRoute) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (env.clerk.isSatellite) {
        // Prefer the explicit env var (validated). If it's unset or
        // malformed for this environment, derive a fallback from the
        // request host rather than silently dropping straight to
        // `redirectToSignIn()` — that path resolves via
        // `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (typically a *relative* path like
        // "/sign-in"), which on a satellite domain is exactly the
        // redirect-loop bug this middleware exists to prevent.
        const primarySignIn = resolveSatellitePrimarySignInUrl(req);

        if (primarySignIn) {
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
            "(env var unset/invalid and host has no apex domain to derive). " +
            "Falling back to local redirectToSignIn(), which may cause a " +
            "redirect loop on satellite domains.",
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
    if (isBlockedUserStatus(metadata?.status)) {
      if (isApiRoute) {
        return NextResponse.json(
          { error: "Forbidden", reason: metadata.status },
          { status: 403 },
        );
      }
      const url = new URL("/unauthorized-sign-in", req.url);
      url.searchParams.set("reason", String(metadata.status));
      return NextResponse.redirect(url);
    }

    // 5. Verification routes — requires admin or verification_admin role
    if (isVerificationRoute(req)) {
      const isAuthorized = hasAllowedRole(
        authObj as MiddlewareAuthObject,
        ADMIN_ROUTE_POLICY_MAP.verification,
      );

      if (!isAuthorized) {
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
      return;
    }

    // 6. Dashboard routes — requires admin role only
    if (isDashboardRoute(req)) {
      const isAuthorized = hasAllowedRole(
        authObj as MiddlewareAuthObject,
        ADMIN_ROUTE_POLICY_MAP.dashboard,
      );

      if (!isAuthorized) {
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
      return;
    }

    // 7. Default: any other protected route requires at least a known admin role
    const isAuthorized = hasAllowedRole(
      authObj as MiddlewareAuthObject,
      ADMIN_ROUTE_POLICY_MAP.defaultProtected,
    );
    if (!isAuthorized) {
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
  },
  // ---------------------------------------------------------------------
  // Dynamic Clerk options resolver.
  //
  // Why a function instead of a static object: both `domain` and
  // `signInUrl` are REQUIRED (and must be well-formed) whenever
  // `isSatellite` is true, or Clerk throws at request time — for EVERY
  // request, including public ones, since Clerk resolves these options
  // internally before our handler body runs.
  //
  // IMPORTANT: this resolver must NEVER hand Clerk an unvalidated env
  // value. A relative/malformed `signInUrl`, or a truthy-but-wrong
  // `isSatellite` flag (e.g. from a raw "false" string), throws here and
  // takes down every route on the site, not just one redirect. Everything
  // below is validated (by @build/security-clerk) before being returned.
  // ---------------------------------------------------------------------
  (req) => {
    const isSatellite = env.clerk.isSatellite;

    if (!isSatellite) {
      return {
        isSatellite: false,
        domain: normalizeClerkDomain(env.clerk.domain) || req.nextUrl.host,
      };
    }

    const signInUrl = resolveSatellitePrimarySignInUrl(req) || undefined;

    if (!signInUrl) {
      // Neither the env var nor host-derivation produced an absolute
      // URL — Clerk would throw on every request with isSatellite: true
      // and no signInUrl. Fail OPEN (disable satellite mode for this
      // request) rather than crashing the whole site; loudly log so this
      // config gap gets fixed instead of silently degrading auth.
      console.error(
        "[middleware] NEXT_PUBLIC_CLERK_IS_SATELLITE is true but no absolute " +
          `signInUrl could be resolved for host "${req.nextUrl.host}". ` +
          "Disabling satellite mode for this request instead of crashing — " +
          "set NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL (absolute URL) and " +
          "NEXT_PUBLIC_CLERK_DOMAIN for this Vercel environment to fix properly.",
      );
      return {
        isSatellite: false,
        domain: normalizeClerkDomain(env.clerk.domain) || req.nextUrl.host,
      };
    }

    return {
      isSatellite: true,
      domain: normalizeClerkDomain(env.clerk.domain) || req.nextUrl.host,
      signInUrl,
    };
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
