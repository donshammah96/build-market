/**
 * Reusable API validation guards.
 *
 * Lightweight guard functions that return null (pass) or a NextResponse (fail).
 * Pattern matches existing request-utils.ts and can be used by any API route.
 */
import { NextRequest, NextResponse } from "next/server";
import { apiError, HttpStatus } from "./api-response";
import { STORE_CONFIG } from "@/lib/domains/stores/store.config";

/**
 * Guard: reject requests where Content-Length exceeds the given limit.
 *
 * /param req - Incoming request
 * /param maxSize - Maximum body size in bytes (defaults to STORE_CONFIG.MAX_BODY_SIZE)
 * /returns null if size is acceptable, or an error NextResponse
 */
export function checkBodySize(
  req: NextRequest,
  maxSize: number = STORE_CONFIG.MAX_BODY_SIZE,
): NextResponse | null {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    return apiError(
      `Request body too large. Maximum size is ${maxSize / 1024}KB`,
      413,
    ) as NextResponse;
  }
  return null;
}

/**
 * Guard: reject requests with too many images in the payload.
 *
 * /param images - Array of image objects (or undefined)
 * /param maxCount - Maximum allowed images (defaults to STORE_CONFIG.MAX_IMAGES_PER_REQUEST)
 * /returns null if count is acceptable, or an error NextResponse
 */
export function checkImageCount(
  images: unknown[] | undefined,
  maxCount: number = STORE_CONFIG.MAX_IMAGES_PER_REQUEST,
): NextResponse | null {
  if (images && images.length > maxCount) {
    return apiError(
      `Too many images. Maximum is ${maxCount}`,
      HttpStatus.BAD_REQUEST,
    ) as NextResponse;
  }
  return null;
}

/**
 * Type guard: validate that an ID parameter is a non-empty string.
 */
export function isValidId(id: string | undefined): id is string {
  return typeof id === "string" && id.length > 0;
}
