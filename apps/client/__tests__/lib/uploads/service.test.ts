import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadService } from "@/app/lib/domains/uploads/service";
import { prisma } from "@build/db";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockStorageUpload = vi.hoisted(() => vi.fn());
const mockStorageDelete = vi.hoisted(() => vi.fn());
const mockFindAssetByChecksum = vi.hoisted(() => vi.fn());
const mockCreateAsset = vi.hoisted(() => vi.fn());
const mockCreateConsentRecord = vi.hoisted(() => vi.fn());
const mockFindOwnedAssetById = vi.hoisted(() => vi.fn());
const mockIncrementAssetAccess = vi.hoisted(() => vi.fn());
const mockFindAssetForDeletion = vi.hoisted(() => vi.fn());
const mockSoftDeleteAsset = vi.hoisted(() => vi.fn());
const mockHardDeleteAsset = vi.hoisted(() => vi.fn());
const mockFindStagedUploads = vi.hoisted(() => vi.fn());
const mockMarkStagedUploadConsumed = vi.hoisted(() => vi.fn());
const mockCreateStagedOnboardingUpload = vi.hoisted(() => vi.fn());
const mockFindExpiredStagedUploadsForCleanup = vi.hoisted(() => vi.fn());
const mockMarkStagedUploadsExpiredByIds = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/api/resilient-api", () => ({
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
}));

vi.mock("@/app/lib/infrastructure/storage", () => ({
  getStorageProvider: vi.fn().mockReturnValue({
    upload: mockStorageUpload,
    delete: mockStorageDelete,
  }),
}));

vi.mock("@build/db", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: object) => Promise<unknown>) =>
      callback({}),
    ),
  },
}));

vi.mock("@/app/lib/domains/uploads/repository", () => ({
  assetDetailSelect: {},
  uploadRepository: {
    findAssetByChecksum: mockFindAssetByChecksum,
    createAsset: mockCreateAsset,
    createConsentRecord: mockCreateConsentRecord,
    findOwnedAssetById: mockFindOwnedAssetById,
    incrementAssetAccess: mockIncrementAssetAccess,
    findAssetForDeletion: mockFindAssetForDeletion,
    softDeleteAsset: mockSoftDeleteAsset,
    hardDeleteAsset: mockHardDeleteAsset,
    findStagedUploads: mockFindStagedUploads,
    createStagedOnboardingUpload: mockCreateStagedOnboardingUpload,
    markStagedUploadConsumed: mockMarkStagedUploadConsumed,
    findExpiredStagedUploadsForCleanup: mockFindExpiredStagedUploadsForCleanup,
    markStagedUploadsExpiredByIds: mockMarkStagedUploadsExpiredByIds,
  },
}));

