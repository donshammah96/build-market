/**
 * Storage abstraction layer for file uploads.
 *
 * LAYER OWNERSHIP (see ADR-002 / ADR-003):
 *   This module is an infrastructure leaf. Domains may import the provider;
 *   routes and browser code should go through the upload domain/API.
 *
 * ADR-006 classification: public image assets remain on the existing
 * multipart/worker path. Class B document assets use PRIVATE visibility and
 * receive temporary download URLs only after authorization.
 *
 * PROVIDER SUPPORT:
 *   - local  — dev/test only; prohibited in production (see assertProductionStorageConfig)
 *   - s3     — S3 or any S3-compatible endpoint (Cloudflare R2, MinIO, etc.)
 *   - gcs    — not yet implemented; use s3-compatible mode with a GCS HMAC key pair
 */

import fs from "fs";
import path from "path";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";

import { env } from "@/app/lib/infrastructure/env";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type StorageVisibility = "public" | "private";

/**
 * GCS is declared in the union for forward-compatibility only.
 * Passing "gcs" to createStorageProvider() throws until it is implemented.
 */
export interface StorageConfig {
  provider: "local" | "s3" | "gcs";
  localPath?: string;
  bucket?: string;
  privateBucket?: string;
  region?: string;
  endpoint?: string;
  cdnUrl?: string;
}

export interface StorageObjectOptions {
  visibility?: StorageVisibility;
}

export interface UploadedFile {
  key: string;
  url: string | null;
  cdnUrl: string | null;
  checksum: string;
  size: number;
  bucket: string;
  visibility: StorageVisibility;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  bucket: string;
  visibility: StorageVisibility;
  requiredHeaders: Record<string, string>;
  expiresAt: number;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
  expiresAt: number;
}

export interface ObjectMetadata {
  size: number;
  mimeType: string;
  createdAt: Date;
}

export interface StorageProvider {
  upload(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    options?: StorageObjectOptions,
  ): Promise<UploadedFile>;

  /**
   * Returns a presigned URL for direct client-to-storage uploads.
   * `checksumSha256` is wired through to the S3 provider for end-to-end
   * integrity enforcement on direct uploads; the local provider accepts but
   * ignores it (dev/test only).
   */
  getPresignedUploadUrl(
    filename: string,
    mimeType: string,
    options?: StorageObjectOptions & {
      expiresInSeconds?: number;
      checksumSha256?: string;
    },
  ): Promise<PresignedUploadResult>;

  getPresignedDownloadUrl(
    key: string,
    options?: StorageObjectOptions & {
      expiresInSeconds?: number;
      filename?: string;
    },
  ): Promise<PresignedDownloadResult>;

  putObject(
    key: string,
    buffer: Buffer,
    mimeType: string,
    options?: StorageObjectOptions & { originalFilename?: string },
  ): Promise<void>;

