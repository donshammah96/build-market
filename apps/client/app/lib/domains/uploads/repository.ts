import {
  prisma,
  type AssetVisibility,
  type OnboardingUploadStatus,
  type Prisma,
} from "@build/db";
import {
  isValidTransition,
  type UploadLifecycleState,
} from "./upload-lifecycle";

type UploadClient = Prisma.TransactionClient | typeof prisma;

export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Invalid staged-upload transition: ${from} -> ${to}`);
    this.name = "InvalidStatusTransitionError";
  }
}

const assetDetailSelect = {
  id: true,
  uploaderId: true,
  originalName: true,
  mimeType: true,
  size: true,
  checksum: true,
  bucket: true,
  key: true,
  cdnUrl: true,
  visibility: true,
  thumbnailUrl: true,
  width: true,
  height: true,
  blurHash: true,
  downloadCount: true,
  lastAccessed: true,
  createdAt: true,
  deletedAt: true,
  deleteAfter: true,
} as const;

const assetDeletionSelect = {
  id: true,
  uploaderId: true,
  key: true,
  bucket: true,
  visibility: true,
  originalName: true,
  deletedAt: true,
  projectImages: { select: { id: true }, take: 1 },
  projectDocs: { select: { id: true }, take: 1 },
  storeDocs: { select: { id: true }, take: 1 },
  storeImages: { select: { id: true }, take: 1 },
  propertyDocs: { select: { id: true }, take: 1 },
  propertyAttachments: { select: { id: true }, take: 1 },
  propertyImages: { select: { id: true }, take: 1 },
  portfolioImages: { select: { id: true }, take: 1 },
  ideaBookAttachments: { select: { id: true }, take: 1 },
  professionalDocs: { select: { id: true }, take: 1 },
  professionalLicenses: { select: { id: true }, take: 1 },
  messageAttachments: { select: { id: true }, take: 1 },
  products: { select: { id: true }, take: 1 },
  quoteAttachments: { select: { id: true }, take: 1 },
  reviewImages: { select: { id: true }, take: 1 },
} as const;

export type UploadAssetRecord = Prisma.AssetGetPayload<{
  select: typeof assetDetailSelect;
}>;

export type UploadAssetDeletionRecord = Prisma.AssetGetPayload<{
  select: typeof assetDeletionSelect;
}>;

export type UploadStagedRecord = Prisma.OnboardingUploadGetPayload<{
  select: {
    id: true;
    clerkId: true;
    tempUrl: true;
    originalName: true;
    mimeType: true;
    size: true;
    checksum: true;
    storageBucket: true;
    storageKey: true;
    status: true;
    expiresAt: true;
  };
}>;

export type UploadCreatedStagedRecord = Prisma.OnboardingUploadGetPayload<{
  select: {
    id: true;
    tempUrl: true;
    originalName: true;
    mimeType: true;
    size: true;
    checksum: true;
    storageBucket: true;
    storageKey: true;
    status: true;
    expiresAt: true;
  };
}>;

const directUploadSelect = {
  id: true,
  uploaderId: true,
  assetId: true,
  originalName: true,
  mimeType: true,
  size: true,
  checksum: true,
  bucket: true,
  key: true,
  visibility: true,
  status: true,
  expiresAt: true,
  confirmedAt: true,
  failedAt: true,
  failureReason: true,
  temporary: true,
  deleteAfter: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type UploadDirectUploadRecord = Prisma.DirectUploadGetPayload<{
  select: typeof directUploadSelect;
}>;

export type CreateStagedUploadInput = {
  clerkId: string;
  tempUrl: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  storageBucket: string;
  storageKey: string;
  initialStatus: UploadLifecycleState;
  expiresAt: Date;
};

export type CreateDirectUploadInput = {
  uploaderId: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  bucket: string;
  key: string;
  visibility: AssetVisibility;
  expiresAt: Date;
  temporary: boolean;
  deleteAfter: Date | null;
};

export const uploadRepository = {
  async findAssetByChecksum(checksum: string, client: UploadClient = prisma) {
    return client.asset.findFirst({
      where: { checksum, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: assetDetailSelect,
    });
  },

  async findOwnedAssetByChecksum(
    checksum: string,
    userId: string,
    visibility: AssetVisibility,
    client: UploadClient = prisma,
  ) {
    return client.asset.findFirst({
      where: {
        checksum,
        uploaderId: userId,
        visibility,
        deletedAt: null,
      },
      select: assetDetailSelect,
    });
  },

  async createAsset(
    data: Prisma.AssetCreateInput,
    client: UploadClient = prisma,
  ) {
    return client.asset.create({
      data,
      select: assetDetailSelect,
    });
  },

  async createConsentRecord(
    data: Prisma.ConsentRecordCreateInput,
    client: UploadClient = prisma,
  ) {
    return client.consentRecord.create({ data });
  },

  async findOwnedAssetById(
    assetId: string,
    userId: string,
    client: UploadClient = prisma,
  ) {
    return client.asset.findFirst({
      where: {
        id: assetId,
        uploaderId: userId,
        deletedAt: null,
      },
      select: assetDetailSelect,
    });
  },

  async findAssetById(assetId: string, client: UploadClient = prisma) {
    return client.asset.findFirst({
      where: {
        id: assetId,
        deletedAt: null,
      },
      select: assetDetailSelect,
    });
  },

  async incrementAssetAccess(assetId: string, client: UploadClient = prisma) {
    return client.asset.update({
      where: { id: assetId },
      data: {
        lastAccessed: new Date(),
        downloadCount: { increment: 1 },
      },
    });
  },

  async findAssetForDeletion(
    assetId: string,
    client: UploadClient = prisma,
  ): Promise<UploadAssetDeletionRecord | null> {
    return client.asset.findUnique({
      where: { id: assetId },
      select: assetDeletionSelect,
    });
  },

  async softDeleteAsset(assetId: string, client: UploadClient = prisma) {
    return client.asset.update({
      where: { id: assetId },
      data: {
        deletedAt: new Date(),
        deleteAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  },

  async hardDeleteAsset(assetId: string, client: UploadClient = prisma) {
    return client.asset.delete({ where: { id: assetId } });
  },

  async findStagedUploads(
    uploadIds: string[],
    clerkId: string,
    client: UploadClient = prisma,
  ): Promise<UploadStagedRecord[]> {
    return client.onboardingUpload.findMany({
      where: {
        id: { in: uploadIds },
        clerkId,
        status: { in: ["STAGED", "ATTACHED", "CONSUMED"] },
      },
      select: {
        id: true,
        clerkId: true,
        tempUrl: true,
        originalName: true,
        mimeType: true,
        size: true,
        checksum: true,
        storageBucket: true,
        storageKey: true,
        status: true,
        expiresAt: true,
      },
    });
  },

  async createStagedOnboardingUpload(
    data: CreateStagedUploadInput,
    client: UploadClient = prisma,
  ): Promise<UploadCreatedStagedRecord> {
    return client.onboardingUpload.create({
      data: {
        clerkId: data.clerkId,
        tempUrl: data.tempUrl,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
        checksum: data.checksum,
        storageBucket: data.storageBucket,
        storageKey: data.storageKey,
        expiresAt: data.expiresAt,
        status: data.initialStatus as OnboardingUploadStatus,
      },
      select: {
        id: true,
        tempUrl: true,
        originalName: true,
        mimeType: true,
        size: true,
        checksum: true,
        storageBucket: true,
        storageKey: true,
        status: true,
        expiresAt: true,
      },
    });
  },

  async markStagedUploadConsumed(
    uploadId: string,
    userId: string,
    client: UploadClient = prisma,
  ) {
    return client.onboardingUpload.update({
      where: { id: uploadId },
      data: {
        status: "ATTACHED",
        consumedAt: new Date(),
        consumedByUserId: userId,
      },
    });
  },

  async transitionStagedUploadStatus(
    uploadId: string,
    next: UploadLifecycleState,
    client: UploadClient = prisma,
  ): Promise<{ from: UploadLifecycleState; to: UploadLifecycleState }> {
    return client.$transaction(async (tx) => {
      const current = await tx.onboardingUpload.findUnique({
        where: { id: uploadId },
        select: { status: true },
      });

      if (!current) {
        throw new Error(`Staged upload not found: ${uploadId}`);
      }

      const from = current.status as UploadLifecycleState;

      if (!isValidTransition(from, next)) {
        throw new InvalidStatusTransitionError(from, next);
      }

      await tx.onboardingUpload.update({
        where: { id: uploadId },
        data: { status: next as OnboardingUploadStatus },
      });

      return { from, to: next };
    });
  },

  async updateStagedUploadStatus(
    uploadId: string,
    status: UploadLifecycleState,
    options?: { storageKey?: string },
    client: UploadClient = prisma,
  ) {
    return client.onboardingUpload.update({
      where: { id: uploadId },
      data: {
        status: status as OnboardingUploadStatus,
        ...(options?.storageKey ? { storageKey: options.storageKey } : {}),
      },
    });
  },

  async findStagedUploadById(
    uploadId: string,
    clerkId?: string,
    client: UploadClient = prisma,
  ): Promise<UploadStagedRecord | null> {
    const where: Prisma.OnboardingUploadWhereInput = { id: uploadId };
    if (clerkId) {
      where.clerkId = clerkId;
    }
    return client.onboardingUpload.findFirst({
      where,
      select: {
        id: true,
        clerkId: true,
        tempUrl: true,
        originalName: true,
        mimeType: true,
        size: true,
        checksum: true,
        storageBucket: true,
        storageKey: true,
        status: true,
        expiresAt: true,
      },
    });
  },

  /**
   * Find expired staged uploads for cleanup (storage deletion + status update).
   */
  async findExpiredStagedUploadsForCleanup(
    client: UploadClient = prisma,
  ): Promise<
    Array<{
      id: string;
      storageBucket: string;
      storageKey: string;
      status: string;
    }>
  > {
    const rows = await client.onboardingUpload.findMany({
      where: {
        OR: [
          { status: "STAGED", expiresAt: { lt: new Date() } },
          { status: "SCAN_FAILED", expiresAt: { lt: new Date() } },
          { status: "QUARANTINED", expiresAt: { lt: new Date() } },
        ],
      },
      select: { id: true, storageBucket: true, storageKey: true, status: true },
    });
    return rows;
  },

  /**
   * Find unattached temporary assets past deleteAfter date for cleanup.
   */
  async findUnattachedTemporaryAssetsForCleanup(
    client: UploadClient = prisma,
  ): Promise<
    Array<{
      id: string;
      key: string;
      bucket: string;
      visibility: AssetVisibility;
    }>
  > {
    return client.asset.findMany({
      where: {
        deletedAt: { not: null },
        deleteAfter: { lt: new Date() },
      },
      select: {
        id: true,
        key: true,
        bucket: true,
        visibility: true,
      },
    });
  },

  /**
   * Mark staged uploads as EXPIRED by IDs.
   * Call after storage cleanup in uploadService.cleanupExpiredStagedUploads().
   * This is the authoritative status-update step for expired staged upload cleanup.
   */
  async markStagedUploadsExpiredByIds(
    ids: string[],
    client: UploadClient = prisma,
  ): Promise<{ count: number }> {
    if (ids.length === 0) return { count: 0 };
    const result = await client.onboardingUpload.updateMany({
      where: { id: { in: ids } },
      data: { status: "EXPIRED" },
    });
    return { count: result.count };
  },

  async createDirectUpload(
    data: CreateDirectUploadInput,
    client: UploadClient = prisma,
  ): Promise<UploadDirectUploadRecord> {
    return client.directUpload.create({
      data: {
        uploader: { connect: { id: data.uploaderId } },
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
        checksum: data.checksum,
        bucket: data.bucket,
        key: data.key,
        visibility: data.visibility,
        expiresAt: data.expiresAt,
        temporary: data.temporary,
        deleteAfter: data.deleteAfter,
      },
      select: directUploadSelect,
    });
  },

  async findDirectUploadById(
    uploadId: string,
    client: UploadClient = prisma,
  ): Promise<UploadDirectUploadRecord | null> {
    return client.directUpload.findUnique({
      where: { id: uploadId },
      select: directUploadSelect,
    });
  },

  async markDirectUploadConfirmed(
    uploadId: string,
    assetId: string,
    client: UploadClient = prisma,
  ): Promise<UploadDirectUploadRecord> {
    return client.directUpload.update({
      where: { id: uploadId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        asset: { connect: { id: assetId } },
      },
      select: directUploadSelect,
    });
  },

  async markDirectUploadFailed(
    uploadId: string,
    failureReason: string,
    client: UploadClient = prisma,
  ): Promise<UploadDirectUploadRecord> {
    return client.directUpload.update({
      where: { id: uploadId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason,
      },
      select: directUploadSelect,
    });
  },

  async findExpiredDirectUploadsForCleanup(
    client: UploadClient = prisma,
  ): Promise<Array<{ id: string; key: string; visibility: AssetVisibility }>> {
    return client.directUpload.findMany({
      where: {
        status: { in: ["PRESIGNED", "EXPIRED"] },
        expiresAt: { lt: new Date() },
      },
      select: { id: true, key: true, visibility: true },
    });
  },

  async markDirectUploadsExpiredByIds(
    ids: string[],
    client: UploadClient = prisma,
  ): Promise<{ count: number }> {
    if (ids.length === 0) return { count: 0 };
    const result = await client.directUpload.updateMany({
      where: {
        id: { in: ids },
        status: { in: ["PRESIGNED", "EXPIRED"] },
      },
      data: { status: "EXPIRED" },
    });
    return { count: result.count };
  },
};

export { assetDetailSelect };
