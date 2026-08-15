export type CspNonceOptions = {
  nonce: string;
  appOrigin: string;
  apiOrigin: string;
  clerkFrontendApiOrigin: string | null;
  analyticsOrigin: string | null;
  isDev: boolean;
  /** Whether to allow 'unsafe-eval' in script-src (dev server or Vercel preview toolbar requirement). */
  allowUnsafeEval?: boolean;
  /**
   * Explicit Clerk satellite FAPI origins, e.g. "https://clerk.admin.buildmarket.app".
   * Replaces the former "https://*.buildmarket.app" wildcard, which granted script/
   * connect trust to ANY subdomain of buildmarket.app, not just Clerk's satellite
   * hosts. Populate with the exact FAPI hosts issued per satellite domain (Clerk
   * dashboard > Domains). Defaults to [] — fails closed rather than falling back
   * to a wildcard.
   */
  clerkSatelliteOrigins?: string[];
  /**
   * Origins Clerk's bot-protection challenge (Cloudflare Turnstile) needs to frame.
   * Only pass this if Clerk's Attack Protection / bot detection is enabled for this
   * instance — see https://clerk.com/docs/security/clerk-csp. Typical values:
   * ["https://challenges.cloudflare.com", "https://*.protect.clerk.com"].
   * Defaults to null (no frame-src override; falls back to default-src 'self').
   */
  clerkChallengeOrigins?: string[] | null;
  /**
   * CSP violation report endpoint (legacy `report-uri` directive; broad browser
   * support). Point this at a route that logs reports somewhere you'll see them.
   * Defaults to null (no reporting).
   */
  reportUri?: string | null;
};

export function generateCspNonce(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("CSP nonce generation requires crypto.getRandomValues");
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);

  if (typeof btoa === "function") {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  return Buffer.from(bytes).toString("base64");
}

const dedup = (arr: string[]) => [...new Set(arr)];

export function buildCspWithNonce(opts: CspNonceOptions): string {
  const {
    nonce,
    appOrigin,
    apiOrigin,
    clerkFrontendApiOrigin,
    analyticsOrigin,
    isDev,
    allowUnsafeEval = isDev,
    clerkSatelliteOrigins = [],
    clerkChallengeOrigins = null,
    reportUri = null,
  } = opts;

  const selfAndFirstParty = ["'self'", appOrigin, apiOrigin];

  const connectOrigins = [
    ...selfAndFirstParty,
    // Canonical www subdomain: Next.js RSC prefetch fetch() calls resolve against the
    // page's href origin. If NEXT_PUBLIC_APP_URL is the Vercel deployment URL rather
    // than www.buildmarket.app, appOrigin won't cover these requests. Explicit entry
    // ensures connect-src allows them regardless of env var configuration.
    "https://www.buildmarket.app",
    // Third-party (identity): Clerk frontend API for auth/session operations.
    clerkFrontendApiOrigin,
    // Third-party (identity): Clerk FAPI for satellite domains (e.g.
    // clerk.admin.buildmarket.app). Explicit per-satellite list — see
    // clerkSatelliteOrigins doc comment. NOT a wildcard: a wildcard here would
    // trust any subdomain of buildmarket.app, not just Clerk's satellites.
    ...clerkSatelliteOrigins,
    // Fallback for Clerk CDN when NEXT_PUBLIC_CLERK_FRONTEND_API is unset.
    "https://*.clerk.accounts.dev",
    // Third-party (identity): Clerk telemetry.
    "https://clerk-telemetry.com",
    // Third-party (identity): Clerk bot protection challenge (Cloudflare Turnstile)
    "https://challenges.cloudflare.com",
    // Third-party (analytics): PostHog ingestion/query endpoint.
    analyticsOrigin,
    // Third-party (analytics): PostHog EU/US ingest endpoints (explicit for CSP).
    "https://us.i.posthog.com",
    "https://eu.i.posthog.com",
    // Vercel Live preview/toolbar endpoints & websockets
    "https://vercel.live",
    "https://*.vercel.live",
    "wss://vercel.live",
    "wss://*.vercel.live",
    // Dev-only HMR websocket endpoint; no wildcard host.
    isDev ? appOrigin.replace(/^http/, "ws") : null,
  ].filter((value): value is string => Boolean(value));

  const scriptOrigins = [
    ...selfAndFirstParty,
    // Canonical production origins: Cloudflare injects /cdn-cgi/ scripts (email-decode,
    // challenge platform, Insights) from whichever origin the request arrives on — the
    // apex buildmarket.app or www.buildmarket.app. 'self' only covers the serving origin,
    // so both must be listed explicitly. Also guards against NEXT_PUBLIC_APP_URL being
    // set to the Vercel deployment URL instead of the canonical production domain.
    "https://buildmarket.app",
    "https://www.buildmarket.app",
    // Third-party (identity): Clerk JS assets. Derived from NEXT_PUBLIC_CLERK_FRONTEND_API
    // so the origin tracks env config rather than a hardcoded hostname.
    clerkFrontendApiOrigin,
    // Third-party (identity): Clerk FAPI for satellite domains. Explicit list, not a
    // wildcard — see clerkSatelliteOrigins doc comment above.
    ...clerkSatelliteOrigins,
    // Fallback for Clerk CDN when NEXT_PUBLIC_CLERK_FRONTEND_API is unset.
    "https://*.clerk.accounts.dev",
    // Third-party (identity): Clerk bot protection challenge (Cloudflare Turnstile script)
    "https://challenges.cloudflare.com",
    // Third-party (CDN): jsdelivr used by some Clerk-adjacent widgets.
    "https://cdn.jsdelivr.net",
    // Third-party (identity avatars): Clerk image CDN — scripts loaded by Clerk widgets.
    "https://img.clerk.com",
    // Third-party (analytics): PostHog web SDK assets.
    analyticsOrigin,
    // Third-party (CDN): Cloudflare Insights beacon — served from Cloudflare's own CDN
    // (static.cloudflareinsights.com), not from the site origin. Cloudflare injects
    // this script via the Web Analytics product. Cannot be proxied to 'self'.
    "https://static.cloudflareinsights.com",
    // Vercel Live preview/toolbar scripts
    "https://vercel.live",
    "https://*.vercel.live",
  ].filter((value): value is string => Boolean(value));

  const scriptSrcTokens = [
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    allowUnsafeEval ? "'unsafe-eval'" : null,
    ...dedup(scriptOrigins),
  ].filter((value): value is string => Boolean(value));

  const styleOrigins = [
    "'self'",
    "'unsafe-inline'",
    // Third-party (typography): Google Fonts stylesheet host.
    "https://fonts.googleapis.com",
    // Vercel Live preview/toolbar inline styles
    "https://vercel.live",
    "https://*.vercel.live",
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

  const frameOrigins = [
    "'self'",
    "https://vercel.live",
    "https://*.vercel.live",
    ...(clerkChallengeOrigins ?? []),
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrcTokens.join(" ")}`,
    `script-src-elem ${dedup([`'nonce-${nonce}'`, "'strict-dynamic'", "'unsafe-inline'", ...scriptOrigins]).join(" ")}`,
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
  ].filter((value): value is string => Boolean(value));

  return directives.join("; ");
}
