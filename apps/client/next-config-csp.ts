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

  const isVercelPreview =
    process.env.VERCEL_ENV === "preview" ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ||
    process.env.ENABLE_CSP_UNSAFE_EVAL === "true";

  const allowUnsafeEval = isDev || isVercelPreview;

  const dedup = (arr: string[]) => [...new Set(arr)];

  const selfAndFirstParty = ["'self'", appOrigin, apiOrigin];

  const connectOrigins = [
    ...selfAndFirstParty,
    "https://www.buildmarket.app",
    "https://staging.buildmarket.app",
    clerkFrontendApiOrigin,
    "https://clerk.staging.buildmarket.app",
    "https://api.clerk.com",
    ...clerkSatelliteOrigins,
    "https://*.clerk.accounts.dev",
    "https://clerk-telemetry.com",
    // Third-party (identity): Clerk bot protection challenge (Cloudflare Turnstile)
    "https://challenges.cloudflare.com",
    analyticsOrigin,
    "https://us.i.posthog.com",
    "https://eu.i.posthog.com",
    "https://vercel.live",
    "https://*.vercel.live",
    "wss://vercel.live",
    "wss://*.vercel.live",
    isDev ? appOrigin.replace(/^http/, "ws") : null,
  ].filter((v): v is string => Boolean(v));

  const scriptOrigins = [
    ...selfAndFirstParty,
    "https://buildmarket.app",
    "https://www.buildmarket.app",
    "https://staging.buildmarket.app",
    clerkFrontendApiOrigin,
    "https://clerk.staging.buildmarket.app",
    ...clerkSatelliteOrigins,
    "https://*.clerk.accounts.dev",
    // Third-party (identity): Clerk bot protection challenge (Cloudflare Turnstile script)
    "https://challenges.cloudflare.com",
    "https://cdn.jsdelivr.net",
    "https://img.clerk.com",
    analyticsOrigin,
    "https://static.cloudflareinsights.com",
    "https://vercel.live",
    "https://*.vercel.live",
  ].filter((v): v is string => Boolean(v));

  const scriptSrcTokens = [
    allowUnsafeEval ? "'unsafe-eval'" : null,
    ...dedup(scriptOrigins),
  ].filter((v): v is string => Boolean(v));

  const styleOrigins = [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://vercel.live",
    "https://*.vercel.live",
  ];

  const imgOrigins = [
    "'self'",
    "data:",
    "blob:",
    "https://img.clerk.com",
    "https://res.cloudinary.com",
    "https://images.unsplash.com",
    "https://unsplash.com",
    "https://i.pravatar.cc",
  ];

  const fontOrigins = [
    "'self'",
    "data:",
    "https://cdn.jsdelivr.net",
    "https://fonts.gstatic.com",
  ];

  const frameOrigins = [
    "'self'",
    "https://staging.buildmarket.app",
    "https://clerk.staging.buildmarket.app",
    "https://vercel.live",
    "https://*.vercel.live",
    ...(clerkChallengeOrigins ?? [
      "https://challenges.cloudflare.com",
      "https://*.protect.clerk.com",
    ]),
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrcTokens.join(" ")}`,
    `script-src-elem ${dedup(["'unsafe-inline'", ...scriptOrigins]).join(" ")}`,
    `style-src ${dedup(styleOrigins).join(" ")}`,
    `style-src-elem ${dedup(styleOrigins).join(" ")}`,
    "style-src-attr 'unsafe-inline'",
    `img-src ${dedup(imgOrigins).join(" ")}`,
    `font-src ${dedup(fontOrigins).join(" ")}`,
    `connect-src ${dedup(connectOrigins).join(" ")}`,
    `frame-src ${dedup(frameOrigins).join(" ")}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    isDev ? null : "upgrade-insecure-requests",
    reportUri ? `report-uri ${reportUri}` : null,
  ].filter((v): v is string => Boolean(v));

  return directives.join("; ");
}
