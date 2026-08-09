import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/webhooks/clerk/route";

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
const mockClaimWebhookDelivery = vi.hoisted(() => vi.fn());
const mockMarkWebhookProcessed = vi.hoisted(() => vi.fn());
const mockReleaseWebhookDelivery = vi.hoisted(() => vi.fn());
const mockIsWebhookTimestampFresh = vi.hoisted(() => vi.fn());
const mockRecordWebhookReplayReject = vi.hoisted(() => vi.fn());
const mockRecordWebhookFailure = vi.hoisted(() => vi.fn());
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
    handleUserUpdated: vi.fn(),
    handleUserDeleted: vi.fn(),
    handleSessionCreated: vi.fn(),
  },
}));

vi.mock("@/app/lib/infrastructure/webhook-replay", () => ({
  claimClerkWebhookDelivery: mockClaimWebhookDelivery,
  markClerkWebhookDeliveryProcessed: mockMarkWebhookProcessed,
  releaseClerkWebhookDelivery: mockReleaseWebhookDelivery,
  isWebhookTimestampFresh: mockIsWebhookTimestampFresh,
}));

vi.mock("@/app/lib/auth/telemetry-metrics", () => ({
  recordWebhookReplayReject: mockRecordWebhookReplayReject,
  recordWebhookFailure: mockRecordWebhookFailure,
}));

function createRequest(
  headers: Record<string, string> = {},
  body = JSON.stringify({ type: "user.created", data: { id: "user_123" } }),
): NextRequest {
  return new NextRequest("http://localhost:3500/api/webhooks/clerk", {
    method: "POST",
    headers: new Headers(headers),
    body,
  });
}

describe("POST /api/webhooks/clerk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.isProd = false;
    mockEnv.clerk.webhookSecret = "whsec_test_secret";
    mockCheckBodySize.mockReturnValue(null);
    mockIsWebhookTimestampFresh.mockReturnValue(true);
    mockClaimWebhookDelivery.mockResolvedValue({
      status: "accepted",
      deliveryId: "msg_123",
    });
    mockMarkWebhookProcessed.mockResolvedValue(undefined);
    mockReleaseWebhookDelivery.mockResolvedValue(undefined);
    mockGetRateLimitIdentifier.mockReturnValue("127.0.0.1");
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockHandleUserCreated.mockResolvedValue({
      ok: true,
      data: { message: "User profile synchronized successfully" },
    });
  });

  it("rejects request missing Svix signature headers with 400 Bad Request", async () => {
    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Missing webhook signature headers");
    expect(mockRecordWebhookReplayReject).toHaveBeenCalledWith(
      "missing_headers",
    );
  });

  it("rejects request with invalid Svix signature with 401 Unauthorized", async () => {
    mockVerify.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const req = createRequest({
      "svix-id": "msg_123",
      "svix-timestamp": "1700000000",
      "svix-signature": "v1,invalid_sig",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid webhook signature");
    expect(mockRecordWebhookReplayReject).toHaveBeenCalledWith(
      "invalid_signature",
    );
  });

  it("rejects stale timestamp with 401 Unauthorized", async () => {
    mockVerify.mockReturnValue({
      type: "user.created",
      data: { id: "user_123" },
    });
    mockIsWebhookTimestampFresh.mockReturnValue(false);

    const req = createRequest({
      "svix-id": "msg_123",
      "svix-timestamp": "1600000000",
      "svix-signature": "v1,valid_sig",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Stale webhook timestamp");
    expect(mockRecordWebhookReplayReject).toHaveBeenCalledWith(
      "stale_timestamp",
    );
  });

  it("processes valid webhook request successfully with 200 OK", async () => {
    mockVerify.mockReturnValue({
      type: "user.created",
      data: { id: "user_123" },
    });

    const req = createRequest({
      "svix-id": "msg_123",
      "svix-timestamp": "1700000000",
      "svix-signature": "v1,valid_sig",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockHandleUserCreated).toHaveBeenCalled();
    expect(mockMarkWebhookProcessed).toHaveBeenCalledWith("msg_123");
  });
});
