import { createRouteMatcher } from "@clerk/nextjs/server";

export const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/homeowner-dashboard(.*)",
  "/professional-portal(.*)",
  "/messages(.*)",
  "/profile(.*)",
  "/client(.*)",
]);

export const isProfessionalRoute = createRouteMatcher([
  "/professional-portal(.*)",
]);

// NOTE: API routes are intentionally NOT included here. `/api(.*)` used to
// live in this list, which meant every API request matched isPublicRoute
// before isPublicApiRoute/isProtectedApiRoute were ever checked, silently
// bypassing auth on routes that were assumed to be protected. API routes
// must be classified explicitly via isPublicApiRoute / isProtectedApiRoute
// below, with an unclassified route treated as fail-closed in middleware.
export const isPublicRoute = createRouteMatcher([
  "/",
  "/maintenance",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/verify(.*)",
  "/sso-callback(.*)",
  "/auth-callback",
  "/unauthorized-sign-in(.*)",
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
  "/api/metrics(.*)",
  "/maintenance",
]);

const PUBLIC_API_ROUTES = [
  "/api/health(.*)",
  "/api/settings/public(.*)",
  "/api/newsletter/confirm(.*)",
  "/api/clerk-webhook",
] as const;

const INTERNAL_API_ROUTES = ["/api/internal(.*)", "/api/metrics(.*)"] as const;

export const isPublicApiRoute = createRouteMatcher(PUBLIC_API_ROUTES);
export const isInternalApiRoute = createRouteMatcher(INTERNAL_API_ROUTES);
export const isProtectedApiRoute = createRouteMatcher([
  "/api/user(.*)",
  "/api/onboarding(.*)",
  "/api/professional-portal(.*)",
]);

// Generic API matcher used ONLY by middleware to detect API paths that
// aren't covered by isPublicApiRoute, isInternalApiRoute, or isProtectedApiRoute
// above, so they can be denied by default instead of silently falling through to the
// page-route "allow everything else" branch. Deliberately excludes
// /trpc(.*) — tRPC procedures are assumed to own their own auth via
// protectedProcedure context; confirm this matches your router setup.
export const isApiRoute = createRouteMatcher(["/api(.*)"]);
