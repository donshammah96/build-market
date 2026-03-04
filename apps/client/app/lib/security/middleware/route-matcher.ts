import { createRouteMatcher } from "@clerk/nextjs/server";

export const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/professional-portal(.*)",
  "/messages(.*)",
  "/profile(.*)",
  "/client(.*)",
]);

export const isProfessionalRoute = createRouteMatcher([
  "/professional-portal(.*)",
]);

export const isPublicRoute = createRouteMatcher([
  "/",
  "/maintenance",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/verify(.*)",
  "/sso-callback(.*)",
  "/auth-callback",
  "/api(.*)",
  "/professionals(.*)",
  "/professional",
  "/professional/sign-up(.*)",
  "/idea-books(.*)",
  "/speak-with-an-advisor(.*)",
]);

export const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

export const isSignUpRoute = createRouteMatcher([
  "/sign-up(.*)",
  "/professional/sign-up(.*)",
]);

export const isSettingsExemptRoute = createRouteMatcher([
  "/api/health(.*)",
  "/api/internal(.*)",
  "/maintenance",
]);
