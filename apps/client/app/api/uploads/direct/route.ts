import { NextRequest } from "next/server";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { uploadService } from "@/app/lib/domains/uploads";
import type { StorageVisibility } from "@/app/lib/infrastructure/storage";

const DIRECT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

function parseVisibility(value: string | null): StorageVisibility | null {
  if (value === "public" || value === "private") {
    return value;
  }
  return null;
}

export async function PUT(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const expiresAt = Number(req.nextUrl.searchParams.get("expires"));
  const visibility = parseVisibility(
    req.nextUrl.searchParams.get("visibility"),
  );
  const mimeType = req.headers.get("Content-Type") ?? "";

  if (
    !key ||
    !token ||
    !visibility ||
    !mimeType ||
    !Number.isFinite(expiresAt)
  ) {
    return apiError("Invalid upload URL", HttpStatus.BAD_REQUEST);
  }

  const sizeGuard = checkBodySize(req, DIRECT_UPLOAD_MAX_BYTES);
  if (sizeGuard) {
    return sizeGuard;
  }

  const buffer = Buffer.from(await req.arrayBuffer());
  const result = await uploadService.putLocalDirectUploadObject({
    key,
    token,
    expiresAt,
    visibility,
    mimeType,
    buffer,
  });

  if (!result.ok) {
    const status =
      result.error === "forbidden"
        ? HttpStatus.FORBIDDEN
        : HttpStatus.INTERNAL_SERVER_ERROR;
    return apiError("Upload failed", status);
  }

  return apiSuccess({ uploaded: true }, HttpStatus.OK);
}
