import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, getClientLogger } from '@/app/lib/resilient-api';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const logger = getClientLogger();

// Upload directory path
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

/**
 * GET /api/uploads/[id]
 * Get metadata for a specific uploaded file
 * The [id] is the filename (e.g., "1702648000000-uuid.jpg")
 */
export const GET = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id: filename } = params!;

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `uploads_get:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching upload metadata', { correlationId, filename, userId: dbUserId });

  try {
    // Sanitize filename to prevent path traversal
    const sanitizedFilename = path.basename(filename);
    const filepath = path.join(UPLOAD_DIR, sanitizedFilename);

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      logger.warn('Upload not found', { correlationId, filename: sanitizedFilename });
      return apiError('File not found', HttpStatus.NOT_FOUND);
    }

    // Get file stats
    const stats = await fs.promises.stat(filepath);
    const ext = path.extname(sanitizedFilename).toLowerCase();

    // Determine MIME type
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const metadata = {
      filename: sanitizedFilename,
      url: `/uploads/${sanitizedFilename}`,
      size: stats.size,
      mimeType: mimeTypes[ext] || 'application/octet-stream',
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
    };

    logger.info('Upload metadata fetched successfully', { correlationId, filename: sanitizedFilename });

    return NextResponse.json({
      success: true,
      data: metadata,
      correlationId,
    });
  } catch (err) {
    logger.error('Error fetching upload', err instanceof Error ? err : new Error(String(err)), {
      correlationId,
      filename,
    });
    return apiError('Failed to fetch file metadata', HttpStatus.INTERNAL_SERVER_ERROR);
  }
});

/**
 * DELETE /api/uploads/[id]
 * Delete a specific uploaded file
 * The [id] is the filename (e.g., "1702648000000-uuid.jpg")
 */
export const DELETE = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id: filename } = params!;

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `uploads_delete:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Deleting upload', { correlationId, filename, userId: dbUserId });

  try {
    // Sanitize filename to prevent path traversal attacks
    const sanitizedFilename = path.basename(filename);
    const filepath = path.join(UPLOAD_DIR, sanitizedFilename);

    // Verify path is within upload directory (extra security)
    const resolvedPath = path.resolve(filepath);
    const resolvedUploadDir = path.resolve(UPLOAD_DIR);
    
    if (!resolvedPath.startsWith(resolvedUploadDir)) {
      logger.warn('Path traversal attempt blocked', { correlationId, filename, userId: dbUserId });
      return apiError('Invalid file path', HttpStatus.BAD_REQUEST);
    }

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      logger.warn('Upload not found for deletion', { correlationId, filename: sanitizedFilename });
      return apiError('File not found', HttpStatus.NOT_FOUND);
    }

    // Delete the file
    await fs.promises.unlink(filepath);

    logger.info('Upload deleted successfully', { correlationId, filename: sanitizedFilename, userId: dbUserId });

    return NextResponse.json({
      success: true,
      data: { message: 'File deleted successfully', filename: sanitizedFilename },
      correlationId,
    });
  } catch (err) {
    logger.error('Error deleting upload', err instanceof Error ? err : new Error(String(err)), {
      correlationId,
      filename,
      userId: dbUserId,
    });
    return apiError('Failed to delete file', HttpStatus.INTERNAL_SERVER_ERROR);
  }
});
