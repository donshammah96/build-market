/**
 * Shared configuration constants for Lead API routes.
 *
 * Centralizes settings used by professional-portal/leads/ routes.
 */
export const LEAD_CONFIG = {
  /** Maximum request body size in bytes (1MB) */
  MAX_BODY_SIZE: 1024 * 1024,

  /** Maximum page size for list queries */
  MAX_LIMIT: 100,

  /** Default page size */
  DEFAULT_LIMIT: 20,

  /** TTL in hours for idempotency keys */
  IDEMPOTENCY_KEY_TTL_HOURS: 24,
} as const;

/**
 * Client-safe configuration for leads-client.ts.
 */
export const LEADS_CLIENT_CONFIG = {
  /** Max concurrent operations in bulkhead */
  BULKHEAD_CONCURRENCY: 5,
} as const;

export type LeadConfig = typeof LEAD_CONFIG;
