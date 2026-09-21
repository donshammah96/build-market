import { env } from "@/app/lib/infrastructure/env";
import { getSafeRedirectUrl as getSafeRedirectUrlShared } from "@build/security-clerk";

/**
 * Validates a redirect target URL parameter to prevent open redirect vulnerabilities
 * while allowing internal relative paths and cross-domain satellite redirects
 * within the BuildMarket ecosystem.
 *
 * Client-Safe: This module contains NO dependencies on `next/server` (NextRequest/NextResponse)
 * and can be safely imported by client components ("use client") and server components alike.
 *
 * Thin wrapper around `@build/security-clerk`'s canonical `getSafeRedirectUrl` (Finding 7 /
 * Drift 1): the allow-list logic itself now lives in exactly one place, and this app just
 * supplies its own env-resolved origins. `env.clientAppUrl` is included in the allow-list
 * check below (already present in this app's copy prior to this change — the autopsy's
 * Drift 1 gap was in other apps' copies of this file, not this one).
 */
export function getSafeRedirectUrl(target?: string | null): string | null {
  return getSafeRedirectUrlShared(target, {
    appUrl: env.appUrl,
    adminAppUrl: env.adminAppUrl,
    clientAppUrl: env.clientAppUrl,
    verificationAppUrl: env.verificationAppUrl,
  });
}
