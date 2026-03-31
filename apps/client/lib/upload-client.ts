/**
 * Upload Client
 *
 * Browser-side client for uploading files to /api/uploads.
 * Provides retry logic, typed errors, and validation.
 *
 * For pure URL utilities (e.g. isLocalUpload), use lib/utils/upload.ts.
 */

// ============================================================================
// TYPES
// ============================================================================

export enum UploadErrorCode {
  /** Network error or fetch failed */
  NETWORK_ERROR = "NETWORK_ERROR",
  /** Server returned non-2xx status */
  SERVER_ERROR = "SERVER_ERROR",
  /** Response format was unexpected */
  INVALID_RESPONSE = "INVALID_RESPONSE",
  /** File validation failed (size, type, etc.) */
  VALIDATION_ERROR = "VALIDATION_ERROR",
  /** Max retries exceeded */
  MAX_RETRIES_EXCEEDED = "MAX_RETRIES_EXCEEDED",
  /** Request was aborted */
  ABORTED = "ABORTED",
  /** Unknown error */
  UNKNOWN = "UNKNOWN",
}

export class UploadError extends Error {
  code: UploadErrorCode;
  statusCode?: number;
  details?: unknown;

  constructor(
    message: string,
    code: UploadErrorCode,
    statusCode?: number,
    details?: unknown,
  ) {
    super(message);
    this.name = "UploadError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface UploadOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay between retries in ms (default: 1000) */
  retryDelay?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Authorization token (optional) */
  authToken?: string;
  /** Additional headers to include */
  headers?: Record<string, string>;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Upload endpoint (default: /api/uploads) */
  endpoint?: string;
}

export interface UploadResult {
  /** Array of uploaded file URLs (cdnUrl) */
  urls: string[];
  /** Array of asset IDs (UUIDs) for linking to documents/certificates/licenses */
  assetIds: string[];
  /** Raw response data from the server */
  raw?: unknown;
}

/** Upload API returns a flat array of results per file */
interface UploadedItem {
  fieldName?: string;
  assetId?: string;
  url?: string;
  cdnUrl?: string;
}

/** Expected API response structure (flat array or legacy keyed format) */
interface ApiUploadResponse {
  data?: {
    uploaded?: UploadedItem[] | Record<string, UploadedItem[]>;
  };
  /** Some APIs return uploaded at root */
  uploaded?: UploadedItem[] | Record<string, UploadedItem[]>;
  error?: string;
  message?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_OPTIONS: Required<
  Omit<UploadOptions, "authToken" | "headers" | "signal">
> = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  endpoint: "/api/uploads",
};

/** File size limits (in bytes) */
export const FILE_LIMITS = {
  IMAGE_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  DOCUMENT_MAX_SIZE: 25 * 1024 * 1024, // 25MB
  MAX_FILES_PER_UPLOAD: 10,
} as const;

/** Allowed file types */
export const ALLOWED_FILE_TYPES = {
  images: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"],
  documents: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
} as const;

// ============================================================================
// HELPERS
// ============================================================================

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof UploadError) {
    return (
      error.code === UploadErrorCode.NETWORK_ERROR ||
      (error.code === UploadErrorCode.SERVER_ERROR &&
        error.statusCode !== undefined &&
        error.statusCode >= 500)
    );
  }
  return false;
};

export const validateFiles = (
  files: File[],
  type: "images" | "documents",
): void => {
  if (files.length === 0) {
    throw new UploadError(
      "No files provided",
      UploadErrorCode.VALIDATION_ERROR,
    );
  }

  if (files.length > FILE_LIMITS.MAX_FILES_PER_UPLOAD) {
    throw new UploadError(
      `Cannot upload more than ${FILE_LIMITS.MAX_FILES_PER_UPLOAD} files at once`,
      UploadErrorCode.VALIDATION_ERROR,
    );
  }

  const maxSize =
    type === "images"
      ? FILE_LIMITS.IMAGE_MAX_SIZE
      : FILE_LIMITS.DOCUMENT_MAX_SIZE;
  const allowedTypes = ALLOWED_FILE_TYPES[type];

  for (const file of files) {
    if (!(allowedTypes as readonly string[]).includes(file.type)) {
      throw new UploadError(
        `File "${file.name}" has an invalid type. Allowed: ${allowedTypes.join(", ")}`,
        UploadErrorCode.VALIDATION_ERROR,
      );
    }

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      throw new UploadError(
        `File "${file.name}" exceeds the maximum size of ${maxSizeMB}MB`,
        UploadErrorCode.VALIDATION_ERROR,
      );
    }
  }
};

