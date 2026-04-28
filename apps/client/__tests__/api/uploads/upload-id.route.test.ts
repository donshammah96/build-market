import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/uploads/[id]/route";

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockGetUploadProcessingStatus = vi.hoisted(() => vi.fn());
const mockGetOwnedAssetMetadataAndTrackAccess = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (
      handler: (
        req: NextRequest,
        context: { dbUserId: string },
        params?: { id: string },
      ) => Promise<Response>,
    ) =>
    async (req: NextRequest, params?: { id: string }) =>
      handler(
        req,
        {
          dbUserId: "db-user-1",
        },
        params || { id: "upload-token-1" },
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

vi.mock("@/app/lib/api/request-utils", () => ({
  getRequestMetadata: vi.fn().mockReturnValue({
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  }),
  TimeoutConfig: {
    NORMAL: "normal",
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("corr-upload-status-1"),
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => ({
      success: true,
      data: await fn(),
    })),
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
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    FORBIDDEN: 403,
  },
}));

vi.mock("@/app/lib/infrastructure/upload-processing-status", () => ({
  getUploadProcessingStatus: mockGetUploadProcessingStatus,
}));

vi.mock("@/app/lib/domains/uploads", () => ({
  uploadService: {
    getOwnedAssetMetadataAndTrackAccess:
      mockGetOwnedAssetMetadataAndTrackAccess,
    deleteOwnedAsset: vi.fn(),
  },
}));

describe("GET /api/uploads/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
  });

  it("returns pending status payload for in-flight image uploads", async () => {
    mockGetUploadProcessingStatus.mockResolvedValue({
      uploadId: "upload-token-1",
      ownerUserId: "db-user-1",
      status: "pending",
      statusUrl: "/api/uploads/upload-token-1",
    });

    const response = await GET(
      new NextRequest("http://localhost:3500/api/uploads/upload-token-1"),
      { id: "upload-token-1" },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(
      expect.objectContaining({
        uploadId: "upload-token-1",
        status: "pending",
        statusUrl: "/api/uploads/upload-token-1",
      }),
    );
    expect(mockGetOwnedAssetMetadataAndTrackAccess).not.toHaveBeenCalled();
  });

  it("returns ready status payload with asset snapshot when processing finishes", async () => {
    mockGetUploadProcessingStatus.mockResolvedValue({
      uploadId: "upload-token-1",
      ownerUserId: "db-user-1",
      status: "ready",
      statusUrl: "/api/uploads/upload-token-1",
      asset: {
        assetId: "asset-123",
        url: "https://cdn.example.com/files/photo.jpg",
        cdnUrl: "https://cdn.example.com/files/photo.jpg",
        thumbnailUrl: "https://cdn.example.com/files/thumb-photo.jpg",
        mimeType: "image/jpeg",
        size: 2048,
        width: 1200,
        height: 900,
      },
    });

    const response = await GET(
      new NextRequest("http://localhost:3500/api/uploads/upload-token-1"),
      { id: "upload-token-1" },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("ready");
    expect(body.data.asset.assetId).toBe("asset-123");
  });

  it("falls back to existing asset metadata path when no pending lifecycle exists", async () => {
    mockGetUploadProcessingStatus.mockResolvedValue(null);
    mockGetOwnedAssetMetadataAndTrackAccess.mockResolvedValue({
      ok: true,
      data: {
        id: "asset-legacy-1",
        filename: "legacy-file.pdf",
        url: "https://cdn.example.com/files/legacy-file.pdf",
        thumbnailUrl: null,
        size: 1024,
        mimeType: "application/pdf",
        width: null,
        height: null,
        blurHash: null,
        downloadCount: 2,
        createdAt: "2026-03-31T08:00:00.000Z",
        temporary: false,
      },
    });

    const response = await GET(
      new NextRequest("http://localhost:3500/api/uploads/asset-legacy-1"),
      { id: "asset-legacy-1" },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe("asset-legacy-1");
    expect(mockGetOwnedAssetMetadataAndTrackAccess).toHaveBeenCalledWith(
      { userId: "db-user-1", correlationId: "corr-upload-status-1" },
      "asset-legacy-1",
    );
  });
});
