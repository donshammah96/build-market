import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const { mockCheckRateLimit, mockGetRateLimitIdentifier, mockSubscribe } =
  vi.hoisted(() => ({
    mockCheckRateLimit: vi.fn(),
    mockGetRateLimitIdentifier: vi.fn(),
    mockSubscribe: vi.fn(),
  }));

// ---------------------------------------------------------------------------
// Module mocks (must be at the top level, before any imports of the SUT)
// ---------------------------------------------------------------------------

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: mockGetRateLimitIdentifier,
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("corr-newsletter-test"),
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/app/lib/api/api-response", () => ({
  HttpStatus: {
    OK: 200,
    BAD_REQUEST: 400,
    TOO_MANY_REQUESTS: 429,
    SERVICE_UNAVAILABLE: 503,
  },
  apiError: vi
    .fn()
    .mockImplementation((message: string, status: number) =>
      NextResponse.json({ success: false, error: message }, { status }),
    ),
  apiSuccess: vi
    .fn()
    .mockImplementation((data: unknown) =>
      NextResponse.json({ success: true, data }, { status: 200 }),
    ),
}));

vi.mock("@/app/lib/domains/newsletter/service", () => ({
  subscribe: mockSubscribe,
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks are wired
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/newsletter/subscribe/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3500/api/newsletter/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/newsletter/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit passes, IP resolves to a dummy value
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockGetRateLimitIdentifier.mockReturnValue("1.2.3.4");
    // Default: ESP call succeeds
    mockSubscribe.mockResolvedValue({
      ok: true,
      data: { status: "created" },
    });
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it("returns 200 when a valid email is submitted", async () => {
    const res = await POST(makeRequest({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 200 when the email is already subscribed (idempotent)", async () => {
    mockSubscribe.mockResolvedValue({
      ok: true,
      data: { status: "already_subscribed" },
    });
    const res = await POST(makeRequest({ email: "existing@example.com" }));
    expect(res.status).toBe(200);
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────

  it("returns 429 when the IP is rate-limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });
    const res = await POST(makeRequest({ email: "flood@example.com" }));
    expect(res.status).toBe(429);
  });

  it("does not call the ESP when rate-limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });
    await POST(makeRequest({ email: "flood@example.com" }));
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("returns 400 for a missing email field", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed email address", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when email exceeds 254 characters", async () => {
    // 246 'a's + '@test.com' (9 chars) = 255 chars, which exceeds .max(254)
    const longEmail = "a".repeat(246) + "@test.com";
    const res = await POST(makeRequest({ email: longEmail }));
    expect(res.status).toBe(400);
  });

  it("does not call the ESP when validation fails", async () => {
    await POST(makeRequest({ email: "bad" }));
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  // ── Honeypot ───────────────────────────────────────────────────────────────

  it("returns 200 silently when the honeypot field is filled (bot detection)", async () => {
    // We return 200 to avoid signalling detection to the bot
    const res = await POST(
      makeRequest({ email: "bot@example.com", company: "I am a bot" }),
    );
    expect(res.status).toBe(200);
  });

  it("does not call the ESP when honeypot is triggered", async () => {
    await POST(makeRequest({ email: "bot@example.com", company: "SPAM" }));
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  // ── ESP error handling ─────────────────────────────────────────────────────

  it("returns 400 (not 502) when the ESP rejects the email as invalid", async () => {
    mockSubscribe.mockResolvedValue({
      ok: false,
      error: "invalid_email",
      message: "Email address rejected by provider",
      status: 400,
    });
    const res = await POST(makeRequest({ email: "bounce@disposable.io" }));
    expect(res.status).toBe(400);
  });

  it("does not leak the ESP's internal error message to the client", async () => {
    mockSubscribe.mockResolvedValue({
      ok: false,
      error: "provider_unavailable",
      message: "Resend account ID 12345 rate limited at datacenter us-east-1",
      status: 502,
    });
    const res = await POST(makeRequest({ email: "user@example.com" }));
    const body = await res.json();
    // The client message must be a static string, not the internal ESP message
    expect(body.error).not.toContain("Resend");
    expect(body.error).not.toContain("12345");
    expect(body.error).not.toContain("us-east-1");
  });

  it("returns 503 when the ESP is unavailable", async () => {
    mockSubscribe.mockResolvedValue({
      ok: false,
      error: "provider_unavailable",
      message: "Internal provider error",
      status: 502,
    });
    const res = await POST(makeRequest({ email: "user@example.com" }));
    expect(res.status).toBe(503);
  });

  it("returns 503 when the ESP call throws unexpectedly", async () => {
    mockSubscribe.mockRejectedValue(new Error("Network timeout"));
    const res = await POST(makeRequest({ email: "user@example.com" }));
    expect(res.status).toBe(503);
  });

  // ── No PII boundary ────────────────────────────────────────────────────────

  it("never surfaces raw body fields in error responses", async () => {
    // Even when honeypot is filled, the error body must not echo back the email
    const res = await POST(
      makeRequest({ email: "spy@example.com", company: "leaking" }),
    );
    const body = await res.json();
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("spy@example.com");
  });
});
