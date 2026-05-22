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
  /** Polling interval for pending uploads in ms (default: 1000) */
  pollIntervalMs?: number;
  /** Max polling attempts for pending uploads (default: 30) */
  maxPollingAttempts?: number;
  /** Use the direct private document flow when uploading credentials */
  directDocuments?: boolean;
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
  uploadId?: string;
  status?: "pending" | "processing" | "ready" | "failed";
  statusUrl?: string;
  url?: string;
  cdnUrl?: string;
  error?: string;
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

interface UploadStatusResponse {
  success?: boolean;
  data?: {
    status?: "pending" | "processing" | "ready" | "failed";
    uploadId?: string;
    error?: string;
    asset?: {
      assetId?: string;
      url?: string;
      cdnUrl?: string;
    };
  };
  error?: string;
  message?: string;
}

interface DirectPresignResponse {
  success?: boolean;
  data?: {
    uploadId?: string;
    uploadUrl?: string;
    key?: string;
    requiredHeaders?: Record<string, string>;
    expiresAt?: string;
  };
  error?: string;
  message?: string;
}

interface DirectConfirmResponse {
  success?: boolean;
  data?: {
    assetId?: string;
    visibility?: "PRIVATE";
  };
  error?: string;
  message?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_OPTIONS: Required<
  Omit<UploadOptions, "authToken" | "headers" | "signal" | "directDocuments">
> = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  endpoint: "/api/uploads",
  pollIntervalMs: 1000,
  maxPollingAttempts: 30,
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

async function sha256Hex(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new UploadError(
      "Browser crypto is unavailable for direct upload checksum calculation",
      UploadErrorCode.UNKNOWN,
    );
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    typeof file.arrayBuffer === "function"
      ? await file.arrayBuffer()
      : await new Response(file).arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function parseJsonOrError<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new UploadError(
      payload.error || payload.message || fallbackMessage,
      UploadErrorCode.SERVER_ERROR,
      response.status,
      payload,
    );
  }

  return payload as T;
}

function createLocalPreviewUrl(file: File): string {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(file);
  }
  return "";
}

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

async function pollPendingUpload(
  item: UploadedItem,
  options: Required<
    Omit<UploadOptions, "authToken" | "headers" | "signal" | "directDocuments">
  >,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ url: string; assetId: string }> {
  const statusUrl =
    item.statusUrl ||
    (item.uploadId ? `/api/uploads/${item.uploadId}` : undefined);

  if (!statusUrl) {
    throw new UploadError(
      "Pending upload is missing a status URL",
      UploadErrorCode.INVALID_RESPONSE,
      undefined,
      item,
    );
  }

  for (let attempt = 0; attempt < options.maxPollingAttempts; attempt++) {
    if (signal?.aborted) {
      throw new UploadError("Upload aborted", UploadErrorCode.ABORTED);
    }

    const response = await fetch(statusUrl, {
      method: "GET",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      signal,
    });

    const payload: UploadStatusResponse = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new UploadError(
        payload.error ||
          payload.message ||
          `Upload status check failed with status ${response.status}`,
        UploadErrorCode.SERVER_ERROR,
        response.status,
        payload,
      );
    }

    const status = payload.data?.status;
    if (status === "failed") {
      throw new UploadError(
        payload.data?.error || "Image processing failed",
        UploadErrorCode.SERVER_ERROR,
        response.status,
        payload,
      );
    }

    if (status === "ready") {
      const url = payload.data?.asset?.url || payload.data?.asset?.cdnUrl;
      const assetId = payload.data?.asset?.assetId;
      if (typeof url === "string" && typeof assetId === "string") {
        return { url, assetId };
      }

      throw new UploadError(
        "Upload finished but missing asset URL",
        UploadErrorCode.INVALID_RESPONSE,
        response.status,
        payload,
      );
    }

    await sleep(options.pollIntervalMs);
  }

  throw new UploadError(
    "Timed out while waiting for image processing",
    UploadErrorCode.MAX_RETRIES_EXCEEDED,
  );
}

