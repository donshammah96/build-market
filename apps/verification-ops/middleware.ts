import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { envConfig } from "@/lib/infrastructure/env";
import { toBool } from "@/lib/infrastructure/env-utils";

/**
 * Edge-level gate for apps/verification-ops. This is defense-in-depth on
 * top of (not instead of) the fix to getVerificationUserContext() in
 * lib/auth.ts — that function does the real authorization (role,
 * isActive, least-privilege mapping); this middleware only guarantees no
 * route in this app is reachable by a fully unauthenticated request, so
 * a future route added without remembering to call
 * getVerificationUserContext() still fails closed rather than open.
 *
 * Only /sign-in is public — this app has no public marketing pages, no
 * public API, nothing else that should ever be reachable signed-out.
 *
 * SATELLITE UPDATE: this app is now a Clerk satellite of apps/client
 * (buildmarket.app), mirroring apps/admin/middleware.ts. Unauthenticated
 * requests are redirected to the PRIMARY domain's sign-in with a
 * `redirect_url` back to this app, instead of rendering local sign-in
 * UI. The local /sign-in route still exists as a safety net for direct
 * navigation (see app/(auth)/sign-in/[[...sign-in]]/page.tsx) and
 * immediately forwards on to the primary itself. Keep this file, that
 * page, layout.tsx, and apps/admin/middleware.ts in sync.
 */
const isPublicRoute = createRouteMatcher(["/sign-in(.*)"]);

// ---------------------------------------------------------------------------
// Helpers — mirror apps/admin/middleware.ts verbatim; keep in sync.
// ---------------------------------------------------------------------------

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
 * Normalize a Clerk `domain` option to a bare host. Clerk expects just
 * the host (e.g. "verification.buildmarket.app"), not a full URL.
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
 * NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL is unset for the environment
 * serving this request (e.g. a Preview/branch deploy where only
 * Production has the var configured).
 *
 * Heuristic: strip the leftmost subdomain label from the current host
 * (`verification.buildmarket.app` -> `buildmarket.app`) and assume
 * `/sign-in` lives at the apex. Safety net only — never a substitute for
 * setting the env var, since it assumes a specific domain-naming
 * convention. Returns null if the host doesn't look like a subdomain.
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
 * Resolve the absolute primary sign-in URL to use for a satellite
 * request, validating the env-provided value rather than trusting it
 * blindly. A relative or malformed
 * NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL must NOT be handed to Clerk —
 * that throws "The signInUrl needs to have a absolute url format" and,
 * because this is evaluated for every request (including public ones),
 * takes down every route on the site, not just one redirect.
 */
function resolvePrimarySignInUrl(req: {
  nextUrl: { protocol: string; host: string };
}): string | null {
  const configured = envConfig.clerk.primarySignInUrl;

  if (configured) {
    if (isAbsoluteHttpUrl(configured)) {
      return configured;
    }
    console.error(
      "[verification-ops middleware] NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL=" +
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
  async (authFn, req) => {
    // 1. Always allow the local /sign-in route without any auth check —
    //    it's the safety-net redirect page, and gating it would itself
    //    create a redirect loop.
    if (isPublicRoute(req)) {
      return NextResponse.next();
    }

    // 2. Require an authenticated Clerk session for every other route.
    const { userId } = await authFn();
    const isApiRoute =
      req.nextUrl.pathname.startsWith("/api") ||
      req.nextUrl.pathname.startsWith("/trpc");

    if (!userId) {
      if (isApiRoute) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Wrapped in toBool() even though envConfig.clerk.isSatellite is
      // already a boolean by this point (env.ts coerces it via
      // getBooleanEnv) — matches apps/admin/middleware.ts's identical
      // call site verbatim, and toBool() short-circuits/passes through
      // cleanly on an actual boolean input (see env-utils.ts). Defense
      // in depth against a future refactor of env.ts accidentally
      // reintroducing a raw string here.
      if (toBool(envConfig.clerk.isSatellite)) {
        // Prefer the explicit env var (validated). If it's unset or
        // malformed for this environment, derive a fallback from the
        // request host rather than dropping to the local /sign-in
        // route's own default target — see resolvePrimarySignInUrl.
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
        // manifesting as a broken redirect for users. Fall through to
        // the local /sign-in redirect below as a last resort — that
        // page will itself attempt (and likely also fail) the same
        // resolution, but at least renders something instead of a
        // middleware-level dead end.
        console.error(
          "[verification-ops middleware] NEXT_PUBLIC_CLERK_IS_SATELLITE is " +
            `true but no primary sign-in URL could be resolved for host ` +
            `"${req.nextUrl.host}" (env var unset/invalid and host has no ` +
            "apex domain to derive).",
        );
      }

      // Non-satellite fallback (e.g. local dev running this app
      // standalone against a test Clerk instance, or the satellite
      // resolution above failed): redirect to this app's own /sign-in,
      // which forwards on to the primary if configured.
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  },
  // ---------------------------------------------------------------------
  // Dynamic Clerk options resolver.
  //
  // Why a function instead of a static object: both `domain` and
  // `signInUrl` are REQUIRED (and must be well-formed) whenever
  // `isSatellite` is true, or Clerk throws at request time — for EVERY
  // request, including public ones, since Clerk resolves these options
  // internally before our handler body runs. Mirrors
  // apps/admin/middleware.ts exactly; keep both in sync.
  //
  // IMPORTANT: this resolver must NEVER hand Clerk an unvalidated env
  // value. A relative/malformed `signInUrl` throws here and takes down
  // every route on the site, not just one redirect. Everything below is
  // validated before being returned.
  // ---------------------------------------------------------------------
  (req) => {
    // Same toBool() wrap as the handler above and as
    // apps/admin/middleware.ts's dynamic-options resolver — see the
    // comment on the first call site for why this is deliberately
    // redundant rather than trusting envConfig.clerk.isSatellite's
    // boolean type directly.
    const isSatellite = toBool(envConfig.clerk.isSatellite);

    if (!isSatellite) {
      return {
        isSatellite: false,
        domain:
          normalizeClerkDomain(envConfig.clerk.domain) || req.nextUrl.host,
      };
    }

    const signInUrl = resolvePrimarySignInUrl(req) || undefined;

    if (!signInUrl) {
      // Neither the env var nor host-derivation produced an absolute
      // URL — Clerk would throw on every request with isSatellite: true
      // and no signInUrl. Fail OPEN (disable satellite mode for this
      // request) rather than crashing the whole site; loudly log so
      // this config gap gets fixed instead of silently degrading auth.
      console.error(
        "[verification-ops middleware] NEXT_PUBLIC_CLERK_IS_SATELLITE is " +
          `true but no absolute signInUrl could be resolved for host ` +
          `"${req.nextUrl.host}". Disabling satellite mode for this ` +
          "request instead of crashing — set " +
          "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL (absolute URL) and " +
          "NEXT_PUBLIC_CLERK_DOMAIN for this Vercel environment to fix " +
          "properly.",
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
    // Skip Next.js internals and static assets, run everywhere else.
    "/((?!_next|[^?]*\\.(?:html?|css|js|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip)).*)",
    "/(api|trpc)(.*)",
  ],
};
