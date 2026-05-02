import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { env } from "@/app/lib/infrastructure/env";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

/**
 * Storage abstraction layer for file uploads
 * Supports local filesystem (development) and can be extended for S3/cloud storage (production)
 */

export interface StorageConfig {
  provider: "local" | "s3" | "gcs";
  localPath?: string;
  bucket?: string;
  region?: string;
  endpoint?: string;
  cdnUrl?: string;
}

export interface UploadedFile {
  key: string;
  url: string;
  cdnUrl?: string;
  checksum: string;
  size: number;
  bucket: string;
}

export interface StorageProvider {
  upload(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<UploadedFile>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getMetadata(
    key: string,
  ): Promise<{ size: number; mimeType: string; createdAt: Date }>;
}

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

function joinCdnUrl(baseUrl: string, key: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${key}`;
}

function buildUploadObjectKey(filename: string): string {
  const now = new Date();
  const ext = path.extname(filename).toLowerCase();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `uploads/${year}/${month}/${randomUUID()}${ext}`;
}

function assertProductionStorageConfig(config: StorageConfig): void {
  if (!env.isProd) {
    return;
  }

  if (config.provider === "local") {
    throw new Error(
      "Unsafe production storage configuration: local storage provider is prohibited in production.",
    );
  }

  if (config.provider === "s3") {
    if (!config.endpoint || !isAbsoluteHttpUrl(config.endpoint)) {
      throw new Error(
        "Unsafe production storage configuration: S3-compatible endpoint must be an absolute remote origin in production.",
      );
    }

    if (!env.storage.accessKeyId || !env.storage.secretAccessKey) {
      throw new Error(
        "Unsafe production storage configuration: remote storage credentials are required in production.",
      );
    }
  }

  const cdnUrl = config.cdnUrl;
  if (!cdnUrl || !isAbsoluteHttpUrl(cdnUrl)) {
    throw new Error(
      "Unsafe production storage configuration: CDN URL must be an absolute remote origin in production.",
    );
  }

  if (isSameOrigin(cdnUrl, env.appUrl) || isSameOrigin(cdnUrl, env.apiUrl)) {
    throw new Error(
      "Unsafe production storage configuration: uploaded content must not be served from the application origin.",
    );
  }
}

/**
 * Local filesystem storage provider
 * WARNING: Only suitable for development. Use S3/GCS in production.
 */
class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;
  private publicUrl: string;

  constructor(config: StorageConfig) {
    this.uploadDir =
      config.localPath ||
      path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads");
    this.publicUrl = config.cdnUrl || "/uploads";

    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<UploadedFile> {
    // Generate checksum for deduplication
    const checksum = createHash("sha256").update(buffer).digest("hex");

    // Generate unique key
    const ext = path.extname(filename);
    const uniqueFilename = `${Date.now()}-${randomUUID()}${ext}`;
    const filepath = path.join(this.uploadDir, uniqueFilename);

    // Write file
    await fs.promises.writeFile(filepath, buffer);

    // Optional: Store MIME type in a metadata file for later retrieval
    const metadataPath = `${filepath}.meta.json`;
    await fs.promises.writeFile(
      metadataPath,
      JSON.stringify({ mimeType, originalFilename: filename }),
    );

    return {
      key: uniqueFilename,
      url: `${this.publicUrl}/${uniqueFilename}`,
      cdnUrl: `${this.publicUrl}/${uniqueFilename}`,
      checksum,
      size: buffer.length,
      bucket: "local",
    };
  }

  async delete(key: string): Promise<void> {
    const filepath = path.join(this.uploadDir, path.basename(key));

    // Verify path is within upload directory
    const resolvedPath = path.resolve(filepath);
    const resolvedUploadDir = path.resolve(this.uploadDir);

    if (!resolvedPath.startsWith(resolvedUploadDir)) {
      throw new Error("Invalid file path");
    }

    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const filepath = path.join(this.uploadDir, path.basename(key));
    return fs.existsSync(filepath);
  }

  async getMetadata(
    key: string,
  ): Promise<{ size: number; mimeType: string; createdAt: Date }> {
    const filepath = path.join(this.uploadDir, path.basename(key));
    const stats = await fs.promises.stat(filepath);

    // Determine MIME type from extension
    const ext = path.extname(key).toLowerCase();
    const mimeTypes: Record<string, string> = {
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

    return {
      size: stats.size,
      mimeType: mimeTypes[ext] || "application/octet-stream",
      createdAt: stats.birthtime,
    };
  }
}

/**
 * S3-compatible storage provider (for production)
 * TODO: Implement using AWS SDK or MinIO client
 */
class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string;
  private readonly publicUrl: string;

  constructor(config: StorageConfig) {
    if (!config.bucket) {
      throw new Error(
        "S3 storage configuration requires STORAGE_BUCKET for remote uploads.",
      );
    }

    if (!config.cdnUrl || !isAbsoluteHttpUrl(config.cdnUrl)) {
      throw new Error("S3 storage configuration requires an absolute CDN_URL.");
    }

    if (!config.endpoint || !isAbsoluteHttpUrl(config.endpoint)) {
      throw new Error(
        "S3 storage configuration requires an absolute R2 endpoint (R2_ENDPOINT or S3_URL).",
      );
    }

    this.bucket = config.bucket;
    this.region = config.region || env.storage.region || "eu";
    this.endpoint = config.endpoint;
    this.publicUrl = config.cdnUrl.replace(/\/+$/, "");

    const credentials =
      env.storage.accessKeyId && env.storage.secretAccessKey
        ? {
            accessKeyId: env.storage.accessKeyId,
            secretAccessKey: env.storage.secretAccessKey,
          }
        : undefined;

    this.client = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      ...(credentials ? { credentials } : {}),
    });
  }

  async upload(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<UploadedFile> {
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const key = buildUploadObjectKey(filename);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentDisposition: "attachment",
        Metadata: {
          originalFilename: path.basename(filename),
          checksum,
        },
      }),
    );

    const url = joinCdnUrl(this.publicUrl, key);

    return {
      key,
      url,
      cdnUrl: url,
      checksum,
      size: buffer.length,
      bucket: this.bucket,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      // Only treat a 404 as "does not exist". Any other error (403 Forbidden,
      // network failure, throttling) means we genuinely don't know whether the
      // object exists and should propagate the failure rather than silently
      // returning false, which could lead to orphaned objects never being
      // cleaned up or double-writes on top of existing objects.
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
  ): Promise<{ size: number; mimeType: string; createdAt: Date }> {
    const result = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    return {
      size: result.ContentLength ?? 0,
      mimeType: result.ContentType || "application/octet-stream",
      createdAt: result.LastModified || new Date(),
    };
  }
}

/**
 * Factory function to create storage provider based on configuration
 */
export function createStorageProvider(
  config?: Partial<StorageConfig>,
): StorageProvider {
  const defaultConfig: StorageConfig = {
    provider: env.storage.provider,
    localPath: env.storage.localPath.startsWith(".")
      ? path.join(
          /*turbopackIgnore: true*/ process.cwd(),
          env.storage.localPath,
        )
      : env.storage.localPath,
    bucket: env.storage.bucket || env.storage.assetBucket,
    region: env.storage.region,
    endpoint: env.storage.endpoint,
    cdnUrl: env.storage.cdnUrl,
  };

  const finalConfig = { ...defaultConfig, ...config };
  assertProductionStorageConfig(finalConfig);

  switch (finalConfig.provider) {
    case "local":
      return new LocalStorageProvider(finalConfig);
    case "s3":
      return new S3StorageProvider(finalConfig);
    case "gcs":
      throw new Error(
        `Unsupported storage provider: ${String(finalConfig.provider)}`,
      );
    default:
      throw new Error(
        `Unsupported storage provider: ${String(finalConfig.provider)}`,
      );
  }
}

/**
 * Get default storage provider instance
 */
let defaultProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!defaultProvider) {
    defaultProvider = createStorageProvider();
  }
  return defaultProvider;
}
