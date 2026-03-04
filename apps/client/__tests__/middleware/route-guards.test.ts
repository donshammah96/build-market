import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

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
  resolveSystemSettings: (...args: unknown[]) => mockResolveSystemSettings(...args),
}));

vi.mock("@/app/lib/security/middleware/decision-log", () => ({
  logMiddlewareDecision: vi.fn(),
}));

import middleware from "@/middleware";

function assertResponse(
  res: Awaited<ReturnType<typeof middleware>>,
): asserts res is Response | NextResponse {
  if (!(res instanceof Response)) {
    throw new Error("Expected middleware to return a response");
  }
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
      role: "client",
      source: "metadata",
      confidence: "high",
      reason: "metadata_present",
    });
  });

  it("redirects unauthenticated protected requests to sign-in", async () => {
    mockAuth.mockResolvedValue({ userId: null, sessionClaims: null });
    const req = new NextRequest("http://localhost:3500/dashboard");

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
    expect(res.headers.get("location")).toContain("redirect_url=%2Fdashboard");
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
      role: "professional",
      source: "metadata",
      confidence: "high",
      reason: "metadata_present",
    });
    const req = new NextRequest("http://localhost:3500/professional-portal");

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
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
      role: "client",
      source: "metadata",
      confidence: "high",
      reason: "metadata_present",
    });
    const req = new NextRequest("http://localhost:3500/professional-portal");

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("redirects authenticated but not-onboarded users to onboarding", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_3",
      sessionClaims: {
        metadata: { role: "CLIENT", isOnboarded: false },
      },
    });
    const req = new NextRequest("http://localhost:3500/dashboard");

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
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
    mockAuth.mockResolvedValue({ userId: "u1", sessionClaims: { metadata: { role: "client" } } });
    const req = new NextRequest("http://localhost:3500/dashboard");

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
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
    mockAuth.mockResolvedValue({ userId: "admin1", sessionClaims: { metadata: { role: "admin" } } });
    mockResolveOnboardingStatus.mockResolvedValueOnce({
      state: "resolved",
      isOnboarded: true,
      role: "admin",
      source: "metadata",
      confidence: "high",
      reason: "metadata_present",
    });
    const req = new NextRequest("http://localhost:3500/dashboard");

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
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
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("pro=closed");
  });

  it("allows onboarding route when onboarding resolver is indeterminate", async () => {
    mockAuth.mockResolvedValue({ userId: "u4", sessionClaims: { metadata: {} } });
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
    expect(res.status).toBe(200);
  });

  it("redirects protected route to onboarding when resolver is indeterminate", async () => {
    mockAuth.mockResolvedValue({ userId: "u5", sessionClaims: { metadata: {} } });
    mockResolveOnboardingStatus.mockResolvedValueOnce({
      state: "indeterminate",
      isOnboarded: false,
      role: undefined,
      source: "fallback",
      confidence: "low",
      reason: "internal_api_non_ok",
    });
    const req = new NextRequest("http://localhost:3500/dashboard");

    const res = await middleware(req, {} as Parameters<typeof middleware>[1]);
    assertResponse(res);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/onboarding");
  });
});
