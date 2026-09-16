import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockClerkHandler, mockClerkMiddleware } = vi.hoisted(() => {
  const mockClerkHandler = vi.fn();
  const mockClerkMiddleware = vi.fn((handler) => {
    return (req: NextRequest, event?: any) => {
      mockClerkHandler(req, event);
      return handler(() => Promise.resolve({ userId: null }), req);
    };
  });
  return { mockClerkHandler, mockClerkMiddleware };
});

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: any) => mockClerkMiddleware(handler),
  createRouteMatcher: (patterns: string[]) => {
    return (req: NextRequest) => {
      const pathname = req.nextUrl.pathname;
      return patterns.some((pattern) => {
        if (pattern.includes("(.*)")) {
          const prefix = pattern.replace("(.*)", "");
          return pathname === prefix || pathname.startsWith(prefix);
        }
        return pathname === pattern;
      });
    };
  },
}));

vi.mock("@build/auth-server/session-claims", () => ({
  parseMiddlewareSessionMetadata: () => undefined,
}));

vi.mock("@/app/lib/security/middleware/onboarding-resolver", () => ({
  resolveOnboardingStatus: () => undefined,
}));

vi.mock("@/app/lib/security/middleware/redirect-policy", () => ({
  clearAuthBounce: (res: any) => res,
  redirectToDashboardForRole: () => new Response("redirect", { status: 307 }),
  redirectToMaintenance: () => new Response("redirect", { status: 307 }),
  redirectToOnboarding: () => new Response("redirect", { status: 307 }),
  redirectToProfessionalPendingVerification: () =>
    new Response("redirect", { status: 307 }),
  redirectToProfessionalSignupClosed: () =>
    new Response("redirect", { status: 307 }),
  redirectToRegistrationClosed: () => new Response("redirect", { status: 307 }),
  redirectToSignIn: () => new Response("redirect", { status: 307 }),
  redirectToUnauthorizedSignIn: () => new Response("redirect", { status: 307 }),
}));

vi.mock("@/app/lib/security/middleware/system-settings-resolver", () => ({
  resolveSystemSettings: () =>
    Promise.resolve({
      settings: {
        maintenanceMode: false,
        publicSignup: true,
        allowProfessionalSignup: true,
        allowedIPs: [],
      },
      reason: "test-default",
    }),
}));

vi.mock("@/app/lib/security/middleware/decision-log", () => ({
  logMiddlewareDecision: vi.fn(),
}));

vi.mock("@/app/lib/security/internal-secret", () => ({
  ensureValidInternalSecret: () => null,
}));

vi.mock("@/app/lib/infrastructure/env", () => ({
  env: {
    isDev: false,
    isCI: false,
    appUrl: "http://localhost:3500",
    apiUrl: "http://localhost:3500",
    auth: { bypassEnabled: false },
    clerk: { frontendApi: "https://clerk.example.com" },
    analytics: { posthogHost: "https://posthog.example.com" },
    services: { internalApiSecret: "test-secret" },
  },
}));

vi.mock("@/app/lib/security/middleware/csp-nonce", () => ({
  generateCspNonce: () => "test-nonce",
  buildCspWithNonce: () => "default-src 'self'",
}));

vi.mock("@/lib/routes", () => ({
  PROFESSIONAL_ROUTES: {
    professionalPendingVerification:
      "/professional-portal/pending-verification",
  },
}));

import middleware from "@/middleware";

describe("middleware — Clerk dispatch regression reproduction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("REPRODUCTION: must route /sign-in through clerkMiddleware to prevent downstream auth() crash", async () => {
    const req = new NextRequest(
      "https://staging.buildmarket.app/sign-in?__clerk_ticket=test_ticket",
    );

    await middleware(req);

    // If fast-path prematurely intercepted /sign-in, clerkMiddleware was never called,
    // causing Clerk's auth() in apps/client/app/sign-in/[[...sign-in]]/page.tsx to throw
    // "Clerk: auth() was called but Clerk can't detect usage of clerkMiddleware()".
    expect(mockClerkHandler).toHaveBeenCalledTimes(1);
  });
});
