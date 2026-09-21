import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/uploads/route";

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockValidateFile = vi.hoisted(() => vi.fn());
const mockIsImageFile = vi.hoisted(() => vi.fn());
const mockGetValidationConfig = vi.hoisted(() => vi.fn());
const mockSanitizeFilename = vi.hoisted(() => vi.fn());
const mockPrepareUploadedAssetPersistence = vi.hoisted(() => vi.fn());
const mockPersistPreparedUploadedAsset = vi.hoisted(() => vi.fn());
const mockCleanupPreparedUploadedAssetArtifacts = vi.hoisted(() => vi.fn());
const mockCreatePendingUploadStatus = vi.hoisted(() => vi.fn());
const mockMarkUploadFailed = vi.hoisted(() => vi.fn());
const mockEnqueueImageUploadProcessingJob = vi.hoisted(() => vi.fn());
const mockProcessImageUploadJob = vi.hoisted(() => vi.fn());
const mockEnv = vi.hoisted(() => ({
  isProd: false,
  jobs: {
    uploadProcessInline: false,
  },
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (
      handler: (
        req: NextRequest,
        context: { dbUserId: string },
      ) => Promise<Response>,
    ) =>
    async (req: NextRequest) =>
      handler(req, {
        dbUserId: "db-user-1",
      }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: vi.fn().mockReturnValue("ip-test"),
  RateLimits: {
    WRITE: { limit: 10, window: 60_000 },
  },
}));

vi.mock("@/app/lib/api/request-utils", () => ({
  getRequestMetadata: vi.fn().mockReturnValue({
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  }),
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("corr-upload-1"),
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
    ACCEPTED: 202,
    BAD_REQUEST: 400,
    TOO_MANY_REQUESTS: 429,
    SERVICE_UNAVAILABLE: 503,
  },
}));

vi.mock("@/app/lib/validation/file-validation", () => ({
  validateFile: mockValidateFile,
  isImageFile: mockIsImageFile,
  getValidationConfig: mockGetValidationConfig,
  sanitizeFilename: mockSanitizeFilename,
}));

vi.mock("@/app/lib/domains/uploads", () => ({
  uploadService: {
    prepareUploadedAssetPersistence: mockPrepareUploadedAssetPersistence,
    persistPreparedUploadedAsset: mockPersistPreparedUploadedAsset,
    cleanupPreparedUploadedAssetArtifacts:
      mockCleanupPreparedUploadedAssetArtifacts,
  },
}));

vi.mock("@/app/lib/infrastructure/upload-processing-status", () => ({
  createPendingUploadStatus: mockCreatePendingUploadStatus,
  markUploadFailed: mockMarkUploadFailed,
}));

vi.mock("@/app/lib/queues/upload-processing.queue", () => ({
  enqueueImageUploadProcessingJob: mockEnqueueImageUploadProcessingJob,
}));

vi.mock("@/app/lib/domains/uploads/inline-processor", () => ({
  processImageUploadInline: mockProcessImageUploadJob,
}));

vi.mock("@/app/lib/infrastructure/env", () => ({
  env: mockEnv,
}));

