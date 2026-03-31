import { createHash } from "crypto";
import { HttpStatus } from "@/app/lib/api/api-response";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { getStorageProvider } from "@/app/lib/infrastructure/storage";
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

const logger = getClientLogger();
const storage = getStorageProvider();

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

export type OwnedAssetMetadata = {
  id: string;
  filename: string;
  url: string;
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

function fail<T>(
  error: UploadServiceErrorCode,
  status: number,
  message: string,
  details?: unknown,
): UploadServiceResult<T> {
  return err({ error, status, message, details });
}

function getChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export const uploadService = {
  async stageOnboardingUpload(
    input: StageOnboardingUploadInput,
  ): Promise<UploadServiceResult<StagedOnboardingUpload>> {
    const expiresAt = new Date(
      Date.now() + (input.expiresInHours ?? 24) * 60 * 60 * 1000,
    );

    try {
      const uploaded = await storage.upload(
        input.file.buffer,
        input.file.originalName,
        input.file.mimeType,
      );

      const stagingInput: CreateStagedUploadInput = {
        clerkId: input.actor.clerkId,
        tempUrl: uploaded.cdnUrl || uploaded.url,
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
    } catch (error) {
      logger.error(
        "Failed to stage onboarding upload",
        error instanceof Error ? error : new Error(String(error)),
        {
          correlationId: input.actor.correlationId,
          originalName: input.file.originalName,
          operationName: "stage-onboarding-upload",
          outcome: "failed",
        },
      );
      return fail(
        "processing_failed",
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to stage upload",
      );
    }
  },

  async persistUploadedAsset(
    input: PersistUploadedAssetInput,
  ): Promise<UploadServiceResult<PersistedUploadResponse>> {
    const storedChecksum = getChecksum(input.storedBuffer);

    try {
      const existingAsset =
        await uploadRepository.findAssetByChecksum(storedChecksum);
      if (existingAsset) {
        return ok({
          asset: existingAsset,
          storedChecksum,
          deduplicated: true,
          expiresAt: existingAsset.deleteAfter?.toISOString(),
        });
      }

      const uploaded = await storage.upload(
        input.storedBuffer,
        input.storedFilename,
        input.mimeType,
      );

      let thumbnailUrl: string | null = null;
      if (input.thumbnailBuffer && input.thumbnailFilename) {
        const thumbUploaded = await storage.upload(
          input.thumbnailBuffer,
          input.thumbnailFilename,
          "image/jpeg",
        );
        thumbnailUrl = thumbUploaded.url;
      }

      const deleteAfter = input.temporary
        ? new Date(Date.now() + input.tempExpiryHours * 60 * 60 * 1000)
        : null;

      const asset = await uploadRepository.createAsset({
        uploader: { connect: { id: input.actor.userId } },
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: uploaded.size,
        checksum: storedChecksum,
        bucket: uploaded.bucket,
        key: uploaded.key,
        cdnUrl: uploaded.cdnUrl || uploaded.url,
        thumbnailUrl,
        width: input.width ?? null,
        height: input.height ?? null,
        blurHash: input.blurHash ?? null,
        deleteAfter,
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
        storedChecksum,
        deduplicated: false,
        expiresAt: deleteAfter?.toISOString(),
      });
    } catch (error) {
      logger.error(
        "Failed to persist uploaded asset",
        error instanceof Error ? error : new Error(String(error)),
        {
          correlationId: input.actor.correlationId,
          originalName: input.originalName,
          operationName: "persist-uploaded-asset",
          outcome: "failed",
        },
      );
      return fail(
        "processing_failed",
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to persist upload",
      );
    }
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
        return fail("not_found", HttpStatus.NOT_FOUND, "File not found");
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
    } catch (error) {
      logger.error(
        "Failed to fetch owned asset metadata",
        error instanceof Error ? error : new Error(String(error)),
        {
          correlationId: actor.correlationId,
          assetId,
          operationName: "get-owned-asset-metadata",
          outcome: "failed",
        },
      );
      return fail(
        "processing_failed",
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to fetch file metadata",
      );
    }
  },

  async deleteOwnedAsset(
    actor: UploadActor,
    assetId: string,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<UploadServiceResult<DeleteOwnedAssetResponse>> {
    try {
      return await prisma.$transaction(async (tx) => {
        const asset = await uploadRepository.findAssetForDeletion(assetId, tx);
        if (!asset || asset.deletedAt) {
          return fail("not_found", HttpStatus.NOT_FOUND, "File not found");
        }
        if (asset.uploaderId !== actor.userId) {
          return fail(
            "forbidden",
            HttpStatus.FORBIDDEN,
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
          await storage.delete(asset.key);
        } catch (storageError) {
          logger.error(
            "Failed to delete asset from storage",
            storageError instanceof Error
              ? storageError
              : new Error(String(storageError)),
            { correlationId: actor.correlationId, assetId, key: asset.key },
          );
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
    } catch (error) {
      logger.error(
        "Failed to delete owned asset",
        error instanceof Error ? error : new Error(String(error)),
        {
          correlationId: actor.correlationId,
          assetId,
          operationName: "delete-owned-asset",
          outcome: "failed",
        },
      );
      return fail(
        "processing_failed",
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to delete file",
      );
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
        return fail(
          "invalid_input",
          HttpStatus.BAD_REQUEST,
          "Invalid or expired document uploads",
        );
      }

      let asset = await uploadRepository.findAssetByChecksum(
        staged.checksum,
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
    } catch (error) {
      logger.error(
        "Failed to materialize onboarding upload",
        error instanceof Error ? error : new Error(String(error)),
        {
          correlationId: input.actor.correlationId,
          uploadId: input.uploadId,
          operationName: "materialize-onboarding-upload",
          outcome: "failed",
        },
      );
      return fail(
        "processing_failed",
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to materialize upload",
      );
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
      return fail(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Unauthorized asset access",
      );
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
    const expired =
      await uploadRepository.findExpiredStagedUploadsForCleanup(prisma);

    let deletedFromStorage = 0;
    const failedDeletions: string[] = [];

    for (const row of expired) {
      try {
        await storage.delete(row.storageKey);
        deletedFromStorage++;
      } catch (error) {
        logger.error(
          "Failed to delete expired staged upload from storage",
          error instanceof Error ? error : new Error(String(error)),
          { uploadId: row.id, storageKey: row.storageKey },
        );
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
};
