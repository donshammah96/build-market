import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { initializeCorrelationId, getClientLogger } from '@/app/lib/resilient-api';

const logger = getClientLogger();

/**
 * POST /api/uploads
 * Accepts multipart/form-data (Request.formData()) and writes files to /public/uploads.
 * Returns JSON: { success: true, data: { uploaded: { <fieldName>: [{ originalName, url }, ...], ... } } }
 *
 * NOTE:
 * - In production you may want to upload directly to cloud storage (S3/GCS) and return remote URLs.
 * - This implementation writes into 'public/uploads' so returned URLs are relative (e.g. /uploads/<file>).
 * - Requires authentication via Clerk.
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  // Rate limiting for uploads
  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `uploads:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many upload requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  try {
    const form = await req.formData();
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');

    await fs.promises.mkdir(uploadDir, { recursive: true });

    const uploaded: Record<string, Array<{ originalName: string; url: string }>> = {};

    for (const [key, value] of form.entries()) {
      // value will be a File object for files
      // (Value may also be string fields; skip those)
      if (typeof value === 'object' && 'arrayBuffer' in value && typeof (value as File).name === 'string') {
        const file = value as File;
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
      // ignore non-file fields
    }

    logger.info('Files uploaded successfully', {
      correlationId,
      userId: dbUserId,
      fileCount: Object.values(uploaded).flat().length,
    });

    return apiSuccess({ uploaded }, HttpStatus.OK);
  } catch (err) {
    logger.error('Upload error', err instanceof Error ? err : new Error(String(err)), {
      correlationId,
      userId: dbUserId,
    });
    return apiError('File upload failed', HttpStatus.INTERNAL_SERVER_ERROR);
  }
});
