import { NextResponse, type NextRequest } from "next/server";
import type { AppRole } from "@/app/lib/security/roles";

export function redirectToSignIn(
  req: NextRequest,
  pathname: string,
): NextResponse {
  const signInUrl = new URL("/sign-in", req.url);
  signInUrl.searchParams.set("redirect_url", pathname);
  return NextResponse.redirect(signInUrl);
}

export function redirectToDashboardForRole(
  req: NextRequest,
  role?: AppRole,
): NextResponse {
  const dashboardPath =
    role === "professional" ? "/professional-portal/dashboard" : "/dashboard";
  return NextResponse.redirect(new URL(dashboardPath, req.url));
}

export function redirectToOnboarding(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/onboarding", req.url));
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

export function redirectToDashboard(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