  readObject(key: string, options?: StorageObjectOptions): Promise<Buffer>;
  delete(key: string, options?: StorageObjectOptions): Promise<void>;
  exists(key: string, options?: StorageObjectOptions): Promise<boolean>;
  getMetadata(
    key: string,
    options?: StorageObjectOptions,
  ): Promise<ObjectMetadata>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PRESIGNED_UPLOAD_TTL_S = 300;
const DEFAULT_PRESIGNED_DOWNLOAD_TTL_S = 900;

const LOCAL_MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isSameOrigin(candidateUrl: string, comparisonUrl: string): boolean {
  try {
    return new URL(candidateUrl).origin === new URL(comparisonUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Joins a CDN base URL with a storage key.
 *
 * If the base URL already ends with `/uploads` AND the key begins with
 * `uploads/`, the leading `uploads/` segment of the key is stripped to avoid
 * the doubled path `/uploads/uploads/…`. This heuristic is intentionally
 * narrow and documented here so callers can reason about it.
 */
function joinCdnUrl(baseUrl: string, key: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanKey =
    cleanBase.endsWith("/uploads") && key.startsWith("uploads/")
      ? key.slice("uploads/".length)
      : key;
  return `${cleanBase}/${cleanKey.replace(/^\/+/, "")}`;
}

function visibilityFromOption(
  visibility?: StorageVisibility,
): StorageVisibility {
  return visibility === "private" ? "private" : "public";
}

/**
 * Generates a server-controlled, time-sharded storage key.
 * Keys are never derived from user-supplied filenames — only the file
 * extension is preserved. See ADR-002 upload security requirements.
 */
function buildObjectKey(
  filename: string,
  visibility: StorageVisibility,
): string {
  const now = new Date();
  const ext = path.extname(filename).toLowerCase();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const prefix = visibility === "private" ? "private/uploads" : "uploads";
  return `${prefix}/${year}/${month}/${randomUUID()}${ext}`;
}

// ---------------------------------------------------------------------------
// Local-provider signing helpers (dev/test only)
// ---------------------------------------------------------------------------

function localSigningSecret(): string {
  const secret = env.encryption.keys.v1;
  if (!secret) {
    // assertProductionStorageConfig() blocks the local provider in production,
    // so reaching this fallback in prod is already a fatal configuration error.
    // In dev/test the predictable constant is intentional.
    if (env.isProd) {
      throw new Error(
        "[storage:local] ENCRYPTION_KEY_V1 must be set — local provider reached in production context.",
      );
    }
    return "dev-only-local-storage-token";
  }
  return secret;
}

function signLocalToken(input: {
  key: string;
  expiresAt: number;
  visibility: StorageVisibility;
}): string {
  return createHmac("sha256", localSigningSecret())
    .update(`${input.key}:${input.expiresAt}:${input.visibility}`)
    .digest("hex");
}

export function verifyLocalPresignedStorageToken(input: {
  key: string;
  expiresAt: number;
  visibility: StorageVisibility;
  token: string;
}): boolean {
  if (!Number.isFinite(input.expiresAt) || input.expiresAt <= Date.now()) {
    return false;
  }

  const expected = signLocalToken(input);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(input.token, "hex");
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

// ---------------------------------------------------------------------------
// S3 body → Buffer helper
// ---------------------------------------------------------------------------

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  // AWS SDK v3 streaming body (Node.js runtime)
  if (
    typeof body === "object" &&
    "transformToByteArray" in body &&
    typeof (body as { transformToByteArray: unknown }).transformToByteArray ===
      "function"
  ) {
    const bytes = await (
      body as { transformToByteArray: () => Promise<Uint8Array> }
    ).transformToByteArray();
    return Buffer.from(bytes);
  }

  // Generic async iterable fallback (e.g. Node.js IncomingMessage)
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string, "utf8"),
    );
  }
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Production guard
// ---------------------------------------------------------------------------

function assertProductionStorageConfig(config: StorageConfig): void {
  if (!env.isProd) {
    return;
  }

  if (config.provider === "local") {
    throw new Error(
      "[storage] Unsafe production config: local storage provider is prohibited in production.",
    );
  }

  if (config.provider === "s3") {
    if (config.endpoint && !isAbsoluteHttpUrl(config.endpoint)) {
      throw new Error(
        "[storage] Unsafe production config: S3-compatible endpoint must be an absolute remote origin.",
      );
    }
    if (!env.storage.accessKeyId || !env.storage.secretAccessKey) {
      throw new Error(
        "[storage] Unsafe production config: remote storage credentials are required in production.",
      );
    }
    if (!config.privateBucket) {
      throw new Error(
        "[storage] Unsafe production config: R2_PRIVATE_BUCKET or S3_PRIVATE_BUCKET is required for private uploads.",
      );
    }
  }

  const cdnUrl = config.cdnUrl;
  if (!cdnUrl || !isAbsoluteHttpUrl(cdnUrl)) {
    throw new Error(
      "[storage] Unsafe production config: CDN URL must be an absolute remote origin.",
    );
  }

  if (isSameOrigin(cdnUrl, env.appUrl) || isSameOrigin(cdnUrl, env.apiUrl)) {
    throw new Error(
      "[storage] Unsafe production config: uploads must not be served from the application origin.",
    );
  }
}

// ---------------------------------------------------------------------------
// Local storage provider (dev/test)
// ---------------------------------------------------------------------------

/**
 * Shape of the JSON metadata sidecar written alongside each stored object.
 * Kept as an explicit type so the write path (putObject) and the read path
 * (getMetadata) cannot silently drift apart.
 */
interface LocalObjectMeta {
  mimeType: string;
  originalFilename: string;
  visibility: StorageVisibility;
}

class LocalStorageProvider implements StorageProvider {
  private readonly uploadDir: string;
  private readonly publicUrl: string;

  constructor(config: StorageConfig) {
    this.uploadDir =
      config.localPath ??
      path.join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads");
    this.publicUrl = config.cdnUrl ?? "/uploads";

    // Synchronous mkdir is acceptable here: constructor runs once at
    // bootstrap, not on the hot request path.
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private bucketFor(visibility: StorageVisibility): string {
    return visibility === "private" ? "local-private" : "local";
  }

  /**
   * Character-level key validation — a fast first pass before the more
   * expensive path.resolve containment check inside resolvePath().
   */
  private assertSafeKey(key: string): void {
    if (!key || key.includes("\0") || key.includes("\\")) {
      throw new Error("[storage:local] Invalid storage key.");
    }
    if (!/^[A-Za-z0-9/_.-]+$/.test(key)) {
      throw new Error(
        "[storage:local] Storage key contains invalid characters.",
      );
    }
    // Quick traversal check; resolvePath() adds the definitive containment
    // assertion via path.resolve.
    const normalized = path.posix.normalize(key);
    if (
      normalized.startsWith("../") ||
      normalized === ".." ||
      normalized.includes("/../")
    ) {
      throw new Error("[storage:local] Path traversal detected.");
    }
  }

  private resolveContainedPath(relativePath: string): string {
    const resolvedRoot = path.resolve(this.uploadDir);
    const resolvedPath = path.resolve(this.uploadDir, relativePath);
    const relative = path.relative(resolvedRoot, resolvedPath);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new Error("[storage:local] Path traversal detected.");
    }
    return resolvedPath;
  }

  /** Returns the path of the metadata sidecar for a given object key. */
  private metadataPath(key: string): string {
    this.assertSafeKey(key);
    if (path.isAbsolute(key)) {
      throw new Error("[storage:local] Absolute storage keys are prohibited.");
    }
    return this.resolveContainedPath(`${key}.meta.json`);
  }

  private resolvePath(key: string): string {
    // Fast character-level check first (no I/O).
    this.assertSafeKey(key);

    // Explicit sink-side key allowlist (defense in depth for static analysis
    // and for any future call-sites that bypass route/domain validation).
    const STORAGE_KEY_PATTERN = /^[A-Za-z0-9/_.-]+$/;
    if (!key || !STORAGE_KEY_PATTERN.test(key)) {
      throw new Error("[storage:local] Invalid storage key.");
    }
    const segments = key.split("/");
    if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
      throw new Error("[storage:local] Invalid storage key path segments.");
    }

    if (path.isAbsolute(key)) {
      throw new Error("[storage:local] Absolute storage keys are prohibited.");
    }

    // Definitive containment check centralized in resolveContainedPath.
    return this.resolveContainedPath(key);
  }

  async upload(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    options?: StorageObjectOptions,
  ): Promise<UploadedFile> {
    const visibility = visibilityFromOption(options?.visibility);
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const key = buildObjectKey(filename, visibility);

    await this.putObject(key, buffer, mimeType, {
      visibility,
      originalFilename: filename,
    });

    const publicUrl =
      visibility === "public" ? joinCdnUrl(this.publicUrl, key) : null;

    return {
      key,
      url: publicUrl,
      cdnUrl: publicUrl,
      checksum,
      size: buffer.length,
      bucket: this.bucketFor(visibility),
      visibility,
    };
  }

  async getPresignedUploadUrl(
    filename: string,
    mimeType: string,
    options?: StorageObjectOptions & {
      expiresInSeconds?: number;
      // checksumSha256 is accepted per interface contract but not enforced by
      // the local provider — integrity is applied during the actual putObject call.
      checksumSha256?: string;
    },
  ): Promise<PresignedUploadResult> {
    const visibility = visibilityFromOption(options?.visibility);
    const ttl = options?.expiresInSeconds ?? DEFAULT_PRESIGNED_UPLOAD_TTL_S;
    const key = buildObjectKey(filename, visibility);
    const expiresAt = Date.now() + ttl * 1000;
    const token = signLocalToken({ key, expiresAt, visibility });

    const params = new URLSearchParams({
      key,
      expires: String(expiresAt),
      visibility,
      token,
    });

    return {
      uploadUrl: `/api/uploads/direct?${params.toString()}`,
      key,
      bucket: this.bucketFor(visibility),
      visibility,
      requiredHeaders: { "Content-Type": mimeType },
      expiresAt,
    };
  }

  async getPresignedDownloadUrl(
    key: string,
    options?: StorageObjectOptions & {
      expiresInSeconds?: number;
      filename?: string;
    },
  ): Promise<PresignedDownloadResult> {
    const visibility = visibilityFromOption(options?.visibility);
    const ttl = options?.expiresInSeconds ?? DEFAULT_PRESIGNED_DOWNLOAD_TTL_S;
    const expiresAt = Date.now() + ttl * 1000;
    const token = signLocalToken({ key, expiresAt, visibility });

    const params = new URLSearchParams({
      key,
      expires: String(expiresAt),
      visibility,
      token,
    });
    if (options?.filename) {
      params.set("filename", options.filename);
    }

    return {
      downloadUrl: `/api/uploads/download?${params.toString()}`,
      expiresAt,
    };
  }

  async putObject(
    key: string,
    buffer: Buffer,
    mimeType: string,
    options?: StorageObjectOptions & { originalFilename?: string },
  ): Promise<void> {
    const filepath = this.resolvePath(key);
    const metadataFilepath = `${filepath}.meta.json`;
    const meta: LocalObjectMeta = {
      mimeType,
      originalFilename: options?.originalFilename ?? path.basename(key),
      visibility: visibilityFromOption(options?.visibility),
    };

    await fs.promises.mkdir(path.dirname(filepath), { recursive: true });
    await fs.promises.writeFile(filepath, buffer);
    await fs.promises.writeFile(metadataFilepath, JSON.stringify(meta));
  }

  async readObject(
    key: string,
    _options?: StorageObjectOptions,
  ): Promise<Buffer> {
    return fs.promises.readFile(this.resolvePath(key));
  }

  async delete(key: string, _options?: StorageObjectOptions): Promise<void> {
    const filepath = this.resolvePath(key);

    await fs.promises.unlink(filepath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });

    await fs.promises
      .unlink(this.metadataPath(key))
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
  }

