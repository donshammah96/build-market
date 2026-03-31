/**
 * Shared configuration constants for Project API routes.
 *
 * Centralizes settings used by professional-portal/projects/ routes.
 */
export const PROJECT_CONFIG = {
  /** Maximum request body size in bytes (1MB) */
  MAX_BODY_SIZE: 1024 * 1024,

  /** Maximum projects per page */
  MAX_LIMIT: 50,

  /** Default page size */
  DEFAULT_LIMIT: 20,

  /** TTL in hours for idempotency keys */
  IDEMPOTENCY_KEY_TTL_HOURS: 24,

  /** Maximum milestones per project */
  MAX_MILESTONES_PER_PROJECT: 50,

  /** Maximum documents per project */
  MAX_DOCUMENTS_PER_PROJECT: 100,

  /** Maximum images per project */
  MAX_IMAGES_PER_PROJECT: 200,

  /** Maximum images per single upload request */
  MAX_IMAGES_PER_REQUEST: 10,
} as const;

export type ProjectConfig = typeof PROJECT_CONFIG;
