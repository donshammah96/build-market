import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { decode } from "blurhash";
import { processImage } from "@/app/lib/media/image-processing";

async function createSampleImageBuffer(): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 48,
      channels: 3,
      background: { r: 120, g: 80, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

describe("image-processing blurhash", () => {
  it("generates a decodable blurhash when enabled", async () => {
    const buffer = await createSampleImageBuffer();

    const result = await processImage(buffer, {
      generateBlurHash: true,
      generateThumbnail: false,
    });

    expect(result.blurHash).toBeTruthy();

    const decoded = decode(result.blurHash!, 8, 8);
    expect(decoded).toBeInstanceOf(Uint8ClampedArray);
    expect(decoded.length).toBe(8 * 8 * 4);
  });

  it("does not generate blurhash when disabled", async () => {
    const buffer = await createSampleImageBuffer();

    const result = await processImage(buffer, {
      generateBlurHash: false,
      generateThumbnail: false,
    });

    expect(result.blurHash).toBeUndefined();
  });
});
