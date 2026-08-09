export type CspNonceOptions = {
  nonce: string;
  appOrigin: string;
  apiOrigin: string;
  clerkFrontendApiOrigin: string | null;
  analyticsOrigin: string | null;
  isDev: boolean;
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
    // Third-party (analytics): PostHog ingestion/query endpoint.
    analyticsOrigin,
    // Third-party (analytics): PostHog EU/US ingest endpoints (explicit for CSP).
    "https://us.i.posthog.com",
    "https://eu.i.posthog.com",
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
    // Third-party (CDN): Cloudflare-injected /cdn-cgi/ scripts are served from
    // the site's own origin, so 'self' covers them. No additional origin needed.
  ].filter((value): value is string => Boolean(value));

  // 'unsafe-eval' is a Next.js *development-server* requirement, not a Clerk
  // production requirement — Clerk's own CSP guidance is explicit about this:
  // https://clerk.com/docs/security/clerk-csp ("script-src 'unsafe-eval' is a
  // requirement for Next.js to run in development environments"). Shipping it
  // to production removes a real mitigation (eval/new Function/string-timer
  // sinks) for no benefit, so it's gated to dev only.
  const scriptSrcTokens = [
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDev ? "'unsafe-eval'" : null,
    ...dedup(scriptOrigins),
  ].filter((value): value is string => Boolean(value));

  const styleOrigins = [
    "'self'",
    `'nonce-${nonce}'`,
    // Fallback for browsers that predate nonce-source support on style-src.
    // Browsers that DO support nonces ignore 'unsafe-inline' automatically once
    // a nonce-source is present (CSP3 backward-compat behavior), so this adds
    // no risk on modern browsers — same pattern already used for script-src-elem.
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
    // 'strict-dynamic' delegates trust to scripts loaded by nonce-authorized scripts.
    // Origin allowlists are retained as fallbacks for browsers without strict-dynamic support.
    // 'self' covers Cloudflare-injected /cdn-cgi/ scripts served from the site origin.
    // 'unsafe-inline' is required as a strict-dynamic fallback for Clerk's embedded components.
    // Browsers supporting 'strict-dynamic' silently ignore 'unsafe-inline' (no security regression).
    // Browsers that support script-src-elem but not strict-dynamic (e.g. older Safari) fall back
    // to 'unsafe-inline', which Clerk needs to initialize its <SignIn>/<SignUp> component scripts.
    // This matches the static CSP layer in next-config-csp.ts and Clerk's own CSP guidance.
    `script-src-elem ${dedup([`'nonce-${nonce}'`, "'strict-dynamic'", "'unsafe-inline'", ...scriptOrigins]).join(" ")}`,
    // style-src: kept as the CSP2 fallback for browsers without style-src-elem/-attr support.
    `style-src ${dedup(styleOrigins).join(" ")}`,
    // style-src-elem: covers <style> tags (styled-jsx output, CSS-in-JS libs) via nonce.
    `style-src-elem ${dedup(styleOrigins).join(" ")}`,
    // style-src-attr: CSP nonces do NOT apply to inline style="" attributes (spec limitation —
    // nonces are element-scoped, not attribute-scoped). Next.js and several UI libraries still
    // set style="" at runtime, so 'unsafe-inline' remains required here. This is a known,
    // tracked gap, not an oversight — closing it needs either auditing/removing those call
    // sites or adopting 'unsafe-hashes' with per-value hashes (CSP3).
    "style-src-attr 'unsafe-inline'",
    `img-src ${dedup(imgOrigins).join(" ")}`,
    `font-src ${dedup(fontOrigins).join(" ")}`,
    `connect-src ${dedup(connectOrigins).join(" ")}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    // Only set if Clerk bot-protection (Cloudflare Turnstile) is enabled for this
    // instance — see clerkChallengeOrigins doc comment above.
    clerkChallengeOrigins && clerkChallengeOrigins.length > 0
      ? `frame-src 'self' ${dedup(clerkChallengeOrigins).join(" ")}`
      : null,
    // Meaningless on http://localhost in dev; standard hardening in production.
    isDev ? null : "upgrade-insecure-requests",
    reportUri ? `report-uri ${reportUri}` : null,
  ].filter((value): value is string => Boolean(value));

  return directives.join("; ");
}
