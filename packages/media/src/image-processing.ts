import { encode } from "blurhash";
import pino from "pino";
import sharp, { type Sharp, type SharpOptions } from "sharp";
import {
  ImageDecompressionBombError,
  ImageProcessingError,
  UnsupportedImageFormatError,
} from "./errors.js";

const logger = pino({
  name: "build-media-image-processing",
  level: process.env.LOG_LEVEL || "info",
});

/**
 * Maximum allowed input pixels to protect against decompression/pixel bombs (e.g. ~16384x16384).
 */
export const MAX_INPUT_PIXELS = 268_402_689;

/**
 * Allowed input/output raster image formats.
 */
export const ALLOWED_IMAGE_FORMATS = new Set([
  "jpeg",
  "jpg",
  "png",
  "webp",
  "avif",
  "heif",
  "heic",
]);

/**
 * Creates a configured Sharp instance with decompression-bomb guards and fail-on-error.
 */
export async function createSafeSharp(
  input?: Buffer | Uint8Array | string,
  options?: SharpOptions,
): Promise<Sharp> {
  const safeOptions: SharpOptions = {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: "error",
    ...options,
  };
  return sharp(input, safeOptions);
}

export function getSharp(): typeof sharp {
  return sharp;
}

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
  thumbnailQuality?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  generateBlurHash?: boolean;
}

export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  generateThumbnail: true,
  thumbnailSize: 300,
  thumbnailQuality: 80,
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 85,
  generateBlurHash: true,
};

/**
 * Generate blurhash placeholder for image.
 */
export async function generateBlurHash(
  buffer: Buffer,
): Promise<string | undefined> {
  try {
    const pipeline = await createSafeSharp(buffer);
    const { data, info } = await pipeline
      .rotate()
      .ensureAlpha()
      .resize(32, 32, { fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height) {
      logger.warn({ info }, "Failed to extract valid dimensions for blurhash");
      return undefined;
    }

    const pixels = new Uint8ClampedArray(
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );

    return encode(pixels, info.width, info.height, 4, 3);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Blurhash generation failed",
    );
    return undefined;
  }
}

/**
 * Check if buffer is a valid, allowed image.
 */
export async function isValidImage(buffer: Buffer): Promise<boolean> {
  try {
    const pipeline = await createSafeSharp(buffer);
    const metadata = await pipeline.metadata();
    if (!metadata.width || !metadata.height || !metadata.format) {
      return false;
    }
    return ALLOWED_IMAGE_FORMATS.has(metadata.format.toLowerCase());
  } catch (err) {
    logger.debug(
      { err: err instanceof Error ? err.message : String(err) },
      "isValidImage check failed",
    );
    return false;
  }
}

/**
 * Extract image dimensions.
 */
export async function getImageDimensions(
  buffer: Buffer,
): Promise<{ width: number; height: number } | null> {
  try {
    const pipeline = await createSafeSharp(buffer);
    const metadata = await pipeline.metadata();
    if (metadata.width && metadata.height) {
      return { width: metadata.width, height: metadata.height };
    }
    return null;
  } catch (err) {
    logger.debug(
      { err: err instanceof Error ? err.message : String(err) },
      "getImageDimensions extraction failed",
    );
    return null;
  }
}

/**
 * Process image: validate format, auto-orient EXIF, resize, optimize, generate thumbnail & blurhash.
 */
