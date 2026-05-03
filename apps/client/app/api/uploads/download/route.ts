import { NextRequest, NextResponse } from "next/server";
import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import { uploadService } from "@/app/lib/domains/uploads";
import type { StorageVisibility } from "@/app/lib/infrastructure/storage";
import { sanitizeFilename } from "@/app/lib/validation/file-validation";

function parseVisibility(value: string | null): StorageVisibility | null {
  if (value === "public" || value === "private") {
    return value;
  }
  return null;
}

function isValidStorageKey(value: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9._/-]{0,510}[A-Za-z0-9])?$/.test(value);
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const expiresAt = Number(req.nextUrl.searchParams.get("expires"));
  const visibility = parseVisibility(
    req.nextUrl.searchParams.get("visibility"),
  );
  const filename = req.nextUrl.searchParams.get("filename");

  if (
    !key ||
    !isValidStorageKey(key) ||
    !token ||
    !visibility ||
    !Number.isFinite(expiresAt)
  ) {
    return apiError("Invalid download URL", HttpStatus.BAD_REQUEST);
  }

  const result = await uploadService.getLocalDirectDownloadObject({
    key,
    token,
    expiresAt,
    visibility,
  });

  if (!result.ok) {
    const status =
      result.error === "forbidden"
        ? HttpStatus.FORBIDDEN
        : HttpStatus.NOT_FOUND;
    return apiError(result.message || "File not found", status);
  }

  const headers = new Headers({
    "Content-Type": result.data.mimeType,
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  });

  if (filename) {
    headers.set(
      "Content-Disposition",
      `attachment; filename="${sanitizeFilename(filename)}"`,
    );
  }

  return new NextResponse(new Uint8Array(result.data.buffer), {
    status: HttpStatus.OK,
    headers,
  });
}
