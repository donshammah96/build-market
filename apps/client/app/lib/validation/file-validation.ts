/**
 * File validation utilities for uploads
 * Implements security best practices including magic number verification
 */

export interface ValidationConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  checkMagicNumbers?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: string;
}

/**
 * Magic numbers (file signatures) for common file types
 * Used to verify actual file content matches declared MIME type
 */
const MAGIC_NUMBERS: Record<
  string,
  { signature: number[]; offset: number; mimeType: string }[]
> = {
  // Images
  "image/jpeg": [
    { signature: [0xff, 0xd8, 0xff], offset: 0, mimeType: "image/jpeg" },
  ],
  "image/png": [
    {
      signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      offset: 0,
      mimeType: "image/png",
    },
  ],
  "image/gif": [
    {
      signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      offset: 0,
      mimeType: "image/gif",
    }, // GIF87a
    {
      signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
      offset: 0,
      mimeType: "image/gif",
    }, // GIF89a
  ],
  "image/webp": [
    { signature: [0x52, 0x49, 0x46, 0x46], offset: 0, mimeType: "image/webp" }, // RIFF
    // WebP files also have "WEBP" at offset 8, but checking RIFF is sufficient
  ],
  // Documents
  "application/pdf": [
    {
      signature: [0x25, 0x50, 0x44, 0x46],
      offset: 0,
      mimeType: "application/pdf",
    }, // %PDF
  ],
  "application/zip": [
    {
      signature: [0x50, 0x4b, 0x03, 0x04],
      offset: 0,
      mimeType: "application/zip",
    }, // PK
    {
      signature: [0x50, 0x4b, 0x05, 0x06],
      offset: 0,
      mimeType: "application/zip",
    }, // Empty archive
    {
      signature: [0x50, 0x4b, 0x07, 0x08],
      offset: 0,
      mimeType: "application/zip",
    }, // Spanned
  ],
  // MS Office (DOCX, XLSX are ZIP-based)
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    {
      signature: [0x50, 0x4b, 0x03, 0x04],
      offset: 0,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    {
      signature: [0x50, 0x4b, 0x03, 0x04],
      offset: 0,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  ],
  // Old MS Office
  "application/msword": [
    {
      signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
      offset: 0,
      mimeType: "application/msword",
    },
  ],
};

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  allowedExtensions: [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".pdf",
    ".doc",
    ".docx",
    ".xlsx",
  ],
  checkMagicNumbers: true,
};

/**
 * Configuration for different upload contexts
 */
export const VALIDATION_PROFILES: Record<string, ValidationConfig> = {
  image: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
    checkMagicNumbers: true,
  },
  document: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    allowedExtensions: [".pdf", ".doc", ".docx"],
    checkMagicNumbers: true,
  },
  avatar: {
    maxFileSize: 2 * 1024 * 1024, // 2MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
    checkMagicNumbers: true,
  },
};

/**
 * Check if buffer matches any of the magic number signatures for a MIME type
 */
function checkMagicNumber(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_NUMBERS[mimeType];
  if (!signatures) return false;

  for (const { signature, offset } of signatures) {
    let matches = true;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[offset + i] !== signature[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }

  return false;
}

/**
 * Detect MIME type from buffer using magic numbers
 */
function detectMimeType(buffer: Buffer): string | null {
  for (const [mimeType, signatures] of Object.entries(MAGIC_NUMBERS)) {
    for (const { signature, offset } of signatures) {
      let matches = true;
      for (let i = 0; i < signature.length; i++) {
        if (buffer[offset + i] !== signature[i]) {
          matches = false;
          break;
        }
      }
      if (matches) return mimeType;
    }
  }
  return null;
}

/**
 * Validate a file upload
 */
export function validateFile(
  file: { name: string; size: number; type: string },
  buffer: Buffer,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG,
): ValidationResult {
  // Check file size
  if (file.size > config.maxFileSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${Math.round(config.maxFileSize / 1024 / 1024)}MB`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: "File is empty",
    };
  }

  // Check MIME type
  if (!config.allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type '${file.type}' is not allowed. Allowed types: ${config.allowedMimeTypes.join(", ")}`,
    };
  }

  // Check file extension
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext || !config.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `File extension '${ext}' is not allowed. Allowed extensions: ${config.allowedExtensions.join(", ")}`,
    };
  }

  // Check magic numbers (verify content matches declared type)
  if (config.checkMagicNumbers && buffer.length > 0) {
    const detectedType = detectMimeType(buffer);

    // Special case: DOCX/XLSX are ZIP files, so detected type will be zip
    const isOfficeDoc = file.type.includes("openxmlformats");
    const isZipDetected = detectedType === "application/zip";

    if (!isOfficeDoc || !isZipDetected) {
      // For non-Office files, detected type should match declared type
      if (!checkMagicNumber(buffer, file.type)) {
        return {
          valid: false,
          error: `File content does not match declared type '${file.type}'. Possible file type spoofing.`,
          detectedMimeType: detectedType || "unknown",
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  let sanitized = filename.replace(/^.*[\\/]/, "");

  // Remove dangerous characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.match(/\.[^.]+$/)?.[0] || "";
    sanitized = sanitized.substring(0, 255 - ext.length) + ext;
  }

  return sanitized;
}

/**
 * Check if file is an image
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Check if file should be scanned for viruses
 * (All uploaded files should be scanned in production)
 */
// eslint-disable-next-line /typescript-eslint/no-unused-vars
export function requiresVirusScan(_mimeType: string): boolean {
  // In production, ALL files should be scanned
  // For development, you might skip images
  return true;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
}

/**
 * Get validation config for a specific upload context
 */
export function getValidationConfig(
  context: "image" | "document" | "avatar" | "default",
): ValidationConfig {
  if (context === "default") return DEFAULT_VALIDATION_CONFIG;
  const config = VALIDATION_PROFILES[context];
  return config ?? DEFAULT_VALIDATION_CONFIG;
}