export async function processImage(
  buffer: Buffer,
  options: ProcessingOptions = {},
): Promise<ImageProcessingResult> {
  const opts = { ...DEFAULT_PROCESSING_OPTIONS, ...options };

  // Read metadata & validate format
  const pipeline = await createSafeSharp(buffer);
  const metadata = await pipeline.metadata();

  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new ImageProcessingError(
      "Invalid image: missing dimensions or format",
    );
  }

  const rawFormat = metadata.format.toLowerCase();
  if (!ALLOWED_IMAGE_FORMATS.has(rawFormat)) {
    throw new UnsupportedImageFormatError(rawFormat);
  }

  if (metadata.pages && metadata.pages > 1) {
    throw new ImageProcessingError(
      "Animated / multi-frame images are not supported. Please upload a static image.",
    );
  }

  const totalPixels = metadata.width * metadata.height;
  if (totalPixels > MAX_INPUT_PIXELS) {
    throw new ImageDecompressionBombError(totalPixels, MAX_INPUT_PIXELS);
  }

  // Convert HEIC/HEIF to WebP for universal browser compatibility
  let targetFormat = rawFormat;
  if (rawFormat === "heif" || rawFormat === "heic") {
    targetFormat = "webp";
  }

  // Optimize primary image
  let optimizedPipeline = (await createSafeSharp(buffer)).rotate();

  // Resize if exceeds bounds
  if (
    (opts.maxWidth && metadata.width > opts.maxWidth) ||
    (opts.maxHeight && metadata.height > opts.maxHeight)
  ) {
    optimizedPipeline = optimizedPipeline.resize(
      opts.maxWidth,
      opts.maxHeight,
      {
        fit: "inside",
        withoutEnlargement: true,
      },
    );
  }

  // Format compression
  const quality = opts.quality ?? 85;
  switch (targetFormat) {
    case "jpeg":
    case "jpg":
      optimizedPipeline = optimizedPipeline.jpeg({
        quality,
        mozjpeg: true,
      });
      break;
    case "png":
      optimizedPipeline = optimizedPipeline.png({
        quality,
        palette: true,
        compressionLevel: 9,
      });
      break;
    case "webp":
      optimizedPipeline = optimizedPipeline.webp({ quality });
      break;
    case "avif":
      optimizedPipeline = optimizedPipeline.avif({ quality });
      break;
    default:
      break;
  }

  // Execute primary buffer export (single pass)
  const { data: optimizedBuffer, info: optimizedInfo } =
    await optimizedPipeline.toBuffer({ resolveWithObject: true });

  const result: ImageProcessingResult = {
    optimized: {
      buffer: optimizedBuffer,
      width: optimizedInfo.width,
      height: optimizedInfo.height,
      size: optimizedBuffer.length,
    },
    metadata: {
      format: targetFormat,
      width: metadata.width,
      height: metadata.height,
      hasAlpha: metadata.hasAlpha || false,
    },
  };

  // Generate thumbnail
  if (opts.generateThumbnail) {
    const thumbSize = opts.thumbnailSize ?? 300;
    const thumbQuality = opts.thumbnailQuality ?? 80;

    const thumbPipeline = (await createSafeSharp(buffer))
      .rotate()
      .resize(thumbSize, thumbSize, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: thumbQuality, mozjpeg: true });

    const { data: thumbBuffer, info: thumbInfo } = await thumbPipeline.toBuffer(
      { resolveWithObject: true },
    );

    result.thumbnail = {
      buffer: thumbBuffer,
      width: thumbInfo.width,
      height: thumbInfo.height,
      size: thumbBuffer.length,
    };
  }

  // Generate blurhash
  if (opts.generateBlurHash) {
    result.blurHash = await generateBlurHash(buffer);
  }

  return result;
}

/**
 * Convert image to WebP format.
 */
export async function convertToWebP(
  buffer: Buffer,
  quality: number = 85,
): Promise<Buffer> {
  const pipeline = await createSafeSharp(buffer);
  return pipeline.rotate().webp({ quality }).toBuffer();
}

/**
 * Create square avatar from image.
 */
export async function createAvatar(
  buffer: Buffer,
  size: number = 200,
): Promise<Buffer> {
  const pipeline = await createSafeSharp(buffer);
  return pipeline
    .rotate()
    .resize(size, size, {
      fit: "cover",
      position: "center",
    })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

/**
 * Calculate compression ratio.
 */
export function getCompressionRatio(
  originalSize: number,
  compressedSize: number,
): number {
  if (originalSize <= 0) return 0;
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
}
