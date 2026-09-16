import { NextResponse, type NextRequest } from "next/server";
import type { AppRole } from "@/app/lib/security/roles";
import { env } from "@/app/lib/infrastructure/env";
import {
  CLIENT_ROUTES,
  PROFESSIONAL_ROUTES,
  dashboardForRole,
} from "@/lib/routes";

import { fingerprintPublishableKey } from "@/app/lib/security/clerk-fingerprint";

export { getSafeRedirectUrl } from "@/app/lib/security/redirect-url";

export const AUTH_BOUNCE_COOKIE = "bm_auth_bounce";
const MAX_AUTH_BOUNCES = 2;
const BOUNCE_COOKIE_TTL_SECONDS = 60;

export function readBounce(req: NextRequest): number {
  const raw = Number(req.cookies.get(AUTH_BOUNCE_COOKIE)?.value ?? "0");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

export function clearAuthBounce(res: NextResponse): NextResponse {
  res.cookies.set(AUTH_BOUNCE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export function authLoopDiagnostic(
  req: NextRequest,
  count: number,
): NextResponse {
  const cookieNames = req.cookies.getAll().map((c) => c.name);
  const body = {
    error: "AUTH_REDIRECT_LOOP_BROKEN",
    message:
      "Edge middleware and the Node runtime disagree about this session. " +
      "The redirect loop was stopped deliberately.",
    bounces: count,
    pathname: req.nextUrl.pathname,
    hasSessionCookie: cookieNames.some((n) => n.startsWith("__session")),
    hasClientUatCookie: cookieNames.some((n) => n.startsWith("__client_uat")),
    hasHandshakeCookie: cookieNames.some((n) => n.includes("clerk_handshake")),
    clerkPublishableKeyFingerprint: fingerprintPublishableKey(
      env.clerk?.publishableKey,
    ),
    clerkIsSatellite: Boolean(env.clerk?.isSatellite),
    clerkDomain: env.clerk?.domain ?? null,
    clerkFrontendApi: env.clerk?.frontendApi ?? null,
    secretKeyPresent: Boolean(process.env.CLERK_SECRET_KEY),
    docs: "docs/STAGING-E2E-STAFF-AUTOPSY-V2.md#4-the-edgenode-auth-asymmetry",
  };
  const res = NextResponse.json(body, { status: 503 });
  clearAuthBounce(res);
  return res;
}

/**
 * Redirects to the sign-in page.
 *
 * CRITICAL: This helper may run in middleware on the primary domain OR on a
 * satellite domain (admin.buildmarket.app, verification.buildmarket.app).
 * Two invariants must hold regardless of which domain called it:
 *
 *   1. The sign-in URL itself must always point at the PRIMARY app, never at
 *      `req.url`'s origin. Only the primary domain renders the Clerk
 *      <SignIn/> UI; satellites do not.
 *   2. The `redirect_url` value must be an ABSOLUTE URL back to the
 *      originating domain whenever the request did not originate on the
 *      primary domain. A bare pathname (e.g. "/dashboard") is only safe
 *      when the caller and the sign-in page share an origin — on a
 *      satellite it would silently resolve against the primary domain
 *      after login and send the user to the wrong app.
 *
 * IMPORTANT — env.appUrl is NOT the primary's URL on a satellite:
 * `redirect-url.ts`'s allow-list checks `env.appUrl`, `env.adminAppUrl`, and
 * `env.verificationAppUrl` as three distinct per-app self-URLs, which
 * confirms `env.appUrl` is a self-referential "this app's own URL" field on
 * every app — including satellites. Using it here to build the sign-in URL
 * (as the previous version of this function did) meant satellites built a
 * sign-in link pointing at THEMSELVES, not at the primary — since
 * satellites don't render the Clerk <SignIn/> UI, that's a second,
 * independent way to end up stuck. The correct primary origin is:
 *   - `env.appUrl` itself, when this app IS the primary (not a satellite), or
 *   - the origin of `env.clerk.primarySignInUrl`, when this app IS a satellite
 *     (see NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL in env.ts).
 *
 * `pathname` is accepted for same-origin callers that want to pass a
 * pre-computed path (e.g. including query string) rather than deriving it
 * from `req`. Satellite callers should generally omit it and let this
 * function derive the full absolute URL from `req` automatically.
 */
function resolvePrimaryOrigin(): string {
  const isSatellite = Boolean(env.clerk?.isSatellite);

  const primarySource = isSatellite ? env.clerk?.primarySignInUrl : env.appUrl;

  if (!primarySource) {
    // FAIL FAST, NOT SILENT: a missing/misconfigured value here previously
    // surfaced as a bare `Invalid URL` thrown deep inside `new URL()`, or
    // worse, silently built a sign-in URL pointing at the wrong origin.
    // Neither is diagnosable from a "stuck page" bug report — say exactly
    // what's missing instead. See REDIRECT_LOOP_AUTOPSY_AND_FIX.md, Finding #2.
    throw new Error(
      isSatellite
        ? "[redirectToSignIn] This app is configured as a Clerk satellite " +
            "(env.clerk.isSatellite=true) but env.clerk.primarySignInUrl is " +
            "not set. Check NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL."
        : "[redirectToSignIn] env.appUrl is not configured for this " +
            "(primary) app. Check APP_URL / NEXT_PUBLIC_APP_URL / " +
            "CLIENT_APP_URL resolution in lib/infrastructure/env.ts.",
    );
  }

  try {
    return new URL(primarySource).origin;
  } catch {
    throw new Error(
      isSatellite
        ? "[redirectToSignIn] env.clerk.primarySignInUrl must be an absolute URL. Check NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL."
        : "[redirectToSignIn] env.appUrl must be an absolute URL. Check APP_URL / NEXT_PUBLIC_APP_URL / CLIENT_APP_URL resolution in lib/infrastructure/env.ts.",
    );
  }
}

export function redirectToSignIn(
  req: NextRequest,
  pathname?: string,
  cspOptions?: { nonce?: string; cspValue?: string },
): NextResponse {
  const primaryOrigin = resolvePrimaryOrigin();
  const signInUrl = new URL(CLIENT_ROUTES.signIn, primaryOrigin);

  const requestOrigin = req.nextUrl.origin;
  const isPrimaryOrigin = requestOrigin === primaryOrigin;

  // Defensive loop breaker: if we're already ON the sign-in page's own
  // origin+path (e.g. a misclassified route matcher sent /sign-in itself
  // through this function), don't re-redirect to a URL identical to the
  // one the browser is already looking at — that's exactly what produces
  // an infinite-redirect / "stuck" tab. Let the request through instead so
  // the real page (or a real error) renders and the loop surfaces in logs
  // rather than as a silent browser hang.
  if (isPrimaryOrigin && req.nextUrl.pathname === CLIENT_ROUTES.signIn) {
    if (cspOptions?.nonce && cspOptions?.cspValue) {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-nonce", cspOptions.nonce);
      requestHeaders.set("Content-Security-Policy", cspOptions.cspValue);
      const res = NextResponse.next({ request: { headers: requestHeaders } });
      const cspHeaderName = env.cspReportOnly
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy";
      res.headers.set(cspHeaderName, cspOptions.cspValue);
      res.headers.set("x-nonce", cspOptions.nonce);
      return res;
    }
    return NextResponse.next();
  }

  const bounceCount = readBounce(req);
  const isDiagnosticEnv =
    env.otel?.ddEnv === "staging" ||
    Boolean(env.isVercelPreview) ||
    Boolean(env.isDev);

  if (bounceCount >= MAX_AUTH_BOUNCES && isDiagnosticEnv) {
    return authLoopDiagnostic(req, bounceCount);
  }

  const redirectTarget = isPrimaryOrigin
    ? (pathname ?? req.nextUrl.pathname + req.nextUrl.search)
    : // Non-primary (satellite) origin: always carry the full absolute URL,
      // never a bare pathname, or the post-login redirect resolves against
      // the primary domain instead of the satellite that sent the user here.
      req.nextUrl.href;

  signInUrl.searchParams.set("redirect_url", redirectTarget);
  const response = NextResponse.redirect(signInUrl);

  response.cookies.set(AUTH_BOUNCE_COOKIE, String(bounceCount + 1), {
    path: "/",
    maxAge: BOUNCE_COOKIE_TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
  });

  return response;
}

export function redirectToDashboardForRole(
  req: NextRequest,
  role?: AppRole,
): NextResponse {
  return NextResponse.redirect(new URL(dashboardForRole(role), req.url));
}

export function redirectToOnboarding(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(CLIENT_ROUTES.onboarding, req.url));
}

export function redirectToProfessionalPendingVerification(
  req: NextRequest,
): NextResponse {
  return NextResponse.redirect(
    new URL(PROFESSIONAL_ROUTES.professionalPendingVerification, req.url),
  );
}

export function redirectToMaintenance(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/maintenance", req.url));
}

export function redirectToRegistrationClosed(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/?registration=closed", req.url));
}

export function redirectToProfessionalSignupClosed(
  req: NextRequest,
): NextResponse {
  return NextResponse.redirect(new URL("/sign-up?pro=closed", req.url));
}

export function redirectToUnauthorizedSignIn(
  req: NextRequest,
  reason: string,
): NextResponse {
  const url = new URL("/unauthorized-sign-in", req.url);
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}