describe("uploadService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stages onboarding uploads through storage and repository", async () => {
    mockStorageUpload.mockResolvedValue({
      key: "1710000000000-upload.pdf",
      url: "/uploads/1710000000000-upload.pdf",
      cdnUrl: "/uploads/1710000000000-upload.pdf",
      checksum:
        "f4d5f1d31dcf2de4f2f801a2f6a76dd5352f53e5af97f4884de6f9f96fcbec6e",
      size: 2048,
      bucket: "local",
    });
    mockCreateStagedOnboardingUpload.mockResolvedValue({
      id: "onb_upload_1",
      tempUrl: "/uploads/1710000000000-upload.pdf",
      originalName: "id-document.pdf",
      mimeType: "application/pdf",
      size: 2048,
      checksum:
        "f4d5f1d31dcf2de4f2f801a2f6a76dd5352f53e5af97f4884de6f9f96fcbec6e",
      storageBucket: "local",
      storageKey: "1710000000000-upload.pdf",
      expiresAt: new Date("2026-03-13T10:00:00.000Z"),
    });

    const result = await uploadService.stageOnboardingUpload({
      actor: { clerkId: "clerk_123", correlationId: "corr_onboarding_upload" },
      file: {
        originalName: "id-document.pdf",
        mimeType: "application/pdf",
        size: 2048,
        buffer: Buffer.from("pdf-bytes"),
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.uploadId).toBe("onb_upload_1");
      expect(result.data.previewUrl).toBe("/uploads/1710000000000-upload.pdf");
      expect(result.data.originalName).toBe("id-document.pdf");
    }

    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.any(Buffer),
      "id-document.pdf",
      "application/pdf",
    );
    expect(mockCreateStagedOnboardingUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkId: "clerk_123",
        originalName: "id-document.pdf",
        mimeType: "application/pdf",
        storageBucket: "local",
      }),
    );
  });

  it("deduplicates uploads before writing to storage", async () => {
    mockFindAssetByChecksum.mockResolvedValue({
      id: "asset_1",
      uploaderId: "user_1",
      originalName: "existing.jpg",
      mimeType: "image/jpeg",
      size: 1024,
      checksum:
        "039058c6f2c0cb492c533b0a4d14ef77ffbd1e83c4d8a06c47782968e6dfb912",
      bucket: "assets",
      key: "uploads/existing.jpg",
      cdnUrl: "https://cdn.example.com/existing.jpg",
      thumbnailUrl: null,
      width: 320,
      height: 240,
      blurHash: null,
      downloadCount: 0,
      lastAccessed: null,
      createdAt: new Date("2026-03-12T10:00:00.000Z"),
      deletedAt: null,
      deleteAfter: null,
    });

    const result = await uploadService.persistUploadedAsset({
      actor: { userId: "user_1", correlationId: "corr_1" },
      originalName: "new.jpg",
      mimeType: "image/jpeg",
      originalSize: 1024,
      storedFilename: "processed-new.jpg",
      storedBuffer: Buffer.from("same-processed-buffer"),
      temporary: false,
      tempExpiryHours: 24,
      consent: { context: "profile_upload" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.deduplicated).toBe(true);
      expect(result.data.asset.id).toBe("asset_1");
    }
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockCreateAsset).not.toHaveBeenCalled();
    expect(mockCreateConsentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { connect: { id: "user_1" } },
        type: "ANALYTICS_COOKIES",
        metadata: expect.objectContaining({
          source: "file_upload",
          context: "profile_upload",
          deduplicated: true,
          existingAssetId: "asset_1",
        }),
      }),
    );
  });

  it("soft deletes referenced assets instead of removing storage", async () => {
    mockFindAssetForDeletion.mockResolvedValue({
      id: "asset_2",
      uploaderId: "user_1",
      key: "uploads/referenced.jpg",
      originalName: "referenced.jpg",
      deletedAt: null,
      projectImages: [{ id: "project_image_1" }],
      projectDocs: [],
      storeDocs: [],
      storeImages: [],
      propertyDocs: [],
      propertyAttachments: [],
      propertyImages: [],
      portfolioImages: [],
      ideaBookAttachments: [],
      professionalDocs: [],
      professionalLicenses: [],
      messageAttachments: [],
      products: [],
      quoteAttachments: [],
      reviewImages: [],
    });

    const result = await uploadService.deleteOwnedAsset(
      { userId: "user_1", correlationId: "corr_2" },
      "asset_2",
      {},
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.softDeleted).toBe(true);
      expect(result.data.permanent).toBe(false);
    }
    expect(mockSoftDeleteAsset).toHaveBeenCalledWith(
      "asset_2",
      expect.any(Object),
    );
    expect(mockStorageDelete).not.toHaveBeenCalled();
    expect(mockHardDeleteAsset).not.toHaveBeenCalled();
    expect(mockCreateConsentRecord).not.toHaveBeenCalled();
  });

  it("rejects expired staged uploads during onboarding materialization", async () => {
    mockFindStagedUploads.mockResolvedValue([
      {
        id: "staged_1",
        clerkId: "clerk_123",
        tempUrl: "https://cdn.example.com/temp.jpg",
        originalName: "temp.jpg",
        mimeType: "image/jpeg",
        size: 2048,
        checksum: "checksum-1",
        storageBucket: "temp-assets",
        storageKey: "staged/temp.jpg",
        status: "STAGED",
        expiresAt: new Date("2026-03-11T10:00:00.000Z"),
      },
    ]);

    const result = await uploadService.materializeOnboardingUpload({
      actor: { userId: "user_1", correlationId: "corr_3" },
      clerkId: "clerk_123",
      uploadId: "staged_1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_input");
      expect(result.message).toContain("Invalid or expired");
    }
    expect(mockCreateAsset).not.toHaveBeenCalled();
    expect(mockMarkStagedUploadConsumed).not.toHaveBeenCalled();
  });

  it("cleanupExpiredStagedUploads deletes storage and marks as EXPIRED", async () => {
    mockFindExpiredStagedUploadsForCleanup.mockResolvedValue([
      {
        id: "expired_1",
        storageBucket: "local",
        storageKey: "staged/expired1.pdf",
      },
      {
        id: "expired_2",
        storageBucket: "local",
        storageKey: "staged/expired2.jpg",
      },
    ]);
    mockMarkStagedUploadsExpiredByIds.mockResolvedValue({ count: 2 });
    mockStorageDelete.mockResolvedValue(undefined);

    const result = await uploadService.cleanupExpiredStagedUploads();

    expect(result).toEqual({
      count: 2,
      deletedFromStorage: 2,
      failedDeletions: [],
    });
    expect(mockFindExpiredStagedUploadsForCleanup).toHaveBeenCalled();
    expect(mockStorageDelete).toHaveBeenCalledTimes(2);
    expect(mockStorageDelete).toHaveBeenCalledWith("staged/expired1.pdf");
    expect(mockStorageDelete).toHaveBeenCalledWith("staged/expired2.jpg");
    expect(mockMarkStagedUploadsExpiredByIds).toHaveBeenCalledWith(
      ["expired_1", "expired_2"],
      expect.anything(),
    );
  });

  it("cleanupExpiredStagedUploads continues on storage delete failure", async () => {
    mockFindExpiredStagedUploadsForCleanup.mockResolvedValue([
      { id: "expired_1", storageBucket: "local", storageKey: "key1.pdf" },
      { id: "expired_2", storageBucket: "local", storageKey: "key2.jpg" },
    ]);
    mockMarkStagedUploadsExpiredByIds.mockResolvedValue({ count: 2 });
    mockStorageDelete
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Storage unavailable"));

    const result = await uploadService.cleanupExpiredStagedUploads();

    expect(result.count).toBe(2);
    expect(result.deletedFromStorage).toBe(1);
    expect(result.failedDeletions).toEqual(["expired_2"]);
    expect(mockMarkStagedUploadsExpiredByIds).toHaveBeenCalledWith(
      ["expired_1", "expired_2"],
      expect.anything(),
    );
  });
});
