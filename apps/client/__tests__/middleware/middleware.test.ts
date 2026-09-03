import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * These tests exercise the ORDER in which middleware.ts classifies and
 * gates requests, not the individual matchers (see route-matrix.test.ts)
 * or the internal-secret comparison logic in isolation (see
 * internal-secret.test.ts). The original production bug this suite guards
 * against was a wiring bug: every matcher was individually correct, but
 * "/api(.*)" living in isPublicRoute meant it always won before the
 * explicit public/internal/protected API checks ever ran. Matcher-only
 * tests could not have caught that; only asserting on the actual response
 * middleware() returns for a given path + auth state can.
 *
 * NOTE: adjust this import to match your actual middleware.ts location /
 * path alias if "@/middleware" isn't correct for this repo.
 */
import middleware from "@/middleware";

// --- Clerk mock (as provided) ---------------------------------------------
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

// --- Session claims ----------------------------------------------------
const mockParseMiddlewareSessionMetadata = vi.fn(
  (..._args: unknown[]) => undefined as unknown,
);
vi.mock("@build/auth-server/session-claims", () => ({
  parseMiddlewareSessionMetadata: (claims: unknown) =>
    mockParseMiddlewareSessionMetadata(claims),
}));

// --- Onboarding resolver (not exercised by the API-focused tests below,
// but middleware.ts imports it unconditionally so it must resolve) -------
const mockResolveOnboardingStatus = vi.fn((..._args: unknown[]) => undefined);
vi.mock("@/app/lib/security/middleware/onboarding-resolver", () => ({
  resolveOnboardingStatus: (...args: unknown[]) =>
    mockResolveOnboardingStatus(...args),
}));

// --- Redirect policy — each mocked as a spy returning an identifiable
// response, so tests can assert *which* redirect fired (or that none did)
// without depending on the real redirect implementation. -----------------
const redirectToDashboardForRole = vi.fn((..._args: unknown[]) =>
  NextResponse.json({ mock: "redirectToDashboardForRole" }, { status: 307 }),
);
const redirectToMaintenance = vi.fn((..._args: unknown[]) =>
  NextResponse.json({ mock: "redirectToMaintenance" }, { status: 307 }),
);
const redirectToOnboarding = vi.fn((..._args: unknown[]) =>
  NextResponse.json({ mock: "redirectToOnboarding" }, { status: 307 }),
);
const redirectToProfessionalPendingVerification = vi.fn((..._args: unknown[]) =>
  NextResponse.json(
    { mock: "redirectToProfessionalPendingVerification" },
    { status: 307 },
  ),
);
const redirectToProfessionalSignupClosed = vi.fn((..._args: unknown[]) =>
  NextResponse.json(
    { mock: "redirectToProfessionalSignupClosed" },
    { status: 307 },
  ),
);
const redirectToRegistrationClosed = vi.fn((..._args: unknown[]) =>
  NextResponse.json({ mock: "redirectToRegistrationClosed" }, { status: 307 }),
);
const redirectToSignIn = vi.fn((..._args: unknown[]) =>
  NextResponse.json({ mock: "redirectToSignIn" }, { status: 307 }),
);
const redirectToUnauthorizedSignIn = vi.fn((..._args: unknown[]) =>
  NextResponse.json({ mock: "redirectToUnauthorizedSignIn" }, { status: 307 }),
);

vi.mock("@/app/lib/security/middleware/redirect-policy", () => ({
  redirectToDashboardForRole: (...args: unknown[]) =>
    redirectToDashboardForRole(...args),
  redirectToMaintenance: (...args: unknown[]) => redirectToMaintenance(...args),
  redirectToOnboarding: (...args: unknown[]) => redirectToOnboarding(...args),
  redirectToProfessionalPendingVerification: (...args: unknown[]) =>
    redirectToProfessionalPendingVerification(...args),
  redirectToProfessionalSignupClosed: (...args: unknown[]) =>
    redirectToProfessionalSignupClosed(...args),
  redirectToRegistrationClosed: (...args: unknown[]) =>
    redirectToRegistrationClosed(...args),
  redirectToSignIn: (...args: unknown[]) => redirectToSignIn(...args),
  redirectToUnauthorizedSignIn: (...args: unknown[]) =>
    redirectToUnauthorizedSignIn(...args),
}));

