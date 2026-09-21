import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const { mockCheckRateLimit, mockGetRateLimitIdentifier, mockUnsubscribe } =
  vi.hoisted(() => ({
    mockCheckRateLimit: vi.fn(),
    mockGetRateLimitIdentifier: vi.fn(),
    mockUnsubscribe: vi.fn(),
  }));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: mockGetRateLimitIdentifier,
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("corr-unsub-test"),
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
  unsubscribe: mockUnsubscribe,
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/newsletter/unsubscribe/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3500/api/newsletter/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeFormRequest(token: string): NextRequest {
  return new NextRequest(
    `http://localhost:3500/api/newsletter/unsubscribe?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/newsletter/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockGetRateLimitIdentifier.mockReturnValue("1.2.3.4");
    mockUnsubscribe.mockResolvedValue({
      ok: true,
      data: { status: "UNSUBSCRIBED" },
    });
  });

  it("returns 200 when a valid token is sent in JSON body", async () => {
    const res = await POST(
      makeJsonRequest({ token: "a".repeat(64), reason: "Spam" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("UNSUBSCRIBED");
    expect(mockUnsubscribe).toHaveBeenCalledWith({
      token: "a".repeat(64),
      reason: "Spam",
    });
  });

  it("returns 200 when list provider issues a RFC 8058 one-click unsubscribe form POST", async () => {
    const res = await POST(makeFormRequest("a".repeat(64)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockUnsubscribe).toHaveBeenCalledWith({
      token: "a".repeat(64),
      reason: undefined,
    });
  });

  it("returns 200 when already unsubscribed (idempotency)", async () => {
    mockUnsubscribe.mockResolvedValue({
      ok: true,
      data: { status: "UNSUBSCRIBED" },
    });
    const res = await POST(makeJsonRequest({ token: "a".repeat(64) }));
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });
    const res = await POST(makeJsonRequest({ token: "a".repeat(64) }));
    expect(res.status).toBe(429);
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });

  it("returns 400 when validation fails (no token)", async () => {
    const res = await POST(makeJsonRequest({}));
    expect(res.status).toBe(400);
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });
});
