import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/internal/telemetry-metrics/route";
import {
  recordClerkSyncLag,
  recordMiddlewareFallback,
  recordWebhookReplayReject,
  resetAuthSloMetrics,
} from "@/app/lib/auth/telemetry-metrics";

vi.mock("server-only", () => ({}));

const mockEnsureSecret = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/security/internal-secret", () => ({
  ensureValidInternalSecret: mockEnsureSecret,
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getClientLogger: vi.fn().mockReturnValue({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("GET /api/internal/telemetry-metrics", () => {
  beforeEach(() => {
    resetAuthSloMetrics();
    vi.clearAllMocks();
    mockEnsureSecret.mockReturnValue(null);
    mockCheckRateLimit.mockResolvedValue({ success: true });
  });

  it("returns 401/403 when x-internal-secret is invalid", async () => {
    const errorResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
      },
    );
    mockEnsureSecret.mockReturnValue(errorResponse as any);

    const req = new NextRequest(
      "http://localhost/api/internal/telemetry-metrics",
    );
    const response = await GET(req);

    expect(response.status).toBe(401);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });

    const req = new NextRequest(
      "http://localhost/api/internal/telemetry-metrics",
    );
    const response = await GET(req);

    expect(response.status).toBe(429);
  });

  it("returns 200 with complete Auth SLO metrics summary", async () => {
    recordClerkSyncLag(120);
    recordWebhookReplayReject("stale_timestamp");
    recordMiddlewareFallback("/dashboard", "unonboarded_redirect");

    const req = new NextRequest(
      "http://localhost/api/internal/telemetry-metrics",
    );
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.clerkSyncLag.totalEvents).toBe(1);
    expect(json.clerkSyncLag.averageLagMs).toBe(120);
    expect(json.webhookReplayRejects.totalRejects).toBe(1);
    expect(json.webhookReplayRejects.byReason["stale_timestamp"]).toBe(1);
    expect(json.middlewareFallbacks.totalFallbacks).toBe(1);
    expect(
      json.middlewareFallbacks.byType["unonboarded_redirect:/dashboard"],
    ).toBe(1);
  });
});
