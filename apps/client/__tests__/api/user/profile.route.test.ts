import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { GET, PATCH } from "@/app/api/user/profile/route";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockGetProfile = vi.hoisted(() => vi.fn());
const mockUpdateProfile = vi.hoisted(() => vi.fn());

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
    execute: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        return { success: true, data: await fn() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  }),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
  apiError: vi
    .fn()
    .mockImplementation((message: string, status: number) =>
      NextResponse.json({ success: false, error: message }, { status }),
    ),
  apiSuccess: vi
    .fn()
    .mockImplementation((data: unknown, status = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
}));

vi.mock("@/app/lib/api/request-utils", () => ({
  TimeoutConfig: { NORMAL: 1000 },
  safeParseJsonBody: vi.fn(async (req: NextRequest) => ({
    success: true,
    data: await req.json(),
  })),
}));

vi.mock("@/app/lib/domains/user-profile", () => ({
  userProfileService: {
    getProfile: mockGetProfile,
    updateProfile: mockUpdateProfile,
  },
}));

describe("/api/user/profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns profile data from the domain service", async () => {
    mockGetProfile.mockResolvedValue({
      ok: true,
      data: {
        user: { id: "db_user_123", status: "ACTIVE" },
        completion: { isComplete: true, percentage: 100 },
        alerts: { accountLocked: false },
      },
    });

    const response = await GET(
      new NextRequest("http://localhost:3500/api/user/profile"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetProfile).toHaveBeenCalledWith({
      userId: "db_user_123",
      correlationId: "test-correlation-id",
    });
    expect(payload.data.user.id).toBe("db_user_123");
  });

  it("maps missing users to 404", async () => {
    mockGetProfile.mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "User not found",
    });

    const response = await GET(
      new NextRequest("http://localhost:3500/api/user/profile"),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("User not found");
  });

  it("maps suspended account updates to 403", async () => {
    mockUpdateProfile.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message:
        "Profile updates are not allowed for suspended or banned accounts",
    });

    const response = await PATCH(
      new NextRequest("http://localhost:3500/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify({ firstName: "Jane" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(mockUpdateProfile).toHaveBeenCalledWith({
      actor: {
        userId: "db_user_123",
        correlationId: "test-correlation-id",
      },
      data: { firstName: "Jane" },
    });
    expect(payload.error).toContain("not allowed");
  });

  it("returns validation failures before calling the service", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost:3500/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify({ avatar: "not-a-url" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(payload.error).toContain("Validation failed");
  });
});
