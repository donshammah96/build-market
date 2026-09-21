/**
 * Shared configuration constants for Professional Document & License API routes.
 *
 * Centralizes settings used by professional-portal/documents/ and
 * professional-portal/licenses/ routes.
 */
export const DOCUMENT_CONFIG = {
  /** Maximum request body size in bytes (1MB) */
  MAX_BODY_SIZE: 1024 * 1024,

  /** Maximum documents per professional */
  MAX_DOCUMENTS_PER_PROFESSIONAL: 50,

  /** Maximum licenses per professional */
  MAX_LICENSES_PER_PROFESSIONAL: 20,

  /** TTL in hours for idempotency keys */
  IDEMPOTENCY_KEY_TTL_HOURS: 24,

  /** Allowed MIME types for document uploads */
  ALLOWED_MIME_TYPES: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],

  /** Maximum file size in bytes (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
} as const;

export type DocumentConfig = typeof DOCUMENT_CONFIG;
