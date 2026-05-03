import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST as PRESIGN } from "@/app/api/uploads/presign/route";
import { POST as CONFIRM } from "@/app/api/uploads/confirm/route";
import { GET as DOWNLOAD } from "@/app/api/uploads/[id]/download/route";

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockRequestDirectUpload = vi.hoisted(() => vi.fn());
const mockConfirmDirectUpload = vi.hoisted(() => vi.fn());
const mockGetAssetDownloadUrl = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (
      handler: (
        req: NextRequest,
        context: { dbUserId: string; userRole: string },
        params?: { id: string },
      ) => Promise<Response>,
    ) =>
    async (req: NextRequest, params?: { id: string }) =>
      handler(
        req,
        {
          dbUserId: "db-user-1",
          userRole: "PROFESSIONAL",
        },
        params,
      ),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: vi.fn().mockReturnValue("ip-test"),
  RateLimits: {
    READ: { limit: 60, window: 60_000 },
    WRITE: { limit: 10, window: 60_000 },
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("corr-direct-route-1"),
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
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    GONE: 410,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

vi.mock("@/app/lib/domains/uploads", () => ({
  uploadService: {
    requestDirectUpload: mockRequestDirectUpload,
    confirmDirectUpload: mockConfirmDirectUpload,
    getAssetDownloadUrl: mockGetAssetDownloadUrl,
  },
}));

describe("direct upload API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
  });

  it("presigns private document uploads without accepting caller visibility", async () => {
    mockRequestDirectUpload.mockResolvedValue({
      ok: true,
      data: {
        uploadId: "11111111-1111-4111-8111-111111111111",
        uploadUrl: "/api/uploads/direct?token=signed",
        key: "private/uploads/2026/05/license.pdf",
        requiredHeaders: { "Content-Type": "application/pdf" },
        expiresAt: "2026-05-03T09:05:00.000Z",
      },
    });

    const response = await PRESIGN(
      new NextRequest("http://localhost:3500/api/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          filename: "license.pdf",
          mimeType: "application/pdf",
          size: 512,
          checksumSha256:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          context: "document",
          visibility: "public",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.uploadId).toBe("11111111-1111-4111-8111-111111111111");
    expect(mockRequestDirectUpload).toHaveBeenCalledWith(
      expect.not.objectContaining({ visibility: "public" }),
    );
    expect(mockRequestDirectUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          userId: "db-user-1",
          correlationId: "corr-direct-route-1",
        },
        context: "document",
      }),
    );
  });

  it("maps expired direct upload confirmation to 410", async () => {
    mockConfirmDirectUpload.mockResolvedValue({
      ok: false,
      error: "expired",
      message: "Upload URL has expired",
    });

    const response = await CONFIRM(
      new NextRequest("http://localhost:3500/api/uploads/confirm", {
        method: "POST",
        body: JSON.stringify({
          uploadId: "22222222-2222-4222-8222-222222222222",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toBe("Upload URL has expired");
  });

  it("returns authorized private download URLs", async () => {
    mockGetAssetDownloadUrl.mockResolvedValue({
      ok: true,
      data: {
        assetId: "asset-private-1",
        visibility: "PRIVATE",
        downloadUrl: "https://storage.example.com/private?signed=1",
        expiresAt: "2026-05-03T09:15:00.000Z",
      },
    });

    const response = await DOWNLOAD(
      new NextRequest(
        "http://localhost:3500/api/uploads/asset-private-1/download",
      ),
      { id: "asset-private-1" },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(
      expect.objectContaining({
        assetId: "asset-private-1",
        visibility: "PRIVATE",
      }),
    );
    expect(mockGetAssetDownloadUrl).toHaveBeenCalledWith({
      actor: {
        userId: "db-user-1",
        role: "PROFESSIONAL",
        correlationId: "corr-direct-route-1",
      },
      assetId: "asset-private-1",
    });
  });
});
