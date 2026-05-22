import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ConsentType } from "@prisma/client";
import { GET, POST, PUT } from "@/app/api/user/consent/route";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockUpdateConsent = vi.hoisted(() => vi.fn());
const mockGetConsents = vi.hoisted(() => vi.fn());
const mockBulkUpdateConsents = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockSafeParseJsonBody = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (handler: (req: NextRequest, context: unknown) => Promise<unknown>) =>
    async (req: NextRequest) =>
      handler(req, {
        clerkId: "clerk_123",
        dbUserId: "db_user_123",
        userEmail: "test@example.com",
        userRole: "CLIENT",
      }),
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => ({
      success: true,
      data: await fn(),
    })),
  }),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
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
    .mockImplementation((data: unknown, status = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 20, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/request-utils", () => ({
  getRequestMetadata: vi.fn().mockReturnValue({ ipAddress: "10.0.0.5" }),
  safeParseJsonBody: mockSafeParseJsonBody,
  TimeoutConfig: { NORMAL: 1000 },
}));

vi.mock("@/app/lib/api/api-response", () => ({
  HttpStatus: {
    OK: 200,
    BAD_REQUEST: 400,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    MULTI_STATUS: 207,
  },
}));

vi.mock("@/app/lib/domains/user-profile", () => ({
  userProfileComplianceService: {
    updateConsent: mockUpdateConsent,
    getConsents: mockGetConsents,
    bulkUpdateConsents: mockBulkUpdateConsents,
  },
}));

describe("/api/user/consent route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockSafeParseJsonBody.mockImplementation(async (req: NextRequest) => ({
      success: true,
      data: await req.json(),
    }));
  });

  it("updates a single consent through the compliance domain service", async () => {
    mockUpdateConsent.mockResolvedValue({
      ok: true,
      data: {
        consent: {
          id: "consent_1",
          type: ConsentType.MARKETING_EMAIL,
          granted: true,
        },
      },
    });

    const response = await POST(
      new NextRequest("http://localhost:3500/api/user/consent", {
        method: "POST",
        body: JSON.stringify({
          type: ConsentType.MARKETING_EMAIL,
          granted: true,
          documentVersion: "v1",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpdateConsent).toHaveBeenCalledWith({
      actor: { userId: "db_user_123", correlationId: "test-correlation-id" },
      consent: {
        type: ConsentType.MARKETING_EMAIL,
        granted: true,
        documentVersion: "v1",
      },
      ipAddress: "10.0.0.5",
    });
    expect(payload.data.consent.id).toBe("consent_1");
  });

  it("rejects invalid consent payloads before domain dispatch", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3500/api/user/consent", {
        method: "POST",
        body: JSON.stringify({
          granted: true,
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(mockUpdateConsent).not.toHaveBeenCalled();
    expect(payload.error).toBe("Invalid consent data");
  });

  it("returns the current consent snapshot from the compliance domain", async () => {
    mockGetConsents.mockResolvedValue({
      ok: true,
      data: {
        total: 2,
        items: [
          {
            id: "consent_1",
            type: ConsentType.MARKETING_EMAIL,
            granted: true,
          },
          {
            id: "consent_2",
            type: ConsentType.ANALYTICS_COOKIES,
            granted: false,
          },
        ],
      },
    });

    const response = await GET(
      new NextRequest("http://localhost:3500/api/user/consent"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetConsents).toHaveBeenCalledWith({
      userId: "db_user_123",
      correlationId: "test-correlation-id",
    });
    expect(payload.data.total).toBe(2);
  });

  it("returns internal error when bulk consent update is not fully successful", async () => {
    mockBulkUpdateConsents.mockResolvedValue({
      ok: true,
      data: {
        success: false,
        results: [
          { type: ConsentType.MARKETING_EMAIL, success: true },
          { type: ConsentType.ANALYTICS_COOKIES, success: false },
        ],
      },
    });

    const response = await PUT(
      new NextRequest("http://localhost:3500/api/user/consent", {
        method: "PUT",
        body: JSON.stringify({
          consents: [
            { type: ConsentType.MARKETING_EMAIL, granted: true },
            { type: ConsentType.ANALYTICS_COOKIES, granted: false },
          ],
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(mockBulkUpdateConsents).toHaveBeenCalledWith({
      actor: { userId: "db_user_123", correlationId: "test-correlation-id" },
      consents: [
        { type: ConsentType.MARKETING_EMAIL, granted: true },
        { type: ConsentType.ANALYTICS_COOKIES, granted: false },
      ],
      ipAddress: "10.0.0.5",
    });
    expect(payload.error).toContain("atomically");
  });

  it("maps rate-limit rejections before executing consent mutations", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false });

    const response = await PUT(
      new NextRequest("http://localhost:3500/api/user/consent", {
        method: "PUT",
        body: JSON.stringify({
          consents: [{ type: ConsentType.MARKETING_EMAIL, granted: true }],
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(mockBulkUpdateConsents).not.toHaveBeenCalled();
    expect(payload.error).toContain("Rate limit exceeded");
  });
});
