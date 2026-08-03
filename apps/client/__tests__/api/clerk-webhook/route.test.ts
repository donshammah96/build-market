import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/clerk-webhook/route";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockCheckBodySize = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockGetRateLimitIdentifier = vi.hoisted(() => vi.fn());
const mockVerify = vi.hoisted(() => vi.fn());
const mockHandleUserCreated = vi.hoisted(() => vi.fn());
const mockHandleUserUpdated = vi.hoisted(() => vi.fn());
const mockHandleUserDeleted = vi.hoisted(() => vi.fn());
const mockHandleSessionCreated = vi.hoisted(() => vi.fn());
const mockClaimWebhookDelivery = vi.hoisted(() => vi.fn());
const mockMarkWebhookProcessed = vi.hoisted(() => vi.fn());
const mockReleaseWebhookDelivery = vi.hoisted(() => vi.fn());
const mockIsWebhookTimestampFresh = vi.hoisted(() => vi.fn());
const mockRecordWebhookReplayReject = vi.hoisted(() => vi.fn());
const mockEnv = vi.hoisted(() => ({
  isProd: false,
  clerk: {
    webhookSecret: "test_webhook_secret",
    replayWindowSeconds: 300,
  },
}));

vi.mock("svix", () => ({
  Webhook: vi.fn(function MockWebhook() {
    return {
      verify: mockVerify,
    };
  }),
}));

vi.mock("@/app/lib/api/api-response", () => ({
  HttpStatus: {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
    NOT_FOUND: 404,
  },
  apiError: vi
    .fn()
    .mockImplementation(
      (
        message: string,
        status: number,
        details?: unknown,
        correlationId?: string,
      ) =>
        NextResponse.json(
          { success: false, error: message, details, correlationId },
          { status },
        ),
    ),
  apiSuccess: vi
    .fn()
    .mockImplementation((data: unknown, status = 200, correlationId?: string) =>
      NextResponse.json({ success: true, data, correlationId }, { status }),
    ),
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  checkBodySize: mockCheckBodySize,
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: mockGetRateLimitIdentifier,
  RateLimits: {
    WEBHOOK: { limit: 100, window: 60000 },
  },
}));

vi.mock("@/app/lib/infrastructure/env", () => ({
  env: mockEnv,
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
}));

vi.mock("@/app/lib/validation/clerk-webhook-validation", () => ({
  WEBHOOK_CONFIG: {
    MAX_PAYLOAD_SIZE: 256 * 1024,
    REQUIRED_HEADERS: ["svix-id", "svix-timestamp", "svix-signature"],
  },
}));

vi.mock("@/app/lib/integrations/clerk/service", () => ({
  clerkIntegrationService: {
    handleUserCreated: mockHandleUserCreated,
    handleUserUpdated: mockHandleUserUpdated,
    handleUserDeleted: mockHandleUserDeleted,
    handleSessionCreated: mockHandleSessionCreated,
  },
}));

vi.mock("@/app/lib/infrastructure/webhook-replay", () => ({
  claimClerkWebhookDelivery: mockClaimWebhookDelivery,
  isWebhookTimestampFresh: mockIsWebhookTimestampFresh,
  markClerkWebhookDeliveryProcessed: mockMarkWebhookProcessed,
  releaseClerkWebhookDelivery: mockReleaseWebhookDelivery,
}));

vi.mock("@/app/lib/auth/telemetry-metrics", () => ({
  recordWebhookReplayReject: mockRecordWebhookReplayReject,
}));

function buildRequest(headers?: HeadersInit) {
  return new NextRequest("http://localhost:3500/api/clerk-webhook", {
    method: "POST",
    body: JSON.stringify({ event: "payload" }),
    headers: {
      "svix-id": "test-id",
      "svix-timestamp": Math.floor(Date.now() / 1000).toString(),
      "svix-signature": "test-signature",
      ...headers,
    },
  });
}

