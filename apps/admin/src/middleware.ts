import { clerkMiddleware } from "@clerk/nextjs/server";
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
import { toBool } from "@/lib/infrastructure/env-utils";
import {
  isPublicRoute,
  isDashboardRoute,
  isVerificationRoute,
} from "@/lib/security/route-registry";

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

/** Returns true only if `value` parses as a well-formed absolute http(s) URL. */
function isAbsoluteHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Normalize a Clerk `domain` option to a bare host. Clerk expects just the
 * host (e.g. "buildmarket.app"), not a full URL. If someone accidentally
 * configures NEXT_PUBLIC_CLERK_DOMAIN with a scheme (e.g.
 * "https://buildmarket.app"), strip it down instead of passing a malformed
 * value through.
 */
function normalizeClerkDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).host || null;
    } catch {
      return null;
    }
  }
  return trimmed;
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

  // Guard against stripping a label off a *.vercel.app (or similar shared
  // hosting) preview host — that would derive a nonsense apex like
  // "vercel.app" that is syntactically valid but not actually ours.
  const KNOWN_SHARED_HOSTING_SUFFIXES = ["vercel.app", "vercel.sh"];
  const apexCandidate = labels.slice(-2).join(".");
  if (KNOWN_SHARED_HOSTING_SUFFIXES.includes(apexCandidate)) {
    return null;
  }

  const apexHost = labels.slice(1).join(".");
  return `${protocol}//${apexHost}/sign-in`;
}

/**
 * Resolve the absolute primary sign-in URL to use for a satellite request,
 * validating the env-provided value rather than trusting it blindly. A
 * relative or malformed `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` (e.g. copied
 * from the non-satellite `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, which is meant to
 * be relative) must NOT be handed to Clerk — that is exactly what throws
 * "The signInUrl needs to have a absolute url format" and, because this is
 * evaluated for every request (including public ones), takes the whole site
 * down rather than just failing one redirect.
 */
function resolvePrimarySignInUrl(req: {
  nextUrl: { protocol: string; host: string };
}): string | null {
  const configured = adminEnvConfig.NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL;

  if (configured) {
    if (isAbsoluteHttpUrl(configured)) {
      return configured;
    }
    console.error(
      "[middleware] NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL=" +
        `"${configured}" is not an absolute http(s) URL (did you mean to set ` +
        "NEXT_PUBLIC_CLERK_SIGN_IN_URL instead, which IS relative?). Ignoring " +
        "it and falling back to host-derivation instead of crashing.",
    );
  }

  return deriveFallbackPrimarySignInUrl(req);
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
    const devBypass = toBool(adminEnvConfig.DEV_ADMIN_BYPASS);

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

      if (toBool(adminEnvConfig.NEXT_PUBLIC_CLERK_IS_SATELLITE)) {
        // Prefer the explicit env var (validated). If it's unset or
        // malformed for this environment, derive a fallback from the
        // request host rather than silently dropping straight to
        // `redirectToSignIn()` — that path resolves via
        // `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (typically a *relative* path like
        // "/sign-in"), which on a satellite domain is exactly the
        // redirect-loop bug this middleware exists to prevent.
        const primarySignIn = resolvePrimarySignInUrl(req);

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
    if (metadata?.status && BLOCKED_STATUSES.includes(metadata.status)) {
      if (isApiRoute) {
        return NextResponse.json(
          { error: "Forbidden", reason: metadata.status },
          { status: 403 },
        );
      }
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
  // below is validated before being returned.
  // ---------------------------------------------------------------------
  (req) => {
    const isSatellite = toBool(adminEnvConfig.NEXT_PUBLIC_CLERK_IS_SATELLITE);

    if (!isSatellite) {
      return {
        isSatellite: false,
        domain:
          normalizeClerkDomain(adminEnvConfig.NEXT_PUBLIC_CLERK_DOMAIN) ||
          req.nextUrl.host,
      };
    }

    const signInUrl = resolvePrimarySignInUrl(req) || undefined;

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
        domain:
          normalizeClerkDomain(adminEnvConfig.NEXT_PUBLIC_CLERK_DOMAIN) ||
          req.nextUrl.host,
      };
    }

    return {
      isSatellite: true,
      domain:
        normalizeClerkDomain(adminEnvConfig.NEXT_PUBLIC_CLERK_DOMAIN) ||
        req.nextUrl.host,
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
