export type CspNonceOptions = {
  nonce: string;
  appOrigin: string;
  apiOrigin: string;
  clerkFrontendApiOrigin: string | null;
  analyticsOrigin: string | null;
  isDev: boolean;
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
    // (static.cloudflareinsights.com), not from the site origin. Cloudflare injects
    // this script via the Web Analytics product. Cannot be proxied to 'self'.
    "https://static.cloudflareinsights.com",
    // Third-party (CDN): Cloudflare-injected /cdn-cgi/ scripts are served from
    // the site's own origin, so 'self' covers them. No additional origin needed.
  ].filter((value): value is string => Boolean(value));

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

  return [
    "default-src 'self'",
    // 'unsafe-eval' is required by Clerk's production JS bundle which uses eval() internally.
    // Tracked as a known Clerk limitation (see https://clerk.com/docs/security/csp).
    // Risk accepted; no user-supplied data reaches eval; Clerk SDK code is not injectable.
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' ${dedup(scriptOrigins).join(" ")}`,
    // 'strict-dynamic' delegates trust to scripts loaded by nonce-authorized scripts.
    // Origin allowlists are retained as fallbacks for browsers without strict-dynamic support.
    // 'self' covers Cloudflare-injected /cdn-cgi/ scripts served from the site origin.
    // 'unsafe-inline' is required as a strict-dynamic fallback for Clerk's embedded components.
    // Browsers supporting 'strict-dynamic' silently ignore 'unsafe-inline' (no security regression).
    // Browsers that support script-src-elem but not strict-dynamic (e.g. older Safari) fall back
    // to 'unsafe-inline', which Clerk needs to initialize its <SignIn>/<SignUp> component scripts.
    // This matches the static CSP layer in next-config-csp.ts and Clerk's own CSP guidance.
    `script-src-elem 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'self' ${dedup(scriptOrigins).join(" ")}`,
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
