import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/onboarding/intent/route";

vi.mock("server-only", () => ({}));
const mockCheckRateLimit = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true }),
);

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getActorRateLimitIdentifier: vi.fn(
    (actorId: string, namespace: string) => `${namespace}:${actorId}`,
  ),
  RateLimits: { AUTH: { limit: 5, window: 60000 } },
}));
vi.mock("@/app/lib/api/api-response", () => ({
  HttpStatus: { OK: 200, BAD_REQUEST: 400, TOO_MANY_REQUESTS: 429 },
  apiError: vi.fn((message: string, status: number, details?: unknown) =>
    NextResponse.json({ success: false, error: message, details }, { status }),
  ),
  apiSuccess: vi.fn((data: unknown, status = 200) =>
    NextResponse.json({ success: true, data }, { status }),
  ),
}));
vi.mock("@/app/lib/infrastructure/env", () => ({
  envConfig: { auth: { secret: "test-secret" }, isProd: false },
}));

function request(body: unknown) {
  return new NextRequest("http://localhost:3500/api/onboarding/intent", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/onboarding/intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
  });

  it("sets a signed HttpOnly professional intent cookie", async () => {
    const response = await POST(
      request({ role: "professional", source: "professional_landing" }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.signUpUrl).toBe("/professional/sign-up");
    expect(response.headers.get("set-cookie")).toContain(
      "bm_onboarding_intent=",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("rejects unsupported roles", async () => {
    const response = await POST(request({ role: "client" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("preserves safe returnTo and returns an expiry timestamp", async () => {
    const response = await POST(
      request({
        role: "professional",
        source: "professional_landing",
        returnTo: "/professional-portal/pending-verification",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(Date.parse(json.data.expiresAt)).not.toBeNaN();
    expect(json.data.signUpUrl).toBe("/professional/sign-up");
  });

  it("rejects protocol-relative returnTo values", async () => {
    const response = await POST(
      request({ role: "professional", returnTo: "//evil.example" }),
    );

    expect(response.status).toBe(400);
  });

  it("rate-limits intent abuse", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const response = await POST(request({ role: "professional" }));
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.success).toBe(false);
  });
});
