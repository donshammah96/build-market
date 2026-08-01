import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadService } from "@/app/lib/domains/uploads/service";
import {
  setVirusScannerForTests,
  MockVirusScanner,
} from "@/app/lib/domains/uploads/virus-scanner";

const {
  mockFindStagedUploadById,
  mockUpdateStagedUploadStatus,
  mockGetPresignedDownloadUrl,
  InvalidStatusTransitionError,
} = vi.hoisted(() => {
  class InvalidStatusTransitionError extends Error {
    constructor(
      public readonly from: string,
      public readonly to: string,
    ) {
      super(`Invalid staged-upload transition: ${from} -> ${to}`);
      this.name = "InvalidStatusTransitionError";
    }
  }
  return {
    mockFindStagedUploadById: vi.fn(),
    mockUpdateStagedUploadStatus: vi
      .fn()
      .mockResolvedValue({ from: "SCAN_PENDING", to: "STAGED" }),
    mockGetPresignedDownloadUrl: vi.fn(),
    InvalidStatusTransitionError,
  };
});

vi.mock("@/app/lib/domains/uploads/repository", () => ({
  assetDetailSelect: {},
  InvalidStatusTransitionError,
  uploadRepository: {
    findStagedUploadById: mockFindStagedUploadById,
    updateStagedUploadStatus: mockUpdateStagedUploadStatus,
    transitionStagedUploadStatus: mockUpdateStagedUploadStatus,
    findExpiredStagedUploadsForCleanup: vi.fn().mockResolvedValue([]),
    findUnattachedTemporaryAssetsForCleanup: vi.fn().mockResolvedValue([]),
    markStagedUploadsExpiredByIds: vi.fn().mockResolvedValue({ count: 0 }),
    hardDeleteAsset: vi.fn(),
  },
}));

vi.mock("@/app/lib/infrastructure/storage", () => ({
  getStorageProvider: vi.fn().mockReturnValue({
    getPresignedDownloadUrl: mockGetPresignedDownloadUrl,
    delete: vi.fn().mockResolvedValue(true),
    readObject: vi.fn().mockResolvedValue(Buffer.from("pdf-bytes")),
  }),
}));

vi.mock("@build/db", () => ({
  prisma: {},
}));

describe("UploadService Phase 4 Enhancements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setVirusScannerForTests(null);
  });

  describe("scanStagedUpload", () => {
    it("transitions status to SCAN_PENDING and then STAGED for clean upload", async () => {
      mockFindStagedUploadById.mockResolvedValue({
        id: "stg_123",
        clerkId: "clerk_pro_1",
        originalName: "contract.pdf",
        mimeType: "application/pdf",
        size: 5000,
        storageKey: "uploads/stg_123/contract.pdf",
        status: "SCAN_FAILED",
      });

      const result = await uploadService.rescanStagedUpload({
        uploadId: "stg_123",
        clerkId: "clerk_pro_1",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe("STAGED");
        expect(result.data.scanResult.status).toBe("CLEAN");
      }

      expect(mockUpdateStagedUploadStatus).toHaveBeenNthCalledWith(
        1,
        "stg_123",
        "SCAN_PENDING",
      );
      expect(mockUpdateStagedUploadStatus).toHaveBeenNthCalledWith(
        2,
        "stg_123",
        "STAGED",
      );
    });

    it("transitions status to QUARANTINED for malware infected upload", async () => {
      mockFindStagedUploadById.mockResolvedValue({
        id: "stg_mal",
        clerkId: "clerk_pro_1",
        originalName: "malware-test-sample.exe",
        mimeType: "application/x-msdownload",
        size: 5000,
        storageKey: "uploads/stg_mal/sample.exe",
        status: "SCAN_FAILED",
      });

      const result = await uploadService.rescanStagedUpload({
        uploadId: "stg_mal",
        clerkId: "clerk_pro_1",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe("QUARANTINED");
        expect(result.data.scanResult.status).toBe("INFECTED");
      }

      expect(mockUpdateStagedUploadStatus).toHaveBeenLastCalledWith(
        "stg_mal",
        "QUARANTINED",
      );
    });

    it("transitions status to SCAN_FAILED when scanner returns an error", async () => {
      setVirusScannerForTests(
        new MockVirusScanner({ simulateScanError: true }),
      );
      mockFindStagedUploadById.mockResolvedValue({
        id: "stg_err",
        clerkId: "clerk_pro_1",
        originalName: "document.pdf",
        mimeType: "application/pdf",
        size: 2000,
        storageKey: "uploads/stg_err/document.pdf",
        status: "SCAN_FAILED",
      });

      const result = await uploadService.rescanStagedUpload({
        uploadId: "stg_err",
        clerkId: "clerk_pro_1",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe("SCAN_FAILED");
        expect(result.data.scanResult.status).toBe("ERROR");
      }

      expect(mockUpdateStagedUploadStatus).toHaveBeenLastCalledWith(
        "stg_err",
        "SCAN_FAILED",
      );
    });
  });

  describe("generateShortLivedPreviewUrl", () => {
    it("generates a signed download URL with 15-min TTL bounds", async () => {
      mockFindStagedUploadById.mockResolvedValue({
        id: "stg_preview",
        clerkId: "clerk_pro_1",
        originalName: "license.pdf",
        storageKey: "uploads/license.pdf",
        status: "STAGED",
      });
      mockGetPresignedDownloadUrl.mockResolvedValue(
        "https://storage.example.com/uploads/license.pdf?token=short-lived",
      );

      const result = await uploadService.generateShortLivedPreviewUrl({
        uploadId: "stg_preview",
        clerkId: "clerk_pro_1",
        expiresInSeconds: 3600, // Explicitly requests 1 hour, should be bounded to 900s
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.previewUrl).toContain("token=short-lived");
      }
      expect(mockGetPresignedDownloadUrl).toHaveBeenCalledWith(
        "uploads/license.pdf",
        {
          expiresInSeconds: 900,
          visibility: "public",
          filename: "license.pdf",
        },
      );
    });

    it("rejects preview URL generation for QUARANTINED upload", async () => {
      mockFindStagedUploadById.mockResolvedValue({
        id: "stg_quarantined",
        clerkId: "clerk_pro_1",
        originalName: "bad.pdf",
        storageKey: "uploads/bad.pdf",
        status: "QUARANTINED",
      });

      const result = await uploadService.generateShortLivedPreviewUrl({
        uploadId: "stg_quarantined",
        clerkId: "clerk_pro_1",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("forbidden");
        expect(result.message).toContain("QUARANTINED");
      }
    });
  });
});
