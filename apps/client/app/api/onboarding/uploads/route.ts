import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import {
  apiSuccess,
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";

const logger = getClientLogger();

// =============================================================================
// Security Configuration
// =============================================================================

/**
 * Allowed MIME types for uploaded files.
 * Only images and PDFs are permitted for onboarding documents.
 */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/**
 * Allowed file extensions (as fallback when MIME type detection fails)
 */
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

/**
 * Maximum file size: 10MB
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Maximum files per request
 */
const MAX_FILES_PER_REQUEST = 5;

// =============================================================================
// Validation Helpers
// =============================================================================

interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Magic bytes (file signatures) for allowed file types.
 * Provides deeper validation than just checking MIME type/extension.
 */
const FILE_SIGNATURES: Record<string, { bytes: number[]; offset?: number }[]> =
  {
    "image/jpeg": [
      { bytes: [0xff, 0xd8, 0xff] }, // JPEG/JFIF/Exif
    ],
    "image/png": [
      { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }, // PNG
    ],
    "image/webp": [
      { bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header (WebP starts with RIFF)
    ],
    "application/pdf": [
      { bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
    ],
  };

/**
 * Verify file content matches claimed type by checking magic bytes.
 * Prevents content-type spoofing attacks.
 */
async function verifyFileSignature(
  file: File,
): Promise<{ valid: boolean; detectedType?: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 16));

    for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
      for (const sig of signatures) {
        const offset = sig.offset || 0;
        let match = true;

        for (let i = 0; i < sig.bytes.length; i++) {
          if (bytes[offset + i] !== sig.bytes[i]) {
            match = false;
            break;
          }
        }

        if (match) {
          // Special check for WebP — must have WEBP at bytes 8-11
          if (mimeType === "image/webp") {
            const webpMarker = new TextDecoder().decode(buffer.slice(8, 12));
            if (webpMarker !== "WEBP") {
              continue;
            }
          }
          return { valid: true, detectedType: mimeType };
        }
      }
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
}

async function validateFile(file: File): Promise<FileValidationResult> {
  // Check MIME type
  const mimeType = file.type.toLowerCase();
  const extension = path.extname(file.name).toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(mimeType) && !ALLOWED_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.name}. Allowed: JPEG, PNG, WebP, PDF`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File too large: ${file.name} (${sizeMB}MB). Maximum: 10MB`,
    };
  }

  // Verify magic bytes match claimed type
  const signatureCheck = await verifyFileSignature(file);
  if (!signatureCheck.valid) {
    return {
      valid: false,
      error: `File content does not match type: ${file.name}. File may be corrupted or spoofed.`,
    };
  }

  return { valid: true };
}

// =============================================================================
// Route Handler
// =============================================================================

/**
 * POST /api/onboarding/uploads
 *
 * Secure upload endpoint for onboarding flow.
 * Only requires Clerk authentication — does NOT require database user to exist.
 *
 * Security:
 * - File type validation (JPEG, PNG, WebP, PDF only)
 * - Magic byte signature verification (prevents content-type spoofing)
 * - File size limit (10MB per file)
 * - Max files per request (5)
 * - Rate limiting
 *
 * NOTE: This endpoint writes to the local filesystem (`public/uploads/`).
 * For production deployments with serverless or multi-instance architectures,
 * migrate to cloud storage (e.g., S3/R2) with the centralized Asset model.
 *
 * Returns: { success: true, data: { uploaded: { <fieldName>: [{ originalName, url }] } } }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(req);

  // Get Clerk user ID — only requires Clerk auth, not DB user
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return apiError("Unauthorized. Please sign in.", HttpStatus.UNAUTHORIZED);
  }

  // Rate limiting for uploads
  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `onboarding-uploads:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many upload requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () => {
      const form = await req.formData();
      const uploadDir = path.join(process.cwd(), "public", "uploads");

      await fs.promises.mkdir(uploadDir, { recursive: true });

      // Collect all files first to validate count
      const files: Array<{ key: string; file: File }> = [];

      for (const [key, value] of form.entries()) {
        if (
          typeof value === "object" &&
          "arrayBuffer" in value &&
          typeof (value as File).name === "string"
        ) {
          files.push({ key, file: value as File });
        }
      }

      // Check max files limit
      if (files.length === 0) {
        return { _error: true as const, message: "No files provided", status: HttpStatus.BAD_REQUEST };
      }
      if (files.length > MAX_FILES_PER_REQUEST) {
        return {
          _error: true as const,
          message: `Too many files. Maximum ${MAX_FILES_PER_REQUEST} files per request.`,
          status: HttpStatus.BAD_REQUEST,
        };
      }

      // Validate all files before writing any (fail-fast)
      const validationErrors: string[] = [];
      for (const { file } of files) {
        const validResult = await validateFile(file);
        if (!validResult.valid && validResult.error) {
          validationErrors.push(validResult.error);
        }
      }

      if (validationErrors.length > 0) {
        logger.warn("Upload validation failed", {
          correlationId,
          clerkId,
          errors: validationErrors,
        });
        return {
          _error: true as const,
          message: validationErrors.join("; "),
          status: HttpStatus.BAD_REQUEST,
        };
      }

      // All files valid — proceed with upload
      const uploaded: Record<
        string,
        Array<{ originalName: string; url: string }>
      > = {};

      for (const { key, file } of files) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = path.extname(file.name) || "";
        const filename = `${Date.now()}-${randomUUID()}${ext}`;
        const filepath = path.join(uploadDir, filename);

        await fs.promises.writeFile(filepath, buffer);

        const url = `/uploads/${filename}`;
        if (!uploaded[key]) uploaded[key] = [];
        uploaded[key].push({ originalName: file.name, url });
      }

      logger.info("Onboarding files uploaded successfully", {
        correlationId,
        clerkId,
        fileCount: files.length,
        fieldNames: Object.keys(uploaded),
      });

      return { uploaded };
    },
    { operationName: "onboarding_upload" },
  );

  if (!result.success || !result.data) {
    logger.error("Onboarding upload failed", result.error, { correlationId });
    return apiError("File upload failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  // Handle validation errors returned from the executor
  if ("_error" in result.data && result.data._error) {
    return apiError(
      (result.data as { message: string }).message,
      (result.data as { status: number }).status,
    );
  }

  return apiSuccess(result.data, HttpStatus.OK);
}
