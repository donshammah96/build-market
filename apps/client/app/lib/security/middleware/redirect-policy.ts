import { NextResponse, type NextRequest } from "next/server";
import type { AppRole } from "@/app/lib/security/roles";
import {
  CLIENT_ROUTES,
  PROFESSIONAL_ROUTES,
  dashboardForRole,
} from "@/lib/routes";
import { env } from "@/app/lib/infrastructure/env";

/**
 * Validates a redirect target URL parameter to prevent open redirect vulnerabilities
 * while allowing internal relative paths and cross-domain satellite redirects
 * within the BuildMarket ecosystem.
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

    // 2. Exact hostname match with env.appUrl or env.adminAppUrl
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

export function redirectToSignIn(
  req: NextRequest,
  pathname: string,
): NextResponse {
  const signInUrl = new URL(CLIENT_ROUTES.signIn, req.url);
  signInUrl.searchParams.set("redirect_url", pathname);
  return NextResponse.redirect(signInUrl);
}

export function redirectToDashboardForRole(
  req: NextRequest,
  role?: AppRole,
): NextResponse {
  return NextResponse.redirect(new URL(dashboardForRole(role), req.url));
}

export function redirectToOnboarding(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(CLIENT_ROUTES.onboarding, req.url));
}

export function redirectToProfessionalPendingVerification(
  req: NextRequest,
): NextResponse {
  return NextResponse.redirect(
    new URL(PROFESSIONAL_ROUTES.professionalPendingVerification, req.url),
  );
}

export function redirectToMaintenance(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/maintenance", req.url));
}

export function redirectToRegistrationClosed(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/?registration=closed", req.url));
}

export function redirectToProfessionalSignupClosed(
  req: NextRequest,
): NextResponse {
  return NextResponse.redirect(new URL("/sign-up?pro=closed", req.url));
}

export function redirectToUnauthorizedSignIn(
  req: NextRequest,
  reason: string,
): NextResponse {
  const url = new URL("/unauthorized-sign-in", req.url);
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}
