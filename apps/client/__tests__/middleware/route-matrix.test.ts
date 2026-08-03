import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  isOnboardingRoute,
  isProfessionalRoute,
  isProtectedRoute,
  isPublicRoute,
  isPublicApiRoute,
  isInternalApiRoute,
  isSettingsExemptRoute,
  isSignUpRoute,
} from "@/app/lib/security/middleware/route-matcher";

function createMockRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost:3500${pathname}`);
}

describe("Middleware Route Protection Matrix", () => {
  describe("isProtectedRoute Matcher", () => {
    it.each([
      "/dashboard",
      "/dashboard/overview",
      "/homeowner-dashboard",
      "/homeowner-dashboard/projects",
      "/professional-portal",
      "/professional-portal/settings",
      "/messages",
      "/messages/thread-123",
      "/profile",
      "/profile/edit",
      "/client",
      "/client/orders",
    ])("classifies %s as a protected route", (pathname) => {
      const req = createMockRequest(pathname);
      expect(isProtectedRoute(req)).toBe(true);
    });

    it.each([
      "/",
      "/sign-in",
      "/sign-up",
      "/onboarding",
      "/maintenance",
      "/professionals",
      "/api/health",
    ])("does NOT classify %s as a protected route", (pathname) => {
      const req = createMockRequest(pathname);
      expect(isProtectedRoute(req)).toBe(false);
    });
  });

  describe("isProfessionalRoute Matcher", () => {
    it.each([
      "/professional-portal",
      "/professional-portal/leads",
      "/professional-portal/projects/123",
    ])("classifies %s as a professional route", (pathname) => {
      const req = createMockRequest(pathname);
      expect(isProfessionalRoute(req)).toBe(true);
    });

    it.each([
      "/homeowner-dashboard",
      "/dashboard",
      "/profile",
      "/messages",
      "/onboarding",
    ])("does NOT classify %s as a professional route", (pathname) => {
      const req = createMockRequest(pathname);
      expect(isProfessionalRoute(req)).toBe(false);
    });
  });

  describe("isPublicRoute Matcher", () => {
    it.each([
      "/",
      "/maintenance",
      "/sign-in",
      "/sign-in/sso",
      "/sign-up",
      "/verify",
      "/sso-callback",
      "/auth-callback",
      "/unauthorized-sign-in",
      "/professionals",
      "/professional",
      "/professional/sign-up",
      "/idea-books",
      "/speak-with-an-advisor",
    ])("classifies %s as a public route", (pathname) => {
      const req = createMockRequest(pathname);
      expect(isPublicRoute(req)).toBe(true);
    });

    it.each([
      "/dashboard",
      "/homeowner-dashboard",
      "/professional-portal",
      "/messages",
      "/profile",
      "/onboarding",
      "/api/properties",
    ])("does NOT classify %s as a public route", (pathname) => {
      const req = createMockRequest(pathname);
      expect(isPublicRoute(req)).toBe(false);
    });
  });

  describe("isOnboardingRoute Matcher", () => {
    it.each(["/onboarding", "/onboarding/step-1", "/onboarding/professional"])(
      "classifies %s as an onboarding route",
      (pathname) => {
        const req = createMockRequest(pathname);
        expect(isOnboardingRoute(req)).toBe(true);
      },
    );

    it.each(["/dashboard", "/sign-in", "/sign-up", "/homeowner-dashboard"])(
      "does NOT classify %s as an onboarding route",
      (pathname) => {
        const req = createMockRequest(pathname);
        expect(isOnboardingRoute(req)).toBe(false);
      },
    );
  });

  describe("isSignUpRoute Matcher", () => {
    it.each(["/sign-up", "/sign-up/sso", "/professional/sign-up"])(
      "classifies %s as a sign-up route",
      (pathname) => {
        const req = createMockRequest(pathname);
        expect(isSignUpRoute(req)).toBe(true);
      },
    );

    it.each(["/sign-in", "/onboarding", "/dashboard"])(
      "does NOT classify %s as a sign-up route",
      (pathname) => {
        const req = createMockRequest(pathname);
        expect(isSignUpRoute(req)).toBe(false);
      },
    );
  });

  describe("isSettingsExemptRoute Matcher", () => {
    it.each([
      "/api/health",
      "/api/health/live",
      "/api/internal/user-status",
      "/maintenance",
    ])(
      "classifies %s as exempt from system settings maintenance block",
      (pathname) => {
        const req = createMockRequest(pathname);
        expect(isSettingsExemptRoute(req)).toBe(true);
      },
    );

    it.each(["/dashboard", "/onboarding", "/sign-in", "/sign-up"])(
      "does NOT classify %s as exempt from system settings",
      (pathname) => {
        const req = createMockRequest(pathname);
        expect(isSettingsExemptRoute(req)).toBe(false);
      },
    );
  });

  describe("isInternalApiRoute Matcher", () => {
    it.each([
      "/api/internal/system-settings",
      "/api/internal/user-status",
      "/api/internal/onboarding-remediation/reconcile",
      "/api/metrics",
    ])("classifies %s as an internal API route", (pathname) => {
      const req = createMockRequest(pathname);
      expect(isInternalApiRoute(req)).toBe(true);
    });

    it.each([
      "/api/health",
      "/api/user/profile",
      "/api/onboarding",
      "/dashboard",
    ])("does NOT classify %s as an internal API route", (pathname) => {
      const req = createMockRequest(pathname);
      expect(isInternalApiRoute(req)).toBe(false);
    });
  });

  describe("isPublicApiRoute Matcher", () => {
    it.each([
      "/api/health",
      "/api/settings/public",
      "/api/newsletter/confirm",
      "/api/clerk-webhook",
    ])("classifies %s as a public API route", (pathname) => {
      const req = createMockRequest(pathname);
      expect(isPublicApiRoute(req)).toBe(true);
    });

    it.each([
      "/api/internal/system-settings",
      "/api/internal/user-status",
      "/api/metrics",
      "/api/user/profile",
    ])("does NOT classify %s as a public API route", (pathname) => {
      const req = createMockRequest(pathname);
      expect(isPublicApiRoute(req)).toBe(false);
    });
  });
});
