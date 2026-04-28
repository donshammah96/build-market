import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { PATCH as genericPatch } from "@/app/api/user/profile/complete/route";
import { PATCH as clientPatch } from "@/app/api/user/profile/complete/client/route";
import { PATCH as professionalPatch } from "@/app/api/user/profile/complete/professional/route";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockResolveProfileCompleteTarget = vi.hoisted(() => vi.fn());
const mockCompleteClientProfile = vi.hoisted(() => vi.fn());
const mockCompleteProfessionalProfile = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());

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
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/domains/user-profile", async () => {
  return {
    resolveProfileCompleteTarget: mockResolveProfileCompleteTarget,
    completeClientProfile: mockCompleteClientProfile,
    completeProfessionalProfile: mockCompleteProfessionalProfile,
  };
});

function buildSuccessPayload(message: string) {
  return {
    success: true as const,
    user: {
      id: "db_user_123",
      firstName: "Jane",
      lastName: "Doe",
      phone: "+254700000000",
      avatar: null,
      bio: null,
      role: "CLIENT",
      isProfileComplete: true,
    },
    profile: { userId: "db_user_123" },
    completion: {
      isComplete: true,
      percentage: 100,
      missingRequired: [],
      missingRequiredLabels: [],
      missingOptional: [],
      filledFields: ["firstName"],
      requiredPercentage: 100,
      optionalPercentage: 100,
    },
    message,
  };
}

