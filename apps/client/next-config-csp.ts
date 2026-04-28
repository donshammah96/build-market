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
 * - `unsafe-eval` is deliberately absent — no dynamic code execution is permitted.
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
    // Third-party (identity): Clerk frontend API for auth/session operations.
    clerkFrontendApiOrigin,
    // Third-party (analytics): PostHog ingestion/query endpoint.
    analyticsOrigin,
    // Dev-only HMR websocket endpoint; no wildcard host.
    isDev ? appOrigin.replace(/^http/, "ws") : null,
  ].filter((v): v is string => Boolean(v));

  const scriptOrigins = [
    ...selfAndFirstParty,
    // Third-party (identity): Clerk JS assets. Derived from NEXT_PUBLIC_CLERK_FRONTEND_API
    // so the origin tracks env config rather than a hardcoded hostname.
    clerkFrontendApiOrigin,
    // Third-party (CDN): jsdelivr used by some Clerk-adjacent widgets.
    "https://cdn.jsdelivr.net",
    // Third-party (identity avatars): Clerk image CDN — scripts loaded by Clerk widgets.
    "https://img.clerk.com",
    // Third-party (analytics): PostHog web SDK assets.
    analyticsOrigin,
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
    // Third-party (typography): Google Fonts file host.
    "https://fonts.gstatic.com",
  ];

  const dedup = (arr: string[]) => [...new Set(arr)];

  return [
    "default-src 'self'",
    `script-src ${dedup(scriptOrigins).join(" ")}`,
    `style-src ${dedup(styleOrigins).join(" ")}`,
    `img-src ${dedup(imgOrigins).join(" ")}`,
    `font-src ${dedup(fontOrigins).join(" ")}`,
    `connect-src ${dedup(connectOrigins).join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}
