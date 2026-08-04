import { env } from "@/app/lib/infrastructure/env";

/**
 * Validates a redirect target URL parameter to prevent open redirect vulnerabilities
 * while allowing internal relative paths and cross-domain satellite redirects
 * within the BuildMarket ecosystem.
 *
 * Client-Safe: This module contains NO dependencies on `next/server` (NextRequest/NextResponse)
 * and can be safely imported by client components ("use client") and server components alike.
 */
export function getSafeRedirectUrl(target?: string | null): string | null {
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

    // 2. Exact hostname match with env.appUrl, env.adminAppUrl, or env.verificationAppUrl
    if (env.appUrl) {
      try {
        const appHost = new URL(env.appUrl).hostname.toLowerCase();
        if (hostname === appHost) return trimmed;
      } catch {
        // ignore invalid URL
      }
    }

    if (env.adminAppUrl) {
      try {
        const adminHost = new URL(env.adminAppUrl).hostname.toLowerCase();
        if (hostname === adminHost) return trimmed;
      } catch {
        // ignore invalid URL
      }
    }

    if (env.verificationAppUrl) {
      try {
        const verificationHost = new URL(
          env.verificationAppUrl,
        ).hostname.toLowerCase();
        if (hostname === verificationHost) return trimmed;
      } catch {
        // ignore invalid URL
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
