/**
 * @build/security-clerk
 * ============================================================================
 * Shared Clerk satellite domain authentication mechanics, open-redirect
 * security, and session freshness helpers.
 *
 * Extracted per AUTH_HARDENING_RECOMMENDATIONS.md Finding 7: apps/admin and
 * apps/verification-ops previously carried byte-for-byte identical copies of
 * `isAbsoluteHttpUrl`, `normalizeClerkDomain`, `deriveFallbackPrimarySignInUrl`,
 * and `resolvePrimarySignInUrl`. This is now the single canonical copy; both
 * apps' middleware files should import from here rather than redefine.
 */

/** Returns true only if `value` parses as a well-formed absolute http(s) URL. */
export function isAbsoluteHttpUrl(
  value: string | null | undefined,
): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Normalize a Clerk `domain` option to a bare host (e.g., "buildmarket.app").
 * Strips schemes if present.
 */
export function normalizeClerkDomain(
  value: string | null | undefined,
): string | null {
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

/** Known shared hosting preview suffixes where stripping a subdomain label would yield invalid apex hosts. */
const KNOWN_SHARED_HOSTING_SUFFIXES = ["vercel.app", "vercel.sh"];

/**
 * Best-effort fallback for primary domain sign-in URL when `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` is unset.
 * Strips the leftmost subdomain label unless hosted on a shared preview suffix like *.vercel.app.
 *
 * Per autopsy Drift 5 / recommendation §6.2: this heuristic is a safety net
 * only. It must never be relied on in place of setting
 * `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` for production/staging Vercel
 * environment targets — callers in prod-like profiles should treat an
 * unresolved primary sign-in URL as a hard configuration error rather than
 * silently falling through to this derivation.
 */
export function deriveFallbackPrimarySignInUrl(req: {
  nextUrl: { protocol: string; host: string };
}): string | null {
  const { protocol, host } = req.nextUrl;
  const labels = host.split(".");

  if (labels.length <= 2) {
    return null;
  }

  const apexCandidate = labels.slice(-2).join(".");
  if (KNOWN_SHARED_HOSTING_SUFFIXES.includes(apexCandidate)) {
    return null;
  }

  const apexHost = labels.slice(1).join(".");
  return `${protocol}//${apexHost}/sign-in`;
}

// Request-scoped memoization map to avoid resolving primary sign-in twice per request (Finding 10)
const requestPrimarySignInCache = new WeakMap<object, string | null>();

/**
 * Resolve the primary sign-in URL for a satellite request.
 * Caches resolution on the `req` reference to avoid duplicate computations and logs.
 *
 * Finding 10: previously the dynamic Clerk options resolver AND the
 * unauthenticated-request handler each independently called an equivalent
 * of this function against the same `req`, doubling both computation and
 * `console.error` noise on every misconfigured request. Callers should
 * invoke this once per request (e.g. from the options resolver) and let the
 * WeakMap cache short-circuit the second call from the handler body.
 */
export function resolvePrimarySignInUrl(
  req: { nextUrl: { protocol: string; host: string } },
  configuredUrl?: string | null,
  loggerName = "middleware",
): string | null {
  if (typeof req === "object" && req !== null) {
    if (requestPrimarySignInCache.has(req)) {
      return requestPrimarySignInCache.get(req) ?? null;
    }
  }

  let resolved: string | null = null;

  if (configuredUrl) {
    if (isAbsoluteHttpUrl(configuredUrl)) {
      resolved = configuredUrl;
    } else {
      console.error(
        `[${loggerName}] NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL="${configuredUrl}" ` +
          "is not an absolute http(s) URL. Ignoring it and falling back to host-derivation.",
      );
      resolved = deriveFallbackPrimarySignInUrl(req);
    }
  } else {
    resolved = deriveFallbackPrimarySignInUrl(req);
  }

  if (typeof req === "object" && req !== null) {
    requestPrimarySignInCache.set(req, resolved);
  }

  return resolved;
}

export interface AllowedEnvUrls {
  appUrl?: string;
  adminAppUrl?: string;
  clientAppUrl?: string;
  verificationAppUrl?: string;
}

/**
 * Validates a redirect target URL parameter to prevent open redirect vulnerabilities
 * while allowing internal relative paths and cross-domain satellite redirects within the BuildMarket ecosystem.
 *
 * Closes Drift 1: callers pass their own `AllowedEnvUrls` so every app
 * (including `clientAppUrl`, previously missing from some copies of this
 * check) is evaluated against the same allow-list logic.
 */
export function getSafeRedirectUrl(
  target?: string | null,
  envUrls?: AllowedEnvUrls,
): string | null {
  if (!target || typeof target !== "string") {
    return null;
  }

  const trimmed = target.trim();
  if (!trimmed) {
    return null;
  }

  // Relative paths (e.g. /homeowner-dashboard, /profile)
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.startsWith("/:")
  ) {
    return trimmed;
  }

  // Absolute URLs (e.g. https://verification.buildmarket.app/ or http://localhost:3000)
  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();

    // 1. BuildMarket domain and all subdomains (*.buildmarket.app or buildmarket.app)
    if (
      hostname === "buildmarket.app" ||
      hostname.endsWith(".buildmarket.app")
    ) {
      return trimmed;
    }

    // 2. Hostname matches against configured app URLs
    if (envUrls) {
      const checkUrls = [
        envUrls.appUrl,
        envUrls.adminAppUrl,
        envUrls.clientAppUrl,
        envUrls.verificationAppUrl,
      ];

      for (const rawUrl of checkUrls) {
        if (!rawUrl) continue;
        try {
          const appHost = new URL(rawUrl).hostname.toLowerCase();
          if (hostname === appHost) return trimmed;
        } catch {
          // ignore invalid URL
        }
      }
    }

    // 3. Local development loopback
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return trimmed;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Asserts whether a JWT session claim's issuance time (iat) is within `maxAgeSeconds`.
 * Used for Tier 1 (180s) and Tier 2 (300s) session freshness verification
 * (autopsy §6.3 / hardening doc §3, closing Drift 3).
 */
export function isClaimFresh(
  sessionClaims: unknown,
  maxAgeSeconds: number,
): boolean {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return false;
  }
  const claims = sessionClaims as Record<string, unknown>;
  const iat = claims.iat;
  if (typeof iat !== "number" || Number.isNaN(iat) || iat <= 0) {
    return false;
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - iat;
  return ageSeconds >= 0 && ageSeconds <= maxAgeSeconds;
}
