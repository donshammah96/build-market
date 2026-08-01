import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Isolated in its own file on purpose: `isBypassActive` in middleware.ts is
 * computed once, at module load, from `env.auth.bypassEnabled && (env.isDev
 * || env.isCI)`. It is NOT re-evaluated per request. That means it can't be
 * flipped between test cases in the same file via a mutable mock — the
 * module has to be loaded fresh with bypass already turned on.
 *
 * NOTE: adjust this import to match your actual middleware.ts location /
 * path alias if "@/middleware" isn't correct for this repo.
 */
import middleware from "@/middleware";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (handler: (auth: () => Promise<unknown>, req: NextRequest) => unknown) =>
    (req: NextRequest) =>
      handler(() => mockAuth(), req),
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
  resolveOnboardingStatus: vi.fn(),
}));
vi.mock("@/app/lib/security/middleware/redirect-policy", () => ({
  redirectToDashboardForRole: vi.fn(),
  redirectToMaintenance: vi.fn(),
  redirectToOnboarding: vi.fn(),
  redirectToProfessionalPendingVerification: vi.fn(),
  redirectToProfessionalSignupClosed: vi.fn(),
  redirectToRegistrationClosed: vi.fn(),
  redirectToSignIn: vi.fn(),
  redirectToUnauthorizedSignIn: vi.fn(),
}));
vi.mock("@/app/lib/security/middleware/system-settings-resolver", () => ({
  resolveSystemSettings: vi.fn(),
}));
const mockLogMiddlewareDecision = vi.fn();
vi.mock("@/app/lib/security/middleware/decision-log", () => ({
  logMiddlewareDecision: (...args: unknown[]) =>
    mockLogMiddlewareDecision(...args),
}));
vi.mock("@/app/lib/security/internal-secret", () => ({
  ensureValidInternalSecret: vi.fn(() => null),
}));
// Bypass ON for this file: isDev true, bypassEnabled true.
vi.mock("@/app/lib/infrastructure/env", () => ({
  env: {
    isDev: true,
    isCI: false,
    appUrl: "http://localhost:3500",
    apiUrl: "http://localhost:3500",
    auth: { bypassEnabled: true },
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

function createMockRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost:3500${pathname}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("middleware — dev/CI auth bypass", () => {
  it("allows any route, including normally-protected ones, without calling auth()", async () => {
    const res = await middleware(createMockRequest("/dashboard"));

    expect(res.status).toBe(200);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockLogMiddlewareDecision).toHaveBeenCalledWith(
      expect.anything(),
      "mw_dev_bypass",
    );
  });

  it("allows API routes as well, bypassing the internal-secret check", async () => {
    const res = await middleware(createMockRequest("/api/internal/anything"));

    expect(res.status).toBe(200);
    expect(mockLogMiddlewareDecision).toHaveBeenCalledWith(
      expect.anything(),
      "mw_dev_bypass",
    );
  });
});
