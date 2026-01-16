import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { initializeCorrelationId, getClientLogger } from '@/app/lib/resilient-api';

const logger = getClientLogger();

// =============================================================================
// Security Configuration
// =============================================================================

/**
 * Allowed MIME types for uploaded files.
 * Only images and PDFs are permitted for onboarding documents.
 */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

/**
 * Allowed file extensions (as fallback when MIME type detection fails)
 */
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

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
 * This provides deeper validation than just checking MIME type/extension.
 */
const FILE_SIGNATURES: Record<string, { bytes: number[]; offset?: number }[]> = {
  'image/jpeg': [
    { bytes: [0xFF, 0xD8, 0xFF] }, // JPEG/JFIF/Exif
  ],
  'image/png': [
    { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }, // PNG
  ],
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header (WebP starts with RIFF)
  ],
  'application/pdf': [
    { bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  ],
};

/**
 * Verify file content matches claimed type by checking magic bytes
 */
async function verifyFileSignature(file: File): Promise<{ valid: boolean; detectedType?: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 16)); // Read first 16 bytes
    
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
          // Special check for WebP - must have WEBP at bytes 8-11
          if (mimeType === 'image/webp') {
            const webpMarker = new TextDecoder().decode(buffer.slice(8, 12));
            if (webpMarker !== 'WEBP') {
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
      error: `Invalid file type: ${file.name}. Allowed: JPEG, PNG, WebP, PDF` 
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return { 
      valid: false, 
      error: `File too large: ${file.name} (${sizeMB}MB). Maximum: 10MB` 
    };
  }

  // Verify magic bytes match claimed type
  const signatureCheck = await verifyFileSignature(file);
  if (!signatureCheck.valid) {
    return {
      valid: false,
      error: `File content does not match type: ${file.name}. File may be corrupted or spoofed.`
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
 * Only requires Clerk authentication - does NOT require database user to exist.
 * 
 * Security:
 * - File type validation (JPEG, PNG, WebP, PDF only)
 * - File size limit (10MB per file)
 * - Max files per request (5)
 * - Rate limiting
 *
 * Returns: { success: true, data: { uploaded: { <fieldName>: [{ originalName, url }] } } }
 */
export async function POST(req: NextRequest) {
  const correlationId = initializeCorrelationId(req);

  try {
    // Get Clerk user ID - only requires Clerk auth, not DB user
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return apiError('Unauthorized. Please sign in.', HttpStatus.UNAUTHORIZED);
    }

    // Rate limiting for uploads
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `onboarding-uploads:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!rateLimitResult.success) {
      return apiError('Too many upload requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const form = await req.formData();
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');

    await fs.promises.mkdir(uploadDir, { recursive: true });

    // Collect all files first to validate count
    const files: Array<{ key: string; file: File }> = [];
    
    for (const [key, value] of form.entries()) {
      if (typeof value === 'object' && 'arrayBuffer' in value && typeof (value as File).name === 'string') {
        files.push({ key, file: value as File });
      }
    }

    // Check max files limit
    if (files.length > MAX_FILES_PER_REQUEST) {
      return apiError(
        `Too many files. Maximum ${MAX_FILES_PER_REQUEST} files per request.`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Validate all files before writing any
    const validationErrors: string[] = [];
    for (const { file } of files) {
      const result = await validateFile(file);
      if (!result.valid && result.error) {
        validationErrors.push(result.error);
      }
    }

    if (validationErrors.length > 0) {
      logger.warn('Upload validation failed', {
        correlationId,
        clerkId,
        errors: validationErrors,
      });
      return apiError(
        validationErrors.join('; '),
        HttpStatus.BAD_REQUEST
      );
    }

    // All files valid, proceed with upload
    const uploaded: Record<string, Array<{ originalName: string; url: string }>> = {};

    for (const { key, file } of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = path.extname(file.name) || '';
      const filename = `${Date.now()}-${randomUUID()}${ext}`;
      const filepath = path.join(uploadDir, filename);
      
      await fs.promises.writeFile(filepath, buffer);
      
      const url = `/uploads/${filename}`;
      if (!uploaded[key]) uploaded[key] = [];
      uploaded[key].push({ originalName: file.name, url });
    }

    logger.info('Onboarding files uploaded successfully', {
      correlationId,
      clerkId,
      fileCount: files.length,
      fieldNames: Object.keys(uploaded),
    });

    return apiSuccess({ uploaded }, HttpStatus.OK);
  } catch (err) {
    logger.error('Onboarding upload error', err instanceof Error ? err : new Error(String(err)), {
      correlationId,
    });
    return apiError('File upload failed', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

