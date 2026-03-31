import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/onboarding/uploads/route";

const mockAuth = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockValidateFile = vi.hoisted(() => vi.fn());
const mockStageOnboardingUpload = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    WRITE: { limit: 5, window: 60_000 },
  },
}));

vi.mock("@/app/lib/validation/file-validation", () => ({
  validateFile: mockValidateFile,
}));

vi.mock("@/app/lib/domains/uploads", () => ({
  uploadService: {
    stageOnboardingUpload: mockStageOnboardingUpload,
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  apiSuccess: vi
    .fn()
    .mockImplementation((data: unknown, status: number = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
  initializeCorrelationId: vi.fn().mockReturnValue("corr_uploads_123"),
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
  HttpStatus: {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

describe("POST /api/onboarding/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "clerk_123" });
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockValidateFile.mockReturnValue({ valid: true });
    mockStageOnboardingUpload.mockResolvedValue({
      ok: true,
      data: {
        uploadId: "upload_123",
        originalName: "national-id.pdf",
        previewUrl: "/uploads/upload_123.pdf",
        expiresAt: "2026-03-14T10:00:00.000Z",
      },
    });
  });

  it("rejects unauthenticated requests", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await POST(
      new NextRequest("http://localhost:3500/api/onboarding/uploads", {
        method: "POST",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Unauthorized");
  });

  it("returns 400 when no files are provided", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3500/api/onboarding/uploads", {
        method: "POST",
        body: new FormData(),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("No files provided");
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      reset: Date.now() + 60_000,
    });

    const formData = new FormData();
    formData.append(
      "idDocument",
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "doc.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost:3500/api/onboarding/uploads", {
        method: "POST",
        body: formData,
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Too many upload requests");
    expect(mockStageOnboardingUpload).not.toHaveBeenCalled();
  });

  it("returns 400 when more than MAX_FILES_PER_REQUEST files are submitted", async () => {
    const formData = new FormData();
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF magic bytes
    for (let i = 1; i <= 6; i++) {
      formData.append(
        `file_${i}`,
        new File([pdfBytes], `doc-${i}.pdf`, { type: "application/pdf" }),
      );
    }

    const response = await POST(
      new NextRequest("http://localhost:3500/api/onboarding/uploads", {
        method: "POST",
        body: formData,
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Too many files. Maximum 5 files per request.");
    expect(mockStageOnboardingUpload).not.toHaveBeenCalled();
  });

  it("stages valid uploads through the uploads domain service", async () => {
    const formData = new FormData();
    formData.append(
      "idDocument",
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "national-id.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost:3500/api/onboarding/uploads", {
        method: "POST",
        body: formData,
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.uploaded.idDocument[0]).toEqual({
      originalName: "national-id.pdf",
      uploadId: "upload_123",
      previewUrl: "/uploads/upload_123.pdf",
    });

    expect(mockValidateFile).toHaveBeenCalled();
    expect(mockStageOnboardingUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          clerkId: "clerk_123",
          correlationId: "corr_uploads_123",
        },
        file: expect.objectContaining({
          originalName: "national-id.pdf",
          mimeType: "application/pdf",
        }),
      }),
    );
  });

  it("maps uploads domain failures to HTTP responses", async () => {
    mockStageOnboardingUpload.mockResolvedValueOnce({
      ok: false,
      error: "invalid_input",
      message: "Unsupported upload payload",
      status: 400,
    });

    const formData = new FormData();
    formData.append(
      "certification",
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "cert.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost:3500/api/onboarding/uploads", {
        method: "POST",
        body: formData,
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Unsupported upload payload");
  });
});
