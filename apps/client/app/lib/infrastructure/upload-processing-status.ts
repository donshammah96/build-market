import { redisCache } from "@build/redis";
import { env } from "@/app/lib/infrastructure/env";

export type UploadProcessingState =
  | "pending"
  | "processing"
  | "ready"
  | "failed";

export type ReadyUploadAssetSnapshot = {
  assetId: string;
  url: string;
  cdnUrl: string;
  thumbnailUrl: string | null;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
};

export type UploadProcessingStatusRecord = {
  uploadId: string;
  ownerUserId: string;
  fieldName: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: UploadProcessingState;
  statusUrl: string;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
  asset?: ReadyUploadAssetSnapshot;
};

const DEFAULT_UPLOAD_STATUS_TTL_SECONDS = env.jobs.uploadStatusTtlSeconds;
const inMemoryStatus = new Map<
  string,
  { record: UploadProcessingStatusRecord; expiresAt: number }
>();

function statusCacheKey(uploadId: string): string {
  return `uploads:processing:${uploadId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneRecord(
  record: UploadProcessingStatusRecord,
): UploadProcessingStatusRecord {
  return {
    ...record,
    asset: record.asset ? { ...record.asset } : undefined,
  };
}

function setInMemory(
  record: UploadProcessingStatusRecord,
  ttlSeconds: number,
): void {
  inMemoryStatus.set(record.uploadId, {
    record: cloneRecord(record),
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function getInMemory(uploadId: string): UploadProcessingStatusRecord | null {
  const cached = inMemoryStatus.get(uploadId);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    inMemoryStatus.delete(uploadId);
    return null;
  }

  return cloneRecord(cached.record);
}

async function persistStatus(
  record: UploadProcessingStatusRecord,
  ttlSeconds: number = DEFAULT_UPLOAD_STATUS_TTL_SECONDS,
): Promise<void> {
  setInMemory(record, ttlSeconds);

  try {
    await redisCache.set(statusCacheKey(record.uploadId), record, ttlSeconds);
  } catch {
    // In-memory fallback keeps status polling available when Redis is unavailable.
  }
}

export async function getUploadProcessingStatus(
  uploadId: string,
): Promise<UploadProcessingStatusRecord | null> {
  const memoryRecord = getInMemory(uploadId);
  if (memoryRecord) {
    return memoryRecord;
  }

  try {
    const redisRecord = await redisCache.get<UploadProcessingStatusRecord>(
      statusCacheKey(uploadId),
    );

    if (redisRecord) {
      setInMemory(redisRecord, DEFAULT_UPLOAD_STATUS_TTL_SECONDS);
      return redisRecord;
    }
  } catch {
    // Ignore Redis read failures and return null.
  }

  return null;
}

export async function createPendingUploadStatus(input: {
  uploadId: string;
  ownerUserId: string;
  fieldName: string;
  originalName: string;
  mimeType: string;
  size: number;
}): Promise<UploadProcessingStatusRecord> {
  const timestamp = nowIso();
  const record: UploadProcessingStatusRecord = {
    uploadId: input.uploadId,
    ownerUserId: input.ownerUserId,
    fieldName: input.fieldName,
    originalName: input.originalName,
    mimeType: input.mimeType,
    size: input.size,
    status: "pending",
    statusUrl: `/api/uploads/${input.uploadId}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await persistStatus(record);
  return record;
}

export async function markUploadProcessing(uploadId: string): Promise<void> {
  const current = await getUploadProcessingStatus(uploadId);
  if (!current) {
    return;
  }

  await persistStatus({
    ...current,
    status: "processing",
    updatedAt: nowIso(),
    errorMessage: undefined,
  });
}

export async function markUploadReady(
  uploadId: string,
  asset: ReadyUploadAssetSnapshot,
): Promise<void> {
  const current = await getUploadProcessingStatus(uploadId);
  if (!current) {
    return;
  }

  await persistStatus({
    ...current,
    status: "ready",
    updatedAt: nowIso(),
    errorMessage: undefined,
    asset,
  });
}

export async function markUploadFailed(
  uploadId: string,
  errorMessage: string,
): Promise<void> {
  const current = await getUploadProcessingStatus(uploadId);
  if (!current) {
    return;
  }

  await persistStatus({
    ...current,
    status: "failed",
    updatedAt: nowIso(),
    errorMessage,
    asset: undefined,
  });
}
