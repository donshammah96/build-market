import { createHash } from "crypto";
import {
  getStorageProvider,
  verifyLocalPresignedStorageToken,
  type StorageVisibility,
  type StorageProvider,
  type UploadedFile,
} from "@/app/lib/infrastructure/storage";
import {
  sanitizeFilename,
  validateFile,
  type ValidationConfig,
} from "@/app/lib/validation/file-validation";
import {
  err,
  ok,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";
import {
  assetDetailSelect,
  uploadRepository,
  type CreateStagedUploadInput,
  type UploadAssetRecord,
} from "@/app/lib/domains/uploads/repository";
import { prisma, type Prisma } from "@build/db";

let storageProviderOverride: StorageProvider | null = null;

export function setUploadServiceStorageProviderForTests(
  provider: StorageProvider | null,
): void {
  storageProviderOverride = provider;
}

function resolveStorageProvider(): StorageProvider {
  return storageProviderOverride ?? getStorageProvider();
}

type UploadClient = Prisma.TransactionClient | typeof prisma;

export type UploadActor = {
  userId: string;
  correlationId?: string;
};

export type OnboardingUploadActor = {
  clerkId: string;
  correlationId?: string;
};

export type UploadServiceErrorCode =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "expired"
  | "invalid_input"
  | "processing_failed";

type UploadServiceError = DomainError<UploadServiceErrorCode>;

export type UploadServiceResult<T> = Result<T, UploadServiceError>;

export type PersistUploadedAssetInput = {
  actor: UploadActor;
  originalName: string;
  mimeType: string;
  originalSize: number;
  storedFilename: string;
  storedBuffer: Buffer;
  thumbnailFilename?: string;
  thumbnailBuffer?: Buffer;
  width?: number | null;
  height?: number | null;
  blurHash?: string | null;
  temporary: boolean;
  tempExpiryHours: number;
  consent: {
    ipAddress?: string;
    userAgent?: string;
    context: string;
  };
};

export type PersistedUploadResponse = {
  asset: UploadAssetRecord;
  storedChecksum: string;
  deduplicated: boolean;
  expiresAt?: string;
};

export type PreparedStoredUpload = {
  storedChecksum: string;
  uploadedFile: UploadedFile;
  thumbnailFile?: UploadedFile;
  deleteAfter: Date | null;
};

export type PrepareUploadedAssetPersistenceResult =
  | {
      kind: "deduplicated";
      response: PersistedUploadResponse;
    }
  | {
      kind: "prepared";
      prepared: PreparedStoredUpload;
    };

export type PersistPreparedUploadedAssetInput = {
  actor: UploadActor;
  originalName: string;
  mimeType: string;
  originalSize: number;
  width?: number | null;
  height?: number | null;
  blurHash?: string | null;
  temporary: boolean;
  consent: {
    ipAddress?: string;
    userAgent?: string;
    context: string;
  };
  prepared: PreparedStoredUpload;
};

export type OwnedAssetMetadata = {
  id: string;
  filename: string;
  url: string | null;
  thumbnailUrl: string | null;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  blurHash: string | null;
  downloadCount: number;
  lastAccessed?: string;
  createdAt: string;
  temporary: boolean;
  expiresAt?: string;
};

export type DeleteOwnedAssetResponse = {
  message: string;
  assetId: string;
  softDeleted: boolean;
  permanent: boolean;
};

/** Post-materialization result; assetId is the canonical reference for ProfessionalDocument. */
export type MaterializedUpload = {
  assetId: string;
};

export type StageOnboardingUploadInput = {
  actor: OnboardingUploadActor;
  file: {
    originalName: string;
    mimeType: string;
    size: number;
    buffer: Buffer;
  };
  expiresInHours?: number;
};

export type StagedOnboardingUpload = {
  uploadId: string;
  originalName: string;
  previewUrl: string;
  expiresAt: string;
};

export type RequestDirectUploadInput = {
  actor: UploadActor;
  filename: string;
  mimeType: string;
  size: number;
  checksumSha256: string;
  context: "document";
  temporary?: boolean;
  tempExpiryHours?: number;
};

export type RequestedDirectUpload = {
  uploadId: string;
  uploadUrl: string;
  key: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
};

export type ConfirmDirectUploadInput = {
  actor: UploadActor;
  uploadId: string;
};

export type ConfirmedDirectUpload = {
  assetId: string;
  visibility: "PRIVATE";
};

export type GetAssetDownloadUrlInput = {
  actor: UploadActor & { role?: string | null };
  assetId: string;
};

export type AssetDownloadUrl = {
  assetId: string;
  visibility: "PUBLIC" | "PRIVATE";
  downloadUrl: string;
  expiresAt: string | null;
};

export type PutLocalDirectUploadObjectInput = {
  key: string;
  expiresAt: number;
  token: string;
  visibility: StorageVisibility;
  mimeType: string;
  buffer: Buffer;
};

export type LocalDirectDownloadObjectInput = {
  key: string;
  expiresAt: number;
  token: string;
  visibility: StorageVisibility;
};

export type LocalDirectDownloadObject = {
  buffer: Buffer;
  mimeType: string;
};

function fail<T>(
  error: UploadServiceErrorCode,
  message: string,
  details?: unknown,
): UploadServiceResult<T> {
  return err({ error, message, details });
}

function getChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

const DIRECT_UPLOAD_TTL_SECONDS = 5 * 60;
const PRIVATE_DOWNLOAD_TTL_SECONDS = 15 * 60;
const HEX_SHA256_RE = /^[a-f0-9]{64}$/i;

const DIRECT_DOCUMENT_VALIDATION_CONFIG: ValidationConfig = {
  maxFileSize: 25 * 1024 * 1024,
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
  allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
  checkMagicNumbers: true,
};

function storageVisibilityFromAsset(
  visibility: "PUBLIC" | "PRIVATE",
): StorageVisibility {
  return visibility === "PRIVATE" ? "private" : "public";
}

function prismaVisibilityFromStorage(
  visibility: StorageVisibility,
): "PUBLIC" | "PRIVATE" {
  return visibility === "private" ? "PRIVATE" : "PUBLIC";
}

function validateDirectUploadRequestMetadata(
  input: RequestDirectUploadInput,
): string | null {
  if (input.context !== "document") {
    return "Direct uploads are currently supported for document files only";
  }
  if (!input.filename.trim()) {
    return "Filename is required";
  }
  if (!Number.isInteger(input.size) || input.size <= 0) {
    return "File size must be a positive integer";
  }
  if (input.size > DIRECT_DOCUMENT_VALIDATION_CONFIG.maxFileSize) {
    return "File size exceeds maximum allowed size of 25MB";
  }
  if (
    !DIRECT_DOCUMENT_VALIDATION_CONFIG.allowedMimeTypes.includes(input.mimeType)
  ) {
    return `File type '${input.mimeType}' is not allowed`;
  }
  const lowerName = input.filename.toLowerCase();
  const hasAllowedExtension =
    DIRECT_DOCUMENT_VALIDATION_CONFIG.allowedExtensions.some((ext) =>
      lowerName.endsWith(ext),
    );
  if (!hasAllowedExtension) {
    return "File extension is not allowed";
  }
  if (!HEX_SHA256_RE.test(input.checksumSha256)) {
    return "checksumSha256 must be a 64-character hexadecimal SHA-256 digest";
  }
  if (
    input.tempExpiryHours !== undefined &&
    (!Number.isInteger(input.tempExpiryHours) ||
      input.tempExpiryHours < 1 ||
      input.tempExpiryHours > 72)
  ) {
    return "tempExpiryHours must be between 1 and 72";
  }
  return null;
}

export const uploadService = {
  async prepareUploadedAssetPersistence(
    input: PersistUploadedAssetInput,
  ): Promise<UploadServiceResult<PrepareUploadedAssetPersistenceResult>> {
    const storage = resolveStorageProvider();
    const storedChecksum = getChecksum(input.storedBuffer);

    try {
      const existingAsset = await uploadRepository.findOwnedAssetByChecksum(
        storedChecksum,
        input.actor.userId,
        "PUBLIC",
      );
      if (existingAsset) {
        await uploadRepository.createConsentRecord({
          user: { connect: { id: input.actor.userId } },
          type: "ANALYTICS_COOKIES",
          granted: true,
          grantedAt: new Date(),
          documentVersion: "v1.0",
          ipAddress: input.consent.ipAddress,
          metadata: {
            source: "file_upload",
            correlationId: input.actor.correlationId,
            userAgent: input.consent.userAgent,
            fileName: input.originalName,
            fileSize: input.originalSize,
            mimeType: input.mimeType,
            temporary: input.temporary,
            context: input.consent.context,
            deduplicated: true,
            existingAssetId: existingAsset.id,
          },
        });

        return ok({
          kind: "deduplicated",
          response: {
            asset: existingAsset,
            storedChecksum,
            deduplicated: true,
            expiresAt: existingAsset.deleteAfter?.toISOString(),
          },
        });
      }

      let uploadedFile: UploadedFile | undefined;
      let thumbnailFile: UploadedFile | undefined;

      try {
        uploadedFile = await storage.upload(
          input.storedBuffer,
          input.storedFilename,
          input.mimeType,
          { visibility: "public" },
        );

        if (input.thumbnailBuffer && input.thumbnailFilename) {
          thumbnailFile = await storage.upload(
            input.thumbnailBuffer,
            input.thumbnailFilename,
            "image/jpeg",
            { visibility: "public" },
          );
        }
      } catch {
        if (thumbnailFile) {
          try {
            await storage.delete(thumbnailFile.key, { visibility: "public" });
          } catch {
            // Best-effort cleanup only.
          }
        }
        if (uploadedFile) {
          try {
            await storage.delete(uploadedFile.key, { visibility: "public" });
          } catch {
            // Best-effort cleanup only.
          }
        }
        return fail("processing_failed", "Failed to persist upload");
      }

      const deleteAfter = input.temporary
        ? new Date(Date.now() + input.tempExpiryHours * 60 * 60 * 1000)
        : null;

      return ok({
        kind: "prepared",
        prepared: {
          storedChecksum,
          uploadedFile,
          thumbnailFile,
          deleteAfter,
        },
      });
    } catch {
      return fail("processing_failed", "Failed to persist upload");
    }
  },

  async persistPreparedUploadedAsset(
    input: PersistPreparedUploadedAssetInput,
  ): Promise<UploadServiceResult<PersistedUploadResponse>> {
    try {
      const asset = await uploadRepository.createAsset({
        uploader: { connect: { id: input.actor.userId } },
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: input.prepared.uploadedFile.size,
        checksum: input.prepared.storedChecksum,
        bucket: input.prepared.uploadedFile.bucket,
        key: input.prepared.uploadedFile.key,
        cdnUrl:
          input.prepared.uploadedFile.cdnUrl ??
          input.prepared.uploadedFile.url ??
          null,
        visibility: "PUBLIC",
        thumbnailUrl: input.prepared.thumbnailFile?.url ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        blurHash: input.blurHash ?? null,
        deleteAfter: input.prepared.deleteAfter,
      });

      await uploadRepository.createConsentRecord({
        user: { connect: { id: input.actor.userId } },
        type: "ANALYTICS_COOKIES",
        granted: true,
        grantedAt: new Date(),
        documentVersion: "v1.0",
        ipAddress: input.consent.ipAddress,
        metadata: {
          source: "file_upload",
          correlationId: input.actor.correlationId,
          userAgent: input.consent.userAgent,
          fileName: input.originalName,
          fileSize: input.originalSize,
          mimeType: input.mimeType,
          temporary: input.temporary,
          context: input.consent.context,
        },
      });

      return ok({
        asset,
        storedChecksum: input.prepared.storedChecksum,
        deduplicated: false,
        expiresAt: input.prepared.deleteAfter?.toISOString(),
      });
    } catch {
      return fail("processing_failed", "Failed to persist upload");
    }
  },

  async cleanupPreparedUploadedAssetArtifacts(
    prepared: PreparedStoredUpload,
  ): Promise<void> {
    const storage = resolveStorageProvider();
    if (prepared.thumbnailFile) {
      try {
        await storage.delete(prepared.thumbnailFile.key, {
          visibility: prepared.thumbnailFile.visibility,
        });
      } catch {
        // Best-effort cleanup only.
      }
    }

    try {
      await storage.delete(prepared.uploadedFile.key, {
        visibility: prepared.uploadedFile.visibility,
      });
    } catch {
      // Best-effort cleanup only.
    }
  },

  async stageOnboardingUpload(
    input: StageOnboardingUploadInput,
  ): Promise<UploadServiceResult<StagedOnboardingUpload>> {
    const storage = resolveStorageProvider();
    const expiresAt = new Date(
      Date.now() + (input.expiresInHours ?? 24) * 60 * 60 * 1000,
    );

    try {
      const uploaded = await storage.upload(
        input.file.buffer,
        input.file.originalName,
        input.file.mimeType,
        { visibility: "public" },
      );

      const stagingInput: CreateStagedUploadInput = {
        clerkId: input.actor.clerkId,
        tempUrl: uploaded.cdnUrl || uploaded.url || "",
        originalName: input.file.originalName,
        mimeType: input.file.mimeType,
        size: uploaded.size,
        checksum: uploaded.checksum,
        storageBucket: uploaded.bucket,
        storageKey: uploaded.key,
        expiresAt,
      };
      const staged =
        await uploadRepository.createStagedOnboardingUpload(stagingInput);

      return ok({
        uploadId: staged.id,
        originalName: staged.originalName,
        previewUrl: staged.tempUrl,
        expiresAt: staged.expiresAt.toISOString(),
      });
    } catch {
      return fail("processing_failed", "Failed to stage upload");
    }
  },

  async requestDirectUpload(
    input: RequestDirectUploadInput,
  ): Promise<UploadServiceResult<RequestedDirectUpload>> {
    const validationError = validateDirectUploadRequestMetadata(input);
    if (validationError) {
      return fail("invalid_input", validationError);
    }

    const storage = resolveStorageProvider();
    const sanitizedFilename = sanitizeFilename(input.filename);
    const visibility = "private" satisfies StorageVisibility;
    const expiresAt = new Date(Date.now() + DIRECT_UPLOAD_TTL_SECONDS * 1000);
    const temporary = input.temporary ?? false;
    const deleteAfter = temporary
      ? new Date(Date.now() + (input.tempExpiryHours ?? 24) * 60 * 60 * 1000)
      : null;

    try {
      const presigned = await storage.getPresignedUploadUrl(
        sanitizedFilename,
        input.mimeType,
        {
          visibility,
          expiresInSeconds: DIRECT_UPLOAD_TTL_SECONDS,
          checksumSha256: input.checksumSha256.toLowerCase(),
        },
      );

      const directUpload = await uploadRepository.createDirectUpload({
        uploaderId: input.actor.userId,
        originalName: sanitizedFilename,
        mimeType: input.mimeType,
        size: input.size,
        checksum: input.checksumSha256.toLowerCase(),
        bucket: presigned.bucket,
        key: presigned.key,
        visibility: prismaVisibilityFromStorage(visibility),
        expiresAt,
        temporary,
        deleteAfter,
      });

      return ok({
        uploadId: directUpload.id,
        uploadUrl: presigned.uploadUrl,
        key: presigned.key,
        requiredHeaders: presigned.requiredHeaders,
        expiresAt: expiresAt.toISOString(),
      });
    } catch {
      return fail("processing_failed", "Failed to create direct upload");
    }
  },

  async confirmDirectUpload(
    input: ConfirmDirectUploadInput,
  ): Promise<UploadServiceResult<ConfirmedDirectUpload>> {
    const storage = resolveStorageProvider();

    try {
      const directUpload = await uploadRepository.findDirectUploadById(
        input.uploadId,
      );
      if (!directUpload) {
        return fail("not_found", "Upload not found");
      }
      if (directUpload.uploaderId !== input.actor.userId) {
        return fail(
          "forbidden",
          "You do not have permission to confirm this upload",
        );
      }
      if (directUpload.status === "CONFIRMED") {
        return fail("conflict", "Upload has already been confirmed");
      }
      if (directUpload.status !== "PRESIGNED") {
        return fail("conflict", "Upload is no longer pending confirmation");
      }
      if (directUpload.expiresAt.getTime() <= Date.now()) {
        await uploadRepository.markDirectUploadsExpiredByIds([directUpload.id]);
        return fail("expired", "Upload URL has expired");
      }

      const visibility = storageVisibilityFromAsset(directUpload.visibility);
      const exists = await storage.exists(directUpload.key, { visibility });
      if (!exists) {
        return fail("invalid_input", "Uploaded object was not found");
      }

      const metadata = await storage.getMetadata(directUpload.key, {
        visibility,
      });
      if (metadata.size !== directUpload.size) {
        await uploadRepository.markDirectUploadFailed(
          directUpload.id,
          "size_mismatch",
        );
        await storage.delete(directUpload.key, { visibility }).catch(() => {});
        return fail("invalid_input", "Uploaded object size did not match");
      }
      if (metadata.mimeType !== directUpload.mimeType) {
        await uploadRepository.markDirectUploadFailed(
          directUpload.id,
          "mime_mismatch",
        );
        await storage.delete(directUpload.key, { visibility }).catch(() => {});
        return fail("invalid_input", "Uploaded object MIME type did not match");
      }

      const buffer = await storage.readObject(directUpload.key, { visibility });
      const checksum = getChecksum(buffer);
      if (checksum !== directUpload.checksum) {
        await uploadRepository.markDirectUploadFailed(
          directUpload.id,
          "checksum_mismatch",
        );
        await storage.delete(directUpload.key, { visibility }).catch(() => {});
        return fail("invalid_input", "Uploaded object checksum did not match");
      }

      const validation = validateFile(
        {
          name: directUpload.originalName,
          size: directUpload.size,
          type: directUpload.mimeType,
        },
        buffer,
        DIRECT_DOCUMENT_VALIDATION_CONFIG,
      );
      if (!validation.valid) {
        await uploadRepository.markDirectUploadFailed(
          directUpload.id,
          "magic_bytes_rejected",
        );
        await storage.delete(directUpload.key, { visibility }).catch(() => {});
        return fail(
          "invalid_input",
          validation.error || "Uploaded object failed content validation",
        );
      }

      const asset = await prisma.$transaction(async (tx) => {
        const pending = await uploadRepository.findDirectUploadById(
          directUpload.id,
          tx,
        );
        if (!pending || pending.status !== "PRESIGNED") {
          throw new Error("DIRECT_UPLOAD_NOT_PENDING");
        }

        let persisted = await uploadRepository.findOwnedAssetByChecksum(
          directUpload.checksum,
          input.actor.userId,
          "PRIVATE",
          tx,
        );

        if (!persisted) {
          persisted = await uploadRepository.createAsset(
            {
              uploader: { connect: { id: input.actor.userId } },
              originalName: directUpload.originalName,
              mimeType: directUpload.mimeType,
              size: directUpload.size,
              checksum: directUpload.checksum,
              bucket: directUpload.bucket,
              key: directUpload.key,
              cdnUrl: null,
              visibility: "PRIVATE",
              deleteAfter: directUpload.deleteAfter,
            },
            tx,
          );
        }

        await uploadRepository.markDirectUploadConfirmed(
          directUpload.id,
          persisted.id,
          tx,
        );

        return persisted;
      });

      if (asset.key !== directUpload.key) {
        await storage.delete(directUpload.key, { visibility }).catch(() => {});
      }

      return ok({
        assetId: asset.id,
        visibility: "PRIVATE",
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "DIRECT_UPLOAD_NOT_PENDING"
      ) {
        return fail("conflict", "Upload is no longer pending confirmation");
      }
      return fail("processing_failed", "Failed to confirm direct upload");
    }
  },

  async getAssetDownloadUrl(
    input: GetAssetDownloadUrlInput,
  ): Promise<UploadServiceResult<AssetDownloadUrl>> {
    const storage = resolveStorageProvider();

    try {
      const asset =
        input.actor.role === "ADMIN"
          ? await uploadRepository.findAssetById(input.assetId)
          : await uploadRepository.findOwnedAssetById(
              input.assetId,
              input.actor.userId,
            );

      if (!asset) {
        return fail("not_found", "File not found");
      }

      await uploadRepository.incrementAssetAccess(asset.id);

      if (asset.visibility === "PRIVATE") {
        const presigned = await storage.getPresignedDownloadUrl(asset.key, {
          visibility: "private",
          expiresInSeconds: PRIVATE_DOWNLOAD_TTL_SECONDS,
          filename: asset.originalName,
        });

        return ok({
          assetId: asset.id,
          visibility: "PRIVATE",
          downloadUrl: presigned.downloadUrl,
          expiresAt: new Date(presigned.expiresAt).toISOString(),
        });
      }

      if (!asset.cdnUrl) {
        return fail("not_found", "File is missing a public URL");
      }

      return ok({
        assetId: asset.id,
        visibility: "PUBLIC",
        downloadUrl: asset.cdnUrl,
        expiresAt: null,
      });
    } catch {
      return fail("processing_failed", "Failed to create download URL");
    }
  },

  async putLocalDirectUploadObject(
    input: PutLocalDirectUploadObjectInput,
  ): Promise<UploadServiceResult<{ key: string }>> {
    if (
      !verifyLocalPresignedStorageToken({
        key: input.key,
        expiresAt: input.expiresAt,
        visibility: input.visibility,
        token: input.token,
      })
    ) {
      return fail("forbidden", "Invalid or expired upload URL");
    }

    try {
      await resolveStorageProvider().putObject(
        input.key,
        input.buffer,
        input.mimeType,
        { visibility: input.visibility },
      );
      return ok({ key: input.key });
    } catch {
      return fail("processing_failed", "Failed to write uploaded object");
    }
  },

  async getLocalDirectDownloadObject(
    input: LocalDirectDownloadObjectInput,
  ): Promise<UploadServiceResult<LocalDirectDownloadObject>> {
    if (
      !verifyLocalPresignedStorageToken({
        key: input.key,
        expiresAt: input.expiresAt,
        visibility: input.visibility,
        token: input.token,
      })
    ) {
      return fail("forbidden", "Invalid or expired download URL");
    }

    try {
      const storage = resolveStorageProvider();
      const [buffer, metadata] = await Promise.all([
        storage.readObject(input.key, { visibility: input.visibility }),
        storage.getMetadata(input.key, { visibility: input.visibility }),
      ]);
      return ok({ buffer, mimeType: metadata.mimeType });
    } catch {
      return fail("not_found", "File not found");
    }
  },

  async persistUploadedAsset(
    input: PersistUploadedAssetInput,
  ): Promise<UploadServiceResult<PersistedUploadResponse>> {
    const prepared = await uploadService.prepareUploadedAssetPersistence(input);
    if (!prepared.ok) {
      return prepared;
    }

    if (prepared.data.kind === "deduplicated") {
      return ok(prepared.data.response);
    }

    return uploadService.persistPreparedUploadedAsset({
      actor: input.actor,
      originalName: input.originalName,
      mimeType: input.mimeType,
      originalSize: input.originalSize,
      width: input.width,
      height: input.height,
      blurHash: input.blurHash,
      temporary: input.temporary,
      consent: input.consent,
      prepared: prepared.data.prepared,
    });
  },

  async getOwnedAssetMetadataAndTrackAccess(
    actor: UploadActor,
    assetId: string,
  ): Promise<UploadServiceResult<OwnedAssetMetadata>> {
    try {
      const asset = await uploadRepository.findOwnedAssetById(
        assetId,
        actor.userId,
      );
      if (!asset) {
        return fail("not_found", "File not found");
      }

      await uploadRepository.incrementAssetAccess(assetId);

      return ok({
        id: asset.id,
        filename: asset.originalName,
        url: asset.cdnUrl,
        thumbnailUrl: asset.thumbnailUrl,
        size: asset.size,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        blurHash: asset.blurHash,
        downloadCount: asset.downloadCount,
        lastAccessed: asset.lastAccessed?.toISOString(),
        createdAt: asset.createdAt.toISOString(),
        temporary: !!asset.deleteAfter,
        expiresAt: asset.deleteAfter?.toISOString(),
      });
    } catch {
      return fail("processing_failed", "Failed to fetch file metadata");
    }
  },

  async deleteOwnedAsset(
    actor: UploadActor,
    assetId: string,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<UploadServiceResult<DeleteOwnedAssetResponse>> {
    const storage = resolveStorageProvider();
    try {
      return await prisma.$transaction(async (tx) => {
        const asset = await uploadRepository.findAssetForDeletion(assetId, tx);
        if (!asset || asset.deletedAt) {
          return fail("not_found", "File not found");
        }
        if (asset.uploaderId !== actor.userId) {
          return fail(
            "forbidden",
            "You do not have permission to delete this file",
          );
        }

        const isReferenced =
          asset.projectImages.length > 0 ||
          asset.projectDocs.length > 0 ||
          asset.storeDocs.length > 0 ||
          asset.storeImages.length > 0 ||
          asset.propertyDocs.length > 0 ||
          asset.propertyAttachments.length > 0 ||
          asset.propertyImages.length > 0 ||
          asset.portfolioImages.length > 0 ||
          asset.ideaBookAttachments.length > 0 ||
          asset.professionalDocs.length > 0 ||
          asset.professionalLicenses.length > 0 ||
          asset.messageAttachments.length > 0 ||
          asset.products.length > 0 ||
          asset.quoteAttachments.length > 0 ||
          asset.reviewImages.length > 0;

        if (isReferenced) {
          await uploadRepository.softDeleteAsset(assetId, tx);
          return ok({
            message:
              "File marked for deletion (still referenced in other records)",
            assetId,
            softDeleted: true,
            permanent: false,
          });
        }

        try {
          await storage.delete(asset.key, {
            visibility: storageVisibilityFromAsset(asset.visibility),
          });
        } catch {
          // Preserve current behavior: continue DB hard-delete even if blob deletion fails.
        }

        await uploadRepository.hardDeleteAsset(assetId, tx);
        await uploadRepository.createConsentRecord(
          {
            user: { connect: { id: actor.userId } },
            type: "PRIVACY_POLICY",
            granted: true,
            grantedAt: new Date(),
            documentVersion: "v1.0",
            ipAddress: metadata.ipAddress,
            metadata: {
              source: "file_deletion",
              correlationId: actor.correlationId,
              userAgent: metadata.userAgent,
              assetId,
              fileName: asset.originalName,
            },
          },
          tx,
        );

        return ok({
          message: "File deleted permanently",
          assetId,
          softDeleted: false,
          permanent: true,
        });
      });
    } catch {
      return fail("processing_failed", "Failed to delete file");
    }
  },

  async materializeOnboardingUpload(input: {
    actor: UploadActor;
    clerkId: string;
    uploadId: string;
    tx?: UploadClient;
  }): Promise<UploadServiceResult<MaterializedUpload>> {
    const client = input.tx ?? prisma;

    try {
      const stagedUploads = await uploadRepository.findStagedUploads(
        [input.uploadId],
        input.clerkId,
        client,
      );
      const staged = stagedUploads[0];
      if (!staged || staged.expiresAt.getTime() <= Date.now()) {
        return fail("invalid_input", "Invalid or expired document uploads");
      }

      let asset = await uploadRepository.findOwnedAssetByChecksum(
        staged.checksum,
        input.actor.userId,
        "PUBLIC",
        client,
      );
      if (!asset) {
        asset = await uploadRepository.createAsset(
          {
            uploader: { connect: { id: input.actor.userId } },
            originalName: staged.originalName,
            mimeType: staged.mimeType,
            size: staged.size,
            checksum: staged.checksum,
            bucket: staged.storageBucket,
            key: staged.storageKey,
            cdnUrl: staged.tempUrl,
            visibility: "PUBLIC",
          },
          client,
        );
      }

      await uploadRepository.markStagedUploadConsumed(
        staged.id,
        input.actor.userId,
        client,
      );

      return ok({
        assetId: asset.id,
      });
    } catch {
      return fail("processing_failed", "Failed to materialize upload");
    }
  },

  async verifyOwnership(
    assetId: string,
    userId: string,
    client: UploadClient = prisma,
  ): Promise<
    UploadServiceResult<Pick<UploadAssetRecord, keyof typeof assetDetailSelect>>
  > {
    const asset = await uploadRepository.findOwnedAssetById(
      assetId,
      userId,
      client,
    );
    if (!asset) {
      return fail("forbidden", "Unauthorized asset access");
    }
    return ok(asset);
  },

  /**
   * Cleanup expired staged uploads: delete storage blobs and mark as EXPIRED.
   * Call from scheduled job (e.g. onboarding-upload-cleanup).
   */
  async cleanupExpiredStagedUploads(): Promise<{
    count: number;
    deletedFromStorage: number;
    failedDeletions: string[];
  }> {
    const storage = resolveStorageProvider();
    const expired =
      await uploadRepository.findExpiredStagedUploadsForCleanup(prisma);

    let deletedFromStorage = 0;
    const failedDeletions: string[] = [];

    for (const row of expired) {
      try {
        await storage.delete(row.storageKey, { visibility: "public" });
        deletedFromStorage++;
      } catch {
        failedDeletions.push(row.id);
      }
    }

    const ids = expired.map((r) => r.id);
    const { count } = await uploadRepository.markStagedUploadsExpiredByIds(
      ids,
      prisma,
    );

    return {
      count,
      deletedFromStorage,
      failedDeletions,
    };
  },

  async cleanupExpiredDirectUploads(): Promise<{
    count: number;
    deletedFromStorage: number;
    failedDeletions: string[];
  }> {
    const storage = resolveStorageProvider();
    const expired =
      await uploadRepository.findExpiredDirectUploadsForCleanup(prisma);

    let deletedFromStorage = 0;
    const failedDeletions: string[] = [];

    for (const row of expired) {
      try {
        await storage.delete(row.key, {
          visibility: storageVisibilityFromAsset(row.visibility),
        });
        deletedFromStorage++;
      } catch {
        failedDeletions.push(row.id);
      }
    }

    const ids = expired.map((r) => r.id);
    const { count } = await uploadRepository.markDirectUploadsExpiredByIds(
      ids,
      prisma,
    );

    return {
      count,
      deletedFromStorage,
      failedDeletions,
    };
  },
};