async function parseUploadResponse(
  json: ApiUploadResponse,
  fieldName: string,
  options: Required<
    Omit<UploadOptions, "authToken" | "headers" | "signal" | "directDocuments">
  >,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ urls: string[]; assetIds: string[] }> {
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

  const urls: string[] = [];
  const assetIds: string[] = [];

  for (const item of items) {
    const immediateUrl = item?.url ?? item?.cdnUrl;
    if (
      typeof immediateUrl === "string" &&
      immediateUrl.length > 0 &&
      typeof item?.assetId === "string" &&
      item.assetId.length > 0
    ) {
      urls.push(immediateUrl);
      assetIds.push(item.assetId);
      continue;
    }

    if (item?.status === "pending" || item?.status === "processing") {
      const ready = await pollPendingUpload(item, options, headers, signal);
      urls.push(ready.url);
      assetIds.push(ready.assetId);
      continue;
    }

    if (item?.status === "failed") {
      throw new UploadError(
        item.error || "Image upload failed",
        UploadErrorCode.SERVER_ERROR,
      );
    }
  }

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
      const { urls, assetIds } = await parseUploadResponse(
        json,
        fieldName,
        config,
        headers,
        config.signal,
      );

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

export async function uploadFilesDirect(
  files: File[],
  fieldName: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  validateFiles(files, "documents");

  const headers: Record<string, string> = { ...options.headers };
  if (options.authToken) {
    headers["Authorization"] = `Bearer ${options.authToken}`;
  }

  const urls: string[] = [];
  const assetIds: string[] = [];
  const raw: unknown[] = [];

  for (const file of files) {
    if (options.signal?.aborted) {
      throw new UploadError("Upload aborted", UploadErrorCode.ABORTED);
    }

    const checksumSha256 = await sha256Hex(file);
    const presignResponse = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        checksumSha256,
        context: "document",
      }),
      signal: options.signal,
    });

    const presign = await parseJsonOrError<DirectPresignResponse>(
      presignResponse,
      "Failed to create upload URL",
    );
    const upload = presign.data;
    if (
      !upload?.uploadId ||
      !upload.uploadUrl ||
      !upload.requiredHeaders ||
      !upload.expiresAt
    ) {
      throw new UploadError(
        "Direct upload presign response was incomplete",
        UploadErrorCode.INVALID_RESPONSE,
        presignResponse.status,
        presign,
      );
    }

    const uploadResponse = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.requiredHeaders,
      body: file,
      signal: options.signal,
    });

    if (!uploadResponse.ok) {
      throw new UploadError(
        `Direct upload failed with status ${uploadResponse.status}`,
        UploadErrorCode.SERVER_ERROR,
        uploadResponse.status,
      );
    }

    const confirmResponse = await fetch("/api/uploads/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ uploadId: upload.uploadId }),
      signal: options.signal,
    });
    const confirmed = await parseJsonOrError<DirectConfirmResponse>(
      confirmResponse,
      "Failed to confirm upload",
    );

    const assetId = confirmed.data?.assetId;
    if (!assetId) {
      throw new UploadError(
        "Direct upload confirmation did not return an asset ID",
        UploadErrorCode.INVALID_RESPONSE,
        confirmResponse.status,
        confirmed,
      );
    }

    assetIds.push(assetId);
    urls.push(createLocalPreviewUrl(file));
    raw.push({ presign, confirmed });
  }

  return { urls, assetIds, raw: { fieldName, items: raw } };
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
  const result =
    options.directDocuments === false
      ? await uploadFiles([file], fieldName, options)
      : await uploadFilesDirect([file], fieldName, options);
  const assetId = result.assetIds[0];
  const url = result.urls[0] ?? "";
  if (!assetId) {
    throw new UploadError(
      "Upload did not return asset ID. The upload API may have changed.",
      UploadErrorCode.INVALID_RESPONSE,
    );
  }
  return { assetId, url };
}