  async exists(key: string, _options?: StorageObjectOptions): Promise<boolean> {
    try {
      await fs.promises.access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(
    key: string,
    _options?: StorageObjectOptions,
  ): Promise<ObjectMetadata> {
    const filepath = this.resolvePath(key);
    const stats = await fs.promises.stat(filepath);
    const ext = path.extname(key).toLowerCase();

    let mimeType = LOCAL_MIME_MAP[ext] ?? "application/octet-stream";

    try {
      const raw = await fs.promises.readFile(
        this.metadataPath(filepath),
        "utf8",
      );
      const parsed = JSON.parse(raw) as Partial<LocalObjectMeta>;
      if (typeof parsed.mimeType === "string" && parsed.mimeType) {
        mimeType = parsed.mimeType;
      }
    } catch {
      // Metadata sidecar is advisory; extension-based fallback is safe for
      // validation purposes.
    }

    return {
      size: stats.size,
      mimeType,
      createdAt: stats.birthtime,
    };
  }
}

// ---------------------------------------------------------------------------
// S3 / S3-compatible storage provider
// ---------------------------------------------------------------------------

class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly publicBucket: string;
  private readonly privateBucket?: string;
  private readonly publicUrl: string;

  constructor(config: StorageConfig) {
    if (!config.bucket) {
      throw new Error(
        "[storage:s3] remote storage requires STORAGE_BUCKET or R2_ASSET_BUCKET.",
      );
    }
    if (!config.cdnUrl || !isAbsoluteHttpUrl(config.cdnUrl)) {
      throw new Error(
        "[storage:s3] CDN URL must be an absolute remote origin.",
      );
    }
    if (config.endpoint && !isAbsoluteHttpUrl(config.endpoint)) {
      throw new Error(
        "[storage:s3] S3-compatible endpoint must be an absolute remote origin.",
      );
    }

    this.publicBucket = config.bucket;
    this.privateBucket = config.privateBucket;
    this.publicUrl = config.cdnUrl.replace(/\/+$/, "");

    const credentials =
      env.storage.accessKeyId && env.storage.secretAccessKey
        ? {
            accessKeyId: env.storage.accessKeyId,
            secretAccessKey: env.storage.secretAccessKey,
          }
        : undefined;

    this.client = new S3Client({
      region: config.region ?? env.storage.region ?? "auto",
      endpoint: config.endpoint,
      ...(credentials ? { credentials } : {}),
    });
  }

  private bucketFor(visibility: StorageVisibility): string {
    if (visibility === "private") {
      if (!this.privateBucket) {
        throw new Error(
          "[storage:s3] R2_PRIVATE_BUCKET or S3_PRIVATE_BUCKET is required for private uploads.",
        );
      }
      return this.privateBucket;
    }
    return this.publicBucket;
  }

  async upload(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    options?: StorageObjectOptions,
  ): Promise<UploadedFile> {
    const visibility = visibilityFromOption(options?.visibility);
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const key = buildObjectKey(filename, visibility);
    const bucket = this.bucketFor(visibility);

    // Pass visibility explicitly so putObject resolves to the correct bucket
    // rather than re-deriving it from the default (which would always be "public").
    await this.putObject(key, buffer, mimeType, {
      visibility,
      originalFilename: filename,
    });

    const publicUrl =
      visibility === "public" ? joinCdnUrl(this.publicUrl, key) : null;

    return {
      key,
      url: publicUrl,
      cdnUrl: publicUrl,
      checksum,
      size: buffer.length,
      bucket,
      visibility,
    };
  }

  async getPresignedUploadUrl(
    filename: string,
    mimeType: string,
    options?: StorageObjectOptions & {
      expiresInSeconds?: number;
      checksumSha256?: string;
    },
  ): Promise<PresignedUploadResult> {
    const visibility = visibilityFromOption(options?.visibility);
    const ttl = options?.expiresInSeconds ?? DEFAULT_PRESIGNED_UPLOAD_TTL_S;
    const key = buildObjectKey(filename, visibility);
    const bucket = this.bucketFor(visibility);
    const expiresAt = Date.now() + ttl * 1000;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
      ContentDisposition: "attachment",
      // Wire checksumSha256 when provided so the storage backend enforces
      // end-to-end integrity on direct client-to-storage uploads.
      ...(options?.checksumSha256
        ? { ChecksumSHA256: options.checksumSha256 }
        : {}),
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: ttl,
    });

