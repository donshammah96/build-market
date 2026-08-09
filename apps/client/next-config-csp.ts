// bootstrap-only: executed at Next.js config / header evaluation time.
// The module graph (app/lib/infrastructure/env.ts) is not initialized here.
// Direct env access via next-config-env.ts is intentional per ADR-004.
// See also: ADR-008 §4 (Security Header Baseline).
//
// IMPORTANT SCOPE NOTE: `headers()` in next.config.ts is evaluated once at
// build/deploy time, not per-request, so there is no way to mint a fresh
// nonce here. This file therefore CANNOT implement a strict nonce-based CSP
// no matter how it's written — that's what csp-nonce.ts + middleware is for.
// This is a static, host-allowlist-based fallback baseline that only matters
// for requests the middleware's matcher doesn't cover. Treat any CSP
// violation reports attributable to this policy (vs. the middleware policy)
// as a signal that the middleware matcher has a gap, not as "this file needs
// to be made stricter" — it structurally can't get much stricter without a
// per-request nonce.

export type CspSources = {
  appOrigin: string;
  apiOrigin: string;
  /** Derived from NEXT_PUBLIC_CLERK_FRONTEND_API. Null when not configured. */
  clerkFrontendApiOrigin: string | null;
  /** Derived from NEXT_PUBLIC_POSTHOG_HOST. Null when not configured. */
  analyticsOrigin: string | null;
  isDev: boolean;
  /**
   * Explicit Clerk satellite FAPI origins, e.g. "https://clerk.admin.buildmarket.app".
   * Replaces the former "https://*.buildmarket.app" wildcard — see csp-nonce.ts for
   * the full rationale. Defaults to [] (fails closed, not to a wildcard).
   */
  clerkSatelliteOrigins?: string[];
  /**
   * Origins Clerk's bot-protection challenge (Cloudflare Turnstile) needs to frame.
   * Only pass if Clerk Attack Protection is enabled. Defaults to null.
   */
  clerkChallengeOrigins?: string[] | null;
  /** CSP violation report endpoint (legacy `report-uri` directive). Defaults to null. */
  reportUri?: string | null;
};

/**
 * Assembles the Content-Security-Policy header value from runtime-resolved origins.
 *
 * Design notes:
 * - Called inside `headers()` so values reflect each deployment's env, not the build.
 * - All third-party entries carry an inline justification (ADR-008 §4 governance rule).
 * - `unsafe-inline` in style-src/style-src-attr is required: no per-request nonce is
 *   available at this evaluation point (see scope note above), and CSP nonces don't
 *   apply to inline style="" attributes regardless (spec limitation, not a config gap).
 * - `unsafe-eval` is dev-only. Despite the historical comment here attributing this to
 *   Clerk's production bundle, Clerk's own CSP docs say 'unsafe-eval' is a Next.js
 *   *development-server* requirement, not a production one:
 *   https://clerk.com/docs/security/clerk-csp
 */
