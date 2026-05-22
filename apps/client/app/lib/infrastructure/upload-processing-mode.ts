export const UPLOAD_PROCESSING_UNAVAILABLE_MESSAGE =
  "Upload processing is temporarily unavailable. Please retry.";

export function assertUploadProcessingModeInvariant(params: {
  isProd: boolean;
  uploadProcessInline: boolean;
}): void {
  if (params.isProd && params.uploadProcessInline) {
    throw new Error("UPLOAD_PROCESS_INLINE cannot be enabled in production.");
  }
}

export function shouldProcessUploadsInline(params: {
  isProd: boolean;
  uploadProcessInline: boolean;
}): boolean {
  assertUploadProcessingModeInvariant(params);
  return !params.isProd && params.uploadProcessInline;
}