// --- System settings / maintenance mode ---------------------------------
const mockResolveSystemSettings = vi.fn<(...args: unknown[]) => any>(
  () => undefined,
);
vi.mock("@/app/lib/security/middleware/system-settings-resolver", () => ({
  resolveSystemSettings: (...args: unknown[]) =>
    mockResolveSystemSettings(...args),
}));

// --- Decision log — used as the primary assertion signal for *which*
// branch fired, since it's more precise than status code alone. ---------
const mockLogMiddlewareDecision = vi.fn((..._args: unknown[]) => undefined);
vi.mock("@/app/lib/security/middleware/decision-log", () => ({
  logMiddlewareDecision: (...args: unknown[]) =>
    mockLogMiddlewareDecision(...args),
}));

// --- Internal secret — unit-tested on its own in internal-secret.test.ts,
// mocked here so these tests assert the *integration boundary*
// (middleware calls it and respects the result) rather than re-testing
// its internals. -----------------------------------------------------
const mockEnsureValidInternalSecret = vi.fn(
  (..._args: unknown[]) => null as NextResponse | null,
);
vi.mock("@/app/lib/security/internal-secret", () => ({
  ensureValidInternalSecret: (secret: string | null) =>
    mockEnsureValidInternalSecret(secret),
}));

// --- Env — bypass disabled for this file; see middleware.dev-bypass.test.ts
// for the bypass branch, which needs its own file because isBypassActive
// is computed once at module load from env, not re-evaluated per request. --
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

function createMockRequest(
  pathname: string,
  init?: { headers?: Record<string, string> },
): NextRequest {
  return new NextRequest(`http://localhost:3500${pathname}`, {
    headers: init?.headers,
  });
}

function eventsLogged(): string[] {
  return mockLogMiddlewareDecision.mock.calls.map((call) => call[1] as string);
}

const DEFAULT_SETTINGS = {
  settings: {
    maintenanceMode: false,
    publicSignup: true,
    allowProfessionalSignup: true,
    allowedIPs: [] as string[],
  },
  reason: "test-default",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveSystemSettings.mockResolvedValue(DEFAULT_SETTINGS);
  mockAuth.mockResolvedValue({ userId: null, sessionClaims: null });
  mockParseMiddlewareSessionMetadata.mockReturnValue(undefined);
  mockEnsureValidInternalSecret.mockReturnValue(null);
});