describe("POST /api/clerk-webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.isProd = false;
    mockEnv.clerk.webhookSecret = "test_webhook_secret";
    mockEnv.clerk.replayWindowSeconds = 300;
    mockCheckBodySize.mockReturnValue(null);
    mockGetRateLimitIdentifier.mockReturnValue("webhook-ip");
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockIsWebhookTimestampFresh.mockReturnValue(true);
    mockClaimWebhookDelivery.mockResolvedValue({
      status: "accepted",
      deliveryId: "test-id",
    });
  });

  it("dispatches user.created events to the integration service", async () => {
    mockVerify.mockReturnValue({
      type: "user.created",
      data: { id: "clerk_123" },
    });
    mockHandleUserCreated.mockResolvedValue({
      ok: true,
      data: {
        userId: "db_user_123",
        message: "User created successfully",
      },
    });

    const response = await POST(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockHandleUserCreated).toHaveBeenCalledWith(
      { correlationId: "test-correlation-id" },
      { id: "clerk_123" },
    );
    expect(mockMarkWebhookProcessed).toHaveBeenCalledWith("test-id");
    expect(mockReleaseWebhookDelivery).not.toHaveBeenCalled();
    expect(payload.data.userId).toBe("db_user_123");
    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
  });

  it("rejects requests missing Svix headers before verification", async () => {
    const response = await POST(
      buildRequest({
        "svix-signature": "",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockClaimWebhookDelivery).not.toHaveBeenCalled();
    expect(mockHandleUserCreated).not.toHaveBeenCalled();
    expect(mockRecordWebhookReplayReject).toHaveBeenCalledWith(
      "missing_headers",
    );
    expect(payload.error).toContain("Missing webhook signature headers");
  });

  it("rejects requests with invalid signatures", async () => {
    mockVerify.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const response = await POST(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(mockClaimWebhookDelivery).not.toHaveBeenCalled();
    expect(mockHandleUserCreated).not.toHaveBeenCalled();
    expect(mockRecordWebhookReplayReject).toHaveBeenCalledWith(
      "invalid_signature",
    );
    expect(payload.error).toContain("Invalid webhook signature");
  });

  it("maps integration service failures to the returned status code", async () => {
    mockVerify.mockReturnValue({
      type: "user.updated",
      data: { id: "clerk_missing" },
    });
    mockHandleUserUpdated.mockResolvedValue({
      ok: false,
      message: "User not found",
      status: 404,
    });

    const response = await POST(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(mockHandleUserUpdated).toHaveBeenCalledWith(
      { correlationId: "test-correlation-id" },
      { id: "clerk_missing" },
    );
    expect(mockReleaseWebhookDelivery).toHaveBeenCalledWith("test-id");
    expect(mockMarkWebhookProcessed).not.toHaveBeenCalled();
    expect(payload.error).toBe("User not found");
  });

  it("acknowledges duplicate deliveries without reprocessing", async () => {
    mockVerify.mockReturnValue({
      type: "user.created",
      data: { id: "clerk_123" },
    });
    mockClaimWebhookDelivery.mockResolvedValue({
      status: "duplicate",
      deliveryId: "test-id",
    });

    const response = await POST(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.deduplicated).toBe(true);
    expect(mockHandleUserCreated).not.toHaveBeenCalled();
    expect(mockMarkWebhookProcessed).not.toHaveBeenCalled();
    expect(mockReleaseWebhookDelivery).not.toHaveBeenCalled();
    expect(mockRecordWebhookReplayReject).toHaveBeenCalledWith(
      "duplicate_delivery",
    );
  });

  it("rejects stale webhook timestamps before replay claim", async () => {
    mockIsWebhookTimestampFresh.mockReturnValue(false);

    mockVerify.mockReturnValue({
      type: "user.created",
      data: { id: "clerk_123" },
    });

    const response = await POST(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain("Stale webhook timestamp");
    expect(mockClaimWebhookDelivery).not.toHaveBeenCalled();
    expect(mockHandleUserCreated).not.toHaveBeenCalled();
    expect(mockRecordWebhookReplayReject).toHaveBeenCalledWith(
      "stale_timestamp",
    );
  });

  it("returns 503 in production when replay protection is unavailable", async () => {
    mockEnv.isProd = true;
    mockVerify.mockReturnValue({
      type: "user.created",
      data: { id: "clerk_123" },
    });
    mockClaimWebhookDelivery.mockRejectedValue(new Error("Redis unavailable"));

    const response = await POST(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toContain("Webhook replay protection unavailable");
    expect(mockHandleUserCreated).not.toHaveBeenCalled();
    expect(mockRecordWebhookReplayReject).toHaveBeenCalledWith(
      "replay_store_unavailable",
    );
  });

  it("releases the replay claim when rate limited after claim", async () => {
    mockVerify.mockReturnValue({
      type: "user.created",
      data: { id: "clerk_123" },
    });
    mockClaimWebhookDelivery.mockResolvedValue({
      status: "accepted",
      deliveryId: "test-id",
    });
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      reset: Date.now() + 5000,
    });

    const response = await POST(buildRequest());

    expect(response.status).toBe(429);
    expect(mockReleaseWebhookDelivery).toHaveBeenCalledWith("test-id");
    expect(mockHandleUserCreated).not.toHaveBeenCalled();
    expect(mockMarkWebhookProcessed).not.toHaveBeenCalled();
  });

  it("releases the replay claim when handler execution throws", async () => {
    mockVerify.mockReturnValue({
      type: "user.created",
      data: { id: "clerk_123" },
    });
    mockHandleUserCreated.mockRejectedValue(new Error("boom"));

    const response = await POST(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toContain("Webhook processing failed");
    expect(mockReleaseWebhookDelivery).toHaveBeenCalledWith("test-id");
    expect(mockMarkWebhookProcessed).not.toHaveBeenCalled();
  });

  it("acknowledges unhandled event types without dispatching", async () => {
    mockVerify.mockReturnValue({
      type: "user.something_else",
      data: {},
    });

    const response = await POST(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockHandleUserCreated).not.toHaveBeenCalled();
    expect(mockHandleUserUpdated).not.toHaveBeenCalled();
    expect(mockHandleUserDeleted).not.toHaveBeenCalled();
    expect(mockHandleSessionCreated).not.toHaveBeenCalled();
    expect(mockMarkWebhookProcessed).toHaveBeenCalledWith("test-id");
    expect(payload.data.message).toContain("acknowledged");
  });
});
