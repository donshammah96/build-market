export class ImageProcessingError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ImageProcessingError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnsupportedImageFormatError extends ImageProcessingError {
  constructor(
    public readonly detectedFormat: string | undefined,
    message?: string,
  ) {
    super(
      message ??
        `Unsupported image format: '${detectedFormat || "unknown"}'. Allowed formats: jpeg, png, webp, avif, heif/heic.`,
    );
    this.name = "UnsupportedImageFormatError";
  }
}

export class ImageDecompressionBombError extends ImageProcessingError {
  constructor(
    public readonly pixels: number,
    public readonly maxPixels: number,
  ) {
    super(
      `Image exceeds maximum input pixel allowance: ${pixels} pixels (max: ${maxPixels} pixels).`,
    );
    this.name = "ImageDecompressionBombError";
  }
}

export class SecurityScanError extends Error {
  constructor(
    message: string,
    public readonly details: {
      status: "INFECTED" | "ERROR";
      virusName?: string;
      threatCategory?: string;
      reason?: string;
    },
  ) {
    super(message);
    this.name = "SecurityScanError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