function parseUploadResponse(
  json: ApiUploadResponse,
  fieldName: string,
): { urls: string[]; assetIds: string[] } {
  if (json.error || json.message) {
    throw new UploadError(
      json.error || json.message || "Upload failed",
      UploadErrorCode.SERVER_ERROR,
    );
  }

  const rawUploaded = json.data?.uploaded ?? json.uploaded;
  let items: UploadedItem[] = [];

  if (Array.isArray(rawUploaded)) {
    items = rawUploaded.filter(
      (item) => item?.fieldName === fieldName,
    ) as UploadedItem[];
  } else if (
    rawUploaded &&
    typeof rawUploaded === "object" &&
    Array.isArray(rawUploaded[fieldName])
  ) {
    items = rawUploaded[fieldName] as UploadedItem[];
  }

  const urls = items
    .map((item) => item?.url ?? item?.cdnUrl)
    .filter((url): url is string => typeof url === "string" && url.length > 0);

  const assetIds = items
    .map((item) => item?.assetId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (urls.length === 0) {
    throw new UploadError(
      "No valid URLs returned from upload",
      UploadErrorCode.INVALID_RESPONSE,
      undefined,
      json,
    );
  }

  return { urls, assetIds };
}

// ============================================================================
// MAIN UPLOAD FUNCTION
// ============================================================================

export async function uploadFiles(
  files: File[],
  fieldName: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: UploadError | null = null;
  let attempt = 0;

  while (attempt <= config.maxRetries) {
    try {
      if (config.signal?.aborted) {
        throw new UploadError("Upload aborted", UploadErrorCode.ABORTED);
      }

      const formData = new FormData();
      files.forEach((file) => formData.append(fieldName, file));

      const headers: Record<string, string> = { ...config.headers };
      if (config.authToken) {
        headers["Authorization"] = `Bearer ${config.authToken}`;
      }

      const response = await fetch(config.endpoint, {
        method: "POST",
        body: formData,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        signal: config.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new UploadError(
          text || `Upload failed with status ${response.status}`,
          UploadErrorCode.SERVER_ERROR,
          response.status,
        );
      }

      const json: ApiUploadResponse = await response.json();
      const { urls, assetIds } = parseUploadResponse(json, fieldName);

      return { urls, assetIds, raw: json };
    } catch (error) {
      if (error instanceof UploadError) {
        lastError = error;
      } else if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new UploadError("Upload aborted", UploadErrorCode.ABORTED);
        }
        lastError = new UploadError(
          error.message,
          UploadErrorCode.NETWORK_ERROR,
        );
      } else {
        lastError = new UploadError(
          "Unknown upload error",
          UploadErrorCode.UNKNOWN,
        );
      }

      if (attempt < config.maxRetries && isRetryableError(lastError)) {
        const delay =
          config.retryDelay * Math.pow(config.backoffMultiplier, attempt);
        console.warn(
          `Upload attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
          lastError.message,
        );
        await sleep(delay);
        attempt++;
      } else {
        break;
      }
    }
  }

  if (lastError) {
    if (lastError.code !== UploadErrorCode.MAX_RETRIES_EXCEEDED) {
      lastError = new UploadError(
        `Upload failed after ${config.maxRetries + 1} attempts: ${lastError.message}`,
        UploadErrorCode.MAX_RETRIES_EXCEEDED,
        lastError.statusCode,
        lastError.details,
      );
    }
    throw lastError;
  }

  throw new UploadError("Upload failed", UploadErrorCode.UNKNOWN);
}

export async function uploadFile(
  file: File,
  fieldName: string,
  options: UploadOptions = {},
): Promise<string> {
  const result = await uploadFiles([file], fieldName, options);
  const url = result.urls[0];
  if (!url) {
    throw new UploadError(
      "No URL returned from upload",
      UploadErrorCode.INVALID_RESPONSE,
    );
  }
  return url;
}

/**
 * Upload a single file for credential creation (document, certificate, license).
 * Returns both assetId (for API) and url (for preview).
 */
export async function uploadForCredential(
  file: File,
  fieldName = "documents",
  options: UploadOptions = {},
): Promise<{ assetId: string; url: string }> {
  validateFiles([file], "documents");
  const result = await uploadFiles([file], fieldName, options);
  const assetId = result.assetIds[0];
  const url = result.urls[0];
  if (!assetId || !url) {
    throw new UploadError(
      "Upload did not return asset ID. The upload API may have changed.",
      UploadErrorCode.INVALID_RESPONSE,
    );
  }
  return { assetId, url };
}
