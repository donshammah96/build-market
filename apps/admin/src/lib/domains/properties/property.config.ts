/**
 * Shared configuration constants for Property API routes.
 *
 * Centralizes settings used by properties/route.ts and properties/[id]/route.ts
 * to eliminate duplication and provide a single source of truth.
 *
 * Mirrors the pattern established by store.config.ts.
 */
export const PROPERTY_CONFIG = {
  /** Maximum request body size in bytes (1MB) */
  MAX_BODY_SIZE: 1024 * 1024,

  /** Maximum number of images per creation/update request */
  MAX_IMAGES_PER_REQUEST: 20,

  /** TTL in hours for idempotency keys before expiration */
  IDEMPOTENCY_KEY_TTL_HOURS: 24,

  /** Max retry attempts for optimistic lock conflicts */
  OPTIMISTIC_LOCK_MAX_RETRIES: 3,

  /** Base delay in ms between optimistic lock retries (multiplied by attempt) */
  OPTIMISTIC_LOCK_RETRY_DELAY_MS: 50,

  /** Maximum number of properties per batch creation request */
  MAX_BATCH_SIZE: 5,
} as const;

export type PropertyConfig = typeof PROPERTY_CONFIG;
