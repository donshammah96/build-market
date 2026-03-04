/**
 * Upload Service
 *
 * Provides a robust file upload abstraction with:
 * - Retry logic with exponential backoff
 * - Typed error codes for better error handling
 * - Auth header support (e.g., JWT)
 * - Configurable options
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
  /** Array of uploaded file URLs */
  urls: string[];
  /** Raw response data from the server */
  raw?: unknown;
}

/** Expected API response structure */
interface ApiUploadResponse {
  data?: {
    uploaded?: Record<string, Array<{ url: string }>>;
  };
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

/**
 * Sleeps for the specified duration.
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Checks if an error is retryable (network issues, 5xx errors).
 */
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

/**
 * Validates files before upload.
 */
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

/**
 * Parses the upload API response.
 */
const parseResponse = (
  json: ApiUploadResponse,
  fieldName: string,
): string[] => {
  // Check for error in response
  if (json.error || json.message) {
    throw new UploadError(
      json.error || json.message || "Upload failed",
      UploadErrorCode.SERVER_ERROR,
    );
  }

  // Extract URLs from the expected structure
  const uploaded = json.data?.uploaded?.[fieldName];
  if (!uploaded || !Array.isArray(uploaded)) {
    throw new UploadError(
      `Invalid response format: expected data.uploaded.${fieldName} to be an array`,
      UploadErrorCode.INVALID_RESPONSE,
      undefined,
      json,
    );
  }

  const urls = uploaded
    .map((item) => item?.url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);

  if (urls.length === 0) {
    throw new UploadError(
      "No valid URLs returned from upload",
      UploadErrorCode.INVALID_RESPONSE,
      undefined,
      json,
    );
  }

  return urls;
};

// ============================================================================
// MAIN UPLOAD FUNCTION
// ============================================================================

/**
 * Uploads files to the server with retry logic and proper error handling.
 *
 * @param files - Array of files to upload
 * @param fieldName - The form field name (e.g., "images", "documents")
 * @param options - Upload configuration options
 * @returns Promise resolving to an UploadResult with URLs
 *
 * @example
 * ```ts
 * try {
 *   const result = await uploadFiles(files, "images", { maxRetries: 3 });
 *   console.log("Uploaded URLs:", result.urls);
 * } catch (error) {
 *   if (error instanceof UploadError) {
 *     switch (error.code) {
 *       case UploadErrorCode.VALIDATION_ERROR:
 *         // Handle validation error
 *         break;
 *       case UploadErrorCode.NETWORK_ERROR:
 *         // Handle network error
 *         break;
 *     }
 *   }
 * }
 * ```
 */
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
      // Check for abort signal
      if (config.signal?.aborted) {
        throw new UploadError("Upload aborted", UploadErrorCode.ABORTED);
      }

      // Build form data
      const formData = new FormData();
      files.forEach((file) => formData.append(fieldName, file));

      // Build headers
      const headers: Record<string, string> = { ...config.headers };
      if (config.authToken) {
        headers["Authorization"] = `Bearer ${config.authToken}`;
      }

      // Make the request
      const response = await fetch(config.endpoint, {
        method: "POST",
        body: formData,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        signal: config.signal,
      });

      // Handle non-OK responses
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new UploadError(
          text || `Upload failed with status ${response.status}`,
          UploadErrorCode.SERVER_ERROR,
          response.status,
        );
      }

      // Parse response
      const json: ApiUploadResponse = await response.json();
      const urls = parseResponse(json, fieldName);

      return { urls, raw: json };
    } catch (error) {
      // Convert to UploadError if needed
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

      // Check if we should retry
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

  // If we get here, all retries failed
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

/**
 * Uploads a single file and returns a single URL.
 */
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
 * Checks if a URL is a local upload (vs external URL).
 * Handles various patterns: /uploads/, relative paths, blob URLs.
 */
export function isLocalUpload(url: string): boolean {
  if (!url) return false;

  // Check for common local patterns
  return (
    url.startsWith("/uploads/") ||
    url.startsWith("/api/") ||
    url.startsWith("blob:") ||
    // Relative paths without protocol
    (!url.startsWith("http://") &&
      !url.startsWith("https://") &&
      !url.startsWith("data:"))
  );
}