describe("middleware — API route classification order", () => {
  it("denies dormant capability deep links before auth or route classification", async () => {
    const res = await middleware(createMockRequest("/api/properties/property_1"));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Not found" });
    expect(mockAuth).not.toHaveBeenCalled();
    expect(eventsLogged()).toContain("mw_deny_disabled_capability");
  });

  it("allows public API routes without calling auth()", async () => {
    const res = await middleware(createMockRequest("/api/health"));
    expect(res.status).toBe(200);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(eventsLogged()).toContain("mw_allow_public_api");
  });

  it("denies unauthenticated requests to protected API routes with a JSON 401, not a redirect", async () => {
    mockAuth.mockResolvedValue({ userId: null, sessionClaims: null });

    const res = await middleware(createMockRequest("/api/user/profile"));

    expect(res.status).toBe(401);
    expect(redirectToSignIn).not.toHaveBeenCalled();
    expect(eventsLogged()).toContain("mw_deny_protected_api_unauthenticated");
  });

  it("allows authenticated requests to protected API routes", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_123",
      sessionClaims: { metadata: {} },
    });
    mockParseMiddlewareSessionMetadata.mockReturnValue({});

    const res = await middleware(createMockRequest("/api/user/profile"));

    expect(res.status).toBe(200);
    expect(eventsLogged()).toContain("mw_allow_protected_api");
  });

  it("denies suspended/blocked accounts on protected API routes", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_123",
      sessionClaims: { metadata: { status: "SUSPENDED" } },
    });
    mockParseMiddlewareSessionMetadata.mockReturnValue({
      status: "SUSPENDED",
    });

    const res = await middleware(createMockRequest("/api/onboarding/status"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Account suspended");
    expect(eventsLogged()).toContain("mw_deny_protected_api_blocked");
  });

  it("delegates internal API auth to ensureValidInternalSecret and denies on failure", async () => {
    mockEnsureValidInternalSecret.mockReturnValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );

    const res = await middleware(
      createMockRequest("/api/internal/system-settings", {
        headers: { "x-internal-secret": "wrong-secret" },
      }),
    );

    expect(res.status).toBe(403);
    expect(mockEnsureValidInternalSecret).toHaveBeenCalledWith("wrong-secret");
    // Internal routes are service-to-service; Clerk auth should never run.
    expect(mockAuth).not.toHaveBeenCalled();
    expect(eventsLogged()).toContain("mw_deny_internal_api_unauthorized");
  });

  it("allows internal API routes when ensureValidInternalSecret passes", async () => {
    mockEnsureValidInternalSecret.mockReturnValue(null);

    const res = await middleware(
      createMockRequest("/api/internal/user-status", {
        headers: { "x-internal-secret": "correct-secret" },
      }),
    );

    expect(res.status).toBe(200);
    expect(eventsLogged()).toContain("mw_allow_internal_api");
  });

  it("fails closed on unclassified /api paths instead of falling through to default-allow", async () => {
    const res = await middleware(
      createMockRequest("/api/some-new-endpoint-nobody-classified-yet"),
    );

    expect(res.status).toBe(401);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(eventsLogged()).toContain("mw_deny_api_unclassified");
  });

  it("REGRESSION: never classifies protected or internal API paths as public", async () => {
    // This is the direct guard against the original bug: "/api(.*)" living
    // in isPublicRoute caused every one of these to return 200 with no
    // auth check at all, silently, with isPublicApiRoute/isProtectedApiRoute
    // never even being reached.
    const sensitivePaths = [
      "/api/user/profile",
      "/api/onboarding/status",
      "/api/professional-portal/leads",
      "/api/internal/system-settings",
    ];

    for (const path of sensitivePaths) {
      vi.clearAllMocks();
      mockResolveSystemSettings.mockResolvedValue(DEFAULT_SETTINGS);
      mockAuth.mockResolvedValue({ userId: null, sessionClaims: null });
      mockEnsureValidInternalSecret.mockReturnValue(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      );

      const res = await middleware(createMockRequest(path));

      expect(res.status).not.toBe(200);
      expect(eventsLogged()).not.toContain("mw_allow_public");
    }
  });

  it("exempts /api/metrics from the maintenance-mode gate", async () => {
    mockResolveSystemSettings.mockResolvedValue({
      settings: {
        maintenanceMode: true,
        publicSignup: true,
        allowProfessionalSignup: true,
        allowedIPs: [],
      },
      reason: "maintenance-window",
    });
    mockEnsureValidInternalSecret.mockReturnValue(null);

    const res = await middleware(
      createMockRequest("/api/metrics", {
        headers: { "x-internal-secret": "correct-secret" },
      }),
    );

    expect(res.status).toBe(200);
    expect(redirectToMaintenance).not.toHaveBeenCalled();
    // Settings-exempt routes should skip the settings lookup entirely.
    expect(mockResolveSystemSettings).not.toHaveBeenCalled();
  });
});

describe("middleware — page route classification order", () => {
  it("redirects to maintenance for non-exempt page routes when maintenance mode is on", async () => {
    mockResolveSystemSettings.mockResolvedValue({
      settings: {
        maintenanceMode: true,
        publicSignup: true,
        allowProfessionalSignup: true,
        allowedIPs: [],
      },
      reason: "maintenance-window",
    });
    mockAuth.mockResolvedValue({ userId: null, sessionClaims: null });

    const res = await middleware(createMockRequest("/dashboard"));

    expect(redirectToMaintenance).toHaveBeenCalled();
    expect(res.status).toBe(307);
  });

  it("allows public page routes without calling auth()", async () => {
    const res = await middleware(createMockRequest("/"));

    expect(res.status).toBe(200);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(eventsLogged()).toContain("mw_allow_public");
  });

  it("redirects unauthenticated users on protected page routes to sign-in", async () => {
    mockAuth.mockResolvedValue({ userId: null, sessionClaims: null });

    const res = await middleware(createMockRequest("/dashboard"));

    expect(redirectToSignIn).toHaveBeenCalled();
    expect(res.status).toBe(307);
  });
});
