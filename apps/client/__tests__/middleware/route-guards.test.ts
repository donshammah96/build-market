import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ROUTES } from "@/lib/links";

const mockAuth = vi.fn();
const mockResolveOnboardingStatus = vi.fn();
const mockResolveSystemSettings = vi.fn();

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

vi.mock("@/app/lib/security/middleware/onboarding-resolver", () => ({
  resolveOnboardingStatus: (...args: unknown[]) =>
    mockResolveOnboardingStatus(...args),
}));

vi.mock("@/app/lib/security/middleware/system-settings-resolver", () => ({
  resolveSystemSettings: (...args: unknown[]) =>
    mockResolveSystemSettings(...args),
}));

vi.mock("@/app/lib/security/middleware/decision-log", () => ({
  logMiddlewareDecision: vi.fn(),
}));

vi.mock("@/app/lib/security/middleware/csp-nonce", () => ({
  generateCspNonce: () => "test-nonce-stable",
  buildCspWithNonce: ({ nonce }: { nonce: string }) =>
    `default-src 'self'; script-src 'nonce-${nonce}'; script-src-elem 'nonce-${nonce}'`,
}));

vi.mock("@/app/lib/security/middleware/redirect-policy", () => ({
  redirectToSignIn: (req: NextRequest, pathname: string) =>
    NextResponse.redirect(
      new URL(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`, req.url),
    ),
  redirectToDashboardForRole: (req: NextRequest) =>
    NextResponse.redirect(new URL("/homeowner-dashboard", req.url)),
  redirectToOnboarding: (req: NextRequest) =>
    NextResponse.redirect(new URL("/onboarding", req.url)),
  redirectToProfessionalPendingVerification: (req: NextRequest) =>
    NextResponse.redirect(
      new URL("/professional-portal/pending-verification", req.url),
    ),
  redirectToMaintenance: (req: NextRequest) =>
    NextResponse.redirect(new URL("/maintenance", req.url)),
  redirectToRegistrationClosed: (req: NextRequest) =>
    NextResponse.redirect(new URL("/?registration=closed", req.url)),
  redirectToProfessionalSignupClosed: (req: NextRequest) =>
    NextResponse.redirect(new URL("/sign-up?pro=closed", req.url)),
}));

import middleware from "@/middleware";

function assertResponse(
  res: Awaited<ReturnType<typeof middleware>>,
): asserts res is Response | NextResponse {
  if (!(res instanceof Response)) {
    throw new Error("Expected middleware to return a response");
  }
}

function expectDocumentCspHeaders(res: Response | NextResponse) {
  const csp = res.headers.get("Content-Security-Policy");

  expect(csp).toBeTruthy();
  expect(csp).toContain("script-src 'nonce-test-nonce-stable'");
  expect(csp).toContain("script-src-elem 'nonce-test-nonce-stable'");
  expect(csp).not.toContain("script-src-elem 'unsafe-inline'");
}

function expectRedirectNoCsp(res: Response | NextResponse) {
  const csp = res.headers.get("Content-Security-Policy");

  expect(csp).toBeNull();
}

describe("middleware route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.INTERNAL_API_SECRET;
    Object.assign(process.env, { NODE_ENV: "test" });
    process.env.BYPASS_AUTH = "false";
    mockResolveSystemSettings.mockResolvedValue({
      state: "resolved",
      settings: {
        maintenanceMode: false,
        maintenanceMessage: null,
        publicSignup: true,
        allowProfessionalSignup: true,
        allowedIPs: [],
      },
      source: "internal_api",
      reason: "internal_api_resolved",
      cacheStrategy: "shared_service_or_metadata",
    });
    mockResolveOnboardingStatus.mockResolvedValue({
      state: "resolved",
      isOnboarded: false,
      role: "CLIENT",
      source: "metadata",
      confidence: "high",
      reason: "metadata_present",
    });
  });

  it("redirects unauthenticated protected requests to sign-in", async () => {
    mockAuth.mockResolvedValue({ userId: null, sessionClaims: null });
    const req = new NextRequest(`http://localhost:3500${ROUTES.userDashboard}`);

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expectRedirectNoCsp(res);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
    expect(res.headers.get("location")).toContain(
      `redirect_url=${encodeURIComponent(ROUTES.userDashboard)}`,
    );
  });

  it("allows onboarded professional access to professional routes", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_1",
      sessionClaims: {
        metadata: { role: "PROFESSIONAL", isOnboarded: true },
      },
    });
    mockResolveOnboardingStatus.mockResolvedValueOnce({
      state: "resolved",
      isOnboarded: true,
      role: "PROFESSIONAL",
      source: "metadata",
      confidence: "high",
      reason: "metadata_present",
    });
    const req = new NextRequest("http://localhost:3500/professional-portal");

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expectDocumentCspHeaders(res);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects non-professional users away from professional routes", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_2",
      sessionClaims: {
        metadata: { role: "CLIENT", isOnboarded: true },
      },
    });
    mockResolveOnboardingStatus.mockResolvedValueOnce({
      state: "resolved",
      isOnboarded: true,
      role: "CLIENT",
      source: "metadata",
      confidence: "high",
      reason: "metadata_present",
    });
    const req = new NextRequest("http://localhost:3500/professional-portal");

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expectRedirectNoCsp(res);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain(ROUTES.userDashboard);
  });

  it("redirects authenticated but not-onboarded users to onboarding", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_3",
      sessionClaims: {
        metadata: { role: "CLIENT", isOnboarded: false },
      },
    });
    const req = new NextRequest(`http://localhost:3500${ROUTES.userDashboard}`);

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expectRedirectNoCsp(res);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/onboarding");
  });

  it("redirects non-admin users to maintenance when maintenance mode is on", async () => {
    mockResolveSystemSettings.mockResolvedValueOnce({
      state: "resolved",
      settings: {
        maintenanceMode: true,
        maintenanceMessage: "down",
        publicSignup: true,
        allowProfessionalSignup: true,
        allowedIPs: [],
      },
      source: "internal_api",
      reason: "internal_api_resolved",
      cacheStrategy: "shared_service_or_metadata",
    });
    mockAuth.mockResolvedValue({
      userId: "u1",
      sessionClaims: { metadata: { role: "client" } },
    });
    const req = new NextRequest(`http://localhost:3500${ROUTES.userDashboard}`);

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expectRedirectNoCsp(res);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/maintenance");
  });

  it("allows admin users during maintenance mode", async () => {
    mockResolveSystemSettings.mockResolvedValueOnce({
      state: "resolved",
      settings: {
        maintenanceMode: true,
        maintenanceMessage: "down",
        publicSignup: true,
        allowProfessionalSignup: true,
        allowedIPs: [],
      },
      source: "internal_api",
      reason: "internal_api_resolved",
      cacheStrategy: "shared_service_or_metadata",
    });
    mockAuth.mockResolvedValue({
      userId: "admin1",
      sessionClaims: { metadata: { role: "admin" } },
    });
    mockResolveOnboardingStatus.mockResolvedValueOnce({
      state: "resolved",
      isOnboarded: true,
      role: "ADMIN",
      source: "metadata",
      confidence: "high",
      reason: "metadata_present",
    });
    const req = new NextRequest(`http://localhost:3500${ROUTES.userDashboard}`);

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expectDocumentCspHeaders(res);
    expect(res.status).toBe(200);
  });

  it("redirects sign-up when public signup is disabled", async () => {
    mockResolveSystemSettings.mockResolvedValueOnce({
      state: "resolved",
      settings: {
        maintenanceMode: false,
        maintenanceMessage: null,
        publicSignup: false,
        allowProfessionalSignup: true,
        allowedIPs: [],
      },
      source: "internal_api",
      reason: "internal_api_resolved",
      cacheStrategy: "shared_service_or_metadata",
    });
    const req = new NextRequest("http://localhost:3500/sign-up");

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expectRedirectNoCsp(res);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("registration=closed");
  });

  it("redirects professional sign-up when professional signup is disabled", async () => {
    mockResolveSystemSettings.mockResolvedValueOnce({
      state: "resolved",
      settings: {
        maintenanceMode: false,
        maintenanceMessage: null,
        publicSignup: true,
        allowProfessionalSignup: false,
        allowedIPs: [],
      },
      source: "internal_api",
      reason: "internal_api_resolved",
      cacheStrategy: "shared_service_or_metadata",
    });
    const req = new NextRequest("http://localhost:3500/professional/sign-up");

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expectRedirectNoCsp(res);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("pro=closed");
  });

  it("allows onboarding route when onboarding resolver is indeterminate", async () => {
    mockAuth.mockResolvedValue({
      userId: "u4",
      sessionClaims: { metadata: {} },
    });
    mockResolveOnboardingStatus.mockResolvedValueOnce({
      state: "indeterminate",
      isOnboarded: false,
      role: undefined,
      source: "fallback",
      confidence: "low",
      reason: "internal_api_error",
    });
    const req = new NextRequest("http://localhost:3500/onboarding");

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expectDocumentCspHeaders(res);
    expect(res.status).toBe(200);
  });

  it("redirects protected route to onboarding when resolver is indeterminate", async () => {
    mockAuth.mockResolvedValue({
      userId: "u5",
      sessionClaims: { metadata: {} },
    });
    mockResolveOnboardingStatus.mockResolvedValueOnce({
      state: "indeterminate",
      isOnboarded: false,
      role: undefined,
      source: "fallback",
      confidence: "low",
      reason: "internal_api_non_ok",
    });
    const req = new NextRequest(`http://localhost:3500${ROUTES.userDashboard}`);

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expectRedirectNoCsp(res);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/onboarding");
  });

  it("redirects professional users in pending verification to holding page", async () => {
    mockAuth.mockResolvedValue({
      userId: "pro_pending_1",
      sessionClaims: {
        metadata: { role: "PROFESSIONAL", isOnboarded: true },
      },
    });
    mockResolveOnboardingStatus.mockResolvedValueOnce({
      state: "resolved",
      isOnboarded: true,
      role: "PROFESSIONAL",
      status: "PENDING_VERIFICATION",
      source: "internal_api",
      confidence: "medium",
      reason: "internal_api_resolved",
    });
    const req = new NextRequest(
      "http://localhost:3500/professional-portal/dashboard",
    );

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expectRedirectNoCsp(res);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain(
      "/professional-portal/pending-verification",
    );
  });

  it("allows professional users on pending-verification route without loop", async () => {
    mockAuth.mockResolvedValue({
      userId: "pro_pending_2",
      sessionClaims: {
        metadata: { role: "PROFESSIONAL", isOnboarded: true },
      },
    });
    mockResolveOnboardingStatus.mockResolvedValueOnce({
      state: "resolved",
      isOnboarded: true,
      role: "PROFESSIONAL",
      status: "PENDING_VERIFICATION",
      source: "internal_api",
      confidence: "medium",
      reason: "internal_api_resolved",
    });
    const req = new NextRequest(
      "http://localhost:3500/professional-portal/pending-verification",
    );

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expectDocumentCspHeaders(res);
    expect(res.status).toBe(200);
  });
});
