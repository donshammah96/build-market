import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

/**
 * Storage abstraction layer for file uploads
 * Supports local filesystem (development) and can be extended for S3/cloud storage (production)
 */

export interface StorageConfig {
  provider: "local" | "s3" | "gcs";
  localPath?: string;
  bucket?: string;
  region?: string;
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

/**
 * Local filesystem storage provider
 * WARNING: Only suitable for development. Use S3/GCS in production.
 */
class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;
  private publicUrl: string;

  constructor(config: StorageConfig) {
    this.uploadDir =
      config.localPath || path.join(process.cwd(), "public", "uploads");
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
        JSON.stringify({ mimeType, originalFilename: filename })
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
  /* eslint-disable /typescript-eslint/no-unused-vars */
  constructor(_config: StorageConfig) {
    // TODO: Initialize S3 client
    throw new Error(
      "S3 storage provider not yet implemented. Use local storage for development.",
    );
  }

  async upload(
    _buffer: Buffer,
    _filename: string,
    _mimeType: string,
  ): Promise<UploadedFile> {
    throw new Error("Not implemented");
  }

  async delete(_key: string): Promise<void> {
    throw new Error("Not implemented");
  }

  async exists(_key: string): Promise<boolean> {
    throw new Error("Not implemented");
  }

  async getMetadata(
    _key: string,
  ): Promise<{ size: number; mimeType: string; createdAt: Date }> {
    throw new Error("Not implemented");
  }
  /* eslint-enable /typescript-eslint/no-unused-vars */
}

/**
 * Factory function to create storage provider based on configuration
 */
export function createStorageProvider(
  config?: Partial<StorageConfig>,
): StorageProvider {
  const defaultConfig: StorageConfig = {
    provider:
      (process.env.STORAGE_PROVIDER as "local" | "s3" | "gcs") || "local",
    localPath:
      process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads"),
    bucket: process.env.STORAGE_BUCKET,
    region: process.env.STORAGE_REGION,
    cdnUrl: process.env.CDN_URL || "/uploads",
  };

  const finalConfig = { ...defaultConfig, ...config };

  switch (finalConfig.provider) {
    case "local":
      return new LocalStorageProvider(finalConfig);
    case "s3":
    case "gcs":
      return new S3StorageProvider(finalConfig);
    default:
      return new LocalStorageProvider(finalConfig);
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