describe("POST /api/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.isProd = false;
    mockEnv.jobs.uploadProcessInline = false;

    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockValidateFile.mockReturnValue({ valid: true });
    mockGetValidationConfig.mockReturnValue({});
    mockSanitizeFilename.mockImplementation((name: string) => name);

    mockCreatePendingUploadStatus.mockResolvedValue({
      uploadId: "upload-token-1",
      status: "pending",
      statusUrl: "/api/uploads/upload-token-1",
      createdAt: "2026-03-31T08:00:00.000Z",
    });
    mockEnqueueImageUploadProcessingJob.mockResolvedValue({ id: "job-1" });

    mockPrepareUploadedAssetPersistence.mockResolvedValue({
      ok: true,
      data: {
        kind: "prepared",
        prepared: {
          storedChecksum: "checksum-1",
          uploadedFile: {
            key: "uploads/2026/04/file-1.pdf",
            url: "/uploads/file-1.pdf",
            cdnUrl: "https://cdn.example.com/files/doc-1.pdf",
            checksum: "checksum-1",
            size: 1024,
            bucket: "local",
          },
          deleteAfter: null,
        },
      },
    });

    mockPersistPreparedUploadedAsset.mockResolvedValue({
      ok: true,
      data: {
        asset: {
          id: "asset-1",
          cdnUrl: "https://cdn.example.com/files/doc-1.pdf",
          thumbnailUrl: null,
          size: 1024,
          mimeType: "application/pdf",
          width: null,
          height: null,
          blurHash: null,
        },
        storedChecksum: "checksum-1",
        deduplicated: false,
      },
    });

    mockCleanupPreparedUploadedAssetArtifacts.mockResolvedValue(undefined);
    mockMarkUploadFailed.mockResolvedValue(undefined);
  });

  it("returns 202 Accepted and pending upload metadata for image files", async () => {
    mockIsImageFile.mockReturnValue(true);

    const formData = new FormData();
    formData.append(
      "images",
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "avatar.jpg", {
        type: "image/jpeg",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost:3500/api/uploads", {
        method: "POST",
        body: formData,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.success).toBe(true);
    expect(body.data.uploaded[0]).toEqual(
      expect.objectContaining({
        fieldName: "images",
        originalName: "avatar.jpg",
        uploadId: expect.any(String),
        status: "pending",
        statusUrl: "/api/uploads/upload-token-1",
      }),
    );
    expect(mockEnqueueImageUploadProcessingJob).toHaveBeenCalledTimes(1);
    expect(mockPrepareUploadedAssetPersistence).not.toHaveBeenCalled();
    expect(mockPersistPreparedUploadedAsset).not.toHaveBeenCalled();
  });

  it("keeps non-image uploads on immediate completion path", async () => {
    mockIsImageFile.mockReturnValue(false);

    const formData = new FormData();
    formData.append(
      "documents",
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "license.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost:3500/api/uploads", {
        method: "POST",
        body: formData,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.uploaded[0]).toEqual(
      expect.objectContaining({
        fieldName: "documents",
        originalName: "license.pdf",
        assetId: "asset-1",
        url: "https://cdn.example.com/files/doc-1.pdf",
      }),
    );
    expect(mockPrepareUploadedAssetPersistence).toHaveBeenCalledTimes(1);
    expect(mockPersistPreparedUploadedAsset).toHaveBeenCalledTimes(1);
    expect(mockCleanupPreparedUploadedAssetArtifacts).not.toHaveBeenCalled();
    expect(mockCreatePendingUploadStatus).not.toHaveBeenCalled();
  });

  it("returns 503 in production when image queue enqueue fails", async () => {
    mockEnv.isProd = true;
    mockIsImageFile.mockReturnValue(true);
    mockEnqueueImageUploadProcessingJob.mockRejectedValueOnce(
      new Error("queue unavailable"),
    );

    const formData = new FormData();
    formData.append(
      "images",
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "avatar.jpg", {
        type: "image/jpeg",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost:3500/api/uploads", {
        method: "POST",
        body: formData,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe(
      "Upload processing is temporarily unavailable. Please retry.",
    );
    expect(mockMarkUploadFailed).toHaveBeenCalledWith(
      expect.any(String),
      "Upload processing is temporarily unavailable. Please retry.",
    );
    expect(mockProcessImageUploadJob).not.toHaveBeenCalled();
  });

  it("uses inline image processing only when explicitly enabled outside production", async () => {
    mockEnv.jobs.uploadProcessInline = true;
    mockIsImageFile.mockReturnValue(true);
    mockProcessImageUploadJob.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append(
      "images",
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "avatar.jpg", {
        type: "image/jpeg",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost:3500/api/uploads", {
        method: "POST",
        body: formData,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.success).toBe(true);
    await vi.waitFor(() => {
      expect(mockProcessImageUploadJob).toHaveBeenCalledTimes(1);
    });
    expect(mockEnqueueImageUploadProcessingJob).not.toHaveBeenCalled();
  });
});
