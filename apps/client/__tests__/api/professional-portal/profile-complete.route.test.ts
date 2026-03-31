import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/professional-portal/profile/complete/route";

const mockCompleteProfile = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (handler: (req: NextRequest, context: unknown) => Promise<unknown>) =>
    async (req: NextRequest) =>
      handler(req, {
        clerkId: "clerk_123",
        dbUserId: "db_user_123",
        userEmail: "pro@example.com",
        userRole: "PROFESSIONAL",
      }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    reset: Date.now() + 60000,
  }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  checkBodySize: vi.fn().mockReturnValue(null),
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        return { success: true, data: await fn() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  }),
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/app/lib/api/api-response", () => ({
  apiError: vi
    .fn()
    .mockImplementation((message: string, status: number, details?: unknown) =>
      NextResponse.json(
        { success: false, error: message, details },
        { status },
      ),
    ),
  apiSuccess: vi
    .fn()
    .mockImplementation((data: unknown, status: number = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
  HttpStatus: {
    OK: 200,
    BAD_REQUEST: 400,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    fail: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/app/lib/domains/professional-settings", () => ({
  professionalSettingsService: {
    completeProfile: mockCompleteProfile,
  },
}));

describe("POST /api/professional-portal/profile/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompleteProfile.mockResolvedValue({ ok: true, data: undefined });
  });

  it("dispatches completion through the professional settings domain", async () => {
    const payload = {
      profession: "ARCHITECT",
      companyName: "Build Market Ltd",
    };

    const response = await POST(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/profile/complete",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, data: { completed: true } });
    expect(mockCompleteProfile).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        clerkId: "clerk_123",
        role: "professional",
      },
      payload,
    );
  });

  it("maps domain invalid-input failures to 400", async () => {
    mockCompleteProfile.mockResolvedValueOnce({
      ok: false,
      error: "invalid_input",
      message: "Invalid or expired document uploads",
      status: 400,
    });

    const response = await POST(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/profile/complete",
        {
          method: "POST",
          body: JSON.stringify({
            profession: "ARCHITECT",
            companyName: "Build Market Ltd",
          }),
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid or expired document uploads");
  });

  it("rejects schema-invalid payloads before domain dispatch", async () => {
    const response = await POST(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/profile/complete",
        {
          method: "POST",
          body: JSON.stringify({
            profession: "ARCHITECT",
          }),
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(mockCompleteProfile).not.toHaveBeenCalled();
  });

  it("returns completed idempotent responses without redispatching", async () => {
    const { IdempotencyService } =
      await import("@/app/lib/services/idempotency.service");

    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValueOnce({
      status: "completed",
      response: { success: true },
    } as never);

    const response = await POST(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/profile/complete",
        {
          method: "POST",
          body: JSON.stringify({
            profession: "ARCHITECT",
            companyName: "Build Market Ltd",
          }),
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, data: { completed: true } });
    expect(mockCompleteProfile).not.toHaveBeenCalled();
  });
});
