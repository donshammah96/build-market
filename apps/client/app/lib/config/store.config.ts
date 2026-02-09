/**
 * Shared configuration constants for Store API routes.
 *
 * Centralizes settings used by both stores/route.ts and stores/[id]/route.ts
 * to eliminate duplication and provide a single source of truth.
 */
export const STORE_CONFIG = {
  /** Maximum request body size in bytes (1MB) */
  MAX_BODY_SIZE: 1024 * 1024,

  /** Maximum number of images per update request */
  MAX_IMAGES_PER_REQUEST: 10,

  /** TTL in hours for idempotency keys before expiration */
  IDEMPOTENCY_KEY_TTL_HOURS: 24,

  /** Max retry attempts for optimistic lock conflicts */
  OPTIMISTIC_LOCK_MAX_RETRIES: 3,

  /** Base delay in ms between optimistic lock retries (multiplied by attempt) */
  OPTIMISTIC_LOCK_RETRY_DELAY_MS: 50,
} as const;

export type StoreConfig = typeof STORE_CONFIG;
