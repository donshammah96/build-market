import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * POST /api/uploads
 * Accepts multipart/form-data (Request.formData()) and writes files to /public/uploads.
 * Returns JSON: { success: true, uploaded: { <fieldName>: [{ originalName, url }, ...], ... } }
 *
 * NOTE:
 * - In production you may want to upload directly to cloud storage (S3/GCS) and return remote URLs.
 * - This implementation writes into 'public/uploads' so returned URLs are relative (e.g. /uploads/<file>).
 */

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');

    await fs.promises.mkdir(uploadDir, { recursive: true });

    const uploaded: Record<string, Array<{ originalName: string; url: string }>> = {};

    for (const [key, value] of form.entries()) {
      // value will be a File object for files
      // (Value may also be string fields; skip those)
      if (typeof value === 'object' && 'arrayBuffer' in value && typeof (value as any).name === 'string') {
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

    return NextResponse.json({ success: true, uploaded });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}