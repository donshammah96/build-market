import { NextResponse, type NextRequest } from "next/server";
import type { AppRole } from "@/app/lib/security/roles";
import {
  CLIENT_ROUTES,
  PROFESSIONAL_ROUTES,
  dashboardForRole,
} from "@/lib/routes";

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
