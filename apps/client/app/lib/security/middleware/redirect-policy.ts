import { NextResponse, type NextRequest } from "next/server";
import type { AppRole } from "@/app/lib/security/roles";
import { ROUTES, dashboardForRole } from "@/lib/links";

export function redirectToSignIn(
  req: NextRequest,
  pathname: string,
): NextResponse {
  const signInUrl = new URL(ROUTES.signIn, req.url);
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
  return NextResponse.redirect(new URL(ROUTES.onboarding, req.url));
}

export function redirectToProfessionalPendingVerification(
  req: NextRequest,
): NextResponse {
  return NextResponse.redirect(
    new URL(ROUTES.professionalPendingVerification, req.url),
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
