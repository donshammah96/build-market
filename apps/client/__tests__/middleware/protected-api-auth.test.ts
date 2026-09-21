import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockAuth } = vi.hoisted(() => {
  return { mockAuth: vi.fn() };
});

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (
    handler: (auth: () => Promise<unknown>, req: NextRequest) => unknown,
  ) => {
    return (req: NextRequest, _event?: any) => {
      return handler(() => mockAuth(), req);
    };
  },
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
  timingSafeEqualStrings: (a: string, b: string) => a === b,
}));

vi.mock("@/app/lib/security/middleware/csp-nonce", () => ({
  generateCspNonce: () => "test-nonce",
  buildCspWithNonce: () => "default-src 'self'",
}));

import middleware from "@/middleware";

describe("middleware — protected API route auth & diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DD_ENV = "staging";
    process.env.STAGING_AUTH_SECRET = "test-staging-secret";
  });

  it("REPRODUCTION: unauthenticated protected API route includes diagnostic headers in staging", async () => {
    mockAuth.mockResolvedValue({
      userId: null,
      debug: () => ({
        reason: "session-token-missing",
        message: "No session token",
      }),
    });

    const req = new NextRequest(
      "https://staging.buildmarket.app/api/messaging/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "bm_staging_auth=test-staging-secret",
        },
        body: JSON.stringify({ threadId: "test-thread", content: "hello" }),
      },
    );

    const res = (await middleware(req)) as NextResponse;

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });

    // Diagnostic headers must be present in staging to illuminate why Edge auth rejected the request
    expect(res.headers.get("x-bm-mw-decision")).toBe(
      "mw_deny_protected_api_unauthenticated",
    );
    expect(res.headers.get("x-bm-auth-reason")).toBe("session-token-missing");
  });

  it("REPRODUCTION: authenticated protected API route forwards x-bm-edge-user for auth parity", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_test_client_123",
      sessionClaims: { sub: "user_test_client_123" },
    });

    const req = new NextRequest(
      "https://staging.buildmarket.app/api/messaging/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "bm_staging_auth=test-staging-secret",
        },
        body: JSON.stringify({ threadId: "test-thread", content: "hello" }),
      },
    );

    const res = (await middleware(req)) as NextResponse;

    expect(res.status).toBe(200);
    // x-bm-edge-user must be forwarded so Node runtime has edge perspective
    expect(res.headers.get("x-bm-mw-decision")).toBe("mw_allow_protected_api");
  });
});
