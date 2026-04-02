import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseMiddlewareSessionMetadata } from "@build/auth-server/session-claims";
import {
  isOnboardingRoute,
  isProfessionalRoute,
  isProtectedRoute,
  isPublicRoute,
  isSettingsExemptRoute,
  isSignUpRoute,
} from "@/app/lib/security/middleware/route-matcher";
import { resolveOnboardingStatus } from "@/app/lib/security/middleware/onboarding-resolver";
import {
  redirectToDashboard,
  redirectToDashboardForRole,
  redirectToMaintenance,
  redirectToOnboarding,
  redirectToProfessionalPendingVerification,
  redirectToProfessionalSignupClosed,
  redirectToRegistrationClosed,
  redirectToSignIn,
} from "@/app/lib/security/middleware/redirect-policy";
import { resolveSystemSettings } from "@/app/lib/security/middleware/system-settings-resolver";
import { logMiddlewareDecision } from "@/app/lib/security/middleware/decision-log";
import { env } from "@/app/lib/infrastructure/env";
import { ROUTES } from "@/lib/links";

// =============================================================================
// Middleware
// =============================================================================

export default clerkMiddleware(async (auth, req: Request) => {
  const nextReq = req as NextRequest;
  const { pathname } = nextReq.nextUrl;
  const baseUrl = nextReq.nextUrl.origin;

  // --- DEV AUTH BYPASS ---
  // Allow all routes during local offline development without triggering Clerk checks
  if (env.auth.bypassEnabled && env.isDev) {
    logMiddlewareDecision(nextReq, "mw_dev_bypass");
    return NextResponse.next();
  }
  // --- END DEV AUTH BYPASS ---

  // 0. Maintenance mode and signup blocking (skip for exempt routes)
  if (!isSettingsExemptRoute(nextReq)) {
    const settingsResult = await resolveSystemSettings(baseUrl);
    const settings = settingsResult.settings;

    // Maintenance mode: block non-admins and non-whitelisted IPs
    if (settings.maintenanceMode) {
      const authObject = await auth();
      const metadata = parseMiddlewareSessionMetadata(authObject.sessionClaims);
      const isAdmin = String(metadata?.role ?? "").toUpperCase() === "ADMIN";

      const forwarded = nextReq.headers.get("x-forwarded-for");
      const clientIp =
        forwarded?.split(",")[0]?.trim() ??
        nextReq.headers.get("x-real-ip") ??
        "";
      const isAllowedIp = settings.allowedIPs.includes(clientIp);

      if (!isAdmin && !isAllowedIp) {
        logMiddlewareDecision(nextReq, "mw_redirect_maintenance", {
          reason: settingsResult.reason,
        });
        return redirectToMaintenance(nextReq);
      }
    }

    // Signup blocking: redirect if registration is disabled
    if (isSignUpRoute(nextReq)) {
      if (!settings.publicSignup) {
        logMiddlewareDecision(nextReq, "mw_redirect_registration_closed", {
          reason: settingsResult.reason,
        });
        return redirectToRegistrationClosed(nextReq);
      }
      if (
        pathname.startsWith("/professional/sign-up") &&
        !settings.allowProfessionalSignup
      ) {
        logMiddlewareDecision(
          nextReq,
          "mw_redirect_professional_signup_closed",
          {
            reason: settingsResult.reason,
          },
        );
        return redirectToProfessionalSignupClosed(nextReq);
      }
    }
  }

  // 1. Public routes - allow access without any checks
  if (isPublicRoute(nextReq)) {
    logMiddlewareDecision(nextReq, "mw_allow_public");
    return NextResponse.next();
  }

  // 2. Onboarding routes - require auth but have special logic
  if (isOnboardingRoute(nextReq)) {
    const authObject = await auth();
    const { userId, sessionClaims } = authObject;
    const claimsMetadata =
      sessionClaims &&
      typeof sessionClaims === "object" &&
      "metadata" in sessionClaims &&
      typeof (sessionClaims as { metadata?: unknown }).metadata === "object"
        ? ((sessionClaims as { metadata?: Record<string, unknown> })
            .metadata ?? {})
        : undefined;

    // Unauthenticated users trying to access onboarding should sign in first
    if (!userId) {
      logMiddlewareDecision(nextReq, "mw_redirect_signin", {
        routeClass: "onboarding",
      });
      return redirectToSignIn(nextReq, pathname);
    }

    const metadata = parseMiddlewareSessionMetadata(sessionClaims);
    const status = await resolveOnboardingStatus(
      userId,
      {
        ...metadata,
        status:
          typeof claimsMetadata?.status === "string"
            ? claimsMetadata.status
            : undefined,
      },
      baseUrl,
      "lenient",
    );

    if (
      status.role === "PROFESSIONAL" &&
      status.status === "PENDING_VERIFICATION"
    ) {
      logMiddlewareDecision(
        nextReq,
        "mw_redirect_professional_pending_verification",
        {
          routeClass: "onboarding",
          source: status.source,
          status: status.status,
        },
      );
      return redirectToProfessionalPendingVerification(nextReq);
    }

    // If already onboarded, redirect to their dashboard (prevent accessing onboarding again)
    if (status.isOnboarded) {
      logMiddlewareDecision(nextReq, "mw_redirect_dashboard", {
        routeClass: "onboarding",
        source: status.source,
      });
      return redirectToDashboardForRole(nextReq, status.role);
    }

    // Not onboarded - allow access to onboarding
    logMiddlewareDecision(nextReq, "mw_allow_onboarding", {
      state: status.state,
      source: status.source,
      reason: status.reason,
    });
    return NextResponse.next();
  }

  // 3. Protected routes - require authentication AND completed onboarding
  if (isProtectedRoute(nextReq)) {
    const authObject = await auth();
    const { userId, sessionClaims } = authObject;
    const claimsMetadata =
      sessionClaims &&
      typeof sessionClaims === "object" &&
      "metadata" in sessionClaims &&
      typeof (sessionClaims as { metadata?: unknown }).metadata === "object"
        ? ((sessionClaims as { metadata?: Record<string, unknown> })
            .metadata ?? {})
        : undefined;

    // Redirect unauthenticated users to sign-in with return URL
    if (!userId) {
      logMiddlewareDecision(nextReq, "mw_redirect_signin", {
        routeClass: "protected",
      });
      return redirectToSignIn(nextReq, pathname);
    }

    const metadata = parseMiddlewareSessionMetadata(sessionClaims);
    const status = await resolveOnboardingStatus(
      userId,
      {
        ...metadata,
        status:
          typeof claimsMetadata?.status === "string"
            ? claimsMetadata.status
            : undefined,
      },
      baseUrl,
      "strict",
    );

    const isPendingVerification =
      status.role === "PROFESSIONAL" &&
      status.status === "PENDING_VERIFICATION";
    const isPendingVerificationRoute =
      pathname === ROUTES.professionalPendingVerification;

    if (isPendingVerification) {
      if (!isPendingVerificationRoute) {
        logMiddlewareDecision(
          nextReq,
          "mw_redirect_professional_pending_verification",
          {
            source: status.source,
            status: status.status,
            role: status.role,
          },
        );
        return redirectToProfessionalPendingVerification(nextReq);
      }

      logMiddlewareDecision(nextReq, "mw_allow_professional_pending_verification", {
        source: status.source,
        status: status.status,
      });
      return NextResponse.next();
    }

    if (isPendingVerificationRoute && status.role === "PROFESSIONAL") {
      logMiddlewareDecision(nextReq, "mw_redirect_professional_dashboard", {
        source: status.source,
        status: status.status,
      });
      return redirectToDashboardForRole(nextReq, status.role);
    }

    // If user hasn't completed onboarding yet, redirect to onboarding
    if (status.state === "indeterminate" || !status.isOnboarded) {
      logMiddlewareDecision(nextReq, "mw_redirect_onboarding", {
        state: status.state,
        source: status.source,
        reason: status.reason,
      });
      return redirectToOnboarding(nextReq);
    }

    // Check role-based access for professional routes
    if (isProfessionalRoute(nextReq) && status.role !== "PROFESSIONAL") {
      // Non-professionals trying to access professional routes
      logMiddlewareDecision(nextReq, "mw_redirect_dashboard", {
        routeClass: "professional",
        role: status.role,
      });
      return redirectToDashboard(nextReq);
    }

    logMiddlewareDecision(nextReq, "mw_allow_protected", {
      source: status.source,
      role: status.role,
    });
  }

  // 4. All other routes - allow access
  logMiddlewareDecision(nextReq, "mw_allow_default");
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
