// bootstrap-only: executed at Next.js config / header evaluation time.
// The module graph (app/lib/infrastructure/env.ts) is not initialized here.
// Direct env access via next-config-env.ts is intentional per ADR-004.
// See also: ADR-008 §4 (Security Header Baseline).

export type CspSources = {
  appOrigin: string;
  apiOrigin: string;
  /** Derived from NEXT_PUBLIC_CLERK_FRONTEND_API. Null when not configured. */
  clerkFrontendApiOrigin: string | null;
  /** Derived from NEXT_PUBLIC_POSTHOG_HOST. Null when not configured. */
  analyticsOrigin: string | null;
  isDev: boolean;
};

/**
 * Assembles the Content-Security-Policy header value from runtime-resolved origins.
 *
 * Design notes:
 * - Called inside `headers()` so values reflect each deployment's env, not the build.
 * - All third-party entries carry an inline justification (ADR-008 §4 governance rule).
 * - `unsafe-inline` in style-src is required by Next.js runtime style injection and
 *   several UI libraries. Removing it without a nonce/hash strategy breaks the UI.
 * - `unsafe-eval` is added to script-src: Clerk's production JS bundle uses eval() internally.
 *   See https://clerk.com/docs/security/csp for Clerk's guidance on this known limitation.
 */
export function buildCspValue(sources: CspSources): string {
  const {
    appOrigin,
    apiOrigin,
    clerkFrontendApiOrigin,
    analyticsOrigin,
    isDev,
  } = sources;

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
    // Third-party (identity): Clerk FAPI for admin satellite domain (clerk.admin.buildmarket.app).
    // The admin app is a Clerk satellite; its FAPI subdomain differs from the primary.
    // Wildcard covers any future Clerk subdomain routing on the custom domain.
    "https://*.buildmarket.app",
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
    // Third-party (identity): Clerk FAPI for admin satellite domain and any future
    // Clerk subdomain routing on the custom domain (e.g. clerk.admin.buildmarket.app).
    "https://*.buildmarket.app",
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

  const styleOrigins = [
    "'self'",
    // Next.js and several UI libraries inject inline style attributes at runtime.
    // Until a nonce/hash strategy is in place this directive must remain.
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

  const dedup = (arr: string[]) => [...new Set(arr)];

  return [
    "default-src 'self'",
    // 'unsafe-eval' is required by Clerk's production JS bundle which uses eval() internally.
    // Tracked as a known Clerk limitation (see https://clerk.com/docs/security/csp).
    // Risk accepted; no user-supplied data reaches eval; Clerk SDK code is not injectable.
    `script-src 'unsafe-eval' ${dedup(scriptOrigins).join(" ")}`,
    // FALLBACK: Middleware injects a per-request nonce-based CSP for browser routes.
    // Keep unsafe-inline here until production confirms zero CSP violations.
    // 'self' covers Cloudflare-injected /cdn-cgi/ scripts served from the site origin.
    `script-src-elem 'unsafe-inline' 'self' ${dedup(scriptOrigins).join(" ")}`,
    `style-src ${dedup(styleOrigins).join(" ")}`,
    `img-src ${dedup(imgOrigins).join(" ")}`,
    `font-src ${dedup(fontOrigins).join(" ")}`,
    `connect-src ${dedup(connectOrigins).join(" ")}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}