describe("/api/user/profile/complete route cluster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      reset: Date.now() + 60000,
    });
    mockResolveProfileCompleteTarget.mockResolvedValue({
      ok: true,
      data: { target: "client", role: "CLIENT" },
    });
    mockCompleteClientProfile.mockResolvedValue({
      ok: true,
      data: buildSuccessPayload("Client profile completed successfully!"),
    });
    mockCompleteProfessionalProfile.mockResolvedValue({
      ok: true,
      data: {
        ...buildSuccessPayload("Professional profile completed successfully!"),
        user: {
          ...buildSuccessPayload("Professional profile completed successfully!")
            .user,
          role: "PROFESSIONAL",
        },
      },
    });
  });

  describe("generic PATCH /api/user/profile/complete", () => {
    it("dispatches client requests through the shared domain orchestration", async () => {
      const response = await genericPatch(
        new NextRequest("http://localhost:3500/api/user/profile/complete", {
          method: "PATCH",
          body: JSON.stringify({ firstName: "Jane" }),
        }),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(mockResolveProfileCompleteTarget).toHaveBeenCalledWith({
        userId: "db_user_123",
        correlationId: "test-correlation-id",
      });
      expect(mockCompleteClientProfile).toHaveBeenCalledWith(
        {
          userId: "db_user_123",
          correlationId: "test-correlation-id",
        },
        { firstName: "Jane" },
      );
      expect(payload.data.message).toContain("Client profile completed");
    });

    it("dispatches professional requests with request metadata", async () => {
      mockResolveProfileCompleteTarget.mockResolvedValueOnce({
        ok: true,
        data: { target: "professional", role: "PROFESSIONAL" },
      });

      const response = await genericPatch(
        new NextRequest("http://localhost:3500/api/user/profile/complete", {
          method: "PATCH",
          headers: {
            "user-agent": "vitest",
            "x-forwarded-for": "10.0.0.5",
          },
          body: JSON.stringify({ companyName: "Build Co" }),
        }),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(mockCompleteProfessionalProfile).toHaveBeenCalledWith(
        {
          userId: "db_user_123",
          correlationId: "test-correlation-id",
        },
        { companyName: "Build Co" },
        {
          ipAddress: "10.0.0.5",
          userAgent: "vitest",
        },
      );
      expect(payload.data.user.role).toBe("PROFESSIONAL");
    });

    it("returns 429 before dispatch when the shared rate limit rejects", async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        success: false,
        reset: Date.now() + 5000,
      });

      const response = await genericPatch(
        new NextRequest("http://localhost:3500/api/user/profile/complete", {
          method: "PATCH",
          body: JSON.stringify({ firstName: "Jane" }),
        }),
      );
      const payload = await response.json();

      expect(response.status).toBe(429);
      expect(mockResolveProfileCompleteTarget).not.toHaveBeenCalled();
      expect(mockCompleteClientProfile).not.toHaveBeenCalled();
      expect(payload.error).toContain("Rate limit exceeded");
    });

    it("returns 400 on invalid JSON before domain dispatch", async () => {
      const response = await genericPatch(
        new NextRequest("http://localhost:3500/api/user/profile/complete", {
          method: "PATCH",
          body: "{",
        }),
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(mockResolveProfileCompleteTarget).toHaveBeenCalledWith({
        userId: "db_user_123",
        correlationId: "test-correlation-id",
      });
      expect(mockCompleteClientProfile).not.toHaveBeenCalled();
      expect(payload.error).toContain("Invalid JSON");
    });

    it("maps missing users from target resolution to 404", async () => {
      mockResolveProfileCompleteTarget.mockResolvedValueOnce({
        ok: false,
        error: "not_found",
        message: "User not found",
        status: 404,
      });

      const response = await genericPatch(
        new NextRequest("http://localhost:3500/api/user/profile/complete", {
          method: "PATCH",
          body: JSON.stringify({ firstName: "Jane" }),
        }),
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(mockCompleteClientProfile).not.toHaveBeenCalled();
      expect(payload.error).toBe("User not found");
    });

    it("returns 400 for schema-invalid client payloads before orchestration", async () => {
      const response = await genericPatch(
        new NextRequest("http://localhost:3500/api/user/profile/complete", {
          method: "PATCH",
          body: JSON.stringify({ avatar: "not-a-url" }),
        }),
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(mockCompleteClientProfile).not.toHaveBeenCalled();
      expect(payload.error).toContain("Validation failed");
    });
  });

  describe("client PATCH /api/user/profile/complete/client", () => {
    it("returns the shared client orchestration payload", async () => {
      const response = await clientPatch(
        new NextRequest(
          "http://localhost:3500/api/user/profile/complete/client",
          {
            method: "PATCH",
            body: JSON.stringify({ firstName: "Jane" }),
          },
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(mockCompleteClientProfile).toHaveBeenCalledWith(
        {
          userId: "db_user_123",
          correlationId: "test-correlation-id",
        },
        { firstName: "Jane" },
      );
      expect(payload.data.success).toBe(true);
    });

    it("returns 400 for invalid client payloads before orchestration", async () => {
      const response = await clientPatch(
        new NextRequest(
          "http://localhost:3500/api/user/profile/complete/client",
          {
            method: "PATCH",
            body: JSON.stringify({ avatar: "not-a-url" }),
          },
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(mockCompleteClientProfile).not.toHaveBeenCalled();
      expect(payload.error).toContain("Validation failed");
    });

    it("maps forbidden domain results to 403", async () => {
      mockCompleteClientProfile.mockResolvedValueOnce({
        ok: false,
        error: "forbidden",
        message: "This endpoint is for client profiles only",
        status: 403,
      });

      const response = await clientPatch(
        new NextRequest(
          "http://localhost:3500/api/user/profile/complete/client",
          {
            method: "PATCH",
            body: JSON.stringify({ firstName: "Jane" }),
          },
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(payload.error).toContain("client profiles only");
    });

    it("maps banned-account domain results to 403", async () => {
      mockCompleteClientProfile.mockResolvedValueOnce({
        ok: false,
        error: "forbidden",
        message:
          "Profile updates are not allowed for suspended or banned accounts",
        status: 403,
      });

      const response = await clientPatch(
        new NextRequest(
          "http://localhost:3500/api/user/profile/complete/client",
          {
            method: "PATCH",
            body: JSON.stringify({ firstName: "Jane" }),
          },
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(payload.error).toContain("suspended or banned accounts");
    });

    it("maps not_found domain results to 404", async () => {
      mockCompleteClientProfile.mockResolvedValueOnce({
        ok: false,
        error: "not_found",
        message: "User not found",
        status: 404,
      });

      const response = await clientPatch(
        new NextRequest(
          "http://localhost:3500/api/user/profile/complete/client",
          {
            method: "PATCH",
            body: JSON.stringify({ firstName: "Jane" }),
          },
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.error).toBe("User not found");
    });
  });

  describe("professional PATCH /api/user/profile/complete/professional", () => {
    it("passes professional payload and metadata into the shared orchestration", async () => {
      const response = await professionalPatch(
        new NextRequest(
          "http://localhost:3500/api/user/profile/complete/professional",
          {
            method: "PATCH",
            headers: {
              "user-agent": "vitest-professional",
              "x-forwarded-for": "10.0.0.8",
            },
            body: JSON.stringify({
              companyName: "Build Co",
              licenses: [
                {
                  authority: "NCA",
                  licenseNumber: "ABC123",
                },
              ],
            }),
          },
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(mockCompleteProfessionalProfile).toHaveBeenCalledWith(
        {
          userId: "db_user_123",
          correlationId: "test-correlation-id",
        },
        {
          companyName: "Build Co",
          licenses: [
            {
              authority: "NCA",
              licenseNumber: "ABC123",
            },
          ],
        },
        {
          ipAddress: "10.0.0.8",
          userAgent: "vitest-professional",
        },
      );
      expect(payload.data.success).toBe(true);
    });

    it("returns 400 for invalid professional payloads before orchestration", async () => {
      const response = await professionalPatch(
        new NextRequest(
          "http://localhost:3500/api/user/profile/complete/professional",
          {
            method: "PATCH",
            body: JSON.stringify({ serviceRadiusKm: 501 }),
          },
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(mockCompleteProfessionalProfile).not.toHaveBeenCalled();
      expect(payload.error).toContain("Validation failed");
    });

    it("returns 429 for professional requests when the shared rate limit rejects", async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        success: false,
        reset: Date.now() + 5000,
      });

      const response = await professionalPatch(
        new NextRequest(
          "http://localhost:3500/api/user/profile/complete/professional",
          {
            method: "PATCH",
            body: JSON.stringify({ companyName: "Build Co" }),
          },
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(429);
      expect(mockCompleteProfessionalProfile).not.toHaveBeenCalled();
      expect(payload.error).toContain("Rate limit exceeded");
    });

    it("maps wrong-role domain results to 403", async () => {
      mockCompleteProfessionalProfile.mockResolvedValueOnce({
        ok: false,
        error: "forbidden",
        message: "This endpoint is for professional profiles only",
        status: 403,
      });

      const response = await professionalPatch(
        new NextRequest(
          "http://localhost:3500/api/user/profile/complete/professional",
          {
            method: "PATCH",
            body: JSON.stringify({ companyName: "Build Co" }),
          },
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(payload.error).toContain("professional profiles only");
    });

    it("maps banned-account domain results to 403", async () => {
      mockCompleteProfessionalProfile.mockResolvedValueOnce({
        ok: false,
        error: "forbidden",
        message:
          "Profile updates are not allowed for suspended or banned accounts",
        status: 403,
      });

      const response = await professionalPatch(
        new NextRequest(
          "http://localhost:3500/api/user/profile/complete/professional",
          {
            method: "PATCH",
            body: JSON.stringify({ companyName: "Build Co" }),
          },
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(payload.error).toContain("suspended or banned accounts");
    });

    it("maps not_found domain results to 404", async () => {
      mockCompleteProfessionalProfile.mockResolvedValueOnce({
        ok: false,
        error: "not_found",
        message: "User not found",
        status: 404,
      });

      const response = await professionalPatch(
        new NextRequest(
          "http://localhost:3500/api/user/profile/complete/professional",
          {
            method: "PATCH",
            body: JSON.stringify({ companyName: "Build Co" }),
          },
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.error).toBe("User not found");
    });
  });
});