    return {
      uploadUrl,
      key,
      bucket,
      visibility,
      requiredHeaders: { "Content-Type": mimeType },
      expiresAt,
    };
  }

  async getPresignedDownloadUrl(
    key: string,
    options?: StorageObjectOptions & {
      expiresInSeconds?: number;
      filename?: string;
    },
  ): Promise<PresignedDownloadResult> {
    const visibility = visibilityFromOption(options?.visibility);
    const ttl = options?.expiresInSeconds ?? DEFAULT_PRESIGNED_DOWNLOAD_TTL_S;
    const expiresAt = Date.now() + ttl * 1000;

    const command = new GetObjectCommand({
      Bucket: this.bucketFor(visibility),
      Key: key,
      ...(options?.filename
        ? {
            ResponseContentDisposition: `attachment; filename="${path.basename(options.filename)}"`,
          }
        : {}),
    });

    const downloadUrl = await getSignedUrl(this.client, command, {
      expiresIn: ttl,
    });

    return { downloadUrl, expiresAt };
  }

  async putObject(
    key: string,
    buffer: Buffer,
    mimeType: string,
    options?: StorageObjectOptions & { originalFilename?: string },
  ): Promise<void> {
    const visibility = visibilityFromOption(options?.visibility);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketFor(visibility),
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentDisposition: "attachment",
        Metadata: {
          originalFilename: path.basename(options?.originalFilename ?? key),
          checksum: createHash("sha256").update(buffer).digest("hex"),
        },
      }),
    );
  }

  async readObject(
    key: string,
    options?: StorageObjectOptions,
  ): Promise<Buffer> {
    const visibility = visibilityFromOption(options?.visibility);
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucketFor(visibility), Key: key }),
    );
    return bodyToBuffer(result.Body);
  }

  async delete(key: string, options?: StorageObjectOptions): Promise<void> {
    const visibility = visibilityFromOption(options?.visibility);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketFor(visibility),
        Key: key,
      }),
    );
  }

  async exists(key: string, options?: StorageObjectOptions): Promise<boolean> {
    const visibility = visibilityFromOption(options?.visibility);
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketFor(visibility),
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      if (
        error instanceof S3ServiceException &&
        error.$metadata.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  async getMetadata(
    key: string,
    options?: StorageObjectOptions,
  ): Promise<ObjectMetadata> {
    const visibility = visibilityFromOption(options?.visibility);
    const result = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucketFor(visibility),
        Key: key,
      }),
    );
    return {
      size: result.ContentLength ?? 0,
      mimeType: result.ContentType ?? "application/octet-stream",
      createdAt: result.LastModified ?? new Date(),
    };
  }
}

