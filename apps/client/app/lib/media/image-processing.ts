import sharp from "sharp";
import { encode } from "blurhash";

/**
 * Image processing utilities for thumbnails, compression, and blurhash generation
 */

export interface ImageProcessingResult {
  thumbnail?: {
    buffer: Buffer;
    width: number;
    height: number;
    size: number;
  };
  optimized: {
    buffer: Buffer;
    width: number;
    height: number;
    size: number;
  };
  blurHash?: string;
  metadata: {
    format: string;
    width: number;
    height: number;
    hasAlpha: boolean;
  };
}

export interface ProcessingOptions {
  generateThumbnail?: boolean;
  thumbnailSize?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  generateBlurHash?: boolean;
}

const DEFAULT_OPTIONS: ProcessingOptions = {
  generateThumbnail: true,
  thumbnailSize: 300,
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 85,
  generateBlurHash: true,
};

/**
 * Generate blurhash for image placeholder
 */
async function generateBlurHash(buffer: Buffer): Promise<string | undefined> {
  try {
    const tiny = await sharp(buffer)
      .ensureAlpha()
      .resize(32, 32, { fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!tiny.info.width || !tiny.info.height) {
      return undefined;
    }

    const pixels = new Uint8ClampedArray(
      tiny.data.buffer,
      tiny.data.byteOffset,
      tiny.data.byteLength,
    );

    return encode(pixels, tiny.info.width, tiny.info.height, 4, 3);
  } catch {
    return undefined;
  }
}

/**
 * Process an image: optimize, generate thumbnail, create blurhash
 */
export async function processImage(
  buffer: Buffer,
  options: ProcessingOptions = {},
): Promise<ImageProcessingResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get image metadata
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image: missing dimensions");
  }

  // Optimize main image
  let optimizedImage = sharp(buffer);

  // Resize if too large
  if (
    (opts.maxWidth && metadata.width > opts.maxWidth) ||
    (opts.maxHeight && metadata.height > opts.maxHeight)
  ) {
    optimizedImage = optimizedImage.resize(opts.maxWidth, opts.maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Apply compression based on format
  const format = metadata.format || "jpeg";
  switch (format) {
    case "jpeg":
      optimizedImage = optimizedImage.jpeg({
        quality: opts.quality,
        mozjpeg: true,
      });
      break;
    case "png":
      optimizedImage = optimizedImage.png({
        quality: opts.quality,
        compressionLevel: 9,
      });
      break;
    case "webp":
      optimizedImage = optimizedImage.webp({ quality: opts.quality });
      break;
    default:
      // Keep original format
      break;
  }

  const optimizedBuffer = await optimizedImage.toBuffer();
  const optimizedMetadata = await sharp(optimizedBuffer).metadata();

  const result: ImageProcessingResult = {
    optimized: {
      buffer: optimizedBuffer,
      width: optimizedMetadata.width || metadata.width,
      height: optimizedMetadata.height || metadata.height,
      size: optimizedBuffer.length,
    },
    metadata: {
      format: format,
      width: metadata.width,
      height: metadata.height,
      hasAlpha: metadata.hasAlpha || false,
    },
  };

  // Generate thumbnail
  if (opts.generateThumbnail) {
    const thumbnailBuffer = await sharp(buffer)
      .resize(opts.thumbnailSize, opts.thumbnailSize, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbMetadata = await sharp(thumbnailBuffer).metadata();

    result.thumbnail = {
      buffer: thumbnailBuffer,
      width: thumbMetadata.width || opts.thumbnailSize!,
      height: thumbMetadata.height || opts.thumbnailSize!,
      size: thumbnailBuffer.length,
    };
  }

  // Generate blurhash
  if (opts.generateBlurHash) {
    result.blurHash = await generateBlurHash(buffer);
  }

  return result;
}

/**
 * Check if buffer is a valid image
 */
export async function isValidImage(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    return !!(metadata.width && metadata.height);
  } catch {
    return false;
  }
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(
  buffer: Buffer,
): Promise<{ width: number; height: number } | null> {
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.width && metadata.height) {
      return { width: metadata.width, height: metadata.height };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Convert image to WebP format
 */
export async function convertToWebP(
  buffer: Buffer,
  quality: number = 85,
): Promise<Buffer> {
  return sharp(buffer).webp({ quality }).toBuffer();
}

/**
 * Create avatar from image (square crop, small size)
 */
export async function createAvatar(
  buffer: Buffer,
  size: number = 200,
): Promise<Buffer> {
  return sharp(buffer)
    .resize(size, size, {
      fit: "cover",
      position: "center",
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Calculate compression ratio
 */
export function getCompressionRatio(
  originalSize: number,
  compressedSize: number,
): number {
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
}
