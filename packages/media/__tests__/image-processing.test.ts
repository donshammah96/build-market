import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { decode } from "blurhash";
import {
  processImage,
  isValidImage,
  getImageDimensions,
  createAvatar,
  convertToWebP,
  getCompressionRatio,
  UnsupportedImageFormatError,
} from "../src/index.js";

async function createSampleImageBuffer(
  width = 64,
  height = 48,
  format: "png" | "jpeg" | "webp" = "png",
): Promise<Buffer> {
  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 80, b: 200 },
    },
  });

  if (format === "jpeg") {
    pipeline = pipeline.jpeg();
  } else if (format === "webp") {
    pipeline = pipeline.webp();
  } else {
    pipeline = pipeline.png();
  }

  return pipeline.toBuffer();
}

describe("@build/media image-processing", () => {
  it("generates a decodable blurhash and thumbnail when enabled", async () => {
    const buffer = await createSampleImageBuffer(100, 100);

    const result = await processImage(buffer, {
      generateBlurHash: true,
      generateThumbnail: true,
      thumbnailSize: 50,
    });

    expect(result.blurHash).toBeTruthy();
    const decoded = decode(result.blurHash!, 8, 8);
    expect(decoded).toBeInstanceOf(Uint8ClampedArray);
    expect(decoded.length).toBe(8 * 8 * 4);

    expect(result.thumbnail).toBeDefined();
    expect(result.thumbnail!.width).toBe(50);
    expect(result.thumbnail!.height).toBe(50);
    expect(result.optimized.buffer.length).toBeGreaterThan(0);
  });

  it("does not generate blurhash or thumbnail when disabled", async () => {
    const buffer = await createSampleImageBuffer(50, 50);

    const result = await processImage(buffer, {
      generateBlurHash: false,
      generateThumbnail: false,
    });

    expect(result.blurHash).toBeUndefined();
    expect(result.thumbnail).toBeUndefined();
    expect(result.optimized.width).toBe(50);
    expect(result.optimized.height).toBe(50);
  });

  it("resizes images larger than maxWidth/maxHeight", async () => {
    const buffer = await createSampleImageBuffer(800, 600);

    const result = await processImage(buffer, {
      maxWidth: 400,
      maxHeight: 300,
      generateThumbnail: false,
      generateBlurHash: false,
    });

    expect(result.optimized.width).toBe(400);
    expect(result.optimized.height).toBe(300);
  });

  it("validates image format correctly and extracts dimensions", async () => {
    const validBuffer = await createSampleImageBuffer(120, 80, "jpeg");
    expect(await isValidImage(validBuffer)).toBe(true);

    const dimensions = await getImageDimensions(validBuffer);
    expect(dimensions).toEqual({ width: 120, height: 80 });

    const textBuffer = Buffer.from("not an image");
    expect(await isValidImage(textBuffer)).toBe(false);
    expect(await getImageDimensions(textBuffer)).toBeNull();
  });

  it("throws UnsupportedImageFormatError on invalid / disallowed formats like gif or raw text", async () => {
    const textBuffer = Buffer.from("plain text data");
    await expect(processImage(textBuffer)).rejects.toThrow();

    const gifBuffer = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .gif()
      .toBuffer();

    await expect(processImage(gifBuffer)).rejects.toThrow(
      UnsupportedImageFormatError,
    );
  });

  it("creates avatar and converts to webp", async () => {
    const buffer = await createSampleImageBuffer(200, 150);
    const avatar = await createAvatar(buffer, 100);
    const avatarMeta = await sharp(avatar).metadata();

    expect(avatarMeta.width).toBe(100);
    expect(avatarMeta.height).toBe(100);

    const webp = await convertToWebP(buffer);
    const webpMeta = await sharp(webp).metadata();
    expect(webpMeta.format).toBe("webp");
  });

  it("calculates compression ratio accurately", () => {
    expect(getCompressionRatio(1000, 600)).toBe(40);
    expect(getCompressionRatio(0, 100)).toBe(0);
  });
});