// ---------------------------------------------------------------------------
// Factory and module-level singleton
// ---------------------------------------------------------------------------

export function createStorageProvider(
  overrides?: Partial<StorageConfig>,
): StorageProvider {
  const localPath = env.storage.localPath;
  const resolvedLocalPath = localPath?.startsWith(".")
    ? path.join(/* turbopackIgnore: true */ process.cwd(), localPath)
    : localPath;

  const defaults: StorageConfig = {
    provider: env.storage.provider,
    localPath: resolvedLocalPath,
    bucket: env.storage.bucket ?? env.storage.assetBucket,
    privateBucket: env.storage.privateBucket,
    region: env.storage.region,
    endpoint: env.storage.endpoint,
    cdnUrl: env.storage.cdnUrl,
  };

  const config: StorageConfig = { ...defaults, ...overrides };
  assertProductionStorageConfig(config);

  switch (config.provider) {
    case "local":
      return new LocalStorageProvider(config);
    case "s3":
      return new S3StorageProvider(config);
    case "gcs":
      throw new Error(
        "[storage] GCS is not yet implemented. Use s3-compatible mode with a GCS HMAC key pair.",
      );
    default:
      throw new Error(
        `[storage] Unknown provider: "${String((config as StorageConfig).provider)}"`,
      );
  }
}

// Module-level lazy singleton. Domain code that needs one shared provider
// across a request should call getStorageProvider(). Code that needs an
// isolated instance (tests, overrides) should call createStorageProvider() directly.
let _moduleProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!_moduleProvider) {
    _moduleProvider = createStorageProvider();
  }
  return _moduleProvider;
}

/**
 * Replaces the module-level provider singleton for test isolation.
 * Never call in production code.
 */
export function setStorageProviderForTests(
  provider: StorageProvider | null,
): void {
  _moduleProvider = provider;
}
