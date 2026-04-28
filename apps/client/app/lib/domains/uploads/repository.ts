import { prisma, type Prisma } from "@build/db";

type UploadClient = Prisma.TransactionClient | typeof prisma;

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
    expiresAt: true;
  };
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
  expiresAt: Date;
};

export const uploadRepository = {
  async findAssetByChecksum(checksum: string, client: UploadClient = prisma) {
    return client.asset.findUnique({
      where: { checksum },
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
        status: "STAGED",
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
        status: "CONSUMED",
        consumedAt: new Date(),
        consumedByUserId: userId,
      },
    });
  },

  /**
   * Find expired staged uploads for cleanup (storage deletion + status update).
   */
  async findExpiredStagedUploadsForCleanup(
    client: UploadClient = prisma,
  ): Promise<Array<{ id: string; storageBucket: string; storageKey: string }>> {
    const rows = await client.onboardingUpload.findMany({
      where: {
        status: "STAGED",
        expiresAt: { lt: new Date() },
      },
      select: { id: true, storageBucket: true, storageKey: true },
    });
    return rows;
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
};

export { assetDetailSelect };
