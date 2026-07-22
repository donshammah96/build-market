import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const { mockCheckRateLimit, mockGetRateLimitIdentifier, mockConfirm } =
  vi.hoisted(() => ({
    mockCheckRateLimit: vi.fn(),
    mockGetRateLimitIdentifier: vi.fn(),
    mockConfirm: vi.fn(),
  }));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: mockGetRateLimitIdentifier,
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("corr-confirm-test"),
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
  confirmSubscription: mockConfirm,
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/newsletter/confirm/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3500/api/newsletter/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/newsletter/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockGetRateLimitIdentifier.mockReturnValue("1.2.3.4");
    mockConfirm.mockResolvedValue({
      ok: true,
      data: { status: "SUBSCRIBED" },
    });
  });

  it("returns 200 when a valid token is confirmed", async () => {
    const res = await POST(makeRequest({ token: "a".repeat(64) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("SUBSCRIBED");
  });

  it("returns 200 and success status if already confirmed (idempotency)", async () => {
    mockConfirm.mockResolvedValue({
      ok: true,
      data: { status: "SUBSCRIBED" },
    });
    const res = await POST(makeRequest({ token: "a".repeat(64) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });
    const res = await POST(makeRequest({ token: "a".repeat(64) }));
    expect(res.status).toBe(429);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("returns 400 when validation fails (short token)", async () => {
    const res = await POST(makeRequest({ token: "short" }));
    expect(res.status).toBe(400);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("returns 400 when domain service returns invalid_token error", async () => {
    mockConfirm.mockResolvedValue({
      ok: false,
      error: "invalid_token",
      message: "This confirmation link is invalid",
      status: 400,
    });
    const res = await POST(makeRequest({ token: "a".repeat(64) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when domain service returns token_expired error", async () => {
    mockConfirm.mockResolvedValue({
      ok: false,
      error: "token_expired",
      message: "This confirmation link has expired",
      status: 400,
    });
    const res = await POST(makeRequest({ token: "a".repeat(64) }));
    expect(res.status).toBe(400);
  });
});