export function buildCspValue(sources: CspSources): string {
  const {
    appOrigin,
    apiOrigin,
    clerkFrontendApiOrigin,
    analyticsOrigin,
    isDev,
    clerkSatelliteOrigins = [],
    clerkChallengeOrigins = null,
    reportUri = null,
  } = sources;

  const dedup = (arr: string[]) => [...new Set(arr)];

  const selfAndFirstParty = ["'self'", appOrigin, apiOrigin];

  const connectOrigins = [
    ...selfAndFirstParty,
    // Canonical www subdomain: RSC prefetch fetch() calls (Next.js App Router server
    // components) resolve against the page's href origin. If the page is served from
    // www.buildmarket.app but NEXT_PUBLIC_APP_URL/APP_URL is set to the Vercel deployment
    // URL, appOrigin won't cover these requests. Explicit entry ensures connect-src
    // allows them regardless of env var configuration.
    "https://www.buildmarket.app",
    // Third-party (identity): Clerk frontend API for auth/session operations.
    clerkFrontendApiOrigin,
    // Third-party (identity): Clerk FAPI for satellite domains. Explicit list, not a
    // wildcard — see clerkSatelliteOrigins doc comment.
    ...clerkSatelliteOrigins,
    // Fallback for Clerk CDN when NEXT_PUBLIC_CLERK_FRONTEND_API is unset.
    "https://*.clerk.accounts.dev",
    // Third-party (identity): Clerk telemetry.
    "https://clerk-telemetry.com",
    // Third-party (analytics): PostHog ingestion/query endpoint.
    analyticsOrigin,
    // Third-party (analytics): PostHog EU/US ingest endpoints.
    "https://us.i.posthog.com",
    "https://eu.i.posthog.com",
    // Dev-only HMR websocket endpoint; no wildcard host.
    isDev ? appOrigin.replace(/^http/, "ws") : null,
  ].filter((v): v is string => Boolean(v));

  const scriptOrigins = [
    ...selfAndFirstParty,
    // Canonical production origins: if NEXT_PUBLIC_APP_URL is the Vercel deployment URL
    // (e.g. build-market-ebon.vercel.app), appOrigin won't cover www.buildmarket.app or
    // the apex buildmarket.app. Cloudflare injects /cdn-cgi/ scripts from whichever origin
    // the request arrives on — apex when accessed via buildmarket.app, www when via
    // www.buildmarket.app. Both must be explicit since 'self' only covers the serving origin.
    "https://buildmarket.app",
    "https://www.buildmarket.app",
    // Third-party (identity): Clerk JS assets. Derived from NEXT_PUBLIC_CLERK_FRONTEND_API
    // so the origin tracks env config rather than a hardcoded hostname.
    clerkFrontendApiOrigin,
    // Third-party (identity): Clerk FAPI for satellite domains. Explicit list, not a
    // wildcard — see clerkSatelliteOrigins doc comment.
    ...clerkSatelliteOrigins,
    // Fallback for Clerk CDN when NEXT_PUBLIC_CLERK_FRONTEND_API is unset.
    "https://*.clerk.accounts.dev",
    // Third-party (CDN): jsdelivr used by some Clerk-adjacent widgets.
    "https://cdn.jsdelivr.net",
    // Third-party (identity avatars): Clerk image CDN — scripts loaded by Clerk widgets.
    "https://img.clerk.com",
    // Third-party (analytics): PostHog web SDK assets.
    analyticsOrigin,
    // Third-party (CDN): Cloudflare Insights beacon — served from Cloudflare's own CDN
    // (static.cloudflareinsights.com), not from the site origin. Cannot be proxied to
    // 'self'. Cloudflare injects this script via the Zaraz or Web Analytics product.
    "https://static.cloudflareinsights.com",
    // Third-party (CDN): Cloudflare-injected /cdn-cgi/ scripts are served from the
    // site's own origin, so 'self' covers them. Listed here for audit clarity.
  ].filter((v): v is string => Boolean(v));

  // See top-of-file note: 'unsafe-eval' is a Next.js dev-server requirement, not a
  // Clerk production requirement (https://clerk.com/docs/security/clerk-csp).
  const scriptSrcTokens = [
    isDev ? "'unsafe-eval'" : null,
    ...dedup(scriptOrigins),
  ].filter((v): v is string => Boolean(v));

  const styleOrigins = [
    "'self'",
    // No per-request nonce is available at this evaluation point (see scope note
    // at top of file) — 'unsafe-inline' is the only option for a static policy.
    "'unsafe-inline'",
    // Third-party (typography): Google Fonts stylesheet host.
    "https://fonts.googleapis.com",
  ];

  const imgOrigins = [
    "'self'",
    "data:",
    "blob:",
    // Third-party (identity avatars): Clerk image CDN.
    "https://img.clerk.com",
    // Third-party (media hosting): Cloudinary.
    "https://res.cloudinary.com",
    // Third-party (image catalog): Unsplash and related hostnames.
    "https://images.unsplash.com",
    "https://unsplash.com",
    // Third-party (placeholder avatars): Pravatar — dev/demo only.
    "https://i.pravatar.cc",
  ];

  const fontOrigins = [
    "'self'",
    "data:",
    // Third-party (CDN): jsdelivr for OpenDyslexic font
    "https://cdn.jsdelivr.net",
    // Third-party (typography): Google Fonts file host.
    "https://fonts.gstatic.com",
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrcTokens.join(" ")}`,
    // FALLBACK: Middleware injects a per-request nonce-based CSP for browser routes.
    // Keep unsafe-inline here until production confirms zero CSP violations.
    // 'self' covers Cloudflare-injected /cdn-cgi/ scripts served from the site origin.
    `script-src-elem ${dedup(["'unsafe-inline'", ...scriptOrigins]).join(" ")}`,
    `style-src ${dedup(styleOrigins).join(" ")}`,
    `img-src ${dedup(imgOrigins).join(" ")}`,
    `font-src ${dedup(fontOrigins).join(" ")}`,
    `connect-src ${dedup(connectOrigins).join(" ")}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    clerkChallengeOrigins && clerkChallengeOrigins.length > 0
      ? `frame-src 'self' ${dedup(clerkChallengeOrigins).join(" ")}`
      : null,
    isDev ? null : "upgrade-insecure-requests",
    reportUri ? `report-uri ${reportUri}` : null,
  ].filter((v): v is string => Boolean(v));

  return directives.join("; ");
}
